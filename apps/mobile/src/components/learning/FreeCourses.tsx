import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseCompletion, CourseSuggestion } from '@workflex/shared';
import {
  declareCourse,
  fetchCompletions,
  fetchCourses,
  uploadCertificate,
} from '../../api/courses';
import { ErrorBanner } from '../ErrorBanner';
import { Slideshow } from '../Slideshow';
import { useErrorMessage } from '../../lib/error-message';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * Where to go and learn what the CV is missing — and what came of it.
 *
 * The skill card above this says which skills the field is asking for that
 * this person cannot show. This answers the question that follows, with two
 * deliberate limits written into the screen rather than hidden.
 *
 * Every course links to a **search**, not to a course page. Free courses
 * move, get taken down, and quietly start charging; a search finds what is
 * actually on offer today, and cannot rot the way a saved link does. The
 * note under the heading says we cannot confirm a course is still free,
 * because we cannot.
 *
 * And finishing one is the person's own word. The certificate they upload is
 * a file, not a verification — an employer can look at it and decide. Saying
 * that plainly is the difference between a record and a false credential.
 */
export function FreeCourses() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [busyId, setBusyId] = useState<string | null>(null);

  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
    staleTime: 300_000,
  });

  const done = useQuery({
    queryKey: ['course-completions'],
    queryFn: fetchCompletions,
  });

  const finished = useMutation({
    mutationFn: (course: CourseSuggestion) =>
      declareCourse({
        title: course.title,
        provider: course.provider,
        url: course.searchUrl,
        skill: course.skill,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['course-completions'] }),
  });

  const certificate = useMutation({
    mutationFn: async (id: string) => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      if (!asset) return;

      await uploadCertificate(id, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      });
    },
    onSettled: () => {
      setBusyId(null);
      void queryClient.invalidateQueries({ queryKey: ['course-completions'] });
    },
  });

  if (courses.isLoading) {
    return <ActivityIndicator color={c.primary} style={s.loading} />;
  }

  const suggestions = courses.data?.courses ?? [];
  const completions = done.data?.completions ?? [];

  // Nothing to suggest and nothing done: the section says nothing rather
  // than showing an empty heading.
  if (suggestions.length === 0 && completions.length === 0) return null;

  /** Already claimed, so the card offers the certificate instead. */
  const claimed = (course: CourseSuggestion) =>
    completions.find(
      (row) => row.title === course.title && row.provider === course.provider,
    );

  return (
    <View>
      {suggestions.length > 0 ? (
        <>
          <Text style={[s.heading, { color: c.text }]}>{t('courses.title')}</Text>
          <Text style={[s.note, { color: c.textMuted }]}>
            {t(
              courses.data?.source === 'written'
                ? 'courses.noteWritten'
                : 'courses.noteAssembled',
            )}
          </Text>

          {courses.error ? (
            <ErrorBanner message={errorMessage(courses.error)} tone="onSurface" />
          ) : null}

          {/* One course at a time, the same rotation the recommended jobs
              use: five seconds each, then out to the right. A gap is worth
              reading about; five gaps stacked is a page people scroll past. */}
          <Slideshow
            items={suggestions}
            keyOf={(course) => `${course.provider}-${course.title}`}
            render={(course) => {
            const already = claimed(course);
            return (
              <View
                style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={[s.courseTitle, { color: c.text }]}>{course.title}</Text>
                <Text style={[s.meta, { color: c.textMuted }]}>
                  {course.provider}
                  {course.minutes
                    ? ` · ${t('courses.minutes', { count: course.minutes })}`
                    : ''}
                </Text>
                <Text style={[s.why, { color: c.text }]}>{course.why}</Text>

                <View style={s.actions}>
                  <Action
                    label={t('courses.find')}
                    primary
                    onPress={() => void Linking.openURL(course.searchUrl).catch(() => {})}
                  />
                  {already ? (
                    <Text style={[s.claimed, { color: c.success }]}>
                      {t('courses.alreadyDone')}
                    </Text>
                  ) : (
                    <Action
                      label={t('courses.iFinished')}
                      busy={finished.isPending}
                      onPress={() => finished.mutate(course)}
                    />
                  )}
                </View>
              </View>
            );
            }}
          />

          {finished.error ? (
            <ErrorBanner message={errorMessage(finished.error)} tone="onSurface" />
          ) : null}
        </>
      ) : null}

      {completions.length > 0 ? (
        <>
          <Text style={[s.heading, { color: c.text }]}>{t('courses.finished')}</Text>
          <Text style={[s.note, { color: c.textMuted }]}>
            {t('courses.finishedNote')}
          </Text>

          {completions.map((row) => (
            <Completion
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onUpload={() => {
                setBusyId(row.id);
                certificate.mutate(row.id);
              }}
            />
          ))}

          {certificate.error ? (
            <ErrorBanner message={errorMessage(certificate.error)} tone="onSurface" />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Completion({
  row,
  busy,
  onUpload,
}: {
  row: CourseCompletion;
  busy: boolean;
  onUpload: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const has = row.certificate !== null;

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.courseTitle, { color: c.text }]}>{row.title}</Text>
      <Text style={[s.meta, { color: c.textMuted }]}>
        {row.provider} · {new Date(row.declaredAt).toLocaleDateString('en-GB')}
      </Text>

      <Text style={[s.why, { color: has ? c.success : c.textMuted }]}>
        {has
          ? t('courses.certificateOn', { name: row.certificate?.name ?? '' })
          : t('courses.noCertificate')}
      </Text>

      <View style={s.actions}>
        <Action
          label={t(has ? 'courses.replaceCertificate' : 'courses.addCertificate')}
          busy={busy}
          onPress={onUpload}
        />
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  primary,
  busy,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.action,
        {
          borderColor: primary ? c.primary : c.primarySoftBorder,
          backgroundColor: pressed || primary ? c.primarySoft : 'transparent',
          opacity: busy ? 0.6 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={c.primary} size="small" />
      ) : (
        <Text style={[s.actionText, { color: c.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  courseTitle: { fontSize: font.sm + 1, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 2 },
  why: { fontSize: font.sm, lineHeight: 20, marginTop: space.xs },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  action: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  actionText: { fontSize: font.xs, fontWeight: '800' },
  claimed: { fontSize: font.xs, fontWeight: '800' },
});
