import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Alert } from '../api/types';
import { BackButton, Button, Card, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, spacing, ThemeColors } from '../theme';
import { timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const ALERT_KIND_KEY: Record<Alert['kind'], string> = {
  SOS: 'alertKind.sos',
  SUSPICIOUS_LOGIN: 'alertKind.suspiciousLogin',
  FAKE_GPS: 'alertKind.fakeGps',
  FAILED_VERIFICATION: 'alertKind.failedVerification',
  FRAUD: 'alertKind.fraud',
};

export function AlertDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data: alert, loading, error, refetch } = useApi<Alert>(`/alerts/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !alert) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!alert) return null;

  const run = async (action: 'resolve' | 'escalate') => {
    setBusy(true);
    try {
      await api(`/alerts/${id}/${action}`, {
        method: 'POST',
        body:
          action === 'resolve'
            ? { actionTaken: t('alertDetail.defaultReviewedClosed') }
            : { actionTaken: t('alertDetail.defaultEscalated') },
      });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('alertDetail.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'head').bg }}>
        <View style={s.head}>
          <StatusPill value={alert.severity} />
          <StatusPill value={alert.status} />
        </View>
        <View style={s.metaRow}>
          <View
            style={[
              s.kindBadge,
              { backgroundColor: categoryTint(categoryPalette, alert.kind).bg },
            ]}
          >
            <Text
              style={[s.kindBadgeText, { color: categoryTint(categoryPalette, alert.kind).fg }]}
            >
              {t(ALERT_KIND_KEY[alert.kind])}
            </Text>
          </View>
          <Text style={text.caption}>{timeAgo(alert.detectedAt, t)}</Text>
        </View>
        <Text style={[text.cardTitle, { marginTop: spacing.sm, fontSize: 16 }]} numberOfLines={4}>
          {alert.message}
        </Text>

        {/* Item 12 — "kon company theke astice oita direct dakabe". The
            company is on the alert itself now, so an admin doesn't have to
            open the worker and work it out from their last job. */}
        {alert.company || alert.companyLabel ? (
          <View style={[s.companyRow, { backgroundColor: colors.card }]}>
            <Text style={s.companyIcon}>🏢</Text>
            <View style={s.grow}>
              <Text style={s.companyName} numberOfLines={1}>
                {alert.company?.name ?? alert.companyLabel}
              </Text>
              <Text style={text.micro}>{t('alertDetail.reportedFrom')}</Text>
            </View>
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
        <DetailRow label={t('alertDetail.user')} value={alert.subjectName} />
        {alert.worker ? <DetailRow label={t('alertDetail.userId')} value={alert.worker.code} /> : null}
        {alert.latitude !== null ? (
          <DetailRow label={t('alertDetail.latitude')} value={`${Math.abs(alert.latitude).toFixed(4)}° N`} />
        ) : null}
        {alert.longitude !== null ? (
          <DetailRow label={t('alertDetail.longitude')} value={`${Math.abs(alert.longitude).toFixed(4)}° E`} />
        ) : null}
        <DetailRow label={t('alertDetail.device')} value={alert.device ?? t('alertDetail.unknown')} />
        <DetailRow label={t('alertDetail.actionTaken')} value={alert.actionTaken ?? t('alertDetail.noneYet')} />
      </Card>

      {/* Item 12 — once escalated, who it went to. Before this an escalation
          left nothing but the word "Escalated"; there was no record of which
          person at which company was actually asked to act. */}
      {alert.escalatedToManager ? (
        <Card style={[s.escalated, { marginTop: spacing.lg }]}>
          <Text style={s.escalatedTitle}>{t('alertDetail.sentToManager')}</Text>
          <Text style={[text.cardTitle, { marginTop: spacing.xs, fontSize: 15 }]}>
            {alert.escalatedToManager.fullName}
          </Text>
          <Text style={text.caption}>
            {alert.company?.name ?? ''}
            {alert.escalatedToManager.phone ? ` · ${alert.escalatedToManager.phone}` : ''}
          </Text>
          <Text style={[text.caption, { marginTop: spacing.xs }]}>
            {alert.escalatedToManager.email}
          </Text>
          {alert.escalatedAt ? (
            <Text style={[text.micro, { marginTop: spacing.xs }]}>
              {t('alertDetail.escalatedAt', { time: timeAgo(alert.escalatedAt, t) })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={s.actions}>
        {alert.worker ? (
          <Button
            label={t('alertDetail.viewUser')}
            variant="outline"
            onPress={() => navigation.navigate('WorkerProfile', { id: alert.worker!.id })}
          />
        ) : null}
        {alert.company ? (
          <Button
            label={t('alertDetail.viewCompany')}
            variant="outline"
            onPress={() => navigation.navigate('CompanyDetail', { id: alert.company!.id })}
          />
        ) : null}
        {alert.status !== 'RESOLVED' ? (
          <>
            <Button
              label={t('alertDetail.escalateToManager')}
              variant="danger"
              loading={busy}
              onPress={() => run('escalate')}
            />
            <Button label={t('alertDetail.markResolved')} variant="success" loading={busy} onPress={() => run('resolve')} />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', gap: spacing.sm },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    kindBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
    kindBadgeText: { fontSize: 11, fontWeight: '700' },
    companyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 12,
      padding: spacing.sm,
      marginTop: spacing.md,
    },
    companyIcon: { fontSize: 16 },
    companyName: { ...text.label, color: colors.textDark },
    grow: { flex: 1 },
    escalated: { backgroundColor: colors.amberBg },
    escalatedTitle: { ...text.label, color: colors.amberText },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  });
}
