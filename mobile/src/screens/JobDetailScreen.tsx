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
import { Job } from '../api/types';
import { Avatar, Button, Card, Chip, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { experience, longDate, salaryRange } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Styles = ReturnType<typeof createStyles>;

export function JobDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data: job, loading, error, refetch } = useApi<Job>(`/jobs/${id}`);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  /// Item 7 — rejecting now opens this instead of posting a canned reason.
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    location: string;
    salaryMin: string;
    salaryMax: string;
  } | null>(null);

  if (loading && !job) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!job) return null;

  const run = async (action: string, body?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/jobs/${id}/${action}`, { method: 'POST', body });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Item 7 — "admin je job gula k reject krobe seigular valid reason text
   * akare user er kace pathabee."
   *
   * This used to fire `run('reject', { reason: t('jobs.defaultRejectReason') })`
   * — one canned sentence for every rejection, which told the employer
   * nothing about their actual post. The reason is now typed per rejection,
   * checked for length before it is sent (the API enforces the same minimum),
   * and the copy above the box says plainly that the employer reads this text
   * word for word, because that is the part an admin needs to know while
   * writing it.
   */
  const submitRejection = async () => {
    const reason = (rejectReason ?? '').trim();
    if (reason.length < 10) {
      RNAlert.alert(t('jobDetail.rejectReasonShortTitle'), t('jobDetail.rejectReasonShortBody'));
      return;
    }
    setBusy(true);
    try {
      await api(`/jobs/${id}/reject`, { method: 'POST', body: { reason } });
      setRejectReason(null);
      await refetch();
      RNAlert.alert(t('jobDetail.rejectSentTitle'), t('jobDetail.rejectSentBody'));
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    setForm({
      title: job.title,
      description: job.description,
      location: job.location,
      salaryMin: String(Math.round(job.salaryMin / 100)),
      salaryMax: String(Math.round(job.salaryMax / 100)),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
  };

  const saveEdit = async () => {
    if (!form) return;
    const min = Number(form.salaryMin);
    const max = Number(form.salaryMax);
    if (!form.title.trim() || !form.location.trim()) {
      RNAlert.alert(t('jobDetail.missingDetailsTitle'), t('jobDetail.missingDetailsBody'));
      return;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      RNAlert.alert(t('postJob.checkSalaryTitle'), t('postJob.checkSalaryBody'));
      return;
    }
    setBusy(true);
    try {
      await api(`/jobs/${id}`, {
        method: 'PATCH',
        body: {
          title: form.title,
          description: form.description,
          location: form.location,
          salaryMin: Math.round(min * 100),
          salaryMax: Math.round(max * 100),
        },
      });
      await refetch();
      setEditing(false);
      setForm(null);
    } catch (e) {
      RNAlert.alert(t('cmsDetail.couldNotSave'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    RNAlert.alert(
      t('jobDetail.deleteTitle'),
      t('jobDetail.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('cmsDetail.delete'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api(`/jobs/${id}`, { method: 'DELETE' });
              navigation.goBack();
            } catch (e) {
              RNAlert.alert(t('cmsDetail.couldNotDelete'), friendlyError(e, t));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (editing && form) {
    return (
      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={text.screenTitle}>{t('jobDetail.editJob')}</Text>

        <Card style={{ marginTop: spacing.lg }}>
          <EditField label={t('postJob.jobTitle')} value={form.title} onChange={(v) => setForm({ ...form, title: v })} styles={s} colors={colors} />
          <EditField label={t('postJob.location')} value={form.location} onChange={(v) => setForm({ ...form, location: v })} styles={s} colors={colors} />
          <View style={s.salaryRow}>
            <View style={s.grow}>
              <EditField
                label={t('postJob.salaryFrom')}
                value={form.salaryMin}
                onChange={(v) => setForm({ ...form, salaryMin: v })}
                numeric
                styles={s}
                colors={colors}
              />
            </View>
            <View style={s.grow}>
              <EditField
                label={t('postJob.salaryTo')}
                value={form.salaryMax}
                onChange={(v) => setForm({ ...form, salaryMax: v })}
                numeric
                styles={s}
                colors={colors}
              />
            </View>
          </View>
          <EditField
            label={t('postJob.description')}
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multiline
            styles={s}
            colors={colors}
          />
        </Card>

        <View style={s.actions}>
          <Button label={t('common.cancel')} variant="outline" onPress={cancelEdit} disabled={busy} />
          <Button label={t('cmsDetail.save')} loading={busy} onPress={saveEdit} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>{t('jobDetail.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'head').bg }}>
        <View style={s.head}>
          <Avatar initials={job.company.initials} size={48} />
          <View style={s.grow}>
            <Text style={s.title} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {job.company.name}
            </Text>
          </View>
          <StatusPill value={job.status} />
        </View>
        <Text style={s.salary}>{salaryRange(job.salaryMin, job.salaryMax)}</Text>
        <View style={s.chipRow}>
          <Chip label={`${job.category.icon} ${job.category.name}`} />
          <Chip label={job.availability === 'FULL_TIME' ? t('workers.fullTime') : t('workers.partTime')} />
          <Chip label={experience(job.experienceMonths, t)} />
          {job.featured ? <Chip label={t('jobDetail.featuredChip')} /> : null}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'description').bg }}>
        <Text style={text.sectionTitle}>{t('jobDetail.description')}</Text>
        <Text style={[text.body, { marginTop: spacing.sm }]}>{job.description}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
        <DetailRow label={t('jobDetail.reference')} value={job.code} />
        <DetailRow label={t('postJob.location')} value={job.location} />
        <DetailRow label={t('jobDetail.posted')} value={longDate(job.postedAt)} />
        <DetailRow label={t('jobDetail.applications')} value={String(job._count.applications)} />
        <DetailRow label={t('jobDetail.views')} value={job.views.toLocaleString('en-IN')} />
      </Card>

      {job.rejectionReason ? (
        <Card style={[s.rejection, { marginTop: spacing.lg }]}>
          <Text style={s.rejectionTitle}>{t('jobDetail.whyRejected')}</Text>
          <Text style={[text.body, { marginTop: spacing.xs }]}>{job.rejectionReason}</Text>
        </Card>
      ) : null}

      <View style={s.actions}>
        {job.status === 'PENDING' ? (
          <>
            <Button label={t('common.approve')} variant="success" loading={busy} onPress={() => run('approve')} />
            <Button
              label={t('common.reject')}
              variant="danger"
              loading={busy}
              onPress={() => setRejectReason('')}
            />
          </>
        ) : null}
        {job.status === 'APPROVED' ? (
          <Button
            label={job.featured ? t('jobDetail.removeFromFeatured') : t('jobDetail.featureThisJob')}
            variant="outline"
            loading={busy}
            onPress={() => run(job.featured ? 'unfeature' : 'feature')}
          />
        ) : null}
        <Button
          label={t('jobDetail.viewApplicants')}
          variant="outline"
          onPress={() => navigation.navigate('Applicants', { id, title: job.title })}
        />
        <Button label={t('jobDetail.edit')} variant="outline" disabled={busy} onPress={startEdit} />
        <Button
          label={t('complaintDetail.viewHistory')}
          variant="outline"
          onPress={() =>
            navigation.navigate('EntityHistory', { entityType: 'Job', entityId: id, title: job.title })
          }
        />
        <Button label={t('cmsDetail.delete')} variant="danger" loading={busy} onPress={confirmDelete} />
      </View>

      <Modal
        visible={rejectReason !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectReason(null)}
      >
        <View style={s.backdrop}>
          <Card style={s.modal}>
            <Text style={text.sectionTitle}>{t('jobDetail.rejectTitle')}</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {t('jobDetail.rejectHint')}
            </Text>
            <TextInput
              value={rejectReason ?? ''}
              onChangeText={setRejectReason}
              placeholder={t('jobDetail.rejectPlaceholder')}
              placeholderTextColor={colors.textLight}
              style={[s.input, s.multiline, { marginTop: spacing.md }]}
              multiline
              autoFocus
            />
            <View style={s.modalActions}>
              <Button
                label={t('common.cancel')}
                variant="outline"
                onPress={() => setRejectReason(null)}
              />
              <Button
                label={t('jobDetail.sendRejection')}
                variant="danger"
                loading={busy}
                onPress={submitRejection}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

function EditField({
  label,
  value,
  onChange,
  multiline,
  numeric,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  styles: Styles;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        placeholderTextColor={colors.textLight}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    title: { fontSize: 17, fontWeight: '700', color: colors.textDark },
    salary: { fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: spacing.lg },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
    rejection: { backgroundColor: colors.redBg },
    rejectionTitle: { ...text.label, color: colors.redText },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },

    field: { marginBottom: spacing.md },
    label: { ...text.label, marginBottom: spacing.xs },
    input: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...text.body,
    },
    multiline: { minHeight: 110, textAlignVertical: 'top' },
    salaryRow: { flexDirection: 'row', gap: spacing.md },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modal: { gap: spacing.xs },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
}
