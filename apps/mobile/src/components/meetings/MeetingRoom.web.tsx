import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { DisconnectReason, Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { MEETING_CHAT_TOPIC, meetingChatMessageSchema } from '@workflex/shared';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { initials, timeLabel } from './meeting-format';
import type { ChatLine, MeetingRoomProps } from './room-types';

type Phase = 'connecting' | 'live' | 'reconnecting' | 'ended' | 'failed';
/** Why the call closed under someone: the host ended it, they joined again elsewhere, or the line dropped. */
type EndedBy = 'host' | 'other-device' | 'dropped';
type Panel = 'chat' | 'people' | null;

/**
 * The video room, browser version.
 *
 * LiveKit's JavaScript SDK does the calling: this connects with the pass the
 * server issued, turns the camera and microphone on, and draws what LiveKit
 * reports — who is in the room, who is speaking, whose camera and microphone
 * are on. In-call chat travels as LiveKit data messages, so it exists only
 * for the length of the call.
 *
 * It is written in DOM elements rather than React Native ones because video
 * and audio are browser things; the phone version is MeetingRoom.tsx, which
 * hands over to a page that runs this.
 */
export default function MeetingRoom({ url, token, title, onLeave }: MeetingRoomProps) {
  const t = useT();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [phase, setPhase] = useState<Phase>('connecting');
  const [endedBy, setEndedBy] = useState<EndedBy>('dropped');
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(wide ? 'chat' : null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  const roomRef = useRef<Room | null>(null);
  const panelRef = useRef<Panel>(panel);
  panelRef.current = panel;
  const chatEnd = useRef<HTMLDivElement>(null);

  // --- the call ---

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const sounds = new Set<HTMLMediaElement>();

    const bump = () => {
      if (!cancelled) redraw();
    };

    room
      .on(RoomEvent.ParticipantConnected, bump)
      .on(RoomEvent.ParticipantDisconnected, bump)
      .on(RoomEvent.TrackPublished, bump)
      .on(RoomEvent.TrackUnpublished, bump)
      .on(RoomEvent.TrackMuted, bump)
      .on(RoomEvent.TrackUnmuted, bump)
      .on(RoomEvent.LocalTrackPublished, bump)
      .on(RoomEvent.LocalTrackUnpublished, bump)
      .on(RoomEvent.ActiveSpeakersChanged, bump)
      .on(RoomEvent.TrackSubscribed, (track) => {
        // Sound has to be played by an element of its own; video is drawn by the tiles.
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
          sounds.add(el);
        }
        bump();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => {
          el.remove();
          sounds.delete(el);
        });
        bump();
      })
      // Browsers hold back sound until the page has been touched.
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setSoundBlocked(!room.canPlaybackAudio))
      .on(RoomEvent.Reconnecting, () => !cancelled && setPhase('reconnecting'))
      .on(RoomEvent.Reconnected, () => !cancelled && setPhase('live'))
      .on(RoomEvent.Disconnected, (reason) => {
        // Leaving on purpose is handled by whoever pressed Leave.
        if (cancelled || reason === DisconnectReason.CLIENT_INITIATED) return;
        setEndedBy(
          reason === DisconnectReason.ROOM_DELETED
            ? 'host'
            : reason === DisconnectReason.DUPLICATE_IDENTITY
              ? 'other-device'
              : 'dropped',
        );
        setPhase((p) => (p === 'failed' ? p : 'ended'));
      })
      .on(RoomEvent.MediaDevicesError, () => !cancelled && setNotice(t('meetings.call.noDevices')))
      .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (topic !== MEETING_CHAT_TOPIC) return;
        try {
          const parsed = meetingChatMessageSchema.safeParse(
            JSON.parse(new TextDecoder().decode(payload)),
          );
          if (!parsed.success) return;
          setLines((all) => [
            ...all,
            { ...parsed.data, from: participant?.name || participant?.identity || '—', mine: false },
          ]);
          if (panelRef.current !== 'chat') setUnread((n) => n + 1);
        } catch {
          // Not one of ours.
        }
      });

    (async () => {
      try {
        await room.connect(url, token);
        if (cancelled) {
          void room.disconnect();
          return;
        }
        setPhase('live');
        setSoundBlocked(!room.canPlaybackAudio);
        try {
          await room.localParticipant.enableCameraAndMicrophone();
        } catch {
          // No camera, or it was refused: sound alone is still a meeting.
          setNotice(t('meetings.call.noDevices'));
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch {
            // Neither; they can still listen and chat.
          }
        }
        bump();
      } catch (err) {
        if (cancelled) return;
        setPhase('failed');
        setProblem(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
      sounds.forEach((el) => el.remove());
      roomRef.current = null;
    };
    // `t` changes only with the language, and reconnecting for that would drop the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, attempt]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'end' });
  }, [lines, panel]);

  const room = roomRef.current;
  const local = room?.localParticipant;
  const others = room ? Array.from(room.remoteParticipants.values()) : [];
  const everyone: Participant[] = local ? [local, ...others] : [];

  // --- actions ---

  const toggleMic = () => void local?.setMicrophoneEnabled(!local.isMicrophoneEnabled).then(redraw).catch(() => setNotice(t('meetings.call.noDevices')));
  const toggleCamera = () => void local?.setCameraEnabled(!local.isCameraEnabled).then(redraw).catch(() => setNotice(t('meetings.call.noDevices')));
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const toggleShare = () => void local?.setScreenShareEnabled(!local.isScreenShareEnabled).then(redraw).catch(() => undefined);

  const leave = () => {
    void roomRef.current?.disconnect();
    onLeave();
  };

  const openPanel = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
    if (next === 'chat') setUnread(0);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !local) return;
    const line = { id: newId(), text, ts: Date.now() };
    try {
      await local.publishData(new TextEncoder().encode(JSON.stringify(line)), {
        reliable: true,
        topic: MEETING_CHAT_TOPIC,
      });
      setLines((all) => [...all, { ...line, from: local.name || t('meetings.call.you'), mine: true }]);
      setDraft('');
    } catch {
      setNotice(t('meetings.call.error'));
    }
  };

  // --- pieces ---

  const round = (on: boolean, danger?: boolean): CSSProperties => ({
    width: 46,
    height: 46,
    borderRadius: 23,
    border: `1px solid ${danger ? c.danger : c.border}`,
    background: danger ? c.danger : on ? c.surfaceAlt : c.dangerSoft,
    color: danger ? c.primaryText : on ? c.text : c.danger,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flex: '0 0 auto',
  });

  const tiles: ReactNode[] = [];
  for (const person of everyone) {
    const isLocal = person === local;
    const camera = person.getTrackPublication(Track.Source.Camera);
    const screen = person.getTrackPublication(Track.Source.ScreenShare);
    const name = person.name || person.identity;

    tiles.push(
      <div
        key={person.identity}
        data-testid={`tile-${person.identity}`}
        style={{
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          background: c.surfaceAlt,
          border: `1px solid ${c.border}`,
          boxShadow: person.isSpeaking ? `0 0 0 3px ${c.primary}` : undefined,
          minHeight: 120,
        }}
      >
        {camera?.track && person.isCameraEnabled ? (
          <Video track={camera.track} mirror={isLocal} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: c.primary, color: c.primaryText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>
              {initials(name)}
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 6, background: c.glassStrongFill, color: c.text, borderRadius: 8, padding: '3px 8px', fontSize: 13, fontWeight: 700 }}>
          {!person.isMicrophoneEnabled ? <Icon name="micOff" size={14} color={c.danger} /> : null}
          <span>{name}{isLocal ? ` (${t('meetings.call.you')})` : ''}</span>
        </div>
      </div>,
    );

    if (screen?.track) {
      tiles.push(
        <div key={`${person.identity}-screen`} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: c.surfaceAlt, border: `1px solid ${c.border}`, minHeight: 120 }}>
          <Video track={screen.track} contain />
          <div style={{ position: 'absolute', left: 8, bottom: 8, background: c.glassStrongFill, color: c.text, borderRadius: 8, padding: '3px 8px', fontSize: 13, fontWeight: 700 }}>
            {name} · {t('meetings.call.share')}
          </div>
        </div>,
      );
    }
  }

  const status =
    phase === 'connecting'
      ? t('meetings.call.connecting')
      : phase === 'reconnecting'
        ? t('meetings.call.reconnecting')
        : phase === 'live'
          ? t('meetings.call.live')
          : t('meetings.ended');

  const sidebar = panel ? (
    <div
      data-testid="side-panel"
      style={{
        width: wide ? 340 : '100%',
        flex: wide ? '0 0 340px' : '0 0 46%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: wide ? `1px solid ${c.border}` : undefined,
        borderTop: wide ? undefined : `1px solid ${c.border}`,
        background: c.surface,
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: `1px solid ${c.border}` }}>
        {(['chat', 'people'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => openPanel(tab === panel ? tab : tab)}
            aria-label={tab === 'chat' ? t('meetings.call.chat') : t('meetings.call.people')}
            style={{ ...tabStyle(tab === panel, c) }}
          >
            <Icon name={tab === 'chat' ? 'chat' : 'people'} size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{tab === 'chat' ? t('meetings.call.chat') : `${t('meetings.call.people')} (${everyone.length})`}</span>
          </button>
        ))}
      </div>

      {panel === 'chat' ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            {lines.length === 0 ? (
              <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 }}>{t('meetings.call.noChat')}</div>
            ) : null}
            {lines.map((line) => (
              <div key={line.id} data-testid="chat-line" style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 15, background: line.mine ? c.primary : c.surfaceAlt, color: line.mine ? c.primaryText : c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flex: '0 0 auto' }}>
                  {initials(line.from)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: c.textMuted }}>
                    <b style={{ color: c.text }}>{line.mine ? t('meetings.call.you') : line.from}</b> · {timeLabel(new Date(line.ts))}
                  </div>
                  <div style={{ fontSize: 14, color: c.text, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{line.text}</div>
                </div>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${c.border}` }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('meetings.call.chatPlaceholder')}
              aria-label={t('meetings.call.chatPlaceholder')}
              maxLength={2000}
              style={{ flex: 1, minWidth: 0, background: c.fieldBg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 999, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit' }}
            />
            <button
              type="submit"
              aria-label={t('meetings.call.send')}
              disabled={!draft.trim()}
              style={{ background: c.primary, color: c.primaryText, border: 'none', borderRadius: 999, padding: '0 16px', fontWeight: 800, cursor: 'pointer', opacity: draft.trim() ? 1 : 0.45 }}
            >
              {t('meetings.call.send')}
            </button>
          </form>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {everyone.map((person) => (
            <div key={person.identity} data-testid="person-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: c.primary, color: c.primaryText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {initials(person.name || person.identity)}
              </div>
              <div style={{ flex: 1, minWidth: 0, color: c.text, fontSize: 14, fontWeight: 700 }}>
                {person.name || person.identity}
                {person === local ? ` (${t('meetings.call.you')})` : ''}
                {person.isSpeaking ? <span style={{ color: c.success, fontWeight: 600 }}> · {t('meetings.call.speaking')}</span> : null}
              </div>
              <span title={t('meetings.call.mic')} style={{ color: person.isMicrophoneEnabled ? c.success : c.danger, display: 'flex' }}>
                <Icon name={person.isMicrophoneEnabled ? 'mic' : 'micOff'} size={17} />
              </span>
              <span title={t('meetings.call.camera')} style={{ color: person.isCameraEnabled ? c.success : c.danger, display: 'flex' }}>
                <Icon name={person.isCameraEnabled ? 'video' : 'videoOff'} size={17} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      data-testid="meeting-room"
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: c.bg, color: c.text, display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${c.border}` }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {phase !== 'failed' ? (
          <span data-testid="phase" style={{ fontSize: 12, fontWeight: 800, color: phase === 'live' ? c.success : c.warning, background: phase === 'live' ? c.successSoft : c.warningSoft, borderRadius: 999, padding: '4px 10px' }}>
            {status}
          </span>
        ) : null}
        <span data-testid="count" style={{ fontSize: 12, color: c.textMuted }}>{everyone.length}</span>
      </div>

      {notice ? (
        <div role="status" style={{ background: c.warningSoft, color: c.warning, borderBottom: `1px solid ${c.warningBorder}`, padding: '8px 14px', fontSize: 13, display: 'flex', gap: 8 }}>
          <span style={{ flex: 1 }}>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 800 }}>×</button>
        </div>
      ) : null}
      {soundBlocked ? (
        <button onClick={() => void roomRef.current?.startAudio().then(() => setSoundBlocked(false))} style={{ background: c.primary, color: c.primaryText, border: 'none', padding: '9px 14px', fontWeight: 800, cursor: 'pointer' }}>
          🔈 {t('meetings.call.enableSound')}
        </button>
      ) : null}

      {/* Stage + side panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column' }}>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, padding: 10, display: 'flex', flexDirection: 'column' }}>
          {phase === 'failed' || phase === 'ended' ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 380, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                {phase === 'failed'
                  ? t('meetings.call.error')
                  : endedBy === 'host'
                    ? t('meetings.call.ended')
                    : endedBy === 'other-device'
                      ? t('meetings.call.otherDevice')
                      : t('meetings.call.dropped')}
              </div>
              {problem ? <div style={{ color: c.textMuted, fontSize: 13, marginBottom: 14, wordBreak: 'break-word' }}>{problem}</div> : null}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {/* A meeting the host has ended is over: there is nothing to rejoin. */}
                {phase === 'failed' || endedBy !== 'host' ? (
                  <button onClick={() => { setPhase('connecting'); setProblem(null); setAttempt((n) => n + 1); }} style={{ background: c.primary, color: c.primaryText, border: 'none', borderRadius: 999, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>
                    {t('meetings.call.rejoin')}
                  </button>
                ) : null}
                <button onClick={onLeave} style={{ background: 'transparent', color: c.primary, border: `1px solid ${c.primary}`, borderRadius: 999, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>
                  {t('meetings.call.back')}
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="grid"
              style={{ flex: 1, minHeight: 0, display: 'grid', gap: 10, gridTemplateColumns: `repeat(auto-fit, minmax(${wide ? 300 : 240}px, 1fr))`, gridAutoRows: 'minmax(140px, 1fr)', overflow: 'auto' }}
            >
              {tiles}
              {everyone.length === 1 && phase === 'live' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, fontSize: 14, textAlign: 'center', padding: 16 }}>
                  {t('meetings.call.alone')}
                </div>
              ) : null}
            </div>
          )}
        </div>
        {sidebar}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 12px', borderTop: `1px solid ${c.border}`, background: c.surface, flexWrap: 'wrap' }}>
        <button data-testid="btn-mic" onClick={toggleMic} aria-label={t('meetings.call.mic')} aria-pressed={!!local?.isMicrophoneEnabled} style={round(!!local?.isMicrophoneEnabled)}>
          <Icon name={local?.isMicrophoneEnabled ? 'mic' : 'micOff'} />
        </button>
        <button data-testid="btn-camera" onClick={toggleCamera} aria-label={t('meetings.call.camera')} aria-pressed={!!local?.isCameraEnabled} style={round(!!local?.isCameraEnabled)}>
          <Icon name={local?.isCameraEnabled ? 'video' : 'videoOff'} />
        </button>
        {canShare ? (
          <button data-testid="btn-share" onClick={toggleShare} aria-label={t('meetings.call.share')} aria-pressed={!!local?.isScreenShareEnabled} style={{ ...round(true), background: local?.isScreenShareEnabled ? c.primary : c.surfaceAlt, color: local?.isScreenShareEnabled ? c.primaryText : c.text }}>
            <Icon name="screen" />
          </button>
        ) : null}
        <button data-testid="btn-chat" onClick={() => openPanel('chat')} aria-label={t('meetings.call.chat')} style={{ ...round(true), background: panel === 'chat' ? c.primarySoft : c.surfaceAlt }}>
          <Icon name="chat" />
          {unread > 0 ? (
            <span data-testid="unread" style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: c.primary, color: c.primaryText, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
              {unread}
            </span>
          ) : null}
        </button>
        <button data-testid="btn-people" onClick={() => openPanel('people')} aria-label={t('meetings.call.people')} style={{ ...round(true), background: panel === 'people' ? c.primarySoft : c.surfaceAlt }}>
          <Icon name="people" />
        </button>
        <button data-testid="btn-leave" onClick={leave} aria-label={t('meetings.call.leave')} style={{ ...round(false, true), width: 64, borderRadius: 23 }}>
          <Icon name="leave" />
        </button>
      </div>
    </div>
  );
}

// --- small pieces ---

/** One video track, drawn. Attaches when it appears and lets go when it goes. */
function Video({ track, mirror, contain }: { track: Track; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover', transform: mirror ? 'scaleX(-1)' : undefined, background: 'transparent' }}
    />
  );
}

const ICONS: Record<string, string> = {
  mic: 'M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z',
  micOff: 'M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23A6.9 6.9 0 0 0 19 11zm-4.02.17c0-.06.02-.11.02-.17V6a3 3 0 0 0-6 0v.17l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52a5 5 0 0 1-5-5H5a7 7 0 0 0 6 6.92V21h2v-3.08c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z',
  video: 'M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z',
  videoOff: 'M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5zM3.27 2 2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z',
  screen: 'M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6v2H8v2h8v-2h-2v-2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H4V5h16v11z',
  chat: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z',
  people: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A4.2 4.2 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  leave: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z',
};

function Icon({ name, size = 22, color = 'currentColor' }: { name: keyof typeof ICONS; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function tabStyle(on: boolean, c: { primarySoft: string; surfaceAlt: string; text: string; border: string }): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 999,
    cursor: 'pointer',
    border: `1px solid ${on ? 'transparent' : c.border}`,
    background: on ? c.primarySoft : 'transparent',
    color: c.text,
  };
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
