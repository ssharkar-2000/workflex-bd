import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Avatar, BackButton, EmptyState, ErrorState, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type Company = {
  id: string;
  name: string;
  initials: string;
  industry: string | null;
  address: string | null;
  verified: boolean;
  _count: { jobs: number; employers: number };
};

export function CompaniesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data, loading, error, refetch } = useApi<Page<Company>>('/companies');

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
            <View style={s.headRow}>
              <Text style={text.screenTitle}>{t('companies.title')}</Text>
              <Text onPress={() => navigation.navigate('CompanyCreate')} style={s.newButton}>
                {t('common.new')}
              </Text>
            </View>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {t('companies.count', { count: data?.meta.total ?? 0 })}
            </Text>
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <EmptyState title={t('companies.empty')} />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('CompanyDetail', { id: item.id })}
            style={({ pressed }) => [
              s.card,
              shadow.card,
              { backgroundColor: categoryTint(categoryPalette, item.id).bg },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={s.top}>
              <Avatar initials={item.initials} />
              <View style={s.grow}>
                <View style={s.row}>
                  <Text style={text.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.verified ? <StatusPill value="VERIFIED" label={t('common.verified')} /> : null}
                </View>
                <Text style={text.caption} numberOfLines={1}>
                  {item.industry ?? t('companies.industryNotSet')}
                </Text>
              </View>
            </View>
            {item.address ? (
              <Text style={text.micro} numberOfLines={1}>
                📍 {item.address}
              </Text>
            ) : null}
            <View style={s.stats}>
              <Text style={s.stat}>{t('companies.jobsCount', { count: item._count.jobs })}</Text>
              <Text style={s.stat}>{t('companies.employersCount', { count: item._count.employers })}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
    top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    stats: { flexDirection: 'row', gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    stat: { ...text.caption, fontWeight: '600', color: colors.primary },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    newButton: { ...text.label, color: colors.primary },
  });
}
