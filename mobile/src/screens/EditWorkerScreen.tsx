import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Availability, Worker } from '../api/types';
import { Button, Card, ErrorState, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

const AVAILABILITY_OPTIONS: Availability[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT'];

export function EditWorkerScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data: worker, loading, error, refetch } = useApi<Worker>(`/workers/${id}`);

  const [form, setForm] = useState({
    fullName: '',
    profession: '',
    phone: '',
    email: '',
    address: '',
    bio: '',
    education: '',
  });
  const [availability, setAvailability] = useState<Availability>('FULL_TIME');
  const [experienceMonths, setExperienceMonths] = useState('0');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!worker) return;
    setForm({
      fullName: worker.fullName,
      profession: worker.profession,
      phone: worker.phone,
      email: worker.email ?? '',
      address: worker.address,
      bio: worker.bio ?? '',
      education: worker.education ?? '',
    });
    setAvailability(worker.availability);
    setExperienceMonths(String(worker.experienceMonths ?? 0));
    setSalaryMin(worker.salaryMin != null ? String(Math.round(worker.salaryMin / 100)) : '');
    setSalaryMax(worker.salaryMax != null ? String(Math.round(worker.salaryMax / 100)) : '');
    setSkills((worker.skills ?? []).map((sk) => sk.name));
  }, [worker]);

  if (loading && !worker) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const availabilityLabel = (a: Availability) =>
    a === 'FULL_TIME' ? t('workers.fullTime') : a === 'PART_TIME' ? t('workers.partTime') : t('workers.contract');

  const addSkill = () => {
    const name = skillInput.trim();
    if (!name) return;
    if (!skills.some((s2) => s2.toLowerCase() === name.toLowerCase())) {
      setSkills((prev) => [...prev, name]);
    }
    setSkillInput('');
  };

  const removeSkill = (name: string) => {
    setSkills((prev) => prev.filter((s2) => s2 !== name));
  };

  const save = async () => {
    const min = salaryMin.trim() === '' ? undefined : Number(salaryMin);
    const max = salaryMax.trim() === '' ? undefined : Number(salaryMax);
    if (
      (min !== undefined && !Number.isFinite(min)) ||
      (max !== undefined && !Number.isFinite(max)) ||
      (min !== undefined && max !== undefined && max < min)
    ) {
      RNAlert.alert(t('editWorker.checkSalaryTitle'), t('editWorker.checkSalaryBody'));
      return;
    }
    const months = experienceMonths.trim() === '' ? 0 : Number(experienceMonths);

    setSaving(true);
    try {
      // Empty optional fields are dropped rather than sent as "", which the
      // API would reject as an invalid email.
      const payload: Record<string, unknown> = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v.trim().length > 0),
      );
      payload.availability = availability;
      payload.experienceMonths = Number.isFinite(months) ? months : 0;
      // The API takes paisa; the form collects taka, same as PostJobScreen.
      if (min !== undefined) payload.salaryMin = Math.round(min * 100);
      if (max !== undefined) payload.salaryMax = Math.round(max * 100);
      payload.skills = skills;

      await api(`/workers/${id}`, { method: 'PATCH', body: payload });
      RNAlert.alert(t('editWorker.savedTitle'), t('editWorker.savedBody', { name: form.fullName }), [
        { text: t('editWorker.done'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      RNAlert.alert(t('editWorker.saveFailed'), friendlyError(e, t));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, multiline = false) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(value) => setForm((f) => ({ ...f, [key]: value }))}
        style={[s.input, multiline && s.multiline]}
        multiline={multiline}
        placeholderTextColor={colors.textLight}
        autoCapitalize={key === 'email' ? 'none' : 'sentences'}
        keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={text.screenTitle}>{t('editWorker.title')}</Text>

        <Card style={{ marginTop: spacing.lg }}>
          {field('fullName', t('editWorker.fullName'))}
          {field('profession', t('editWorker.profession'))}
          {field('phone', t('editWorker.phone'))}
          {field('email', t('editWorker.email'))}
          {field('address', t('editWorker.address'), true)}
          {field('education', t('editWorker.education'))}
          {field('bio', t('editWorker.bio'), true)}

          <View style={s.field}>
            <Text style={s.label}>{t('editWorker.availability')}</Text>
            <View style={s.chipRow}>
              {AVAILABILITY_OPTIONS.map((option) => {
                const active = availability === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setAvailability(option)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {availabilityLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t('editWorker.experienceMonths')}</Text>
            <TextInput
              value={experienceMonths}
              onChangeText={(v) => setExperienceMonths(v.replace(/[^0-9]/g, ''))}
              style={s.input}
              keyboardType="number-pad"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <View style={s.salaryRow}>
            <View style={s.grow}>
              <Text style={s.label}>{t('editWorker.salaryMin')}</Text>
              <TextInput
                value={salaryMin}
                onChangeText={(v) => setSalaryMin(v.replace(/[^0-9]/g, ''))}
                style={s.input}
                keyboardType="number-pad"
                placeholderTextColor={colors.textLight}
              />
            </View>
            <View style={s.grow}>
              <Text style={s.label}>{t('editWorker.salaryMax')}</Text>
              <TextInput
                value={salaryMax}
                onChangeText={(v) => setSalaryMax(v.replace(/[^0-9]/g, ''))}
                style={s.input}
                keyboardType="number-pad"
                placeholderTextColor={colors.textLight}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t('editWorker.skills')}</Text>
            <View style={s.chipRow}>
              {skills.map((name) => (
                <Pressable key={name} onPress={() => removeSkill(name)} style={s.skillChip}>
                  <Text style={s.skillChipText}>{name} ✕</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.addSkillRow}>
              <TextInput
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                placeholder={t('editWorker.addSkill')}
                style={[s.input, s.addSkillInput]}
                placeholderTextColor={colors.textLight}
                returnKeyType="done"
              />
              <Button label="+" onPress={addSkill} />
            </View>
          </View>
        </Card>

        <View style={s.actions}>
          <Button label={t('common.cancel')} variant="outline" onPress={() => navigation.goBack()} />
          <Button label={t('editWorker.saveChanges')} loading={saving} onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    field: { marginBottom: spacing.md },
    label: { ...text.label, marginBottom: spacing.xs },
    input: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...text.body,
    },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textGray },
    chipTextActive: { color: colors.onPrimary },
    salaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    grow: { flex: 1 },
    skillChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skillChipText: { fontSize: 12, fontWeight: '600', color: colors.textGray },
    addSkillRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
    addSkillInput: { flex: 1 },
  });
}
