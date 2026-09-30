import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Meeting, MeetingTab, MeetingTemplate } from '@workflex/shared';
import {
  deleteTemplate,
  fetchMeetings,
  fetchTemplates,
  respondToMeeting,
} from '../../../src/api/meetings';
import { Card, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { MeetingCard } from '../../../src/components/meetings/MeetingCard';
import { ScheduleMeetingModal } from '../../../src/components/meetings/ScheduleMeetingModal';
import { ask, openMeeting } from '../../../src/components/meetings/meeting-actions';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type Tab = MeetingTab | 'TEMPLATES';
const TABS: Tab[] = ['UPCOMING', 'PAST', 'ORGANIZED', 'TEMPLATES'];

/**
 * Meetings: schedule, join and look back at them.
 *
 * Both sides of a meeting use this screen. The host schedules and everyone
 * invited finds the meeting in Upcoming, with the link and Accept/Decline;
 * the room opens for Join a little before the start. New and changed meetings
 * arrive over the chat socket (see lib/chat-socket.ts), and the list also
 * refetches on a timer because "Join now" is a matter of the clock, not of
 * anything anyone did.
 */
export default function MeetingsScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('UPCOMING');
  const [scheduling, setScheduling] = useState<{ template: MeetingTemplate | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // The list for a meeting tab. Templates are their own list, but the counts
  // in the tab bar still come from a meetings request, so it always runs.
  const listTab: MeetingTab = tab === 'TEMPLATES' ? 'UPCOMING' : tab;
  const overview = useQuery({
    queryKey: ['meetings', listTab],
    queryFn: () => fetchMeetings(listTab),
    refetchInterval: 30_000,
  });
  const templates = useQuery({
    queryKey: ['meeting-templates'],
    queryFn: fetchTemplates,
    enabled: tab === 'TEMPLATES',
  });

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: 'ACCEPTED' | 'DECLINED' }) =>
      respondToMeeting(id, response),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['meetings'] }),
    onError: (err) => setProblem(errorMessage(err)),
  });

  const removeTemplate = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meeting-templates'] });
      void queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (err) => setProblem(errorMessage(err)),
  });

  const join = useCallback(
    async (meeting: Meeting) => {
      setProblem(null);
      setJoiningId(meeting.id);
      try {
        await openMeeting(meeting.id, router);
      } catch (err) {
        setProblem(errorMessage(err));
      } finally {
        setJoiningId(null);
      }
    },
    [router, errorMessage],
  );

  const refresh = () => {
    void overview.refetch();
    if (tab === 'TEMPLATES') void templates.refetch();
  };

  const counts = overview.data?.counts;
  const meetings = overview.data?.meetings ?? [];
  const showingTemplates = tab === 'TEMPLATES';
  const list = showingTemplates ? (templates.data ?? []) : meetings;
  const loading = showingTemplates ? templates.isLoading : overview.isLoading;
  const failed = showingTemplates ? templates.isError : overview.isError;

  return (
    <MoneyScreen
      title={t('meetings.title')}
      subtitle={t('meetings.subtitle')}
      refreshing={overview.isRefetching}
      onRefresh={refresh}
    >
      <View style={s.actions}>
        <Pressable
          onPress={() => router.push('/(app)/meetings/rooms' as never)}
          accessibilityRole="button"
          testID="btn-rooms"
          style={({ pressed }) => [
            s.outline,
            { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
          ]}
        >
          <Text style={[s.outlineText, { color: c.primary }]}>{t('meetings.rooms')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setScheduling({ template: null })}
          accessibilityRole="button"
          testID="btn-schedule"
          style={({ pressed }) => [s.solid, { backgroundColor: pressed ? c.primaryPressed : c.primary }]}
        >
          <Text style={[s.solidText, { color: c.primaryText }]}>+ {t('meetings.schedule')}</Text>
        </Pressable>
      </View>

      {overview.data && !overview.data.callsEnabled ? (
        <Notice tone="info" body={t('meetings.callsOff')} />
      ) : null}
      {notice ? <Notice tone="success" body={notice} /> : null}
      {problem ? <Notice tone="danger" body={problem} /> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabs}
      >
        {TABS.map((id) => {
          const on = tab === id;
          const label =
            id === 'TEMPLATES' && counts
              ? `${t('meetings.tab.TEMPLATES')} (${counts.templates})`
              : t(`meetings.tab.${id}` as TranslationKey);
          return (
            <Pressable
              key={id}
              onPress={() => {
                setTab(id);
                setNotice(null);
                setProblem(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              testID={`tab-${id}`}
              style={[
                s.tab,
                {
                  backgroundColor: on ? c.primarySoft : c.surfaceAlt,
                  borderColor: on ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[s.tabText, { color: on ? c.text : c.textMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : failed ? (
        <Card>
          <Text style={[s.emptyTitle, { color: c.text }]}>
            {errorMessage(showingTemplates ? templates.error : overview.error)}
          </Text>
          <Pressable onPress={refresh} accessibilityRole="button" hitSlop={8}>
            <Text style={[s.link, { color: c.primary }]}>{t('common.retry')}</Text>
          </Pressable>
        </Card>
      ) : list.length === 0 ? (
        <Card style={s.empty}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={[s.emptyTitle, { color: c.text }]} testID="empty-title">
            {showingTemplates ? t('meetings.tab.TEMPLATES') : t('meetings.empty')}
          </Text>
          <Text style={[s.emptyHint, { color: c.textMuted }]}>
            {showingTemplates ? t('meetings.noTemplates') : t('meetings.emptyHint')}
          </Text>
        </Card>
      ) : showingTemplates ? (
        <View style={s.list}>
          {templates.data?.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => setScheduling({ template })}
              onDelete={() =>
                ask(
                  t('meetings.deleteTemplate'),
                  template.name,
                  t('meetings.deleteTemplate'),
                  t('common.cancel'),
                  () => removeTemplate.mutate(template.id),
                )
              }
            />
          ))}
        </View>
      ) : (
        <View style={s.list}>
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              joining={joiningId === meeting.id}
              onOpen={() =>
                router.push({ pathname: '/(app)/meetings/[id]', params: { id: meeting.id } })
              }
              onJoin={() => void join(meeting)}
              onRespond={(response) => respond.mutate({ id: meeting.id, response })}
            />
          ))}
        </View>
      )}

      {scheduling ? (
        <ScheduleMeetingModal
          template={scheduling.template}
          onClose={() => setScheduling(null)}
          onScheduled={() => {
            setScheduling(null);
            setTab('UPCOMING');
            setProblem(null);
            setNotice(t('meetings.scheduled'));
          }}
        />
      ) : null}
    </MoneyScreen>
  );
}

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: MeetingTemplate;
  onUse: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const guests = template.participants.map((p) => p.name).join(', ');

  return (
    <View style={[s.template, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.templateName, { color: c.text }]} numberOfLines={1}>
        {template.name}
      </Text>
      <Text style={[s.templateMeta, { color: c.textMuted }]} numberOfLines={2}>
        {template.title} · {t('meetings.form.minutes', { count: template.durationMinutes })} ·{' '}
        {t(`meetings.recurrence.${template.recurrence}` as TranslationKey)}
        {guests ? ` · ${guests}` : ''}
      </Text>
      <View style={s.templateActions}>
        <Pressable
          onPress={onUse}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.solid,
            s.small,
            { backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
        >
          <Text style={[s.solidText, { color: c.primaryText }]}>{t('meetings.useTemplate')}</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          style={[s.outline, s.small, { borderColor: c.dangerBorder }]}
        >
          <Text style={[s.outlineText, { color: c.danger }]}>{t('meetings.deleteTemplate')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  outline: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineText: { fontSize: font.sm, fontWeight: '800' },
  solid: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  solidText: { fontSize: font.sm, fontWeight: '800' },
  small: { paddingVertical: 8 },
  tabsScroll: { flexGrow: 0, marginTop: space.md },
  tabs: { gap: space.sm, paddingRight: space.md },
  tab: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  tabText: { fontSize: font.sm, fontWeight: '700' },
  list: { gap: space.sm, marginTop: space.md },
  center: { paddingVertical: space.xl, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: space.xl },
  emptyIcon: { fontSize: 34, marginBottom: 8 },
  emptyTitle: { fontSize: font.md, fontWeight: '800', textAlign: 'center' },
  emptyHint: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  link: { fontSize: font.sm, fontWeight: '800', marginTop: 8 },
  template: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: 6 },
  templateName: { fontSize: font.md, fontWeight: '800' },
  templateMeta: { fontSize: font.xs, lineHeight: 18 },
  templateActions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
});
