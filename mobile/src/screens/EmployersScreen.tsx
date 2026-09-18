import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Avatar, BackButton, Button, EmptyState, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type Employer = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  verified: boolean;
  company: { id: string; name: string; initials: string } | null;
};

type Filter = 'ALL' | 'VERIFIED' | 'UNVERIFIED';

export function EmployersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useApi<{ total: number; verified: number; unverified: number }>('/employers/counts');
  const query =
    filter === 'ALL' ? '' : `?verified=${filter === 'VERIFIED' ? 'true' : 'false'}`;
  const { data, loading, error, refetch } = useApi<Page<Employer>>(`/employers${query}`, [filter]);

  const toggleVerified = async (employer: Employer) => {
    setBusyId(employer.id);
    try {
      await api(`/employers/${employer.id}`, { method: 'PATCH', body: { verified: !employer.verified } });
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.headRow}>
          <Text style={text.screenTitle}>{t('employers.title')}</Text>
          <Text onPress={() => navigation.navigate('EmployerCreate')} style={s.newButton}>
            {t('common.new')}
          </Text>
        </View>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t('common.all'), count: counts.data?.total },
            { value: 'VERIFIED', label: t('common.verified'), count: counts.data?.verified },
            { value: 'UNVERIFIED', label: t('common.unverified'), count: counts.data?.unverified },
          ]}
        />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={<EmptyState title={t('employers.empty')} />}
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
              <Pressable
                onPress={() =>
                  item.company && navigation.navigate('CompanyDetail', { id: item.company.id })
                }
                style={s.cardTop}
              >
                <Avatar
                  initials={item.fullName
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}
                />
                <View style={s.grow}>
                  <View style={s.row}>
                    <Text style={text.cardTitle} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                    <StatusPill
                      value={item.verified ? 'VERIFIED' : 'PENDING'}
                      label={item.verified ? t('common.verified') : t('common.unverified')}
                    />
                  </View>
                  <Text style={text.caption} numberOfLines={1}>
                    {item.company?.name ?? t('employers.noCompanyLinked')}
                  </Text>
                  <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={1}>
                    {item.code} · {item.email}
                  </Text>
                </View>
              </Pressable>
              <Button
                label={item.verified ? t('companyDetail.revokeVerification') : t('employers.verifyEmployer')}
                variant={item.verified ? 'danger' : 'success'}
                loading={busyId === item.id}
                onPress={() => toggleVerified(item)}
                style={s.verifyButton}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    newButton: { ...text.label, color: colors.primary },
    list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    verifyButton: { alignSelf: 'flex-start' },
  });
}
