import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share } from 'react-native';
import { getTokens } from '../auth/tokenStorage';
import { BASE_URL } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { BackButton, Button, Card, ErrorState, FilterTabs, Loading, SectionHeader } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, spacing, ThemeColors } from '../theme';
import { taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Report = {
  range: { from: string; to: string };
  workforce: { total: number; active: number; pending: number; suspended: number; newInPeriod: number };
  hiring: {
    totalJobs: number;
    approved: number;
    pending: number;
    rejected: number;
    postedInPeriod: number;
    hiresInPeriod: number;
  };
  money: { revenue: number; transactionCount: number; refunded: number; failedCount: number };
  trustAndSafety: {
    verificationsApproved: number;
    verificationsPending: number;
    criticalAlerts: number;
    highAlerts: number;
    complaintsResolvedInPeriod: number;
  };
};

type RangeOption = '7' | '30' | '90';
type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

function rangeToDates(option: RangeOption): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (Number(option) - 1) * 864e5);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function ReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [range, setRange] = useState<RangeOption>('30');
  const [exporting, setExporting] = useState(false);
  const { from, to } = rangeToDates(range);
  const { data, loading, error, refetch } = useApi<Report>(
    `/reports/summary?from=${from}&to=${to}`,
    [range],
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const tokens = await getTokens();
      const res = await fetch(`${BASE_URL}/reports/transactions.csv?from=${from}&to=${to}`, {
        headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
      });
      if (!res.ok) throw new Error('The server could not generate the export.');
      const csv = await res.text();
      await Share.share({
        title: t('reports.exportTitle'),
        message: csv,
      });
    } catch (e) {
      RNAlert.alert(t('reports.exportFailed'), friendlyError(e, t));
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <View style={s.headRow}>
        <View style={s.grow}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={text.screenTitle}>{t('reports.title')}</Text>
          <Text style={[text.caption, { marginTop: spacing.xs }]}>
            {data.range.from} to {data.range.to}
          </Text>
        </View>
      </View>

      <FilterTabs<RangeOption>
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: t('reports.last7') },
          { value: '30', label: t('reports.last30') },
          { value: '90', label: t('reports.last90') },
        ]}
      />

      {/* Item 3/5 sweep fix: an exportCsv() function and `exporting` state
          already existed and worked, but no button in this screen ever
          called it — the backend/logic was real, the UI just never wired
          it up. Added the actual Export action here. */}
      <Button
        label={t('reports.exportCsv')}
        variant="outline"
        loading={exporting}
        onPress={exportCsv}
        style={{ marginTop: spacing.md }}
      />

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'workforce').bg }}>
        <SectionHeader title={t('reports.workforce')} />
        <Row label={t('reports.totalWorkers')} value={data.workforce.total} styles={s} text={text} />
        <Row label={t('workers.active')} value={data.workforce.active} styles={s} text={text} />
        <Row label={t('reports.pendingVerification')} value={data.workforce.pending} styles={s} text={text} />
        <Row label={t('workers.suspended')} value={data.workforce.suspended} styles={s} text={text} />
        <Row label={t('reports.joinedInPeriod')} value={data.workforce.newInPeriod} highlight styles={s} text={text} />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'hiring').bg }}>
        <SectionHeader title={t('reports.hiring')} />
        <Row label={t('reports.totalJobs')} value={data.hiring.totalJobs} styles={s} text={text} />
        <Row label={t('common.approve')} value={data.hiring.approved} styles={s} text={text} />
        <Row label={t('reports.awaitingReview')} value={data.hiring.pending} styles={s} text={text} />
        <Row label={t('reports.rejected')} value={data.hiring.rejected} styles={s} text={text} />
        <Row label={t('reports.postedInPeriod')} value={data.hiring.postedInPeriod} styles={s} text={text} />
        <Row label={t('reports.hiresInPeriod')} value={data.hiring.hiresInPeriod} highlight styles={s} text={text} />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'money').bg }}>
        <SectionHeader title={t('reports.money')} />
        <Row label={t('payments.totalRevenue')} value={taka(data.money.revenue, true)} highlight styles={s} text={text} />
        <Row label={t('reports.transactions')} value={data.money.transactionCount} styles={s} text={text} />
        <Row label={t('reports.refunded')} value={taka(data.money.refunded, true)} styles={s} text={text} />
        <Row label={t('reports.failed')} value={data.money.failedCount} styles={s} text={text} />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'trustSafety').bg }}>
        <SectionHeader title={t('reports.trustSafety')} />
        <Row label={t('reports.verificationsApproved')} value={data.trustAndSafety.verificationsApproved} styles={s} text={text} />
        <Row label={t('reports.verificationsPending')} value={data.trustAndSafety.verificationsPending} styles={s} text={text} />
        <Row label={t('reports.criticalAlerts')} value={data.trustAndSafety.criticalAlerts} styles={s} text={text} />
        <Row label={t('reports.highAlerts')} value={data.trustAndSafety.highAlerts} styles={s} text={text} />
        <Row label={t('reports.complaintsResolved')} value={data.trustAndSafety.complaintsResolvedInPeriod} styles={s} text={text} />
      </Card>

      <Text style={s.note}>{t('reports.csvNote')}</Text>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  highlight,
  styles,
  text,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  styles: Styles;
  text: Txt;
}) {
  return (
    <View style={styles.row}>
      <Text style={text.body}>{label}</Text>
      <Text style={[styles.value, highlight && styles.valueHighlight]}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    headRow: { flexDirection: 'row', alignItems: 'flex-start' },
    grow: { flex: 1 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    value: { fontSize: 14, fontWeight: '700', color: colors.textDark },
    valueHighlight: { color: colors.primary },
    note: { ...text.micro, marginTop: spacing.lg, lineHeight: 16 },
  });
}
