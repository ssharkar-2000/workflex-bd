import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
 * The filter bar: one named dropdown per filter, all of them on screen.
 *
 * An earlier version put every group behind a single "Filters" button. It
 * fitted more neatly, and it meant someone who did not already know the
 * product could not tell the app filters by working hours or hiring urgency
 * at all — the names were the discoverable part, and they were hidden. Nine
 * labelled buttons say what is on offer before anything is tapped.
 *
 * Selections apply as they are made. A dropdown that needs a separate Apply
 * is two taps for one decision, and the count on each button already shows
 * what is active.
 */

/** Fields holding an array of selected values. */
type Multi = keyof Pick<
  JobFilterState,
  | 'categories'
  | 'jobTypes'
  | 'workplaceTypes'
  | 'paymentTypes'
  | 'workingTimes'
  | 'hoursBands'
  | 'durations'
  | 'urgencies'
  | 'divisions'
  | 'districts'
>;

type GroupKey =
  | 'jobType'
  | 'category'
  | 'location'
  | 'pay'
  | 'time'
  | 'duration'
  | 'start'
  | 'urgency'
  | 'workMode';

interface Choice {
  value: string;
  label: TranslationKey;
}

const JOB_TYPES: Choice[] = [
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
];

const PAYMENT_TYPES: Choice[] = [
  { value: 'HOURLY', label: 'jobs.pay.HOURLY' },
  { value: 'DAILY', label: 'jobs.pay.DAILY' },
  { value: 'WEEKLY', label: 'jobs.pay.WEEKLY' },
  { value: 'MONTHLY', label: 'jobs.pay.MONTHLY' },
  { value: 'FIXED_PROJECT', label: 'jobs.pay.FIXED_PROJECT' },
  { value: 'NEGOTIABLE', label: 'jobs.pay.NEGOTIABLE' },
];

const WORKING_TIMES: Choice[] = [
  { value: 'MORNING', label: 'jobs.time.MORNING' },
  { value: 'AFTERNOON', label: 'jobs.time.AFTERNOON' },
  { value: 'EVENING', label: 'jobs.time.EVENING' },
  { value: 'NIGHT', label: 'jobs.time.NIGHT' },
  { value: 'FLEXIBLE', label: 'jobs.time.FLEXIBLE' },
];

const HOURS: Choice[] = [
  { value: 'H2_3', label: 'jobs.hours.H2_3' },
  { value: 'H4_6', label: 'jobs.hours.H4_6' },
  { value: 'H6_8', label: 'jobs.hours.H6_8' },
  { value: 'H8_PLUS', label: 'jobs.hours.H8_PLUS' },
];

const DURATIONS: Choice[] = [
  { value: 'ONE_TIME', label: 'jobs.dur.ONE_TIME' },
  { value: 'ONE_DAY', label: 'jobs.dur.ONE_DAY' },
  { value: 'FEW_DAYS', label: 'jobs.dur.FEW_DAYS' },
  { value: 'ONE_WEEK', label: 'jobs.dur.ONE_WEEK' },
  { value: 'ONE_MONTH', label: 'jobs.dur.ONE_MONTH' },
  { value: 'THREE_TO_SIX_MONTHS', label: 'jobs.dur.THREE_TO_SIX_MONTHS' },
  { value: 'LONG_TERM', label: 'jobs.dur.LONG_TERM' },
];

const URGENCIES: Choice[] = [
  { value: 'IMMEDIATE', label: 'jobs.urg.IMMEDIATE' },
  { value: 'WITHIN_24H', label: 'jobs.urg.WITHIN_24H' },
  { value: 'WITHIN_3_DAYS', label: 'jobs.urg.WITHIN_3_DAYS' },
  { value: 'THIS_WEEK', label: 'jobs.urg.THIS_WEEK' },
  { value: 'NONE', label: 'jobs.urg.NONE' },
];

const WORK_MODES: Choice[] = [
  { value: 'ONSITE', label: 'jobs.place.ONSITE' },
  { value: 'REMOTE', label: 'jobs.place.REMOTE' },
  { value: 'HYBRID', label: 'jobs.place.HYBRID' },
];

const START_WINDOWS: Choice[] = [
  { value: 'TODAY', label: 'jobs.start.TODAY' },
  { value: 'TOMORROW', label: 'jobs.start.TOMORROW' },
  { value: 'THIS_WEEK', label: 'jobs.start.THIS_WEEK' },
  { value: 'THIS_MONTH', label: 'jobs.start.THIS_MONTH' },
  { value: 'FLEXIBLE', label: 'jobs.start.FLEXIBLE' },
];

const BUTTONS: { key: GroupKey; icon: string; label: TranslationKey }[] = [
  { key: 'jobType', icon: '🔍', label: 'filter.jobType' },
  { key: 'category', icon: '📂', label: 'filter.category' },
  { key: 'location', icon: '📍', label: 'filter.location' },
  { key: 'pay', icon: '💰', label: 'filter.pay' },
  { key: 'time', icon: '🕒', label: 'filter.workingTime' },
  { key: 'duration', icon: '📅', label: 'filter.duration' },
  { key: 'start', icon: '📆', label: 'filter.startDate' },
  { key: 'urgency', icon: '⚡', label: 'filter.urgency' },
  { key: 'workMode', icon: '🏠', label: 'filter.workMode' },
];

export function JobFilterBar({
  value,
  onChange,
  onClear,
  /** Total selected values, for the clear button's badge. */
  activeCount,
  /** Open listings per category, shown beside each name. */
  categoryCounts,
}: {
  value: JobFilterState;
  onChange: (next: JobFilterState) => void;
  onClear: () => void;
  activeCount: number;
  categoryCounts?: Record<string, number>;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  const [open, setOpen] = useState<GroupKey | null>(null);
  /** Screen Y the panel drops from — the bottom of the button row. */
  const [anchorY, setAnchorY] = useState(0);
  const barRef = useRef<View>(null);

  // Salary inputs are staged: applying on every keystroke would refetch after
  // each digit, so "15000" would fire five queries and show four wrong lists.
  const [minText, setMinText] = useState(value.salaryMin?.toString() ?? '');
  const [maxText, setMaxText] = useState(value.salaryMax?.toString() ?? '');

  const openGroup = (key: GroupKey) => {
    // measureInWindow, not onLayout: the panel lives in a Modal, which is
    // positioned against the screen rather than against this row's parent.
    barRef.current?.measureInWindow((_x, y, _w, h) => {
      setAnchorY(y + h);
      setOpen(key);
    });
  };

  const toggle = (field: Multi, v: string) => {
    const current = (value[field] as string[] | undefined) ?? [];
    const next = current.includes(v)
      ? current.filter((x) => x !== v)
      : [...current, v];
    // An empty array is not "match nothing" — it is no constraint at all.
    onChange({ ...value, [field]: next.length > 0 ? next : undefined });
  };

  const isOn = (field: Multi, v: string) =>
    ((value[field] as string[] | undefined) ?? []).includes(v);

  const countOf = (key: GroupKey): number => {
    const len = (f: Multi) => (value[f] as string[] | undefined)?.length ?? 0;
    switch (key) {
      case 'jobType':
        return len('jobTypes');
      case 'category':
        return len('categories');
      case 'location':
        return len('divisions') + len('districts');
      case 'pay':
        return (
          len('paymentTypes') +
          (value.salaryMin !== undefined ? 1 : 0) +
          (value.salaryMax !== undefined ? 1 : 0)
        );
      case 'time':
        return len('workingTimes') + len('hoursBands');
      case 'duration':
        return len('durations');
      case 'start':
        return value.startWindow ? 1 : 0;
      case 'urgency':
        return len('urgencies');
      case 'workMode':
        return len('workplaceTypes');
    }
  };

  const applySalary = () => {
    const num = (s: string) => {
      const n = Number.parseInt(s.replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? n : undefined;
    };
    onChange({ ...value, salaryMin: num(minText), salaryMax: num(maxText) });
  };

  const chosenDivisions = (value.divisions ?? []) as Division[];

  return (
    <>
      <View ref={barRef} collapsable={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // ScrollView's own base style is flexGrow/flexShrink 1, so without
          // this it fights the job list for height and loses.
          style={styles.barScroll}
          contentContainerStyle={styles.bar}
        >
          <Pressable
            onPress={() =>
              onChange({
                ...value,
                savedOnly: value.savedOnly ? undefined : true,
              })
            }
            accessibilityRole="button"
            accessibilityState={{ selected: value.savedOnly === true }}
            style={[
              styles.button,
              {
                backgroundColor: value.savedOnly ? c.primarySoft : c.surface,
                borderColor: value.savedOnly ? c.primary : c.border,
              },
            ]}
          >
            <Text style={styles.buttonIcon}>🔖</Text>
            <Text style={[styles.buttonText, { color: c.text }]}>
              {t('jobs.saved')}
            </Text>
          </Pressable>

          {BUTTONS.map((b) => {
            const n = countOf(b.key);
            const active = n > 0;
            return (
              <Pressable
                key={b.key}
                onPress={() => openGroup(b.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open === b.key }}
                accessibilityLabel={
                  active
                    ? `${t(b.label)}, ${n}`
                    : t(b.label)
                }
                style={[
                  styles.button,
                  {
                    backgroundColor: active ? c.primarySoft : c.surface,
                    borderColor: active ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={styles.buttonIcon}>{b.icon}</Text>
                <Text style={[styles.buttonText, { color: c.text }]}>
                  {t(b.label)}
                </Text>
                {active ? (
                  <View style={[styles.badge, { backgroundColor: c.primary }]}>
                    <Text style={[styles.badgeText, { color: c.primaryText }]}>
                      {n}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.caret, { color: c.textMuted }]}>⌄</Text>
              </Pressable>
            );
          })}

          {activeCount > 0 ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.clearAll')}
              style={[
                styles.button,
                { backgroundColor: c.surface, borderColor: c.danger },
              ]}
            >
              <Text style={[styles.buttonText, { color: c.danger }]}>
                ✕ {t('jobs.clearAll')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable
            // Swallows taps so choosing an option does not close the panel —
            // these are multi-select, and reopening for each choice would be
            // the sheet's problem all over again.
            onPress={() => undefined}
            style={[
              styles.panel,
              {
                top: anchorY + 4,
                backgroundColor: c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {open === 'jobType' ? (
                <Group title={t('filter.jobType')}>
                  {JOB_TYPES.map((o) => (
                    <Option
                      key={o.value}
                      label={t(o.label)}
                      on={isOn('jobTypes', o.value)}
                      onPress={() => toggle('jobTypes', o.value)}
                    />
                  ))}
                </Group>
              ) : null}

              {open === 'category' ? (
                <Group title={t('filter.category')}>
                  {JOB_CATEGORIES.map((cat) => {
                    const n = categoryCounts?.[cat.key];
                    return (
                      <Option
                        key={cat.key}
                        // The count is what a separate category strip used to
                        // contribute; it belongs next to the name, not on its
                        // own row duplicating this list.
                        label={`${cat.emoji} ${jobCategoryName(cat.key, locale)}${
                          n ? `  ${n}` : ''
                        }`}
                        on={isOn('categories', cat.key)}
                        onPress={() => toggle('categories', cat.key)}
                      />
                    );
                  })}
                </Group>
              ) : null}

              {open === 'location' ? (
                <>
                  <Group title={t('filter.division')}>
                    {DIVISIONS.map((d) => (
                      <Option
                        key={d.key}
                        label={divisionName(d.key, locale)}
                        on={isOn('divisions', d.key)}
                        onPress={() => toggle('divisions', d.key)}
                      />
                    ))}
                  </Group>
                  {chosenDivisions.length > 0 ? (
                    <Group title={t('filter.district')}>
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
                    </Group>
                  ) : (
                    <Note text={t('filter.districtHint')} />
                  )}
                </>
              ) : null}

              {open === 'pay' ? (
                <>
                  <Group title={t('filter.salary')}>
                    <View style={styles.salaryRow}>
                      <Money
                        label={t('filter.salaryMin')}
                        value={minText}
                        onChange={setMinText}
                        onDone={applySalary}
                      />
                      <Money
                        label={t('filter.salaryMax')}
                        value={maxText}
                        onChange={setMaxText}
                        onDone={applySalary}
                      />
                    </View>
                  </Group>
                  <Note text={t('filter.salaryNote')} />
                  <Group title={t('filter.paymentType')}>
                    {PAYMENT_TYPES.map((o) => (
                      <Option
                        key={o.value}
                        label={t(o.label)}
                        on={isOn('paymentTypes', o.value)}
                        onPress={() => toggle('paymentTypes', o.value)}
                      />
                    ))}
                  </Group>
                </>
              ) : null}

              {open === 'time' ? (
                <>
                  <Group title={t('filter.workingTime')}>
                    {WORKING_TIMES.map((o) => (
                      <Option
                        key={o.value}
                        label={t(o.label)}
                        on={isOn('workingTimes', o.value)}
                        onPress={() => toggle('workingTimes', o.value)}
                      />
                    ))}
                  </Group>
                  <Group title={t('filter.hours')}>
                    {HOURS.map((o) => (
                      <Option
                        key={o.value}
                        label={t(o.label)}
                        on={isOn('hoursBands', o.value)}
                        onPress={() => toggle('hoursBands', o.value)}
                      />
                    ))}
                  </Group>
                </>
              ) : null}

              {open === 'duration' ? (
                <Group title={t('filter.duration')}>
                  {DURATIONS.map((o) => (
                    <Option
                      key={o.value}
                      label={t(o.label)}
                      on={isOn('durations', o.value)}
                      onPress={() => toggle('durations', o.value)}
                    />
                  ))}
                </Group>
              ) : null}

              {open === 'start' ? (
                <Group title={t('filter.startDate')}>
                  {START_WINDOWS.map((o) => (
                    <Option
                      key={o.value}
                      label={t(o.label)}
                      on={value.startWindow === o.value}
                      // One window only — overlapping ones would contradict.
                      onPress={() =>
                        onChange({
                          ...value,
                          startWindow:
                            value.startWindow === o.value
                              ? undefined
                              : (o.value as JobFilterState['startWindow']),
                        })
                      }
                    />
                  ))}
                </Group>
              ) : null}

              {open === 'urgency' ? (
                <Group title={t('filter.urgency')}>
                  {URGENCIES.map((o) => (
                    <Option
                      key={o.value}
                      label={t(o.label)}
                      on={isOn('urgencies', o.value)}
                      onPress={() => toggle('urgencies', o.value)}
                    />
                  ))}
                </Group>
              ) : null}

              {open === 'workMode' ? (
                <Group title={t('filter.workMode')}>
                  {WORK_MODES.map((o) => (
                    <Option
                      key={o.value}
                      label={t(o.label)}
                      on={isOn('workplaceTypes', o.value)}
                      onPress={() => toggle('workplaceTypes', o.value)}
                    />
                  ))}
                </Group>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={() => {
                applySalary();
                setOpen(null);
              }}
              accessibilityRole="button"
              style={[styles.done, { borderTopColor: c.border }]}
            >
              <Text style={[styles.doneText, { color: c.primary }]}>
                {t('filter.done')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: c.textMuted }]}>{title}</Text>
      <View style={styles.options}>{children}</View>
    </View>
  );
}

function Note({ text }: { text: string }) {
  const { c } = useTheme();
  return <Text style={[styles.note, { color: c.textMuted }]}>{text}</Text>;
}

/** A checkbox drawn as a chip — the tick carries the state, not just colour. */
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

function Money({
  label,
  value,
  onChange,
  onDone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.money}>
      <Text style={[styles.moneyLabel, { color: c.textMuted }]}>{label}</Text>
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
          onBlur={onDone}
          onSubmitEditing={onDone}
          returnKeyType="done"
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
  barScroll: { flexGrow: 0, flexShrink: 0 },
  bar: {
    paddingHorizontal: space.md,
    gap: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonIcon: { fontSize: 12 },
  buttonText: { fontSize: font.xs + 1, fontWeight: '700' },
  caret: { fontSize: 13, fontWeight: '800', marginTop: -3 },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  panel: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    maxHeight: '62%',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },

  group: { paddingHorizontal: 14, marginBottom: 14 },
  groupTitle: {
    fontSize: font.xs - 1,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  optionText: { fontSize: font.xs + 1, fontWeight: '600' },

  note: {
    fontSize: font.xs,
    lineHeight: 17,
    paddingHorizontal: 14,
    marginBottom: 14,
    marginTop: -6,
  },

  salaryRow: { flexDirection: 'row', gap: 10, width: '100%' },
  money: { flex: 1 },
  moneyLabel: { fontSize: font.xs, fontWeight: '700', marginBottom: 5 },
  moneyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  taka: { fontSize: font.md, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: font.md, paddingVertical: 0 },

  done: { borderTopWidth: 1, paddingVertical: 13, alignItems: 'center' },
  doneText: { fontSize: font.sm, fontWeight: '800' },
});
