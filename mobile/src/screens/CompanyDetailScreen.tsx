import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Avatar, BackButton, Button, Card, DetailRow, ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type CompanyDetail = {
  id: string;
  name: string;
  initials: string;
  industry: string | null;
  address: string | null;
  verified: boolean;
  createdAt: string;
  employers: { id: string; fullName: string; code: string; verified: boolean }[];
  jobs: { id: string; title: string; status: string; postedAt: string }[];
  _count: { jobs: number; employers: number };
};

export function CompanyDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data, loading, error, refetch } = useApi<CompanyDetail>(`/companies/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const toggleVerified = async () => {
    setBusy(true);
    try {
      await api(`/companies/${id}`, { method: 'PATCH', body: { verified: !data.verified } });
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
      <Text style={text.screenTitle}>{t('companyDetail.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'top').bg }}>
        <View style={s.top}>
          <Avatar initials={data.initials} size={56} />
          <View style={s.grow}>
            <Text style={s.name} numberOfLines={1}>
              {data.name}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {data.industry ?? t('companies.industryNotSet')}
            </Text>
          </View>
          <StatusPill value={data.verified ? 'VERIFIED' : 'PENDING'} label={data.verified ? t('common.verified') : t('common.unverified')} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
        <DetailRow label={t('companyDetail.address')} value={data.address ?? '—'} />
        <DetailRow label={t('companyDetail.registered')} value={longDate(data.createdAt)} />
        <DetailRow label={t('companyDetail.totalJobs')} value={String(data._count.jobs)} />
        <DetailRow label={t('menu.employers')} value={String(data._count.employers)} />
      </Card>

      {data.employers.length > 0 ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'employers').bg }}>
          <SectionHeader title={t('menu.employers')} />
          {data.employers.map((e) => (
            <View key={e.id} style={s.row}>
              <Text style={text.body} numberOfLines={1}>
                {e.fullName}
              </Text>
              <Text style={text.micro}>{e.code}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {data.jobs.length > 0 ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'postings').bg }}>
          <SectionHeader title={t('companyDetail.recentPostings')} />
          {data.jobs.map((j) => (
            <View key={j.id} style={s.row}>
              <Text style={[text.body, s.grow]} numberOfLines={1}>
                {j.title}
              </Text>
              <StatusPill value={j.status} />
            </View>
          ))}
        </Card>
      ) : null}

      <View style={s.actions}>
        <Button
          label={data.verified ? t('companyDetail.revokeVerification') : t('companyDetail.verifyCompany')}
          variant={data.verified ? 'danger' : 'success'}
          loading={busy}
          onPress={toggleVerified}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    name: { fontSize: 17, fontWeight: '700', color: colors.textDark },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  });
}
