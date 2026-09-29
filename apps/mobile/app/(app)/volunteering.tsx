import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { volunteerIdeasSchema, type VolunteerIdeas } from '@workflex/shared';
import { api } from '../../src/api/client';
import { fetchJobs } from '../../src/api/jobs';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

async function fetchVolunteerIdeas(): Promise<VolunteerIdeas> {
  const { data } = await api.get('/jobs/volunteer-ideas', { timeout: 60_000 });
  return volunteerIdeasSchema.parse(data);
}

/**
 * The Volunteer Board.
 *
 * Two halves, and the difference between them is the point.
 *
 * Above: volunteering posted on WorkFlex BD itself — real listings with an
 * organiser, a place and a date, that can be applied to like any other job.
 *
 * Below: kinds of volunteering worth looking for, each opening a Google
 * search run where the person is. Not events. A model asked for "blood
 * donation camps in Mirpur this week" invents one, with a date and a street,
 * and somebody spends bus fare they do not have getting to a camp that was
 * never happening. The search finds what is genuinely on today.
 */
export default function VolunteeringScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const postings = useQuery({
    queryKey: ['jobs', 'volunteer'],
    queryFn: () => fetchJobs({ categories: ['VOLUNTEER'] } as never),
  });

  const ideas = useQuery({
    queryKey: ['volunteer-ideas'],
    queryFn: fetchVolunteerIdeas,
    staleTime: 600_000,
  });

  const listed = postings.data?.items ?? [];

  return (
    <MoneyScreen title={t('volunteer.title')} subtitle={t('volunteer.subtitle')}>
      <Text style={[s.heading, { color: c.text }]}>{t('volunteer.onPlatform')}</Text>

      {postings.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : listed.length === 0 ? (
        <Notice tone="info" body={t('volunteer.noneHere')} />
      ) : (
        listed.map((job) => (
          <Pressable
            key={job.id}
            onPress={() =>
              router.push({ pathname: '/(app)/job/[id]', params: { id: job.id } })
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              s.card,
              {
                backgroundColor: pressed ? c.surfaceAlt : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
              {job.companyName} · {job.location}
            </Text>
          </Pressable>
        ))
      )}

      <Text style={[s.heading, { color: c.text }]}>{t('volunteer.elsewhere')}</Text>
      <Text style={[s.note, { color: c.textMuted }]}>
        {t('volunteer.searchNote', { area: ideas.data?.area ?? '' })}
      </Text>

      {ideas.error ? (
        <ErrorBanner message={errorMessage(ideas.error)} tone="onSurface" />
      ) : null}

      {ideas.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (
        (ideas.data?.ideas ?? []).map((idea) => (
          <View
            key={idea.title}
            style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[s.cardTitle, { color: c.text }]}>{idea.title}</Text>
            {idea.organisers ? (
              <Text style={[s.meta, { color: c.textMuted }]}>{idea.organisers}</Text>
            ) : null}
            <Text style={[s.why, { color: c.text }]}>{idea.why}</Text>

            <Pressable
              onPress={() => void Linking.openURL(idea.searchUrl).catch(() => {})}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.find,
                {
                  borderColor: c.primary,
                  backgroundColor: pressed ? c.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[s.findText, { color: c.primary }]}>
                {t('volunteer.find')}
              </Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={[s.note, { color: c.textMuted }]}>{t('volunteer.footnote')}</Text>
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },
  loading: { marginTop: space.md },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardTitle: { fontSize: font.sm + 1, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 2 },
  why: { fontSize: font.sm, lineHeight: 20, marginTop: space.xs },

  find: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginTop: space.sm,
  },
  findText: { fontSize: font.xs, fontWeight: '800' },
});
