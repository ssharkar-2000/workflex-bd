import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { BackButton, BarChart, Card, ErrorState, Loading, Meter, SectionHeader } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type JobAnalytics = {
  fillRate: number;
  totalViews: number;
  averageViews: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
};

type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

/// Backed by GET /jobs/analytics, which already existed on the backend but
/// was never called from anywhere in the app.
export function JobAnalyticsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data, loading, error, refetch } = useApi<JobAnalytics>('/jobs/analytics');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const categoryBars = data.byCategory
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((row) => ({ label: row.category, value: row.count }));

  return (
    <ScrollView style={s.flex} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('jobAnalytics.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'fillRate').bg }}>
        <SectionHeader title={t('jobAnalytics.fillRate')} />
        <Text style={s.bigStat}>{data.fillRate}%</Text>
        <Meter percent={data.fillRate} />
        <Text style={[text.caption, { marginTop: spacing.xs }]}>{t('analytics.approvedVsTotal')}</Text>
      </Card>

      <View style={s.grid}>
        <KpiTile
          value={data.totalViews.toLocaleString('en-IN')}
          label={t('jobAnalytics.totalViews')}
          styles={s}
          text={text}
          shadow={shadow}
          tint={categoryTint(categoryPalette, 'totalViews').bg}
        />
        <KpiTile
          value={data.averageViews.toLocaleString('en-IN')}
          label={t('jobAnalytics.avgViews')}
          styles={s}
          text={text}
          shadow={shadow}
          tint={categoryTint(categoryPalette, 'avgViews').bg}
        />
      </View>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'byCategory').bg }}>
        <SectionHeader title={t('jobAnalytics.byCategory')} />
        {categoryBars.length === 0 ? (
          <Text style={text.caption}>{t('jobAnalytics.noJobsYet')}</Text>
        ) : (
          <BarChart data={categoryBars} />
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'byStatus').bg }}>
        <SectionHeader title={t('jobAnalytics.byStatus')} />
        {data.byStatus.map((row) => (
          <View key={row.status} style={s.breakdownRow}>
            <Text style={text.body}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</Text>
            <Text style={text.body}>{row.count}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function KpiTile({
  value,
  label,
  styles,
  text,
  shadow,
  tint,
}: {
  value: string;
  label: string;
  styles: Styles;
  text: Txt;
  shadow: { card: object };
  tint?: string;
}) {
  return (
    <View style={[styles.tile, shadow.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.label, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    bigStat: { fontSize: 32, fontWeight: '700', color: colors.primary, marginVertical: spacing.xs },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  });
}
