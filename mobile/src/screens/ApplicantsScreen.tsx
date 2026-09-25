import React, { useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { JobApplication } from '../api/types';
import { Avatar, BackButton, Button, Card, EmptyState, ErrorState, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

/// Item 23 follow-up (#4): backend already exposes GET /jobs/:id/applications
/// and the shortlist/hire/reject actions (verified against a real database
/// this session) — this screen is the missing mobile half.
export function ApplicantsScreen({ route, navigation }: any) {
  const { id, title } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data: applicants, loading, error, refetch } = useApi<JobApplication[]>(`/jobs/${id}/applications`);
  const [busyId, setBusyId] = useState<string | null>(null);
  /// Item 10 — an interview is raised from the applicant it belongs to, so
  /// the job, the worker and the application are all already known here and
  /// none of them has to be picked from a list.
  const [scheduling, setScheduling] = useState<{
    app: JobApplication;
    when: string;
    location: string;
  } | null>(null);

  if (loading && !applicants) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const run = async (applicationId: string, action: 'shortlist' | 'hire' | 'reject') => {
    setBusyId(applicationId);
    try {
      await api(`/jobs/${id}/applications/${applicationId}/${action}`, { method: 'POST' });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('applicants.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  const confirmHire = (app: JobApplication) => {
    RNAlert.alert(
      t('applicants.confirmHireTitle'),
      t('applicants.confirmHireBody', { name: app.worker.fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('applicants.hire'), onPress: () => run(app.id, 'hire') },
      ],
    );
  };

  const confirmReject = (app: JobApplication) => {
    RNAlert.alert(
      t('applicants.confirmRejectTitle'),
      t('applicants.confirmRejectBody', { name: app.worker.fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('applicants.reject'), style: 'destructive', onPress: () => run(app.id, 'reject') },
      ],
    );
  };

  const scheduleInterview = async () => {
    if (!scheduling) return;
    const when = new Date(scheduling.when.trim().replace(' ', 'T'));
    if (Number.isNaN(when.getTime())) {
      RNAlert.alert(t('interviews.badDateTitle'), t('interviews.badDateBody'));
      return;
    }
    setBusyId(scheduling.app.id);
    try {
      await api('/interviews', {
        method: 'POST',
        body: {
          jobId: id,
          workerId: scheduling.app.worker.id,
          applicationId: scheduling.app.id,
          scheduledAt: when.toISOString(),
          ...(scheduling.location.trim() ? { location: scheduling.location.trim() } : {}),
        },
      });
      setScheduling(null);
      RNAlert.alert(t('interviews.scheduledTitle'), t('interviews.scheduledBody'));
      await refetch();
    } catch (e) {
      RNAlert.alert(t('interviews.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  const items = applicants ?? [];

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('applicants.title')}</Text>
      {title ? (
        <Text style={[text.caption, { marginTop: spacing.xs }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}

      {items.length === 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
          <EmptyState title={t('applicants.noneYet')} hint={t('applicants.noneYetHint')} />
        </View>
      ) : (
        items.map((app) => {
          const busy = busyId === app.id;
          return (
            <Card key={app.id} style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, app.id).bg }}>
              <View style={s.head}>
                <Avatar initials={app.worker.initials} />
                <View style={s.grow}>
                  <Text style={s.name} numberOfLines={1}>
                    {app.worker.fullName}
                  </Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {app.worker.profession} · {app.worker.code}
                  </Text>
                </View>
                <StatusPill value={app.status} />
              </View>

              <View style={s.metaRow}>
                <Text style={text.caption}>
                  {t('applicants.appliedOn', { date: longDate(app.appliedAt) })}
                </Text>
                {app.hiredAt ? (
                  <Text style={text.caption}>
                    {t('applicants.hiredOn', { date: longDate(app.hiredAt) })}
                  </Text>
                ) : null}
              </View>

              <View style={s.statsRow}>
                <Text style={s.stat}>⭐ {app.worker.rating.toFixed(1)}</Text>
                <Text style={s.stat}>{t('workers.trust')}: {app.worker.trustScore}</Text>
              </View>

              {app.status === 'APPLIED' || app.status === 'SHORTLISTED' ? (
                <View style={s.actions}>
                  {app.status === 'APPLIED' ? (
                    <Button
                      label={t('applicants.shortlist')}
                      variant="outline"
                      tint={categoryPalette[0]}
                      loading={busy}
                      onPress={() => run(app.id, 'shortlist')}
                    />
                  ) : null}
                  <Button
                    label={t('applicants.hire')}
                    variant="success"
                    loading={busy}
                    onPress={() => confirmHire(app)}
                  />
                  <Button
                    label={t('applicants.reject')}
                    variant="danger"
                    loading={busy}
                    onPress={() => confirmReject(app)}
                  />
                  <Button
                    label={t('applicants.scheduleInterview')}
                    variant="outline"
                    tint={categoryPalette[3]}
                    disabled={busy}
                    onPress={() =>
                      setScheduling({ app, when: defaultSlot(), location: '' })
                    }
                  />
                  <Button
                    label={t('applicants.documents')}
                    variant="outline"
                    tint={categoryPalette[1]}
                    onPress={() =>
                      navigation.navigate('Documents', { workerId: app.worker.id, jobId: id })
                    }
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      <Modal
        visible={!!scheduling}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduling(null)}
      >
        <View style={s.backdrop}>
          <Card style={s.modal}>
            <Text style={text.sectionTitle}>{t('applicants.scheduleInterview')}</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {t('interviews.scheduleHint', { name: scheduling?.app.worker.fullName ?? '' })}
            </Text>

            <Text style={[text.label, { marginTop: spacing.md }]}>{t('interviews.whenLabel')}</Text>
            <TextInput
              value={scheduling?.when ?? ''}
              onChangeText={(v) => setScheduling((x) => (x ? { ...x, when: v } : x))}
              placeholder="2026-09-20 10:30"
              placeholderTextColor={colors.textLight}
              style={s.input}
              autoCapitalize="none"
            />

            <Text style={[text.label, { marginTop: spacing.md }]}>
              {t('interviews.locationLabel')}
            </Text>
            <TextInput
              value={scheduling?.location ?? ''}
              onChangeText={(v) => setScheduling((x) => (x ? { ...x, location: v } : x))}
              placeholder={t('interviews.locationPlaceholder')}
              placeholderTextColor={colors.textLight}
              style={s.input}
            />

            <View style={s.modalActions}>
              <Button label={t('common.cancel')} variant="outline" onPress={() => setScheduling(null)} />
              <Button
                label={t('interviews.send')}
                loading={!!busyId}
                onPress={scheduleInterview}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

/// Tomorrow, 10:00 — a sensible starting point an admin edits rather than
/// types from scratch.
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 10:00`;
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.textDark },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    statsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
    stat: { ...text.label, color: colors.textGray },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modal: { gap: spacing.xs },
    input: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
      ...text.body,
    },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
}
