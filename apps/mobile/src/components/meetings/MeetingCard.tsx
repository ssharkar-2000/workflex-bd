import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Meeting } from '@workflex/shared';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';
import { namesSummary, timeLabel, whenRange } from './meeting-format';

/**
 * One meeting in a list: what, when, who, and the one thing to do about it.
 *
 * The action changes with where the meeting stands — Join when the door is
 * open, Accept and Decline while an invitation is unanswered, otherwise the
 * time the door opens. Tapping the card opens the full details.
 */
export function MeetingCard({
  meeting,
  onOpen,
  onJoin,
  joining,
  onRespond,
}: {
  meeting: Meeting;
  onOpen: () => void;
  onJoin: () => void;
  joining?: boolean;
  onRespond: (response: 'ACCEPTED' | 'DECLINED') => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [copied, setCopied] = useState(false);

  const cancelled = meeting.status === 'CANCELLED';
  const ended = meeting.status === 'ENDED';
  const others = meeting.participants.filter((p) => p.id !== meeting.host.id).map((p) => p.name);
  const { shown, more } = namesSummary(others);
  const opensLater =
    meeting.kind === 'VIDEO' &&
    meeting.status === 'SCHEDULED' &&
    !meeting.canJoin &&
    new Date(meeting.joinOpensAt).getTime() > Date.now();
  const awaitingMyReply =
    !meeting.iAmHost && meeting.myResponse === 'PENDING' && meeting.status === 'SCHEDULED';

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.card,
        { backgroundColor: pressed ? c.surfaceAlt : c.surface, borderColor: c.border },
        (cancelled || ended) && { opacity: 0.75 },
      ]}
    >
      <View style={s.top}>
        <Text style={[s.title, { color: c.text }]} numberOfLines={2}>
          {meeting.title}
        </Text>
        {meeting.live ? (
          <Badge text={t('meetings.live')} bg={c.successSoft} fg={c.success} />
        ) : cancelled ? (
          <Badge text={t('meetings.cancelled')} bg={c.dangerSoft} fg={c.danger} />
        ) : ended ? (
          <Badge text={t('meetings.ended')} bg={c.surfaceAlt} fg={c.textMuted} />
        ) : null}
      </View>

      <Text style={[s.when, { color: c.text }]}>{whenRange(meeting.startsAt, meeting.endsAt)}</Text>

      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={2}>
        {meeting.kind === 'IN_PERSON'
          ? `${t('meetings.inPerson')}${meeting.room ? ` · ${meeting.room.name}` : ''}`
          : t('meetings.video')}
        {' · '}
        {meeting.iAmHost
          ? others.length === 0
            ? t('meetings.onlyYou')
            : more > 0
              ? t('meetings.withMore', { names: shown, count: more })
              : t('meetings.with', { names: shown })
          : t('meetings.host', { name: meeting.host.name })}
      </Text>

      {!meeting.iAmHost && meeting.myResponse ? (
        <Text style={[s.meta, { color: meeting.myResponse === 'DECLINED' ? c.danger : c.textMuted }]}>
          {t(`meetings.response.${meeting.myResponse}` as 'meetings.response.PENDING')}
        </Text>
      ) : null}

      <View style={s.actions}>
        {meeting.canJoin ? (
          <Pressable
            onPress={onJoin}
            disabled={joining}
            accessibilityRole="button"
            accessibilityLabel={`${t('meetings.join')}: ${meeting.title}`}
            style={({ pressed }) => [
              s.primary,
              { backgroundColor: pressed ? c.primaryPressed : c.primary, opacity: joining ? 0.7 : 1 },
            ]}
          >
            {joining ? (
              <ActivityIndicator color={c.primaryText} />
            ) : (
              <Text style={[s.primaryText, { color: c.primaryText }]}>{t('meetings.join')}</Text>
            )}
          </Pressable>
        ) : opensLater ? (
          <Text style={[s.meta, { color: c.textMuted }]}>
            {t('meetings.opensAt', { time: timeLabel(new Date(meeting.joinOpensAt)) })}
          </Text>
        ) : null}

        {awaitingMyReply ? (
          <>
            <Pressable
              onPress={() => onRespond('ACCEPTED')}
              accessibilityRole="button"
              style={[s.outline, { borderColor: c.primary }]}
            >
              <Text style={[s.outlineText, { color: c.primary }]}>{t('meetings.accept')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onRespond('DECLINED')}
              accessibilityRole="button"
              style={[s.outline, { borderColor: c.border }]}
            >
              <Text style={[s.outlineText, { color: c.textMuted }]}>{t('meetings.decline')}</Text>
            </Pressable>
          </>
        ) : null}

        {meeting.kind === 'VIDEO' && !cancelled ? (
          <Pressable
            onPress={() => {
              void Clipboard.setStringAsync(meeting.link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[s.link, { color: c.primary }]}>
              {copied ? t('meetings.linkCopied') : t('meetings.copyLink')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { flex: 1, fontSize: font.md, fontWeight: '800' },
  when: { fontSize: font.sm, fontWeight: '700' },
  meta: { fontSize: font.xs, lineHeight: 18 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: font.xs, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: 4 },
  primary: {
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  primaryText: { fontSize: font.sm, fontWeight: '800' },
  outline: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  outlineText: { fontSize: font.xs, fontWeight: '800' },
  link: { fontSize: font.xs, fontWeight: '800' },
});
