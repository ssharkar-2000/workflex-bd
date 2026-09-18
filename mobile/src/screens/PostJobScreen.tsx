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
          </View>

          <View style={s.salaryRow}>
            <View style={s.grow}>
              <Field
                label="Salary from (৳)"
                value={form.salaryMin}
                onChange={(v) => setForm({ ...form, salaryMin: v })}
                numeric
              />
            </View>
            <View style={s.grow}>
              <Field
                label="Salary to (৳)"
                value={form.salaryMax}
                onChange={(v) => setForm({ ...form, salaryMax: v })}
                numeric
              />
            </View>
          </View>

          <Field
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multiline
          />
        </Card>

        <View style={s.actions}>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
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
