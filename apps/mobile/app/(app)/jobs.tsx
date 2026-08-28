import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
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
  JOB_CATEGORIES,
  jobCategoryName,
  type JobCategory,
  type JobListing,
  type JobType,
  type WorkplaceType,
} from '@workflex/shared';
import {
  fetchCategoryCounts,
  fetchJobs,
  toggleSavedJob,
  type JobFilters,
} from '../../src/api/jobs';
import { NotificationBell } from '../../src/components/NotificationBell';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

const JOB_TYPE_KEYS: Record<JobType, TranslationKey> = {
  FULL_TIME: 'jobs.type.FULL_TIME',
  PART_TIME: 'jobs.type.PART_TIME',
  CONTRACT: 'jobs.type.CONTRACT',
  TEMPORARY: 'jobs.type.TEMPORARY',
  INTERNSHIP: 'jobs.type.INTERNSHIP',
  ONE_TIME: 'jobs.type.ONE_TIME',
};

const WORKPLACE_KEYS: Record<WorkplaceType, TranslationKey> = {
  ONSITE: 'jobs.place.ONSITE',
  REMOTE: 'jobs.place.REMOTE',
  HYBRID: 'jobs.place.HYBRID',
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
  const [category, setCategory] = useState<JobCategory | null>(null);
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [workplace, setWorkplace] = useState<WorkplaceType | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);

  const filters: JobFilters = useMemo(
    () => ({
      q: applied || undefined,
      category: category ?? undefined,
      jobType: jobType ?? undefined,
      workplaceType: workplace ?? undefined,
      savedOnly: savedOnly || undefined,
    }),
    [applied, category, jobType, workplace, savedOnly],
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
    setCategory(null);
    setJobType(null);
    setWorkplace(null);
    setSavedOnly(false);
    setSearch('');
    setApplied('');
  }, []);

  const filterCount =
    (category ? 1 : 0) + (jobType ? 1 : 0) + (workplace ? 1 : 0) + (savedOnly ? 1 : 0);

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

      {/* Filter row. Horizontal because there are more chips than fit, and
          wrapping them would push the first job card off the screen. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {filterCount > 0 ? (
          <Chip label={`✕ ${t('jobs.clearAll')}`} active onPress={clearFilters} />
        ) : null}

        <Chip
          label={`🔖 ${t('jobs.saved')}`}
          active={savedOnly}
          onPress={() => setSavedOnly((v) => !v)}
        />

        <Cycler
          value={jobType}
          options={Object.keys(JOB_TYPE_KEYS) as JobType[]}
          onChange={setJobType}
          render={(v) => t(JOB_TYPE_KEYS[v])}
          placeholder={t('jobs.anyType')}
        />

        <Cycler
          value={workplace}
          options={Object.keys(WORKPLACE_KEYS) as WorkplaceType[]}
          onChange={setWorkplace}
          render={(v) => t(WORKPLACE_KEYS[v])}
          placeholder={t('jobs.anyPlace')}
        />
      </ScrollView>

      {/* Categories get their own row: twenty of them would swamp the filters
          above, and this is the axis people actually browse by. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {JOB_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.key}
            info={cat}
            count={counts?.[cat.key]}
            active={category === cat.key}
            onPress={() =>
              setCategory((current) => (current === cat.key ? null : cat.key))
            }
          />
        ))}
      </ScrollView>

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
              onToggleSave={() => save.mutate(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.surface,
          borderColor: active ? c.primary : c.border,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? c.primaryText : c.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A chip that steps through its options on each tap and then back to "any".
 *
 * A dropdown would be the obvious control, but it needs a modal, a backdrop
 * and a list for what is at most six choices — and the row already scrolls
 * horizontally, so an open menu would fight it. Tapping through is one
 * gesture and shows the current value in the chip itself.
 */
function Cycler<T extends string>({
  value,
  options,
  onChange,
  render,
  placeholder,
}: {
  value: T | null;
  options: T[];
  onChange: (next: T | null) => void;
  render: (value: T) => string;
  placeholder: string;
}) {
  const next = () => {
    if (value === null) return onChange(options[0] ?? null);
    const i = options.indexOf(value);
    // Past the last option, back to unset — so the filter is always clearable
    // by tapping, without a separate reset control per chip.
    onChange(i === options.length - 1 ? null : (options[i + 1] ?? null));
  };

  return (
    <Chip
      label={`${value ? render(value) : placeholder} ⌄`}
      active={value !== null}
      onPress={next}
    />
  );
}

function CategoryChip({
  info,
  count,
  active,
  onPress,
}: {
  info: (typeof JOB_CATEGORIES)[number];
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const [locale] = useLocale();
  return (
    <Chip
      label={`${info.emoji} ${jobCategoryName(info.key, locale)}${
        count ? ` ${count}` : ''
      }`}
      active={active}
      onPress={onPress}
    />
  );
}

function JobCard({
  job,
  index,
  onToggleSave,
}: {
  job: JobListing;
  index: number;
  onToggleSave: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  const tint = c.tints[index % c.tints.length];
  const tintBorder = c.tintBorders[index % c.tintBorders.length];

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
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
        {job.salaryRange ? (
          <View
            style={[
              styles.tag,
              { backgroundColor: c.successSoft, borderColor: c.success },
            ]}
          >
            <Text style={[styles.tagText, { color: c.success }]}>
              {job.salaryRange}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
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

  /**
   * ScrollView's own base style is { flexGrow: 1, flexShrink: 1 }, so a
   * horizontal one placed in a flex column competes with its siblings for
   * height — and the job list, having far more content, wins and crushes the
   * chips to a few pixels. Opting these rows out of the flex negotiation
   * makes them size to their content instead.
   */
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    paddingHorizontal: space.md,
    gap: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipText: { fontSize: font.xs + 1, fontWeight: '700' },

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

  jobTitle: { fontSize: font.md, fontWeight: '800', marginTop: 10 },
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
