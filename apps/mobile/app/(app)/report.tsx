import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createReportSchema,
  type MyReport,
  type ReportCategory,
  type ReportTarget,
} from '@workflex/shared';
import { createReport, fetchMyReports } from '../../src/api/reports';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * Categories, in the order they are offered.
 *
 * Money and safety first, technical last. Someone who has just been cheated
 * should not scroll past "app problem" to say so, and the order also matches
 * how urgently the console needs to act.
 */
const CATEGORIES: { value: ReportCategory; icon: string; label: TranslationKey }[] = [
  { value: 'FRAUD', icon: '🚫', label: 'report.cat.FRAUD' },
  { value: 'NON_PAYMENT', icon: '💸', label: 'report.cat.NON_PAYMENT' },
  { value: 'MISLEADING_PAY', icon: '⚖️', label: 'report.cat.MISLEADING_PAY' },
  { value: 'FAKE_JOB', icon: '🎭', label: 'report.cat.FAKE_JOB' },
  { value: 'HARASSMENT', icon: '🛑', label: 'report.cat.HARASSMENT' },
  { value: 'UNSAFE_WORK', icon: '⚠️', label: 'report.cat.UNSAFE_WORK' },
  { value: 'FAKE_PROFILE', icon: '👤', label: 'report.cat.FAKE_PROFILE' },
  { value: 'TECHNICAL', icon: '🐞', label: 'report.cat.TECHNICAL' },
  { value: 'OTHER', icon: '💬', label: 'report.cat.OTHER' },
];

const TARGETS: { value: ReportTarget; label: TranslationKey }[] = [
  { value: 'PERSON', label: 'report.target.PERSON' },
  { value: 'JOB', label: 'report.target.JOB' },
  { value: 'SYSTEM', label: 'report.target.SYSTEM' },
  { value: 'OTHER', label: 'report.target.OTHER' },
];

const CATEGORY_LABELS: Record<ReportCategory, TranslationKey> =
  Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<
    ReportCategory,
    TranslationKey
  >;

const STATUS_LABELS: Record<MyReport['status'], TranslationKey> = {
  OPEN: 'report.status.OPEN',
  IN_REVIEW: 'report.status.IN_REVIEW',
  ACTION_TAKEN: 'report.status.ACTION_TAKEN',
  DISMISSED: 'report.status.DISMISSED',
};

export default function ReportScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  // Reached from a job's detail screen with the posting already chosen, so
  // nobody has to describe which listing they mean.
  const { jobId, jobTitle } = useLocalSearchParams<{
    jobId?: string;
    jobTitle?: string;
  }>();

  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [target, setTarget] = useState<ReportTarget>(jobId ? 'JOB' : 'PERSON');
  const [targetPhone, setTargetPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchMyReports,
  });

  const submit = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      setCategory(null);
      setSubject('');
      setDetails('');
      setTargetPhone('');
      setError(null);
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) => {
      setSent(false);
      setError(errorMessage(err));
    },
  });

  const onSubmit = () => {
    // Validated with the schema the server enforces, so the rules cannot
    // drift apart and the user hears about a short description here rather
    // than after a round trip.
    const parsed = createReportSchema.safeParse({
      category,
      targetType: target,
      targetJobId: target === 'JOB' ? jobId : undefined,
      targetPhone: target === 'PERSON' ? targetPhone : undefined,
      subject,
      details,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('error.VALIDATION_FAILED'));
      return;
    }
    submit.mutate(parsed.data);
  };

  const clear = () => {
    if (error) setError(null);
    if (sent) setSent(false);
  };

  const reports = data?.reports ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>← {t('notif.back')}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: c.text }]}>{t('report.title')}</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {t('report.subtitle')}
          </Text>

          <View
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[styles.label, { color: c.text }]}>
              {t('report.whatHappened')}
            </Text>
            <View style={styles.options}>
              {CATEGORIES.map((option) => (
                <Option
                  key={option.value}
                  label={`${option.icon} ${t(option.label)}`}
                  on={category === option.value}
                  onPress={() => {
                    setCategory(option.value);
                    clear();
                  }}
                />
              ))}
            </View>

            <Text style={[styles.label, styles.spaced, { color: c.text }]}>
              {t('report.aboutWhat')}
            </Text>
            {jobId ? (
              // Arrived from a job, so the posting is fixed — offering a
              // picker here would invite changing it by accident.
              <View
                style={[
                  styles.fixedTarget,
                  { backgroundColor: c.surfaceAlt, borderColor: c.border },
                ]}
              >
                <Text style={[styles.fixedTargetText, { color: c.text }]} numberOfLines={2}>
                  🎯 {jobTitle ?? t('report.target.JOB')}
                </Text>
              </View>
            ) : (
              <View style={styles.options}>
                {TARGETS.map((option) => (
                  <Option
                    key={option.value}
                    label={t(option.label)}
                    on={target === option.value}
                    onPress={() => {
                      setTarget(option.value);
                      clear();
                    }}
                  />
                ))}
              </View>
            )}

            {!jobId && target === 'PERSON' ? (
              <>
                <Text style={[styles.label, styles.spaced, { color: c.text }]}>
                  {t('report.theirPhone')}
                </Text>
                <TextInput
                  value={targetPhone}
                  onChangeText={(v) => {
                    setTargetPhone(v);
                    clear();
                  }}
                  placeholder="01XXXXXXXXX"
                  placeholderTextColor={c.textMuted}
                  keyboardType="phone-pad"
                  maxLength={20}
                  style={[
                    styles.input,
                    { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.text },
                  ]}
                />
              </>
            ) : null}

            <Text style={[styles.label, styles.spaced, { color: c.text }]}>
              {t('report.subject')}
            </Text>
            <TextInput
              value={subject}
              onChangeText={(v) => {
                setSubject(v);
                clear();
              }}
              placeholder={t('report.subjectHint')}
              placeholderTextColor={c.textMuted}
              maxLength={140}
              style={[
                styles.input,
                { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.text },
              ]}
            />

            <Text style={[styles.label, styles.spaced, { color: c.text }]}>
              {t('report.details')}
            </Text>
            <TextInput
              value={details}
              onChangeText={(v) => {
                setDetails(v);
                clear();
              }}
              placeholder={t('report.detailsHint')}
              placeholderTextColor={c.textMuted}
              multiline
              numberOfLines={6}
              maxLength={4000}
              textAlignVertical="top"
              style={[
                styles.input,
                styles.textarea,
                { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.text },
              ]}
            />

            <ErrorBanner message={error} />

            {sent ? (
              <View
                style={[
                  styles.sentNote,
                  { backgroundColor: c.successSoft, borderColor: c.success },
                ]}
              >
                <Text style={[styles.sentText, { color: c.success }]}>
                  {t('report.sent')}
                </Text>
              </View>
            ) : null}

            <View style={styles.submit}>
              <ShimmerButton
                label={t('report.submit')}
                onPress={onSubmit}
                loading={submit.isPending}
              />
            </View>

            <Text style={[styles.privacy, { color: c.textMuted }]}>
              {t('report.privacy')}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {t('report.mine')}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={c.primary} style={styles.loading} />
          ) : reports.length === 0 ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              {t('report.noneYet')}
            </Text>
          ) : (
            reports.map((report) => (
              <ReportCard key={report.id} report={report} locale={locale} />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Option({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[
        styles.option,
        {
          backgroundColor: on ? c.primarySoft : c.surfaceAlt,
          borderColor: on ? c.primary : c.border,
        },
      ]}
    >
      <Text style={[styles.optionText, { color: c.text }]}>
        {on ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function ReportCard({
  report,
  locale,
}: {
  report: MyReport;
  locale: 'en' | 'bn';
}) {
  const t = useT();
  const { c } = useTheme();

  // Only the two endings are coloured — an open report is neither good news
  // nor bad, and tinting it either way would misrepresent a decision that
  // has not been made.
  const tone =
    report.status === 'ACTION_TAKEN'
      ? { bg: c.successSoft, border: c.success, text: c.success }
      : report.status === 'DISMISSED'
        ? { bg: c.surfaceAlt, border: c.border, text: c.textMuted }
        : { bg: c.warningSoft, border: c.warningBorder, text: c.warning };

  return (
    <View style={[styles.report, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.reportTop}>
        <Text style={[styles.reportSubject, { color: c.text }]} numberOfLines={2}>
          {report.subject}
        </Text>
        <View
          style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}
        >
          <Text style={[styles.pillText, { color: tone.text }]}>
            {t(STATUS_LABELS[report.status])}
          </Text>
        </View>
      </View>

      <Text style={[styles.reportMeta, { color: c.textMuted }]}>
        {t(CATEGORY_LABELS[report.category])}
        {report.targetJobTitle ? ` · ${report.targetJobTitle}` : ''}
      </Text>

      <Text style={[styles.reportBody, { color: c.textMuted }]}>{report.details}</Text>

      {report.response ? (
        <View style={[styles.reply, { borderLeftColor: c.primary }]}>
          <Text style={[styles.replyLabel, { color: c.primary }]}>
            {t('report.reply')}
          </Text>
          <Text style={[styles.replyText, { color: c.text }]}>{report.response}</Text>
        </View>
      ) : null}

      <Text style={[styles.reportDate, { color: c.textMuted }]}>
        {new Date(report.createdAt).toLocaleDateString(
          locale === 'bn' ? 'bn-BD' : 'en-GB',
          { day: 'numeric', month: 'short', year: 'numeric' },
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { fontSize: font.sm, fontWeight: '700' },
  scroll: { padding: space.md, paddingBottom: space.xl },

  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 8 },
  spaced: { marginTop: 16 },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  optionText: { fontSize: font.xs + 1, fontWeight: '600' },

  fixedTarget: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fixedTargetText: { fontSize: font.sm, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: font.md,
  },
  textarea: { minHeight: 130, paddingTop: 11 },

  sentNote: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 11,
    marginTop: 12,
  },
  sentText: { fontSize: font.sm, fontWeight: '600' },
  submit: { marginTop: 16 },
  privacy: { fontSize: font.xs, lineHeight: 17, marginTop: 12 },

  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  loading: { marginTop: space.md },
  empty: { fontSize: font.sm, lineHeight: 20 },

  report: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  reportTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reportSubject: { flex: 1, fontSize: font.md, fontWeight: '700' },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: { fontSize: font.xs - 1, fontWeight: '800' },
  reportMeta: { fontSize: font.xs, marginTop: 6, fontWeight: '600' },
  reportBody: { fontSize: font.sm, lineHeight: 20, marginTop: 8 },

  reply: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 12 },
  replyLabel: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4 },
  replyText: { fontSize: font.sm, lineHeight: 20, marginTop: 3 },
  reportDate: { fontSize: font.xs, marginTop: 10 },
});
