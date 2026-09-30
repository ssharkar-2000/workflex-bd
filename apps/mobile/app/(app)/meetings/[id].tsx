import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Meeting, MeetingParticipant } from '@workflex/shared';
import {
  cancelMeeting,
  endMeeting,
  fetchMeeting,
  respondToMeeting,
} from '../../../src/api/meetings';
import { Card, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { ask, openMeeting } from '../../../src/components/meetings/meeting-actions';
import { initials, timeLabel, whenRange } from '../../../src/components/meetings/meeting-format';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * One meeting, in full: when, who, the link, and everything that can be done
 * to it — join, answer the invitation, and for the host end or cancel it.
 *
 * The page refreshes itself while it is open, so a guest arriving, or the
 * host ending the call, shows without leaving it.
 */
export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [problem, setProblem] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => fetchMeeting(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
  const meeting = query.data;

  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    void queryClient.invalidateQueries({ queryKey: ['meetings'] });
  };

  const respond = useMutation({
    mutationFn: (response: 'ACCEPTED' | 'DECLINED') => respondToMeeting(id!, response),
    onSuccess: changed,
    onError: (err) => setProblem(errorMessage(err)),
  });

  const cancel = useMutation({
    mutationFn: (scope: 'ONE' | 'SERIES') => cancelMeeting(id!, scope),
    onSuccess: changed,
    onError: (err) => setProblem(errorMessage(err)),
  });

  const end = useMutation({
    mutationFn: () => endMeeting(id!),
    onSuccess: changed,
    onError: (err) => setProblem(errorMessage(err)),
  });

  const join = async () => {
    if (!meeting) return;
    setProblem(null);
    setJoining(true);
    try {
      await openMeeting(meeting.id, router);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  const copyLink = () => {
    if (!meeting) return;
    void Clipboard.setStringAsync(meeting.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (query.isLoading || !id) {
    return (
      <MoneyScreen title={t('meetings.title')}>
        <View style={s.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </MoneyScreen>
    );
  }

  if (!meeting) {
    return (
      <MoneyScreen title={t('meetings.title')}>
        <Notice tone="warning" body={query.isError ? errorMessage(query.error) : t('meetings.notFound')} />
      </MoneyScreen>
    );
  }

  const cancelled = meeting.status === 'CANCELLED';
  const ended = meeting.status === 'ENDED';
  const open = meeting.status === 'SCHEDULED';
  const awaitingMyReply = !meeting.iAmHost && meeting.myResponse === 'PENDING' && open;
  const opensLater =
    meeting.kind === 'VIDEO' && open && !meeting.canJoin && new Date(meeting.joinOpensAt).getTime() > Date.now();
  const insecure =
    Platform.OS === 'web' && typeof window !== 'undefined' && window.isSecureContext === false;
  const series = meeting.seriesId !== null && meeting.recurrence !== 'NONE';

  const confirmCancel = (scope: 'ONE' | 'SERIES') =>
    ask(
      scope === 'SERIES' ? t('meetings.cancelSeries') : t('meetings.cancel'),
      t('meetings.cancelConfirm', { title: meeting.title }),
      scope === 'SERIES' ? t('meetings.cancelSeries') : t('meetings.cancel'),
      t('meetings.keep'),
      () => cancel.mutate(scope),
    );

  const confirmEnd = () =>
    ask(t('meetings.end'), t('meetings.endConfirm', { title: meeting.title }), t('meetings.end'), t('meetings.keep'), () =>
      end.mutate(),
    );

  return (
    <MoneyScreen
      title={meeting.title}
      subtitle={whenRange(meeting.startsAt, meeting.endsAt)}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <View style={s.badges}>
        {meeting.live ? <Badge text={t('meetings.live')} bg={c.successSoft} fg={c.success} /> : null}
        {cancelled ? <Badge text={t('meetings.cancelled')} bg={c.dangerSoft} fg={c.danger} /> : null}
        {ended ? <Badge text={t('meetings.ended')} bg={c.surfaceAlt} fg={c.textMuted} /> : null}
        <Badge
          text={
            meeting.kind === 'IN_PERSON'
              ? `${t('meetings.inPerson')}${meeting.room ? ` · ${meeting.room.name}` : ''}`
              : t('meetings.video')
          }
          bg={c.surfaceAlt}
          fg={c.text}
        />
        {series ? (
          <Badge
            text={t('meetings.repeats', {
              how: t(`meetings.recurrence.${meeting.recurrence}` as TranslationKey),
            })}
            bg={c.surfaceAlt}
            fg={c.text}
          />
        ) : null}
      </View>

      {problem ? <Notice tone="danger" body={problem} /> : null}
      {insecure && meeting.canJoin ? <Notice tone="warning" body={t('meetings.httpNote')} /> : null}

      {open ? (
        <Card>
          <View style={s.actions}>
            {meeting.canJoin ? (
              <Pressable
                onPress={() => void join()}
                disabled={joining}
                accessibilityRole="button"
                testID="btn-join"
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
              <Text style={[s.muted, { color: c.textMuted }]}>
                {t('meetings.opensAt', { time: timeLabel(new Date(meeting.joinOpensAt)) })}
              </Text>
            ) : null}

            {awaitingMyReply ? (
              <>
                <Pressable
                  onPress={() => respond.mutate('ACCEPTED')}
                  accessibilityRole="button"
                  testID="btn-accept"
                  style={[s.outline, { borderColor: c.primary }]}
                >
                  <Text style={[s.outlineText, { color: c.primary }]}>{t('meetings.accept')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => respond.mutate('DECLINED')}
                  accessibilityRole="button"
                  testID="btn-decline"
                  style={[s.outline, { borderColor: c.border }]}
                >
                  <Text style={[s.outlineText, { color: c.textMuted }]}>{t('meetings.decline')}</Text>
                </Pressable>
              </>
            ) : !meeting.iAmHost && meeting.myResponse ? (
              <Text style={[s.muted, { color: meeting.myResponse === 'DECLINED' ? c.danger : c.textMuted }]}>
                {t(`meetings.response.${meeting.myResponse}` as TranslationKey)}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      {meeting.kind === 'VIDEO' && !cancelled ? (
        <Card>
          <Text style={[s.heading, { color: c.text }]}>{t('meetings.link')}</Text>
          <Text
            style={[s.link, { color: c.text, backgroundColor: c.fieldBg, borderColor: c.border }]}
            selectable
            testID="meeting-link"
          >
            {meeting.link}
          </Text>
          <Pressable onPress={copyLink} accessibilityRole="button" hitSlop={8} testID="btn-copy-link">
            <Text style={[s.action, { color: c.primary }]}>
              {copied ? t('meetings.linkCopied') : t('meetings.copyLink')}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {meeting.agenda ? (
        <Card>
          <Text style={[s.heading, { color: c.text }]}>{t('meetings.agenda')}</Text>
          <Text style={[s.body, { color: c.text }]}>{meeting.agenda}</Text>
        </Card>
      ) : null}

      {meeting.notes ? (
        <Card>
          <Text style={[s.heading, { color: c.text }]}>{t('meetings.notes')}</Text>
          <Text style={[s.body, { color: c.text }]}>{meeting.notes}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={[s.heading, { color: c.text }]}>
          {t('meetings.participants')} ({meeting.participants.length})
        </Text>
        <View style={s.people}>
          {meeting.participants.map((person) => (
            <Person key={person.id} person={person} meeting={meeting} />
          ))}
        </View>
      </Card>

      {meeting.iAmHost && open ? (
        <View style={s.danger}>
          {meeting.live ? (
            <Pressable
              onPress={confirmEnd}
              accessibilityRole="button"
              testID="btn-end"
              style={[s.outline, { borderColor: c.dangerBorder }]}
            >
              <Text style={[s.outlineText, { color: c.danger }]}>{t('meetings.end')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => confirmCancel('ONE')}
            accessibilityRole="button"
            testID="btn-cancel-meeting"
            style={[s.outline, { borderColor: c.dangerBorder }]}
          >
            <Text style={[s.outlineText, { color: c.danger }]}>{t('meetings.cancel')}</Text>
          </Pressable>
          {series ? (
            <Pressable
              onPress={() => confirmCancel('SERIES')}
              accessibilityRole="button"
              testID="btn-cancel-series"
              style={[s.outline, { borderColor: c.dangerBorder }]}
            >
              <Text style={[s.outlineText, { color: c.danger }]}>{t('meetings.cancelSeries')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </MoneyScreen>
  );
}

function Person({ person, meeting }: { person: MeetingParticipant; meeting: Meeting }) {
  const t = useT();
  const { c } = useTheme();
  const host = person.id === meeting.host.id;

  return (
    <View style={s.person} testID={`person-${person.publicId}`}>
      <View style={[s.avatar, { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder }]}>
        <Text style={[s.avatarText, { color: c.text }]}>{initials(person.name)}</Text>
      </View>
      <View style={s.grow}>
        <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
          {person.name}
          {host ? `  ·  ${t('meetings.hostLabel')}` : ''}
        </Text>
        <Text style={[s.muted, { color: c.textMuted }]} numberOfLines={1}>
          {person.publicId}
          {person.company ? ` · ${person.company}` : ''}
          {!host ? ` · ${t(`meetings.response.${person.response}` as TranslationKey)}` : ''}
        </Text>
      </View>
      {person.inCall ? <Badge text={t('meetings.inCall')} bg={c.successSoft} fg={c.success} /> : null}
    </View>
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
  center: { paddingVertical: space.xl, alignItems: 'center' },
  grow: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.xs, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  primary: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  primaryText: { fontSize: font.sm, fontWeight: '800' },
  outline: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    alignItems: 'center',
  },
  outlineText: { fontSize: font.sm, fontWeight: '800' },
  heading: { fontSize: font.md, fontWeight: '800', marginBottom: 8 },
  body: { fontSize: font.sm, lineHeight: 21 },
  muted: { fontSize: font.xs, lineHeight: 17 },
  link: {
    fontSize: font.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  action: { fontSize: font.sm, fontWeight: '800', marginTop: 10 },
  people: { gap: space.sm + 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.sm, fontWeight: '800' },
  name: { fontSize: font.sm, fontWeight: '800' },
  danger: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, marginBottom: space.lg },
});
