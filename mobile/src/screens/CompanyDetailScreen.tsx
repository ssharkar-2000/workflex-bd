import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Avatar, Card, DetailRow, ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { colors, spacing, text } from '../theme';
import { longDate } from '../theme/format';

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
  const { data, loading, error, refetch } = useApi<CompanyDetail>(`/companies/${id}`);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Company</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.top}>
          <Avatar initials={data.initials} size={56} />
          <View style={s.grow}>
            <Text style={s.name}>{data.name}</Text>
            <Text style={text.caption}>{data.industry ?? 'Industry not set'}</Text>
          </View>
          {data.verified ? <StatusPill value="VERIFIED" label="Verified" /> : null}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="Address" value={data.address ?? '—'} />
        <DetailRow label="Registered" value={longDate(data.createdAt)} />
        <DetailRow label="Total jobs" value={String(data._count.jobs)} />
        <DetailRow label="Employers" value={String(data._count.employers)} />
      </Card>

      {data.employers.length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Employers" />
          {data.employers.map((e) => (
            <View key={e.id} style={s.row}>
              <Text style={text.body}>{e.fullName}</Text>
              <Text style={text.micro}>{e.code}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {data.jobs.length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Recent postings" />
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
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
});
