import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobCategoryName, type CvStatus } from '@workflex/shared';
import { fetchCvStatus, removeCv, uploadCv } from '../../src/api/cv';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * The CV screen.
 *
 * Shows back what was understood, not just that a file was accepted. The
 * extracted skills are the input to every match score in the app, so someone
 * has to be able to see them and notice when their CV was misread — a score
 * derived from an invisible profile is not something anyone can argue with.
 */
export default function CvScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cv'],
    queryFn: fetchCvStatus,
  });

  const afterChange = (next: CvStatus) => {
    queryClient.setQueryData(['cv'], next);
    // Every listing's match score is derived from this profile.
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    void queryClient.invalidateQueries({ queryKey: ['job'] });
  };

  const upload = useMutation({
    mutationFn: uploadCv,
    onSuccess: (next) => {
      setError(null);
      afterChange(next);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: removeCv,
    onSuccess: afterChange,
    onError: (err) => setError(errorMessage(err)),
  });

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    setError(null);
    upload.mutate({
      uri: asset.uri,
      name: asset.name || 'cv',
      mimeType: asset.mimeType || 'application/pdf',
    });
  };

  const confirmRemove = () => {
    Alert.alert(t('cv.removeTitle'), t('cv.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cv.remove'),
        style: 'destructive',
        onPress: () => remove.mutate(),
      },
    ]);
  };

  const profile = data?.profile ?? null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>← {t('notif.back')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: c.text }]}>{t('cv.title')}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {t('cv.subtitle')}
        </Text>

        {/* Said plainly rather than hidden: without parsing the upload still
            works, but no match scores appear, and the user should know why. */}
        {data && !data.parsingEnabled ? (
          <View
            style={[
              styles.notice,
              { backgroundColor: c.warningSoft, borderColor: c.warningBorder },
            ]}
          >
            <Text style={[styles.noticeText, { color: c.warning }]}>
              {t('cv.parsingOff')}
            </Text>
          </View>
        ) : null}

        <ErrorBanner message={error} />

        {isLoading ? (
          <ActivityIndicator color={c.primary} style={styles.loading} />
        ) : (
          <>
            <View style={styles.action}>
              <ShimmerButton
                label={data?.hasCv ? t('cv.replace') : t('cv.upload')}
                onPress={() => void pick()}
                loading={upload.isPending}
              />
            </View>

            {upload.isPending ? (
              <Text style={[styles.working, { color: c.textMuted }]}>
                {t('cv.reading')}
              </Text>
            ) : null}

            {profile ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t('cv.understood')}
                </Text>

                {profile.summary ? (
                  <Text style={[styles.summary, { color: c.textMuted }]}>
                    {profile.summary}
                  </Text>
                ) : null}

                <Field
                  label={t('cv.experience')}
                  value={
                    profile.yearsExperience !== null
                      ? t('cv.years', { count: profile.yearsExperience })
                      : t('job.notSpecified')
                  }
                />

                {profile.titles.length > 0 ? (
                  <Chips label={t('cv.titles')} values={profile.titles} />
                ) : null}

                {profile.skills.length > 0 ? (
                  <Chips label={t('cv.skills')} values={profile.skills} />
                ) : null}

                {profile.categories.length > 0 ? (
                  <Chips
                    label={t('cv.categories')}
                    values={profile.categories.map((k) =>
                      jobCategoryName(k, locale),
                    )}
                  />
                ) : null}

                <Text style={[styles.hint, { color: c.textMuted }]}>
                  {t('cv.correctHint')}
                </Text>
              </View>
            ) : data?.hasCv ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                {t('cv.storedNotParsed')}
              </Text>
            ) : null}

            {data?.hasCv ? (
              <Pressable
                onPress={confirmRemove}
                style={styles.removeRow}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.removeText, { color: c.danger }]}>
                  {remove.isPending ? t('cv.removing') : t('cv.remove')}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function Chips({ label, values }: { label: string; values: string[] }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <View style={styles.chips}>
        {values.map((v) => (
          <View
            key={v}
            style={[
              styles.chip,
              { backgroundColor: c.surfaceAlt, borderColor: c.border },
            ]}
          >
            <Text style={[styles.chipText, { color: c.text }]}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { fontSize: font.sm, fontWeight: '700' },
  scroll: { padding: space.md, paddingBottom: space.xl },

  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },

  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginTop: space.md,
  },
  noticeText: { fontSize: font.xs, lineHeight: 18 },

  loading: { marginTop: space.lg },
  action: { marginTop: space.md },
  working: { fontSize: font.xs, textAlign: 'center', marginTop: 10 },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  cardTitle: { fontSize: font.md, fontWeight: '800' },
  summary: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },

  field: { marginTop: 14 },
  fieldLabel: {
    fontSize: font.xs - 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldValue: { fontSize: font.sm, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: font.xs, fontWeight: '600' },

  hint: { fontSize: font.xs, lineHeight: 17, marginTop: 14 },
  removeRow: { alignItems: 'center', marginTop: space.lg, padding: 8 },
  removeText: { fontSize: font.sm, fontWeight: '700' },
});
