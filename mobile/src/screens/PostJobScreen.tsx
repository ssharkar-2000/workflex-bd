import React, { useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  KeyboardAvoidingView,
  Modal,
import React, { useState } from 'react';
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
import { Button, Card, Loading } from '../components';
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
  const categoriesApi = useApi<Category[]>('/jobs/categories');
  const companiesApi = useApi<Company[]>('/jobs/companies');
import { useApi } from '../api/hooks';
import { Button, Card, Loading } from '../components';
import { colors, radii, spacing, text } from '../theme';

type Category = { id: string; slug: string; name: string; icon: string };
type Company = { id: string; name: string };

export function PostJobScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
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

  /// The list is a preset (seeded companies/categories), but a poster whose
  /// company or trade genuinely isn't there yet shouldn't be stuck — this
  /// opens a small "add new" prompt instead of forcing them to pick the
  /// closest existing option.
  const [addingCompany, setAddingCompany] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newName, setNewName] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  if (categoriesApi.loading || companiesApi.loading) return <Loading />;

  const addCompany = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      RNAlert.alert(t('postJob.addNameShortTitle'), t('postJob.addNameShortBody'));
      return;
    }
    setAddBusy(true);
    try {
      const created = await api<Company>('/companies', { method: 'POST', body: { name } });
      await companiesApi.refetch();
      setCompanyId(created.id);
      setAddingCompany(false);
      setNewName('');
    } catch (e) {
      RNAlert.alert(t('postJob.addFailedTitle'), friendlyError(e, t));
    } finally {
      setAddBusy(false);
    }
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      RNAlert.alert(t('postJob.addNameShortTitle'), t('postJob.addNameShortBody'));
      return;
    }
    setAddBusy(true);
    try {
      const created = await api<Category>('/jobs/categories', { method: 'POST', body: { name } });
      await categoriesApi.refetch();
      setCategoryId(created.id);
      setAddingCategory(false);
      setNewName('');
    } catch (e) {
      RNAlert.alert(t('postJob.addFailedTitle'), friendlyError(e, t));
    } finally {
      setAddBusy(false);
    }
  };

  const submit = async () => {
    if (!companyId || !categoryId) {
      RNAlert.alert(t('postJob.pickCompanyTitle'), t('postJob.pickCompanyBody'));
  if (categories.loading || companies.loading) return <Loading />;

  const submit = async () => {
    if (!companyId || !categoryId) {
      RNAlert.alert(
        'Pick a company and category',
        'Both are needed before a posting can enter the review queue.',
      );
      return;
    }

    const min = Number(form.salaryMin);
    const max = Number(form.salaryMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      RNAlert.alert(t('postJob.checkSalaryTitle'), t('postJob.checkSalaryBody'));
      RNAlert.alert('Check the salary range', 'Enter both figures in taka, with the maximum at or above the minimum.');
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
      RNAlert.alert('Job posted', 'It is now in the review queue.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      RNAlert.alert('Could not post', e.message);
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
            {(companiesApi.data ?? []).map((c) => {
        <Text style={text.screenTitle}>Post a Job</Text>

        <Card style={{ marginTop: spacing.lg }}>
          <Field label="Job title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Field
            label="Location"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
          />

          <Text style={s.label}>Company</Text>
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
            {/* Item: not stuck with the preset list — types a new company
                here and it's created and selected right away. */}
            <Pressable
              onPress={() => {
                setNewName('');
                setAddingCompany(true);
              }}
              style={[s.chip, s.chipAdd]}
            >
              <Text style={s.chipAddText}>+ {t('postJob.addNew')}</Text>
            </Pressable>
          </View>

          <Text style={s.label}>{t('postJob.category')}</Text>
          <View style={s.chipRow}>
            {(categoriesApi.data ?? []).map((c) => {
          </View>

          <Text style={s.label}>Category</Text>
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
            <Pressable
              onPress={() => {
                setNewName('');
                setAddingCategory(true);
              }}
              style={[s.chip, s.chipAdd]}
            >
              <Text style={s.chipAddText}>+ {t('postJob.addNew')}</Text>
            </Pressable>
          </View>

          <View style={s.salaryRow}>
            <View style={s.grow}>
              <Field
                label={t('postJob.salaryFrom')}
                value={form.salaryMin}
                onChange={(v) => setForm({ ...form, salaryMin: v })}
                numeric
                styles={s}
                label="Salary from (৳)"
                value={form.salaryMin}
                onChange={(v) => setForm({ ...form, salaryMin: v })}
                numeric
              />
            </View>
            <View style={s.grow}>
              <Field
                label={t('postJob.salaryTo')}
                value={form.salaryMax}
                onChange={(v) => setForm({ ...form, salaryMax: v })}
                numeric
                styles={s}
                label="Salary to (৳)"
                value={form.salaryMax}
                onChange={(v) => setForm({ ...form, salaryMax: v })}
                numeric
              />
            </View>
          </View>

          <Field
            label={t('postJob.description')}
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multiline
            styles={s}
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multiline
          />
        </Card>

        <View style={s.actions}>
          <Button label={t('common.cancel')} variant="outline" onPress={() => navigation.goBack()} />
          <Button label={t('postJob.postJob')} loading={saving} onPress={submit} />
        </View>
      </ScrollView>

      <Modal
        visible={addingCompany || addingCategory}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAddingCompany(false);
          setAddingCategory(false);
        }}
      >
        <View style={s.backdrop}>
          <Card style={s.modal}>
            <Text style={text.sectionTitle}>
              {addingCompany ? t('postJob.addCompanyTitle') : t('postJob.addCategoryTitle')}
            </Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {addingCompany ? t('postJob.addCompanyHint') : t('postJob.addCategoryHint')}
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={addingCompany ? t('postJob.companyNamePlaceholder') : t('postJob.categoryNamePlaceholder')}
              placeholderTextColor={colors.textLight}
              style={[s.input, { marginTop: spacing.md }]}
              autoFocus
            />
            <View style={s.modalActions}>
              <Button
                label={t('common.cancel')}
                variant="outline"
                onPress={() => {
                  setAddingCompany(false);
                  setAddingCategory(false);
                }}
              />
              <Button
                label={t('postJob.add')}
                loading={addBusy}
                onPress={addingCompany ? addCompany : addCategory}
              />
            </View>
          </Card>
        </View>
      </Modal>
          <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} />
          <Button label="Post job" loading={saving} onPress={submit} />
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
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[s.input, multiline && s.multiline]}
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
    // A visually distinct "add new" chip — dashed border, tinted fill — so
    // it reads as an action rather than one more option in the row.
    chipAdd: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    chipAddText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    salaryRow: { flexDirection: 'row', gap: spacing.md },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modal: { gap: spacing.xs },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    grow: { flex: 1 },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
}
const s = StyleSheet.create({
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
