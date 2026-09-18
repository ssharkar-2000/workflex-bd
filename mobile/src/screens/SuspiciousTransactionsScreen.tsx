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
import { IrregularTransactions, IrregularWorker, Page, ScheduledBan } from '../api/types';
import {
  Avatar,
  BackButton,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterTabs,
  Loading,
  SectionHeader,
  StatusPill,
} from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate, taka, timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Tab = 'flagged' | 'notices';

const FLAG_KEY: Record<string, string> = {
  LARGE_AMOUNT: 'bans.flagLargeAmount',
  BURST: 'bans.flagBurst',
  REPEATED_FAILURES: 'bans.flagRepeatedFailures',
  OUTFLOW_EXCEEDS_INFLOW: 'bans.flagOutflow',
};

const BAN_STATUS_KEY: Record<string, string> = {
  SCHEDULED: 'bans.statusScheduled',
  EXECUTED: 'bans.statusExecuted',
  CANCELLED: 'status.cancelled',
};

/**
 * Item 8 — "transaction irregular dakle admin user k ban korbe and ban korar
 * 24h age akta notification with text."
 *
 * Two tabs, matching the two halves of that sentence. **Flagged** is the
 * review queue: workers whose last 24 hours of transactions tripped one of
 * the detector's patterns, with the specific reason spelled out rather than a
 * bare score. **Notices** is every ban raised and where it stands.
 *
 * Raising a ban here does not suspend anyone — it starts a 24-hour countdown
 * and sends the worker the notice text written in this form. That text is
 * what they actually read, which is why the field is required and free-form
 * rather than a canned string, and why the countdown is shown on every
 * notice card: an admin can still call it off right up to the deadline.
 */
export function SuspiciousTransactionsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);

  const [tab, setTab] = useState<Tab>('flagged');
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ worker: IrregularWorker; reason: string; notice: string } | null>(
    null,
  );

  const flagged = useApi<IrregularTransactions>('/bans/irregular-transactions');
  const notices = useApi<Page<ScheduledBan>>('/bans');

  const openForm = (worker: IrregularWorker) => {
    const summary = worker.flags.map((f) => f.detail).join('; ');
    setForm({
      worker,
      reason: t('bans.defaultReason', { summary }),
      notice: '',
    });
  };

  const submit = async () => {
    if (!form) return;
    if (form.reason.trim().length < 10) {
      RNAlert.alert(t('bans.reasonTooShortTitle'), t('bans.reasonTooShortBody'));
      return;
    }
    setBusy('create');
    try {
      await api('/bans', {
        method: 'POST',
        body: {
          workerId: form.worker.workerId,
          reason: form.reason.trim(),
          ...(form.notice.trim() ? { noticeText: form.notice.trim() } : {}),
          triggerTransactionId: form.worker.sampleTransaction.id,
        },
      });
      setForm(null);
      await Promise.all([flagged.refetch(), notices.refetch()]);
      RNAlert.alert(t('bans.raisedTitle'), t('bans.raisedBody'));
    } catch (e) {
      RNAlert.alert(t('bans.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(null);
    }
  };

  const act = async (ban: ScheduledBan, action: 'cancel' | 'execute') => {
    setBusy(ban.id);
    try {
      await api(`/bans/${ban.id}/${action}`, { method: 'POST', body: {} });
      await Promise.all([flagged.refetch(), notices.refetch()]);
    } catch (e) {
      RNAlert.alert(t('bans.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(null);
    }
  };

  const confirmExecute = (ban: ScheduledBan) => {
    RNAlert.alert(
      t('bans.banNowTitle'),
      t('bans.banNowBody', { name: ban.worker?.fullName ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('bans.banNow'), style: 'destructive', onPress: () => act(ban, 'execute') },
      ],
    );
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('bans.title')}</Text>
      <Text style={[text.caption, { marginTop: spacing.xs }]}>
        {t('bans.subtitle', { hours: flagged.data?.windowHours ?? 24 })}
      </Text>

      <FilterTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'flagged', label: t('bans.tabFlagged'), count: flagged.data?.items.length },
          { value: 'notices', label: t('bans.tabNotices'), count: notices.data?.meta.total },
        ]}
      />

      {tab === 'flagged' ? (
        flagged.loading && !flagged.data ? (
          <Loading />
        ) : flagged.error && !flagged.data ? (
          <ErrorState message={flagged.error} onRetry={flagged.refetch} />
        ) : (flagged.data?.items.length ?? 0) === 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState title={t('bans.noFlagsTitle')} hint={t('bans.noFlagsHint')} />
          </View>
        ) : (
          flagged.data!.items.map((row) => (
            <Card
              key={row.workerId}
              style={{
                marginTop: spacing.md,
                backgroundColor: categoryTint(categoryPalette, row.workerId).bg,
              }}
            >
              <View style={s.head}>
                <Avatar initials={row.worker?.initials ?? '??'} />
                <View style={s.grow}>
                  <Text style={s.name} numberOfLines={1}>
                    {row.worker?.fullName ?? t('bans.unknownWorker')}
                  </Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {row.worker?.code} · {timeAgo(row.lastActivityAt, t)}
                  </Text>
                </View>
                {row.worker ? <StatusPill value={row.worker.status} /> : null}
              </View>

              {/* Why this row is here, in words — a number on its own tells an
                  admin nothing they can act on. */}
              <View style={s.flags}>
                {row.flags.map((flag) => (
                  <View key={flag.code} style={[s.flag, { backgroundColor: colors.amberBg }]}>
                    <Text style={[s.flagTitle, { color: colors.amberText }]}>
                      {t(FLAG_KEY[flag.code] ?? 'bans.flagOther')}
                    </Text>
                    <Text style={text.caption}>{flag.detail}</Text>
                  </View>
                ))}
              </View>

              <View style={[s.statRow, shadow.card, { backgroundColor: colors.card }]}>
                <View style={s.stat}>
                  <Text style={text.stat}>{row.transactionCount}</Text>
                  <Text style={text.caption}>{t('bans.transactions')}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={text.stat}>{taka(row.totalAmount, true)}</Text>
                  <Text style={text.caption}>{t('bans.moved')}</Text>
                </View>
              </View>

              <View style={s.actions}>
                {row.worker ? (
                  <Button
                    label={t('bans.viewWorker')}
                    variant="outline"
                    onPress={() => navigation.navigate('WorkerProfile', { id: row.worker!.id })}
                  />
                ) : null}
                {row.openBan ? (
                  <Text style={[text.caption, s.pending]}>
                    {t('bans.alreadyUnderNotice', { date: longDate(row.openBan.effectiveAt) })}
                  </Text>
                ) : (
                  <Button
                    label={t('bans.raiseNotice')}
                    variant="danger"
                    onPress={() => openForm(row)}
                  />
                )}
              </View>
            </Card>
          ))
        )
      ) : notices.loading && !notices.data ? (
        <Loading />
      ) : notices.error && !notices.data ? (
        <ErrorState message={notices.error} onRetry={notices.refetch} />
      ) : (notices.data?.items.length ?? 0) === 0 ? (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState title={t('bans.noNoticesTitle')} hint={t('bans.noNoticesHint')} />
        </View>
      ) : (
        notices.data!.items.map((ban) => {
          const live = ban.status === 'SCHEDULED';
          return (
            <Card
              key={ban.id}
              style={{ marginTop: spacing.md, backgroundColor: categoryTint(categoryPalette, ban.id).bg }}
            >
              <View style={s.head}>
                <Avatar initials={ban.worker?.initials ?? '??'} />
                <View style={s.grow}>
                  <Text style={s.name} numberOfLines={1}>
                    {ban.worker?.fullName}
                  </Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {ban.worker?.code}
                  </Text>
                </View>
                <StatusPill value={ban.status} label={t(BAN_STATUS_KEY[ban.status] ?? ban.status)} />
              </View>

              {live ? (
                <View style={[s.countdown, { backgroundColor: colors.redBg }]}>
                  <Text style={[s.countdownText, { color: colors.redText }]}>
                    {countdown(ban.effectiveAt, t)}
                  </Text>
                  <Text style={text.caption}>{longDate(ban.effectiveAt)}</Text>
                </View>
              ) : null}

              <Text style={[text.label, { marginTop: spacing.md }]}>{t('bans.reasonLabel')}</Text>
              <Text style={text.body}>{ban.reason}</Text>

              <Text style={[text.label, { marginTop: spacing.md }]}>{t('bans.noticeSent')}</Text>
              <Text style={[text.body, s.notice]}>{ban.noticeText}</Text>

              {ban.cancelReason ? (
                <Text style={[text.caption, { marginTop: spacing.sm }]}>
                  {t('bans.cancelledBecause', { reason: ban.cancelReason })}
                </Text>
              ) : null}

              <View style={s.actions}>
                {ban.worker ? (
                  <Button
                    label={t('bans.viewWorker')}
                    variant="outline"
                    onPress={() => navigation.navigate('WorkerProfile', { id: ban.worker!.id })}
                  />
                ) : null}
                {live ? (
                  <>
                    <Button
                      label={t('bans.cancelNotice')}
                      variant="outline"
                      loading={busy === ban.id}
                      onPress={() => act(ban, 'cancel')}
                    />
                    <Button
                      label={t('bans.banNow')}
                      variant="danger"
                      loading={busy === ban.id}
                      onPress={() => confirmExecute(ban)}
                    />
                  </>
                ) : null}
              </View>
            </Card>
          );
        })
      )}

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <ScrollView contentContainerStyle={s.backdrop} keyboardShouldPersistTaps="handled">
          <Card style={s.modal}>
            <SectionHeader title={t('bans.raiseNotice')} />
            <Text style={text.caption}>
              {t('bans.formIntro', { name: form?.worker.worker?.fullName ?? '' })}
            </Text>

            <Text style={[text.label, { marginTop: spacing.md }]}>{t('bans.reasonLabel')}</Text>
            <Text style={text.micro}>{t('bans.reasonHint')}</Text>
            <TextInput
              value={form?.reason ?? ''}
              onChangeText={(v) => setForm((f) => (f ? { ...f, reason: v } : f))}
              style={[s.input, s.multiline]}
              multiline
              placeholderTextColor={colors.textLight}
            />

            <Text style={[text.label, { marginTop: spacing.md }]}>{t('bans.noticeLabel')}</Text>
            <Text style={text.micro}>{t('bans.noticeHint')}</Text>
            <TextInput
              value={form?.notice ?? ''}
              onChangeText={(v) => setForm((f) => (f ? { ...f, notice: v } : f))}
              style={[s.input, s.multiline]}
              multiline
              placeholder={t('bans.noticePlaceholder')}
              placeholderTextColor={colors.textLight}
            />

            <View style={s.modalActions}>
              <Button label={t('common.cancel')} variant="outline" onPress={() => setForm(null)} />
              <Button
                label={t('bans.sendNotice')}
                variant="danger"
                loading={busy === 'create'}
                onPress={submit}
              />
            </View>
          </Card>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

function countdown(iso: string, t: (k: string, v?: Record<string, string | number>) => string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t('bans.dueNow');
  const hours = Math.floor(ms / 3600_000);
  const minutes = Math.floor((ms % 3600_000) / 60_000);
  return t('bans.takesEffectIn', { hours, minutes });
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.textDark },

    flags: { gap: spacing.xs, marginTop: spacing.md },
    flag: { borderRadius: radii.md, padding: spacing.sm, gap: 2 },
    flagTitle: { fontSize: 12, fontWeight: '700' },

    statRow: { flexDirection: 'row', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md },
    stat: { flex: 1, gap: 2 },

    countdown: { borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, gap: 2 },
    countdownText: { fontSize: 14, fontWeight: '700' },
    notice: {
      marginTop: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      padding: spacing.sm,
    },
    pending: { flex: 1, color: colors.amberText, fontWeight: '600' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },

    backdrop: { flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
    modal: { gap: spacing.xs },
    input: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
      ...text.body,
    },
    multiline: { minHeight: 92, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
}
