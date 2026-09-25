import React, { useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Interview, InterviewCounts, InterviewMode, Page } from '../api/types';
import {
  Avatar,
  BackButton,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterTabs,
  Loading,
  StatusPill,
} from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Tab = 'upcoming' | 'today' | 'completed' | 'cancelled' | 'all';

const MODE_KEY: Record<InterviewMode, string> = {
  IN_PERSON: 'interviews.modeInPerson',
  PHONE: 'interviews.modePhone',
  VIDEO: 'interviews.modeVideo',
};

const STATUS_LABEL_KEY: Record<string, string> = {
  SCHEDULED: 'status.scheduled',
  RESCHEDULED: 'status.rescheduled',
  COMPLETED: 'status.completed',
  CANCELLED: 'status.cancelled',
  NO_SHOW: 'status.noShow',
};

/**
 * Item 10 — "interview list ki admin manage kora jabe?"
 *
 * The whole list in one place, filtered the way an admin actually works:
 * what's still to happen, what's on today, and the history. Rescheduling is a
 * first-class action rather than an edit form, because that's the thing that
 * happens most — and it's the action that re-notifies the worker.
 */
export function InterviewsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);

  const [tab, setTab] = useState<Tab>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ interview: Interview; value: string } | null>(null);

  const counts = useApi<InterviewCounts>('/interviews/status-counts');
  const { data, loading, error, refetch } = useApi<Page<Interview>>(queryFor(tab), [tab]);

  const run = async (id: string, action: 'cancel' | 'complete' | 'noShow') => {
    setBusyId(id);
    try {
      if (action === 'cancel') {
        await api(`/interviews/${id}/cancel`, { method: 'POST', body: {} });
      } else {
        await api(`/interviews/${id}`, {
          method: 'PATCH',
          body: { status: action === 'complete' ? 'COMPLETED' : 'NO_SHOW' },
        });
      }
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e) {
      RNAlert.alert(t('interviews.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  const confirmCancel = (interview: Interview) => {
    RNAlert.alert(
      t('interviews.confirmCancelTitle'),
      t('interviews.confirmCancelBody', { name: interview.worker.fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('interviews.cancelInterview'),
          style: 'destructive',
          onPress: () => run(interview.id, 'cancel'),
        },
      ],
    );
  };

  const saveReschedule = async () => {
    if (!reschedule) return;
    const when = new Date(reschedule.value.trim().replace(' ', 'T'));
    if (Number.isNaN(when.getTime())) {
      RNAlert.alert(t('interviews.badDateTitle'), t('interviews.badDateBody'));
      return;
    }
    setBusyId(reschedule.interview.id);
    try {
      await api(`/interviews/${reschedule.interview.id}`, {
        method: 'PATCH',
        body: { scheduledAt: when.toISOString() },
      });
      setReschedule(null);
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e) {
      RNAlert.alert(t('interviews.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={text.screenTitle}>{t('interviews.title')}</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>{t('interviews.subtitle')}</Text>

            <FilterTabs<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'upcoming', label: t('interviews.tabUpcoming'), count: counts.data?.upcoming },
                { value: 'today', label: t('interviews.tabToday'), count: counts.data?.today },
                { value: 'completed', label: t('interviews.tabCompleted'), count: counts.data?.completed },
                { value: 'cancelled', label: t('interviews.tabCancelled'), count: counts.data?.cancelled },
                { value: 'all', label: t('common.all'), count: counts.data?.all },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <View style={{ marginTop: spacing.xl }}>
              <EmptyState title={t('interviews.emptyTitle')} hint={t('interviews.emptyHint')} />
            </View>
          )
        }
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          const live = item.status === 'SCHEDULED' || item.status === 'RESCHEDULED';
          return (
            <Card style={{ backgroundColor: categoryTint(categoryPalette, item.id).bg }}>
              <View style={s.head}>
                <Avatar initials={item.worker.initials} />
                <View style={s.grow}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.worker.fullName}
                  </Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {item.job.title} · {item.job.company.name}
                  </Text>
                </View>
                <StatusPill value={item.status} label={t(STATUS_LABEL_KEY[item.status] ?? 'status.scheduled')} />
              </View>

              <View style={[s.whenRow, shadow.card, { backgroundColor: colors.card }]}>
                <Text style={s.when}>{longDate(item.scheduledAt)}</Text>
                <Text style={text.caption}>
                  {t(MODE_KEY[item.mode])} · {t('interviews.minutes', { count: item.durationMinutes })}
                </Text>
              </View>

              {item.location ? (
                <Text style={[text.caption, { marginTop: spacing.sm }]} numberOfLines={2}>
                  📍 {item.location}
                </Text>
              ) : null}
              {item.interviewerName ? (
                <Text style={[text.caption, { marginTop: 2 }]} numberOfLines={1}>
                  👤 {t('interviews.interviewer')}: {item.interviewerName}
                </Text>
              ) : null}
              {item.outcome ? (
                <Text style={[text.body, { marginTop: spacing.sm }]}>{item.outcome}</Text>
              ) : null}

              <View style={s.actions}>
                <Button
                  label={t('interviews.viewWorker')}
                  variant="outline"
                  tint={categoryPalette[0]}
                  onPress={() => navigation.navigate('WorkerProfile', { id: item.worker.id })}
                />
                {live ? (
                  <>
                    <Button
                      label={t('interviews.reschedule')}
                      variant="outline"
                      tint={categoryPalette[3]}
                      disabled={busy}
                      onPress={() =>
                        setReschedule({ interview: item, value: toInputValue(item.scheduledAt) })
                      }
                    />
                    <Button
                      label={t('interviews.markDone')}
                      variant="success"
                      loading={busy}
                      onPress={() => run(item.id, 'complete')}
                    />
                    <Button
                      label={t('interviews.noShow')}
                      variant="outline"
                      tint={categoryPalette[1]}
                      disabled={busy}
                      onPress={() => run(item.id, 'noShow')}
                    />
                    <Button
                      label={t('interviews.cancelInterview')}
                      variant="danger"
                      disabled={busy}
                      onPress={() => confirmCancel(item)}
                    />
                  </>
                ) : null}
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={!!reschedule} transparent animationType="fade" onRequestClose={() => setReschedule(null)}>
        <View style={s.backdrop}>
          <Card style={s.modal}>
            <Text style={text.sectionTitle}>{t('interviews.reschedule')}</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {t('interviews.rescheduleHint')}
            </Text>
            <TextInput
              value={reschedule?.value ?? ''}
              onChangeText={(v) => setReschedule((r) => (r ? { ...r, value: v } : r))}
              placeholder="2026-09-20 10:30"
              placeholderTextColor={colors.textLight}
              style={s.input}
              autoCapitalize="none"
            />
            <View style={s.modalActions}>
              <Button label={t('common.cancel')} variant="outline" onPress={() => setReschedule(null)} />
              <Button label={t('common.save')} loading={!!busyId} onPress={saveReschedule} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

function queryFor(tab: Tab): string {
  if (tab === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return `/interviews?from=${start.toISOString()}&to=${end.toISOString()}`;
  }
  if (tab === 'upcoming') return `/interviews?status=SCHEDULED&from=${new Date().toISOString()}`;
  if (tab === 'completed') return '/interviews?status=COMPLETED';
  if (tab === 'cancelled') return '/interviews?status=CANCELLED';
  return '/interviews';
}

/// "2026-09-20 10:30" — the same shape the input expects back, so an admin
/// edits what they see rather than an ISO string with a timezone suffix.
function toInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.textDark },
    whenRow: {
      marginTop: spacing.md,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: 2,
    },
    when: { ...text.cardTitle, fontSize: 14 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modal: { gap: spacing.sm },
    input: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
      ...text.body,
    },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });
}
