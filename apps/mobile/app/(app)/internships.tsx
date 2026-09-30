import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { internshipIdeasSchema, type InternshipIdeas } from '@workflex/shared';
import { api } from '../../src/api/client';
import { fetchJobs } from '../../src/api/jobs';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

async function fetchInternshipIdeas(): Promise<InternshipIdeas> {
  const { data } = await api.get('/jobs/internship-ideas', { timeout: 60_000 });
  return internshipIdeasSchema.parse(data);
}

/**
 * First Step — internships for people who have just finished studying.
 *
 * Built in two halves, like the Volunteer Board, and for the same reason.
 *
 * Above: internships posted on WorkFlex BD, which are real and can be applied
 * to from inside the app.
 *
 * Below: kinds of placement worth searching for, each opening a Google search
 * run where the person lives. Deliberately not named vacancies — intakes open
 * and close on their own calendar, and a graduate who spends a morning
 * applying to a programme that closed in March loses more than the morning.
 * The search shows whatever is genuinely open today.
 */
export default function InternshipsScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const postings = useQuery({
    queryKey: ['jobs', 'internship'],
    queryFn: () => fetchJobs({ jobTypes: ['INTERNSHIP'] }),
  });

  const ideas = useQuery({
    queryKey: ['internship-ideas'],
    queryFn: fetchInternshipIdeas,
    staleTime: 600_000,
  });

  const listed = postings.data?.items ?? [];

  return (
    <MoneyScreen title={t('internships.title')} subtitle={t('internships.subtitle')}>
      <Text style={[s.heading, { color: c.text }]}>{t('internships.onPlatform')}</Text>

      {postings.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : listed.length === 0 ? (
        <Notice tone="info" body={t('internships.noneHere')} />
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

      <Text style={[s.heading, { color: c.text }]}>{t('internships.elsewhere')}</Text>
      <Text style={[s.note, { color: c.textMuted }]}>
        {t('internships.searchNote', { area: ideas.data?.area ?? '' })}
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
            {idea.employers ? (
              <Text style={[s.meta, { color: c.textMuted }]}>{idea.employers}</Text>
            ) : null}
            <Text style={[s.why, { color: c.text }]}>{idea.why}</Text>

            {/* What it asks for, kept visually separate: it is the line that
                decides whether applying is worth the afternoon. */}
            {idea.asksFor ? (
              <View style={[s.asks, { backgroundColor: c.surfaceAlt }]}>
                <Text style={[s.asksLabel, { color: c.textMuted }]}>
                  {t('internships.asksFor')}
                </Text>
                <Text style={[s.asksBody, { color: c.text }]}>{idea.asksFor}</Text>
              </View>
            ) : null}

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
                {t('internships.find')}
              </Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={[s.note, { color: c.textMuted }]}>{t('internships.footnote')}</Text>
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

  asks: {
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    marginTop: space.sm,
  },
  asksLabel: { fontSize: font.xs - 1, fontWeight: '800', letterSpacing: 0.4 },
  asksBody: { fontSize: font.xs + 1, lineHeight: 18, marginTop: 2 },

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
