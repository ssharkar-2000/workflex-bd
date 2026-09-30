import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  jobCategoryName,
  opportunityResponseSchema,
  type OpportunityResponse,
} from '@workflex/shared';
import { api } from '../../api/client';
import { useLocale, useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

async function fetchOpportunity(): Promise<OpportunityResponse> {
  const { data } = await api.get('/jobs/opportunity');
  return opportunityResponseSchema.parse(data);
}

/**
 * Where the work is, in one line.
 *
 * Both numbers are counts of rows that exist — open postings in this kind of
 * work in this person's own division, and accounts there whose CV points at
 * it. The card says "high demand" only when the first clearly outnumbers the
 * second.
 *
 * It renders nothing at all when there is nothing honest to say: no area on
 * the account, too few postings, or no category worth naming. A banner that
 * always finds an opportunity is one people stop reading by the third day,
 * and then they miss the week it actually matters.
 */
export function OpportunityNearYou() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { c } = useTheme();

  const { data } = useQuery({
    queryKey: ['opportunity'],
    queryFn: fetchOpportunity,
    staleTime: 600_000,
  });

  const one = data?.opportunity;
  if (!one) return null;

  const work = jobCategoryName(one.category, locale);

  return (
    <View style={[s.card, { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder }]}>
      <Text style={[s.where, { color: c.primary }]} numberOfLines={1}>
        {t('opp.title')} · {one.area}
      </Text>

      <Text style={[s.headline, { color: c.text }]}>
        {one.highDemand
          ? t('opp.high', { work, area: one.area })
          : t('opp.some', { work, area: one.area })}
      </Text>

      <View style={s.counts}>
        <View style={s.count}>
          <Text style={[s.countValue, { color: c.text }]}>{one.openJobs}</Text>
          <Text style={[s.countLabel, { color: c.textMuted }]}>{t('opp.openJobs')}</Text>
        </View>
        <View style={s.count}>
          <Text style={[s.countValue, { color: c.text }]}>{one.matchingWorkers}</Text>
          <Text style={[s.countLabel, { color: c.textMuted }]}>{t('opp.workers')}</Text>
        </View>

        <Pressable
          onPress={() =>
            router.push({ pathname: '/(app)/jobs', params: { q: one.area } })
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            s.button,
            { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={s.buttonText}>{t('opp.view')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  where: { fontSize: font.xs, fontWeight: '800' },
  headline: { fontSize: font.sm + 2, fontWeight: '800', lineHeight: 22, marginTop: 4 },

  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  count: {},
  countValue: { fontSize: font.md, fontWeight: '900' },
  countLabel: { fontSize: font.xs - 1 },

  button: {
    marginLeft: 'auto',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  buttonText: { color: '#FFFFFF', fontSize: font.xs, fontWeight: '800' },
});
