import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  jobCategoryName,
  type JobFilterState,
  type JobListing,
  type JobType,
  type WorkplaceType,
} from '@workflex/shared';
import {
  fetchCategoryCounts,
  fetchJobs,
  toggleSavedJob,
} from '../../src/api/jobs';
import { JobFilterBar } from '../../src/components/jobs/JobFilterBar';
import { NotificationBell } from '../../src/components/NotificationBell';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

const JOB_TYPE_KEYS: Record<JobType, TranslationKey> = {
  FULL_TIME: 'jobs.type.FULL_TIME',
  PART_TIME: 'jobs.type.PART_TIME',
  PERMANENT: 'jobs.type.PERMANENT',
  CONTRACT: 'jobs.type.CONTRACT',
  FREELANCE: 'jobs.type.FREELANCE',
  INTERNSHIP: 'jobs.type.INTERNSHIP',
  TEMPORARY: 'jobs.type.TEMPORARY',
  SEASONAL: 'jobs.type.SEASONAL',
  SHIFT_BASED: 'jobs.type.SHIFT_BASED',
  ONE_TIME: 'jobs.type.ONE_TIME',
};

const PAYMENT_KEYS: Record<JobListing['paymentType'], TranslationKey> = {
  HOURLY: 'jobs.pay.HOURLY',
  DAILY: 'jobs.pay.DAILY',
  WEEKLY: 'jobs.pay.WEEKLY',
  MONTHLY: 'jobs.pay.MONTHLY',
  FIXED_PROJECT: 'jobs.pay.FIXED_PROJECT',
  NEGOTIABLE: 'jobs.pay.NEGOTIABLE',
};

const WORKPLACE_KEYS: Record<WorkplaceType, TranslationKey> = {
  ONSITE: 'jobs.place.ONSITE',
  REMOTE: 'jobs.place.REMOTE',
  HYBRID: 'jobs.place.HYBRID',
};

const URGENCY_KEYS: Record<JobListing['urgency'], TranslationKey> = {
  IMMEDIATE: 'jobs.urg.IMMEDIATE',
  WITHIN_24H: 'jobs.urg.WITHIN_24H',
  WITHIN_3_DAYS: 'jobs.urg.WITHIN_3_DAYS',
  THIS_WEEK: 'jobs.urg.THIS_WEEK',
  NONE: 'jobs.urg.NONE',
};

const DURATION_KEYS: Record<JobListing['duration'], TranslationKey> = {
  ONE_TIME: 'jobs.dur.ONE_TIME',
  ONE_DAY: 'jobs.dur.ONE_DAY',
  FEW_DAYS: 'jobs.dur.FEW_DAYS',
  ONE_WEEK: 'jobs.dur.ONE_WEEK',
  ONE_MONTH: 'jobs.dur.ONE_MONTH',
  THREE_TO_SIX_MONTHS: 'jobs.dur.THREE_TO_SIX_MONTHS',
  LONG_TERM: 'jobs.dur.LONG_TERM',
};

const EXPERIENCE_KEYS: Record<JobListing['experienceLevel'], TranslationKey> = {
  ENTRY: 'jobs.exp.ENTRY',
  ONE_TO_THREE: 'jobs.exp.ONE_TO_THREE',
  THREE_TO_FIVE: 'jobs.exp.THREE_TO_FIVE',
  FIVE_PLUS: 'jobs.exp.FIVE_PLUS',
};

export default function JobsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');

  // Everything the sheet owns. The search box and the two shortcut chips
  // stay outside it, because those are reached constantly and a sheet for
  // one tap is friction.
  const [sheet, setSheet] = useState<JobFilterState>({});

  const filters: JobFilterState = useMemo(
    () => ({ ...sheet, q: applied || undefined }),
    [sheet, applied],
  );

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['jobs', filters],
    queryFn: ({ pageParam }) => fetchJobs(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const { data: counts } = useQuery({
    queryKey: ['jobs', 'category-counts'],
    queryFn: fetchCategoryCounts,
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: toggleSavedJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  // From the first page, which carries the count for the whole filtered set —
  // not `items.length`, which only counts what has been scrolled into view.
  const total = data?.pages[0]?.total ?? 0;

  const clearFilters = useCallback(() => {
    setSheet({});
    setSearch('');
    setApplied('');
  }, []);

  // Counts selected *values*, not groups — picking three job types reads as
  // three active filters, which is what the number on the button implies.
  const filterCount = Object.entries(sheet).reduce((n, [key, value]) => {
    if (key === 'q' || value === undefined) return n;
    if (Array.isArray(value)) return n + value.length;
    return n + 1;
  }, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {t('jobs.title')}
        </Text>
        <NotificationBell />
      </View>

      <View style={styles.searchWrap}>
        <View
          style={[
            styles.search,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setApplied(search.trim())}
            returnKeyType="search"
            placeholder={t('jobs.searchHint')}
            placeholderTextColor={c.textMuted}
            style={[styles.searchInput, { color: c.text }]}
          />
          {search ? (
            <Pressable
              onPress={() => {
                setSearch('');
                setApplied('');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.clearSearch')}
            >
              <Text style={[styles.clear, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Every filter named on screen, each opening its own dropdown. */}
      <JobFilterBar
        value={sheet}
        onChange={setSheet}
        onClear={clearFilters}
        activeCount={filterCount + (applied ? 1 : 0)}
        categoryCounts={counts}
      />

      <Text style={[styles.count, { color: c.textMuted }]}>
        {t('jobs.available', { count: total })}
      </Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={errorMessage(error)} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(j) => j.id}
          contentContainerStyle={
            items.length === 0 ? styles.emptyWrap : styles.list
          }
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {t('jobs.emptyTitle')}
              </Text>
              <Text style={[styles.emptyBody, { color: c.textMuted }]}>
                {t('jobs.emptyBody')}
              </Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={c.primary} style={styles.more} />
            ) : null
          }
          renderItem={({ item, index }) => (
            <JobCard
              job={item}
              index={index}
              onOpen={() =>
                router.push({ pathname: '/(app)/job/[id]', params: { id: item.id } })
              }
              onToggleSave={() => save.mutate(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function JobCard({
  job,
  index,
  onOpen,
  onToggleSave,
}: {
  job: JobListing;
  index: number;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  const tint = c.tints[index % c.tints.length];
  const tintBorder = c.tintBorders[index % c.tintBorders.length];

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${job.companyName}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTop}>
        {/* Initials, not a logo: postings carry no image yet, and an empty
            square reads as a failed load. */}
        <View
          style={[styles.logo, { backgroundColor: tint, borderColor: tintBorder }]}
        >
          <Text style={[styles.logoText, { color: c.text }]}>
            {job.companyInitials}
          </Text>
        </View>

        <Pressable
          onPress={onToggleSave}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ selected: job.saved }}
          accessibilityLabel={t(job.saved ? 'jobs.unsave' : 'jobs.save')}
        >
          {/* Same glyph in both states, faded when unsaved. Two different
              emoji read as two different actions — the 🏷 outline variant in
              particular renders as a price tag, not a bookmark. */}
          <Text style={[styles.bookmark, !job.saved && styles.bookmarkOff]}>
            🔖
          </Text>
        </Pressable>
      </View>

      {job.urgency !== 'NONE' ? (
        <View
          style={[
            styles.urgent,
            { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
          ]}
        >
          <Text style={[styles.urgentText, { color: c.danger }]}>
            🔥 {t(URGENCY_KEYS[job.urgency])}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.jobTitle, { color: c.text }]} numberOfLines={2}>
        {job.title}
      </Text>
      <Text style={[styles.company, { color: c.textMuted }]} numberOfLines={1}>
        {job.companyName} · {job.location}
      </Text>

      <View style={styles.metaRow}>
        {job.daysLeft !== null ? (
          <Meta text={t('jobs.daysLeft', { count: job.daysLeft })} />
        ) : null}
        <Meta text={t(EXPERIENCE_KEYS[job.experienceLevel])} />
        <Meta text={t(WORKPLACE_KEYS[job.workplaceType])} />
        <Meta text={t(DURATION_KEYS[job.duration])} />
      </View>

      <View style={styles.tagRow}>
        <View
          style={[styles.tag, { backgroundColor: tint, borderColor: tintBorder }]}
        >
          <Text style={[styles.tagText, { color: c.text }]}>
            {jobCategoryName(job.category, locale)}
          </Text>
        </View>
        <View
          style={[
            styles.tag,
            { backgroundColor: c.surfaceAlt, borderColor: c.border },
          ]}
        >
          <Text style={[styles.tagText, { color: c.textMuted }]}>
            {t(JOB_TYPE_KEYS[job.jobType])}
          </Text>
        </View>
        <View
          style={[
            styles.tag,
            { backgroundColor: c.successSoft, borderColor: c.success },
          ]}
        >
          <Text style={[styles.tagText, { color: c.success }]}>
            {formatPay(job, t(PAYMENT_KEYS[job.paymentType]))}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Turns the numeric bounds into the label on the card.
 *
 * The cadence has to be on it — "৳500 – ৳900" is meaningless without knowing
 * whether that is a day or a month, and in this marketplace both are common.
 * A posting with no figures shows its payment type alone, which at least says
 * "negotiable" or "hourly" rather than leaving the tile blank.
 */
function formatPay(job: JobListing, cadence: string): string {
  const money = (n: number) => `৳${n.toLocaleString('en-US')}`;
  if (job.salaryMin !== null && job.salaryMax !== null) {
    return `${money(job.salaryMin)} – ${money(job.salaryMax)} · ${cadence}`;
  }
  if (job.salaryMin !== null) return `${money(job.salaryMin)}+ · ${cadence}`;
  if (job.salaryMax !== null) return `up to ${money(job.salaryMax)} · ${cadence}`;
  return cadence;
}

function Meta({ text }: { text: string }) {
  const { c } = useTheme();
  return <Text style={[styles.meta, { color: c.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: space.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  back: { fontSize: 22, fontWeight: '700' },
  title: { flex: 1, fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },

  searchWrap: { paddingHorizontal: space.md, paddingVertical: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 46,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: font.md, paddingVertical: 0 },
  clear: { fontSize: 15, fontWeight: '700', paddingHorizontal: 2 },

  count: {
    fontSize: font.sm,
    fontWeight: '600',
    paddingHorizontal: space.md,
    paddingTop: 4,
    paddingBottom: space.sm,
  },

  list: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: 10 },
  more: { marginVertical: space.md },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  cardPressed: { opacity: 0.72 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: font.sm, fontWeight: '800' },
  bookmark: { fontSize: 18 },
  bookmarkOff: { opacity: 0.3 },

  urgent: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 10,
  },
  urgentText: { fontSize: font.xs - 1, fontWeight: '800' },
  jobTitle: { fontSize: font.md, fontWeight: '800', marginTop: 8 },
  company: { fontSize: font.sm, marginTop: 3 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { fontSize: font.xs },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: { fontSize: font.xs - 1, fontWeight: '700' },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: space.lg },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
});
