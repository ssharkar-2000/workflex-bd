import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page, Worker, WorkerStatus } from '../api/types';
import { Avatar, Chip, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { experience, taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Filter = 'ALL' | WorkerStatus;
type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

export function WorkersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [filter, setFilter] = useState<Filter>('ALL');

  const counts = useApi<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
  }>('/workers/status-counts');

  const query = filter === 'ALL' ? '' : `?status=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<Worker>>(`/workers${query}`, [filter]);

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Text style={text.screenTitle}>{t('workers.title')}</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t('common.all'), count: counts.data?.total },
            { value: 'ACTIVE', label: t('workers.active'), count: counts.data?.active },
            { value: 'PENDING', label: t('workers.pending'), count: counts.data?.pending },
            { value: 'SUSPENDED', label: t('workers.suspended'), count: counts.data?.suspended },
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
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPress={() => navigation.navigate('WorkerProfile', { id: item.id })}
              styles={s}
              text={text}
              shadow={shadow}
              t={t}
              tint={categoryTint(categoryPalette, item.id).bg}
            />
          )}
        />
      )}
    </View>
  );
}

function WorkerCard({
  worker,
  onPress,
  styles,
  text,
  shadow,
  t,
  tint,
}: {
  worker: Worker;
  onPress: () => void;
  styles: Styles;
  text: Txt;
  shadow: { card: object };
  t: (key: string, vars?: Record<string, string | number>) => string;
  tint?: string;
}) {
  const skills = worker.skills ?? [];
  const shown = skills.slice(0, 3);
  const extra = skills.length - shown.length;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadow.card, tint ? { backgroundColor: tint } : null, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Avatar initials={worker.initials} />
        <View style={styles.grow}>
          <View style={styles.nameRow}>
            <Text style={text.cardTitle} numberOfLines={1}>
              {worker.fullName}
            </Text>
            <StatusPill value={worker.status} />
          </View>
          <Text style={text.caption} numberOfLines={1}>
            {worker.profession} · {experience(worker.experienceMonths, t)}
          </Text>
          <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={1}>
            📍 {worker.address}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {shown.map((skill) => (
          <Chip key={skill.name} label={skill.name} />
        ))}
        {extra > 0 ? <Chip label={t('workers.moreSkills', { count: extra })} /> : null}
      </View>

      <View style={styles.statRow}>
        <Stat value={worker.rating.toFixed(1)} label={t('workers.rating')} styles={styles} text={text} />
        <Stat value={String(worker.totalJobs)} label={t('menu.jobs')} styles={styles} text={text} />
        <Stat value={`${worker.trustScore}%`} label={t('workers.trust')} styles={styles} text={text} />
        <Stat value={worker.salaryMin ? taka(worker.salaryMin) : '—'} label={t('workers.salary')} styles={styles} text={text} />
      </View>

      <View style={styles.footer}>
        <Text style={text.micro} numberOfLines={1}>
          {t('workers.last', { company: worker.lastCompany ?? t('workers.noHistory') })}
        </Text>
        <Chip label={worker.availability === 'FULL_TIME' ? t('workers.fullTime') : t('workers.partTime')} />
      </View>
    </Pressable>
  );
}

function Stat({ value, label, styles, text }: { value: string; label: string; styles: Styles; text: Txt }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={text.micro}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg },
    list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },

    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
    pressed: { opacity: 0.9 },
    cardTop: { flexDirection: 'row', gap: spacing.md },
    grow: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },

    statRow: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 14, fontWeight: '700', color: colors.textDark },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
  });
}
