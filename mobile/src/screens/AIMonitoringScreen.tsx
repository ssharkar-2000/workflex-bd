import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Alert, Page } from '../api/types';
import { BackButton, ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { taka, timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

/**
 * Item 13 — "AI monitoring name change kore suspicous type dakabe like
 * manager er kache patha be."
 *
 * The screen is still reached by the `AIMonitoring` route (renaming that
 * would break every existing navigate call for no user-visible gain), but
 * everything a person reads now says Suspicious Activity: the title, the menu
 * row, and the stat tiles. Each card also shows the company the activity came
 * from, and escalating from here (or from the detail screen) routes the alert
 * to that company's manager — see AlertsService.escalate.
 */
export function AIMonitoringScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const summary = useApi<{ aiMatches: number; gpsAlerts: number; fraudSaved: number; online: boolean }>(
    '/alerts/summary',
  );
  const { data, loading, error, refetch } = useApi<Page<Alert>>('/alerts');

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={s.head}>
              <Text style={text.screenTitle}>{t('suspicious.title')}</Text>
              {summary.data?.online ? (
                <View style={s.online}>
                  <Text style={s.onlineText}>● {t('aiMonitoring.online')}</Text>
                </View>
              ) : null}
            </View>

            {summary.data ? (
              <View style={s.grid}>
                <StatTile
                  value={summary.data.aiMatches.toLocaleString('en-IN')}
                  label={t('aiMonitoring.aiMatches')}
                  styles={s}
                  text={text}
                  shadow={shadow}
                  tint={categoryTint(categoryPalette, 'aiMatches').bg}
                />
                <StatTile
                  value={taka(summary.data.fraudSaved, true)}
                  label={t('aiMonitoring.fraudSaved')}
                  styles={s}
                  text={text}
                  shadow={shadow}
                  tint={categoryTint(categoryPalette, 'fraudSaved').bg}
                />
                <StatTile
                  value={String(summary.data.gpsAlerts)}
                  label={t('aiMonitoring.gpsAlerts')}
                  styles={s}
                  text={text}
                  shadow={shadow}
                  tint={categoryTint(categoryPalette, 'gpsAlerts').bg}
                />
              </View>
            ) : null}

            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {t('suspicious.subtitle')}
            </Text>

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title={t('suspicious.latest')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? <ErrorState message={error} onRetry={refetch} /> : loading ? <Loading /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('AlertDetail', { id: item.id })}
            style={({ pressed }) => [
              s.card,
              shadow.card,
              { backgroundColor: categoryTint(categoryPalette, item.id).bg },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={s.row}>
              <View style={s.grow}>
                {/* Item 6 fix: long alert messages had no numberOfLines and
                    could push the status pills off-screen / wrap awkwardly. */}
                <Text style={text.cardTitle} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={[text.caption, { marginTop: spacing.xs }]} numberOfLines={1}>
                  {item.subjectName} · {timeAgo(item.detectedAt, t)}
                </Text>
                {/* Item 12/13 — which company this came from, on the card
                    itself rather than two screens deep. */}
                {item.company || item.companyLabel ? (
                  <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={1}>
                    🏢 {item.company?.name ?? item.companyLabel}
                    {item.escalatedToManager
                      ? ` · ${t('suspicious.withManager', { name: item.escalatedToManager.fullName })}`
                      : ''}
                  </Text>
                ) : null}
              </View>
              <View style={s.pills}>
                <StatusPill value={item.severity} />
                {item.status !== 'OPEN' ? <StatusPill value={item.status} /> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function StatTile({
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
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    online: { backgroundColor: colors.greenBg, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
    onlineText: { color: colors.greenText, fontSize: 11, fontWeight: '700' },

    grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    tile: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },

    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },
    row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    grow: { flex: 1 },
    pills: { gap: spacing.xs, alignItems: 'flex-end' },
  });
}
