import React, { useEffect, useState } from 'react';
import {
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Worker } from '../api/types';
import { Button, Card, ErrorState, Loading } from '../components';
import { colors, radii, spacing, text } from '../theme';

export function EditWorkerScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
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
  }, [worker]);

  if (loading && !worker) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const save = async () => {
    setSaving(true);
    try {
      // Empty optional fields are dropped rather than sent as "", which the
      // API would reject as an invalid email.
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v.trim().length > 0),
      );
      await api(`/workers/${id}`, { method: 'PATCH', body: payload });
      RNAlert.alert('Changes saved', `${form.fullName}'s profile has been updated.`, [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      RNAlert.alert('Could not save', e.message);
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
        <Text style={text.screenTitle}>Edit Profile</Text>

        <Card style={{ marginTop: spacing.lg }}>
          {field('fullName', 'Full name')}
          {field('profession', 'Profession')}
          {field('phone', 'Phone')}
          {field('email', 'Email')}
          {field('address', 'Address', true)}
          {field('education', 'Education')}
          {field('bio', 'Bio', true)}
        </Card>

        <View style={s.actions}>
          <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} />
          <Button label="Save changes" loading={saving} onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
