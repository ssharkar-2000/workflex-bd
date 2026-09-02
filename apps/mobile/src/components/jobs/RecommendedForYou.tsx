import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  jobCategoryName,
  type RecommendationReason,
  type RecommendedJob,
} from '@workflex/shared';
import { fetchRecommendations } from '../../api/jobs';
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

const REASON_LABELS: Record<RecommendationReason, TranslationKey> = {
  SKILLS: 'rec.reason.SKILLS',
  LOCATION: 'rec.reason.LOCATION',
  AVAILABILITY: 'rec.reason.AVAILABILITY',
  PREFERENCE: 'rec.reason.PREFERENCE',
};

const REASON_ICONS: Record<RecommendationReason, string> = {
  SKILLS: '🧠',
  LOCATION: '📍',
  AVAILABILITY: '⏰',
  PREFERENCE: '⭐',
};

/**
 * Suggestions built from what this account has actually done.
 *
 * The section removes itself when there is nothing to personalise on. A new
 * account with no CV and no history has told the system nothing, and filling
 * the row with arbitrary postings under a personalised heading is worse than
 * showing no row at all — it teaches people the section means nothing.
 */
export function RecommendedForYou() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: fetchRecommendations,
    // Suggestions change when the person saves or applies to something, which
    // already invalidates this key; a short stale time stops the dashboard
    // refetching on every glance.
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <View style={styles.section}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!data || data.items.length === 0) return null;

  // Only claim the signals that were actually used.
  const basis = (
    [
      ['skills', 'rec.basis.skills'],
      ['location', 'rec.basis.location'],
      ['availability', 'rec.basis.availability'],
      ['preferences', 'rec.basis.preferences'],
    ] as const
  )
    .filter(([key]) => data.basis[key])
    .map(([, label]) => t(label as TranslationKey));

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>
          ✨ {t('rec.title')}
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/jobs')}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.seeAll, { color: c.primary }]}>
            {t('rec.seeAll')}
          </Text>
        </Pressable>
      </View>

      {basis.length > 0 ? (
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {t('rec.subtitle', { signals: basis.join(', ') })}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // flexGrow/flexShrink zero, or the row collapses under the cards it
        // contains — ScrollView's own base style would otherwise win.
        style={styles.rail}
        contentContainerStyle={styles.railContent}
      >
        {data.items.map((item) => (
          <RecommendationCard
            key={item.job.id}
            item={item}
            onPress={() =>
              router.push({
                pathname: '/(app)/job/[id]',
                params: { id: item.job.id },
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function RecommendationCard({
  item,
  onPress,
}: {
  item: RecommendedJob;
  onPress: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.job.title}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.logo,
            { backgroundColor: c.tints[1], borderColor: c.tintBorders[1] },
          ]}
        >
          <Text style={[styles.logoText, { color: c.text }]}>
            {item.job.companyInitials}
          </Text>
        </View>
        <View
          style={[
            styles.fit,
            { backgroundColor: c.successSoft, borderColor: c.success },
          ]}
        >
          <Text style={[styles.fitText, { color: c.success }]}>
            {item.fit}%
          </Text>
        </View>
      </View>

      <Text style={[styles.jobTitle, { color: c.text }]} numberOfLines={2}>
        {item.job.title}
      </Text>
      <Text style={[styles.company, { color: c.textMuted }]} numberOfLines={1}>
        {item.job.companyName}
      </Text>
      <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
        {jobCategoryName(item.job.category, locale)} · {item.job.location}
      </Text>

      {/* Why this one, in the person's own terms. Capped at two so the card
          stays a card — the third reason adds little and costs a line. */}
      <View style={styles.reasons}>
        {item.reasons.slice(0, 2).map((reason) => (
          <View
            key={reason}
            style={[styles.chip, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
          >
            <Text style={[styles.chipText, { color: c.textMuted }]}>
              {REASON_ICONS[reason]} {t(REASON_LABELS[reason])}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },
  seeAll: { fontSize: font.sm, fontWeight: '800' },
  subtitle: { fontSize: font.xs, marginTop: 4, lineHeight: 16 },

  rail: { flexGrow: 0, flexShrink: 0, marginTop: space.md },
  railContent: { gap: 12, paddingRight: space.md },

  card: {
    width: 232,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: font.sm, fontWeight: '800' },
  fit: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  fitText: { fontSize: font.xs, fontWeight: '800' },

  jobTitle: { fontSize: font.md, fontWeight: '800' },
  company: { fontSize: font.xs, fontWeight: '600' },
  meta: { fontSize: font.xs },

  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: font.xs - 1, fontWeight: '700' },
});
