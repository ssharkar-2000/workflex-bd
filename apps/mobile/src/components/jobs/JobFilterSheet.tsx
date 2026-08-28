import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DIVISIONS,
  JOB_CATEGORIES,
  districtsOf,
  divisionName,
  jobCategoryName,
  type Division,
  type JobFilterState,
} from '@workflex/shared';
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * Every filter the job feed supports, in one sheet.
 *
 * Nine groups will not fit in the chip row — the row keeps the two or three
 * people reach for constantly, and everything else lives behind one button.
 * Choices are staged locally and only applied on "Show results": each change
 * would otherwise refetch, so picking four options would fire four queries
 * and shuffle the list under the finger still tapping it.
 */

type Multi = keyof Pick<
  JobFilterState,
  | 'categories'
  | 'jobTypes'
  | 'workplaceTypes'
  | 'experienceLevels'
  | 'paymentTypes'
  | 'workingTimes'
  | 'hoursBands'
  | 'durations'
  | 'urgencies'
  | 'divisions'
  | 'districts'
>;

interface Group {
  field: Multi;
  title: TranslationKey;
  options: { value: string; label: TranslationKey }[];
}

/** Ordered as the spec asks: employment shape first, then the rest. */
const GROUPS: Group[] = [
  {
    field: 'jobTypes',
    title: 'filter.jobType',
    options: [
      { value: 'FULL_TIME', label: 'jobs.type.FULL_TIME' },
      { value: 'PART_TIME', label: 'jobs.type.PART_TIME' },
      { value: 'PERMANENT', label: 'jobs.type.PERMANENT' },
      { value: 'CONTRACT', label: 'jobs.type.CONTRACT' },
      { value: 'FREELANCE', label: 'jobs.type.FREELANCE' },
      { value: 'INTERNSHIP', label: 'jobs.type.INTERNSHIP' },
      { value: 'TEMPORARY', label: 'jobs.type.TEMPORARY' },
      { value: 'SEASONAL', label: 'jobs.type.SEASONAL' },
      { value: 'SHIFT_BASED', label: 'jobs.type.SHIFT_BASED' },
      { value: 'ONE_TIME', label: 'jobs.type.ONE_TIME' },
    ],
  },
  {
    field: 'durations',
    title: 'filter.duration',
    options: [
      { value: 'ONE_TIME', label: 'jobs.dur.ONE_TIME' },
      { value: 'ONE_DAY', label: 'jobs.dur.ONE_DAY' },
      { value: 'FEW_DAYS', label: 'jobs.dur.FEW_DAYS' },
      { value: 'ONE_WEEK', label: 'jobs.dur.ONE_WEEK' },
      { value: 'ONE_MONTH', label: 'jobs.dur.ONE_MONTH' },
      { value: 'THREE_TO_SIX_MONTHS', label: 'jobs.dur.THREE_TO_SIX_MONTHS' },
      { value: 'LONG_TERM', label: 'jobs.dur.LONG_TERM' },
    ],
  },
  {
    field: 'urgencies',
    title: 'filter.urgency',
    options: [
      { value: 'IMMEDIATE', label: 'jobs.urg.IMMEDIATE' },
      { value: 'WITHIN_24H', label: 'jobs.urg.WITHIN_24H' },
      { value: 'WITHIN_3_DAYS', label: 'jobs.urg.WITHIN_3_DAYS' },
      { value: 'THIS_WEEK', label: 'jobs.urg.THIS_WEEK' },
      { value: 'NONE', label: 'jobs.urg.NONE' },
    ],
  },
  {
    field: 'workingTimes',
    title: 'filter.workingTime',
    options: [
      { value: 'MORNING', label: 'jobs.time.MORNING' },
      { value: 'AFTERNOON', label: 'jobs.time.AFTERNOON' },
      { value: 'EVENING', label: 'jobs.time.EVENING' },
      { value: 'NIGHT', label: 'jobs.time.NIGHT' },
      { value: 'FLEXIBLE', label: 'jobs.time.FLEXIBLE' },
    ],
  },
  {
    field: 'hoursBands',
    title: 'filter.hours',
    options: [
      { value: 'H2_3', label: 'jobs.hours.H2_3' },
      { value: 'H4_6', label: 'jobs.hours.H4_6' },
      { value: 'H6_8', label: 'jobs.hours.H6_8' },
      { value: 'H8_PLUS', label: 'jobs.hours.H8_PLUS' },
    ],
  },
  {
    field: 'paymentTypes',
    title: 'filter.paymentType',
    options: [
      { value: 'HOURLY', label: 'jobs.pay.HOURLY' },
      { value: 'DAILY', label: 'jobs.pay.DAILY' },
      { value: 'WEEKLY', label: 'jobs.pay.WEEKLY' },
      { value: 'MONTHLY', label: 'jobs.pay.MONTHLY' },
      { value: 'FIXED_PROJECT', label: 'jobs.pay.FIXED_PROJECT' },
      { value: 'NEGOTIABLE', label: 'jobs.pay.NEGOTIABLE' },
    ],
  },
  {
    field: 'workplaceTypes',
    title: 'filter.workMode',
    options: [
      { value: 'ONSITE', label: 'jobs.place.ONSITE' },
      { value: 'REMOTE', label: 'jobs.place.REMOTE' },
      { value: 'HYBRID', label: 'jobs.place.HYBRID' },
    ],
  },
  {
    field: 'experienceLevels',
    title: 'filter.experience',
    options: [
      { value: 'ENTRY', label: 'jobs.exp.ENTRY' },
      { value: 'ONE_TO_THREE', label: 'jobs.exp.ONE_TO_THREE' },
      { value: 'THREE_TO_FIVE', label: 'jobs.exp.THREE_TO_FIVE' },
      { value: 'FIVE_PLUS', label: 'jobs.exp.FIVE_PLUS' },
    ],
  },
];

const START_WINDOWS = [
  { value: 'TODAY', label: 'jobs.start.TODAY' },
  { value: 'TOMORROW', label: 'jobs.start.TOMORROW' },
  { value: 'THIS_WEEK', label: 'jobs.start.THIS_WEEK' },
  { value: 'THIS_MONTH', label: 'jobs.start.THIS_MONTH' },
  { value: 'FLEXIBLE', label: 'jobs.start.FLEXIBLE' },
] as const;

export function JobFilterSheet({
  visible,
  initial,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: JobFilterState;
  onApply: (next: JobFilterState) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<JobFilterState>(initial);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');

  // Re-seed from the live filters each time the sheet opens, so cancelling
  // and reopening shows what is actually applied rather than a stale draft.
  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setSalaryMin(initial.salaryMin?.toString() ?? '');
    setSalaryMax(initial.salaryMax?.toString() ?? '');
  }, [visible, initial]);

  const toggle = (field: Multi, value: string) => {
    setDraft((d) => {
      const current = (d[field] as string[] | undefined) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      // An empty array means "no constraint", which is the same as absent —
      // sending [] would filter everything out.
      return { ...d, [field]: next.length > 0 ? next : undefined };
    });
  };

  const isOn = (field: Multi, value: string) =>
    ((draft[field] as string[] | undefined) ?? []).includes(value);

  const apply = () => {
    const toNumber = (v: string) => {
      const n = Number.parseInt(v.replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? n : undefined;
    };
    onApply({
      ...draft,
      salaryMin: toNumber(salaryMin),
      salaryMax: toNumber(salaryMax),
    });
  };

  const clear = () => {
    setDraft({});
    setSalaryMin('');
    setSalaryMax('');
  };

  // Districts only make sense once a division is chosen — all 64 at once is a
  // wall, and a district without its division is ambiguous anyway.
  const chosenDivisions = (draft.divisions ?? []) as Division[];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View style={[styles.head, { borderBottomColor: c.border }]}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.headAction, { color: c.textMuted }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Text style={[styles.headTitle, { color: c.text }]}>
              {t('filter.title')}
            </Text>
            <Pressable onPress={clear} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.headAction, { color: c.primary }]}>
                {t('filter.clear')}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <Section title={t('filter.category')}>
              {JOB_CATEGORIES.map((cat) => (
                <Option
                  key={cat.key}
                  label={`${cat.emoji} ${jobCategoryName(cat.key, locale)}`}
                  on={isOn('categories', cat.key)}
                  onPress={() => toggle('categories', cat.key)}
                />
              ))}
            </Section>

            {GROUPS.map((group) => (
              <Section key={group.field} title={t(group.title)}>
                {group.options.map((o) => (
                  <Option
                    key={o.value}
                    label={t(o.label)}
                    on={isOn(group.field, o.value)}
                    onPress={() => toggle(group.field, o.value)}
                  />
                ))}
              </Section>
            ))}

            <Section title={t('filter.salary')}>
              <View style={styles.salaryRow}>
                <MoneyField
                  label={t('filter.salaryMin')}
                  value={salaryMin}
                  onChange={setSalaryMin}
                />
                <MoneyField
                  label={t('filter.salaryMax')}
                  value={salaryMax}
                  onChange={setSalaryMax}
                />
              </View>
              <Text style={[styles.note, { color: c.textMuted }]}>
                {t('filter.salaryNote')}
              </Text>
            </Section>

            <Section title={t('filter.startDate')}>
              {START_WINDOWS.map((w) => (
                <Option
                  key={w.value}
                  label={t(w.label)}
                  on={draft.startWindow === w.value}
                  // Single choice: overlapping windows would contradict each
                  // other, and tapping the active one clears it.
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      startWindow:
                        d.startWindow === w.value ? undefined : w.value,
                    }))
                  }
                />
              ))}
            </Section>

            <Section title={t('filter.division')}>
              {DIVISIONS.map((d) => (
                <Option
                  key={d.key}
                  label={divisionName(d.key, locale)}
                  on={isOn('divisions', d.key)}
                  onPress={() => toggle('divisions', d.key)}
                />
              ))}
            </Section>

            {chosenDivisions.length > 0 ? (
              <Section title={t('filter.district')}>
                {chosenDivisions.flatMap((div) =>
                  districtsOf(div).map((d) => (
                    <Option
                      key={`${div}-${d.en}`}
                      label={locale === 'bn' ? d.bn : d.en}
                      on={isOn('districts', d.en)}
                      onPress={() => toggle('districts', d.en)}
                    />
                  )),
                )}
              </Section>
            ) : null}
          </ScrollView>

          <View style={[styles.foot, { borderTopColor: c.border }]}>
            <Pressable
              onPress={apply}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.apply,
                { backgroundColor: c.primary },
                pressed && styles.applyPressed,
              ]}
            >
              <Text style={[styles.applyText, { color: c.primaryText }]}>
                {t('filter.apply')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      <View style={styles.options}>{children}</View>
    </View>
  );
}

/**
 * A checkbox drawn as a chip.
 *
 * A real checkbox column would run to well over a hundred rows across these
 * groups; chips wrap and let a whole group be scanned at a glance. The tick
 * keeps the on-state readable without relying on colour alone.
 */
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
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[
        styles.option,
        {
          backgroundColor: on ? c.primarySoft : c.surface,
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

function MoneyField({
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
      <Text style={[styles.moneyLabel, { color: c.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.moneyBox,
          { backgroundColor: c.surface, borderColor: c.border },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headTitle: { fontSize: font.md, fontWeight: '800' },
  headAction: { fontSize: font.sm, fontWeight: '700' },

  body: { padding: space.md, paddingBottom: space.lg },

  section: { marginBottom: space.lg },
  sectionTitle: { fontSize: font.sm, fontWeight: '800', marginBottom: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  option: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  optionText: { fontSize: font.xs + 1, fontWeight: '600' },

  salaryRow: { flexDirection: 'row', gap: 10 },
  money: { flex: 1 },
  moneyLabel: { fontSize: font.xs, fontWeight: '700', marginBottom: 5 },
  moneyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
  },
  taka: { fontSize: font.md, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: font.md, paddingVertical: 0 },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 8 },

  foot: { padding: space.md, borderTopWidth: 1 },
  apply: {
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyPressed: { opacity: 0.85 },
  applyText: { fontSize: font.md, fontWeight: '800' },
});
