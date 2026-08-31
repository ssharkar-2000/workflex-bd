import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DIVISIONS,
  JOB_CATEGORIES,
  createJobSchema,
  districtsOf,
  divisionName,
  jobCategoryName,
  type CreateJobDto,
  type CreateJobInput,
  type Division,
  type JobCategory,
  type PostAs,
} from '@workflex/shared';
import { createJob } from '../../src/api/jobs';
import { fetchMe } from '../../src/api/auth';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * One screen, two shapes.
 *
 * Someone hiring a cleaner for three hours and a company hiring a permanent
 * engineer are answering different questions, and asking both sets of both
 * people would make each fill in fields that do not apply. The individual form
 * asks only what a person hiring at home actually knows; the company form adds
 * what a business posting needs — and is gated on an approved trade licence.
 */

type Choice<T extends string> = { value: T; label: TranslationKey };

const JOB_TYPES_INDIVIDUAL: Choice<string>[] = [
  { value: 'ONE_TIME', label: 'jobs.type.ONE_TIME' },
  { value: 'PART_TIME', label: 'jobs.type.PART_TIME' },
  { value: 'TEMPORARY', label: 'jobs.type.TEMPORARY' },
  { value: 'SHIFT_BASED', label: 'jobs.type.SHIFT_BASED' },
  { value: 'CONTRACT', label: 'jobs.type.CONTRACT' },
];

const JOB_TYPES_COMPANY: Choice<string>[] = [
  { value: 'FULL_TIME', label: 'jobs.type.FULL_TIME' },
  { value: 'PART_TIME', label: 'jobs.type.PART_TIME' },
  { value: 'PERMANENT', label: 'jobs.type.PERMANENT' },
  { value: 'CONTRACT', label: 'jobs.type.CONTRACT' },
  { value: 'INTERNSHIP', label: 'jobs.type.INTERNSHIP' },
  { value: 'SEASONAL', label: 'jobs.type.SEASONAL' },
  { value: 'SHIFT_BASED', label: 'jobs.type.SHIFT_BASED' },
];

const DURATIONS: Choice<string>[] = [
  { value: 'ONE_TIME', label: 'jobs.dur.ONE_TIME' },
  { value: 'ONE_DAY', label: 'jobs.dur.ONE_DAY' },
  { value: 'FEW_DAYS', label: 'jobs.dur.FEW_DAYS' },
  { value: 'ONE_WEEK', label: 'jobs.dur.ONE_WEEK' },
  { value: 'ONE_MONTH', label: 'jobs.dur.ONE_MONTH' },
  { value: 'THREE_TO_SIX_MONTHS', label: 'jobs.dur.THREE_TO_SIX_MONTHS' },
  { value: 'LONG_TERM', label: 'jobs.dur.LONG_TERM' },
];

const PAYMENT_TYPES: Choice<string>[] = [
  { value: 'HOURLY', label: 'jobs.pay.HOURLY' },
  { value: 'DAILY', label: 'jobs.pay.DAILY' },
  { value: 'WEEKLY', label: 'jobs.pay.WEEKLY' },
  { value: 'MONTHLY', label: 'jobs.pay.MONTHLY' },
  { value: 'FIXED_PROJECT', label: 'jobs.pay.FIXED_PROJECT' },
  { value: 'NEGOTIABLE', label: 'jobs.pay.NEGOTIABLE' },
];

const WORKING_TIMES: Choice<string>[] = [
  { value: 'MORNING', label: 'jobs.time.MORNING' },
  { value: 'AFTERNOON', label: 'jobs.time.AFTERNOON' },
  { value: 'EVENING', label: 'jobs.time.EVENING' },
  { value: 'NIGHT', label: 'jobs.time.NIGHT' },
  { value: 'FLEXIBLE', label: 'jobs.time.FLEXIBLE' },
];

const URGENCIES: Choice<string>[] = [
  { value: 'IMMEDIATE', label: 'jobs.urg.IMMEDIATE' },
  { value: 'WITHIN_24H', label: 'jobs.urg.WITHIN_24H' },
  { value: 'WITHIN_3_DAYS', label: 'jobs.urg.WITHIN_3_DAYS' },
  { value: 'THIS_WEEK', label: 'jobs.urg.THIS_WEEK' },
  { value: 'NONE', label: 'jobs.urg.NONE' },
];

const EXPERIENCE: Choice<string>[] = [
  { value: 'ENTRY', label: 'jobs.exp.ENTRY' },
  { value: 'ONE_TO_THREE', label: 'jobs.exp.ONE_TO_THREE' },
  { value: 'THREE_TO_FIVE', label: 'jobs.exp.THREE_TO_FIVE' },
  { value: 'FIVE_PLUS', label: 'jobs.exp.FIVE_PLUS' },
];

const WORKPLACES: Choice<string>[] = [
  { value: 'ONSITE', label: 'jobs.place.ONSITE' },
  { value: 'REMOTE', label: 'jobs.place.REMOTE' },
  { value: 'HYBRID', label: 'jobs.place.HYBRID' },
];

export default function PostJobScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const [postAs, setPostAs] = useState<PostAs>('INDIVIDUAL');

  // Shared
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<JobCategory | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [division, setDivision] = useState<Division | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [jobType, setJobType] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [workingTime, setWorkingTime] = useState('FLEXIBLE');
  const [paymentType, setPaymentType] = useState<string | null>(null);
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [urgency, setUrgency] = useState('NONE');
  const [vacancies, setVacancies] = useState('');

  // Company only
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('ENTRY');
  const [workplaceType, setWorkplaceType] = useState('ONSITE');
  const [requirements, setRequirements] = useState('');
  const [benefits, setBenefits] = useState('');

  const [error, setError] = useState<string | null>(null);

  /**
   * The validated posting, held while the person reads it back.
   *
   * Storing the parsed DTO rather than a flag means the summary shows exactly
   * what will be sent — including the defaults and coercions the schema
   * applied — instead of a second rendering of the form state that could
   * quietly disagree with it.
   */
  const [review, setReview] = useState<CreateJobDto | null>(null);

  const canPostAsCompany = me?.canPostCompanyJobs === true;
  const isCompany = postAs === 'COMPANY';

  const districts = useMemo(
    () => (division ? districtsOf(division) : []),
    [division],
  );

  const post = useMutation({
    mutationFn: createJob,
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      router.replace({ pathname: '/(app)/job/[id]', params: { id: job.id } });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const clear = () => {
    if (error) setError(null);
  };

  const onSubmit = () => {
    const num = (v: string) => {
      const n = Number.parseInt(v.replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? n : undefined;
    };

    const base = {
      title,
      category,
      description,
      location,
      division,
      district,
      jobType,
      duration,
      workingTime,
      paymentType,
      salaryMin: num(payMin),
      salaryMax: num(payMax),
      urgency,
      vacancies: num(vacancies),
    };

    const input = (
      isCompany
        ? {
            ...base,
            postAs: 'COMPANY',
            companyName,
            companyRegistrationNumber: registrationNumber,
            designation,
            experienceLevel,
            workplaceType,
            requirements: requirements.trim() || undefined,
            benefits: benefits.trim() || undefined,
            openForDays: 30,
          }
        : { ...base, postAs: 'INDIVIDUAL' }
    ) as CreateJobInput;

    // Validated with the schema the server enforces, so nothing passes here
    // and fails after a round trip.
    const parsed = createJobSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('error.VALIDATION_FAILED'));
      return;
    }

    // Opens the summary rather than posting. Validation runs first on purpose:
    // there is no point reviewing a form that cannot be submitted, and finding
    // a missing field after reading the summary would be the second time of
    // being told.
    setReview(parsed.data);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

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
          <Text style={[styles.title, { color: c.text }]}>{t('post.title')}</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {t('post.subtitle')}
          </Text>

          {/* Who is hiring decides which form follows. */}
          <View style={styles.tabs}>
            <ModeTab
              label={t('post.asIndividual')}
              hint={t('post.asIndividualHint')}
              on={!isCompany}
              onPress={() => {
                setPostAs('INDIVIDUAL');
                setJobType(null);
                clear();
              }}
            />
            <ModeTab
              label={t('post.asCompany')}
              hint={
                canPostAsCompany
                  ? t('post.asCompanyHint')
                  : t('post.asCompanyLocked')
              }
              on={isCompany}
              locked={!canPostAsCompany}
              onPress={() => {
                setPostAs('COMPANY');
                setJobType(null);
                clear();
              }}
            />
          </View>

          {/* The gate, explained where it is hit and with the way out. */}
          {isCompany && !canPostAsCompany ? (
            <View
              style={[
                styles.gate,
                { backgroundColor: c.warningSoft, borderColor: c.warningBorder },
              ]}
            >
              <Text style={[styles.gateTitle, { color: c.warning }]}>
                {t('post.gateTitle')}
              </Text>
              <Text style={[styles.gateBody, { color: c.text }]}>
                {t('post.gateBody')}
              </Text>
              <Pressable
                onPress={() => router.push('/(onboarding)/documents')}
                accessibilityRole="button"
                style={[styles.gateCta, { borderColor: c.warning }]}
              >
                <Text style={[styles.gateCtaText, { color: c.warning }]}>
                  {t('post.gateCta')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              {isCompany ? (
                <>
                  <Field
                    label={t('post.companyName')}
                    value={companyName}
                    onChange={(v) => {
                      setCompanyName(v);
                      clear();
                    }}
                    placeholder={t('post.companyNameHint')}
                  />
                  <Field
                    label={t('post.registrationNumber')}
                    value={registrationNumber}
                    onChange={(v) => {
                      setRegistrationNumber(v);
                      clear();
                    }}
                    placeholder="C-123456/2020"
                  />
                  <Field
                    label={t('post.yourRole')}
                    value={designation}
                    onChange={(v) => {
                      setDesignation(v);
                      clear();
                    }}
                    placeholder={t('post.yourRoleHint')}
                  />
                  <Divider />
                </>
              ) : null}

              <Field
                label={t('post.jobTitle')}
                value={title}
                onChange={(v) => {
                  setTitle(v);
                  clear();
                }}
                placeholder={
                  isCompany ? t('post.jobTitleHintCompany') : t('post.jobTitleHint')
                }
              />

              <Group label={t('filter.category')}>
                {JOB_CATEGORIES.map((cat) => (
                  <Option
                    key={cat.key}
                    label={`${cat.emoji} ${jobCategoryName(cat.key, locale)}`}
                    on={category === cat.key}
                    onPress={() => {
                      setCategory(cat.key);
                      clear();
                    }}
                  />
                ))}
              </Group>

              <Field
                label={t('post.description')}
                value={description}
                onChange={(v) => {
                  setDescription(v);
                  clear();
                }}
                placeholder={
                  isCompany
                    ? t('post.descriptionHintCompany')
                    : t('post.descriptionHint')
                }
                multiline
              />

              <Divider />

              <Field
                label={t('post.area')}
                value={location}
                onChange={(v) => {
                  setLocation(v);
                  clear();
                }}
                placeholder={t('post.areaHint')}
              />

              <Group label={t('filter.division')}>
                {DIVISIONS.map((d) => (
                  <Option
                    key={d.key}
                    label={divisionName(d.key, locale)}
                    on={division === d.key}
                    onPress={() => {
                      setDivision(d.key);
                      setDistrict(null);
                      clear();
                    }}
                  />
                ))}
              </Group>

              {districts.length > 0 ? (
                <Group label={t('filter.district')}>
                  {districts.map((d) => (
                    <Option
                      key={d.en}
                      label={locale === 'bn' ? d.bn : d.en}
                      on={district === d.en}
                      onPress={() => {
                        setDistrict(d.en);
                        clear();
                      }}
                    />
                  ))}
                </Group>
              ) : null}

              <Divider />

              <Group label={t('filter.jobType')}>
                {(isCompany ? JOB_TYPES_COMPANY : JOB_TYPES_INDIVIDUAL).map((o) => (
                  <Option
                    key={o.value}
                    label={t(o.label)}
                    on={jobType === o.value}
                    onPress={() => {
                      setJobType(o.value);
                      clear();
                    }}
                  />
                ))}
              </Group>

              <Group label={t('filter.duration')}>
                {DURATIONS.map((o) => (
                  <Option
                    key={o.value}
                    label={t(o.label)}
                    on={duration === o.value}
                    onPress={() => {
                      setDuration(o.value);
                      clear();
                    }}
                  />
                ))}
              </Group>

              <Group label={t('filter.workingTime')}>
                {WORKING_TIMES.map((o) => (
                  <Option
                    key={o.value}
                    label={t(o.label)}
                    on={workingTime === o.value}
                    onPress={() => setWorkingTime(o.value)}
                  />
                ))}
              </Group>

              <Group label={t('filter.urgency')}>
                {URGENCIES.map((o) => (
                  <Option
                    key={o.value}
                    label={t(o.label)}
                    on={urgency === o.value}
                    onPress={() => setUrgency(o.value)}
                  />
                ))}
              </Group>

              <Divider />

              <Group label={t('filter.paymentType')}>
                {PAYMENT_TYPES.map((o) => (
                  <Option
                    key={o.value}
                    label={t(o.label)}
                    on={paymentType === o.value}
                    onPress={() => {
                      setPaymentType(o.value);
                      clear();
                    }}
                  />
                ))}
              </Group>

              <View style={styles.payRow}>
                <Money
                  label={t('filter.salaryMin')}
                  value={payMin}
                  onChange={setPayMin}
                />
                <Money
                  label={t('filter.salaryMax')}
                  value={payMax}
                  onChange={setPayMax}
                />
              </View>

              <Field
                label={t('post.vacancies')}
                value={vacancies}
                onChange={setVacancies}
                placeholder="1"
                keyboardType="number-pad"
                optional
              />

              {isCompany ? (
                <>
                  <Divider />

                  <Group label={t('filter.experience')}>
                    {EXPERIENCE.map((o) => (
                      <Option
                        key={o.value}
                        label={t(o.label)}
                        on={experienceLevel === o.value}
                        onPress={() => setExperienceLevel(o.value)}
                      />
                    ))}
                  </Group>

                  <Group label={t('filter.workMode')}>
                    {WORKPLACES.map((o) => (
                      <Option
                        key={o.value}
                        label={t(o.label)}
                        on={workplaceType === o.value}
                        onPress={() => setWorkplaceType(o.value)}
                      />
                    ))}
                  </Group>

                  <Field
                    label={t('job.tab.requirements')}
                    value={requirements}
                    onChange={setRequirements}
                    placeholder={t('post.requirementsHint')}
                    multiline
                    optional
                  />
                  <Field
                    label={t('job.tab.benefits')}
                    value={benefits}
                    onChange={setBenefits}
                    placeholder={t('post.benefitsHint')}
                    multiline
                    optional
                  />
                </>
              ) : null}

              <ErrorBanner message={error} />

              <View style={styles.submit}>
                <ShimmerButton
                  label={t('post.submit')}
                  onPress={onSubmit}
                  loading={post.isPending}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ReviewSheet
        job={review}
        publishing={post.isPending}
        onBack={() => setReview(null)}
        onPublish={() => {
          if (review) post.mutate(review);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * The last look before a posting goes live.
 *
 * A job advert is public and is read by people deciding whether to travel
 * across a city for work, so a typo in the pay or the location has a real cost.
 * The summary lists what was entered, in the words the reader will see rather
 * than the enum values the form stores.
 *
 * Back closes without clearing anything: the form is still mounted underneath
 * with every field as it was, so correcting one line does not mean retyping
 * the rest.
 */
function ReviewSheet({
  job,
  publishing,
  onBack,
  onPublish,
}: {
  job: CreateJobDto | null;
  publishing: boolean;
  onBack: () => void;
  onPublish: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  if (!job) return null;

  const money = (n: number) => `৳${n.toLocaleString('en-US')}`;
  const pay =
    job.salaryMin && job.salaryMax
      ? `${money(job.salaryMin)}–${money(job.salaryMax)}`
      : job.salaryMin
        ? `${money(job.salaryMin)}+`
        : job.salaryMax
          ? `${t('post.review.upTo')} ${money(job.salaryMax)}`
          : t('jobs.pay.NEGOTIABLE');

  // Every classification on one line, the way a job card shows them.
  //
  // Each carries its own key prefix — duration is `jobs.dur`, not `jobs.type`
  // — so the pairs are spelled out rather than derived from the value alone.
  // `workplaceType` is company-only: the individual branch of the union does
  // not have the field at all, which is why it is read through the guard.
  const classifications: [string, string | undefined][] = [
    ['jobs.type', job.jobType],
    ['jobs.place', job.postAs === 'COMPANY' ? job.workplaceType : undefined],
    ['jobs.dur', job.duration],
    ['jobs.time', job.workingTime],
  ];
  const types = classifications
    .filter(([, value]) => Boolean(value))
    .map(([prefix, value]) => t(`${prefix}.${value}` as TranslationKey))
    .join(', ');

  const place = [job.location, job.district, job.division ? divisionName(job.division, locale) : null]
    .filter(Boolean)
    .join(', ');

  const rows: { label: string; value: string }[] = [
    { label: t('post.review.title'), value: job.title },
    {
      label: t('post.review.company'),
      value:
        job.postAs === 'COMPANY' ? job.companyName : t('post.review.individual'),
    },
    { label: t('post.review.category'), value: jobCategoryName(job.category, locale) },
    { label: t('post.review.salary'), value: pay },
    {
      label: t('post.review.vacancy'),
      value: job.vacancies ? String(job.vacancies) : t('post.review.notSaid'),
    },
    { label: t('post.review.location'), value: place },
    { label: t('post.review.types'), value: types || t('post.review.notSaid') },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onBack}>
      <View style={styles.reviewBackdrop}>
        <View
          style={[
            styles.reviewSheet,
            { backgroundColor: c.bg, borderColor: c.border },
          ]}
        >
          <Text style={[styles.reviewTitle, { color: c.text }]}>
            {t('post.review.heading')}
          </Text>

          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={[
              styles.reviewCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.reviewRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <Text style={[styles.reviewLabel, { color: c.textMuted }]}>
                  {row.label}
                </Text>
                <Text
                  style={[styles.reviewValue, { color: c.text }]}
                  numberOfLines={3}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.reviewActions}>
            <Pressable
              onPress={onBack}
              disabled={publishing}
              accessibilityRole="button"
              style={[
                styles.reviewBack,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <Text style={[styles.reviewBackText, { color: c.text }]}>
                {t('post.review.back')}
              </Text>
            </Pressable>

            <View style={styles.reviewPublish}>
              <ShimmerButton
                label={`➤  ${t('post.review.publish')}`}
                onPress={onPublish}
                loading={publishing}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModeTab({
  label,
  hint,
  on,
  locked = false,
  onPress,
}: {
  label: string;
  hint: string;
  on: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={[
        styles.modeTab,
        {
          backgroundColor: on ? c.primarySoft : c.surface,
          borderColor: on ? c.primary : c.border,
        },
      ]}
    >
      <Text style={[styles.modeLabel, { color: c.text }]}>
        {locked ? '🔒 ' : ''}
        {label}
      </Text>
      <Text style={[styles.modeHint, { color: c.textMuted }]}>{hint}</Text>
    </Pressable>
  );
}

function Divider() {
  const { c } = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <View style={styles.options}>{children}</View>
    </View>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  optional = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
  keyboardType?: 'number-pad';
}) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: c.text }]}>
        {label}
        {optional ? (
          <Text style={[styles.optionalTag, { color: c.textMuted }]}>
            {'  '}
            {t('ob.optionalField')}
          </Text>
        ) : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.textarea,
          { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.text },
        ]}
      />
    </View>
  );
}

function Money({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.money}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <View
        style={[
          styles.moneyBox,
          { backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      >
        <Text style={[styles.taka, { color: c.textMuted }]}>৳</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={c.textMuted}
          style={[styles.moneyInput, { color: c.text }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { fontSize: font.sm, fontWeight: '700' },
  scroll: { padding: space.md, paddingBottom: space.xl },

  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },

  tabs: { flexDirection: 'row', gap: 10, marginTop: space.md },
  modeTab: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  modeLabel: { fontSize: font.sm, fontWeight: '800' },
  modeHint: { fontSize: font.xs, lineHeight: 16, marginTop: 4 },

  gate: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  gateTitle: { fontSize: font.md, fontWeight: '800' },
  gateBody: { fontSize: font.sm, lineHeight: 20, marginTop: 8 },
  gateCta: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  gateCtaText: { fontSize: font.sm, fontWeight: '800' },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  divider: { height: 1, marginVertical: 6 },

  group: { marginBottom: 16 },
  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 8 },
  optionalTag: { fontSize: font.xs, fontWeight: '600' },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  optionText: { fontSize: font.xs + 1, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: font.md,
  },
  textarea: { minHeight: 110, paddingTop: 11 },

  payRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  money: { flex: 1 },
  moneyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  taka: { fontSize: font.md, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: font.md, paddingVertical: 0 },

  submit: { marginTop: 8 },

  reviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reviewSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    padding: space.md,
    paddingBottom: space.lg,
    // Never taller than most of the screen, so the form stays visible behind
    // it and the sheet reads as a step rather than a new page.
    maxHeight: '86%',
  },
  reviewTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: space.md,
  },
  reviewScroll: { flexGrow: 0, flexShrink: 1 },
  reviewCard: { borderWidth: 1, borderRadius: radius.lg },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  reviewLabel: { fontSize: font.sm },
  // Right-aligned and heavier, so the values read as a column of answers.
  reviewValue: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '800',
    textAlign: 'right',
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginTop: space.md,
  },
  reviewBack: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  reviewBackText: { fontSize: font.md, fontWeight: '800' },
  reviewPublish: { flex: 1.3 },
});
