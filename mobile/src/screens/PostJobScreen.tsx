import React, { useMemo, useState } from 'react';
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
import { BackButton, Button, Card, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type Category = { id: string; slug: string; name: string; icon: string };
type Company = { id: string; name: string };
type Styles = ReturnType<typeof createStyles>;

export function PostJobScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const categories = useApi<Category[]>('/jobs/categories');
  const companies = useApi<Company[]>('/jobs/companies');

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
  });
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (categories.loading || companies.loading) return <Loading />;

  const submit = async () => {
    if (!companyId || !categoryId) {
      RNAlert.alert(t('postJob.pickCompanyTitle'), t('postJob.pickCompanyBody'));
      return;
    }

    const min = Number(form.salaryMin);
    const max = Number(form.salaryMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      RNAlert.alert(t('postJob.checkSalaryTitle'), t('postJob.checkSalaryBody'));
      return;
    }

    setSaving(true);
    try {
      // The API takes paisa; the form collects taka.
      await api('/jobs', {
        method: 'POST',
        body: {
          ...form,
          categoryId,
          companyId,
          salaryMin: Math.round(min * 100),
          salaryMax: Math.round(max * 100),
        },
      });
      RNAlert.alert(t('postJob.postedTitle'), t('postJob.postedBody'), [
        { text: t('editWorker.done'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      RNAlert.alert(t('postJob.couldNotPost'), friendlyError(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={text.screenTitle}>{t('postJob.title')}</Text>

        <Card style={{ marginTop: spacing.lg }}>
          <Field label={t('postJob.jobTitle')} value={form.title} onChange={(v) => setForm({ ...form, title: v })} styles={s} />
          <Field
            label={t('postJob.location')}
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
            styles={s}
          />

          <Text style={s.label}>{t('postJob.company')}</Text>
          <View style={s.chipRow}>
            {(companies.data ?? []).map((c) => {
              const active = companyId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCompanyId(c.id)}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.label}>{t('postJob.category')}</Text>
          <View style={s.chipRow}>
            {(categories.data ?? []).map((c) => {
              const active = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {c.icon} {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.salaryRow}>
            <View style={s.grow}>
              <Field
                label={t('postJob.salaryFrom')}
                value={form.salaryMin}
                onChange={(v) => setForm({ ...form, salaryMin: v })}
                numeric
                styles={s}
              />
            </View>
            <View style={s.grow}>
              <Field
                label={t('postJob.salaryTo')}
                value={form.salaryMax}
                onChange={(v) => setForm({ ...form, salaryMax: v })}
                numeric
                styles={s}
              />
            </View>
          </View>

          <Field
            label={t('postJob.description')}
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multiline
            styles={s}
          />
        </Card>

        <View style={s.actions}>
          <Button label={t('common.cancel')} variant="outline" onPress={() => navigation.goBack()} />
          <Button label={t('postJob.postJob')} loading={saving} onPress={submit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  numeric,
  styles,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  styles: Styles;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        placeholderTextColor={colors.textLight}
      />
    </View>
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
    multiline: { minHeight: 110, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textGray },
    chipTextActive: { color: colors.onPrimary },
    salaryRow: { flexDirection: 'row', gap: spacing.md },
    grow: { flex: 1 },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
}
