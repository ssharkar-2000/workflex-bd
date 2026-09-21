import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Button, Card } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type CompanyOption = { id: string; name: string; initials: string };

/// Item 23 follow-up: POST /employers already worked on the backend but had
/// no create UI anywhere in the app. Reuses GET /jobs/companies (the same
/// picker data source as the Post a Job form) for the optional company link.
export function EmployerCreateScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const companies = useApi<CompanyOption[]>('/jobs/companies');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!fullName.trim() || !email.trim()) {
      RNAlert.alert(t('employerCreate.missingTitle'), t('employerCreate.missingFields'));
      return;
    }
    setBusy(true);
    try {
      await api('/employers', {
        method: 'POST',
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          companyId: companyId ?? undefined,
        },
      });
      navigation.goBack();
    } catch (e) {
      RNAlert.alert(t('employerCreate.saveFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={text.screenTitle}>{t('employerCreate.title')}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Field label={t('employerCreate.name')} value={fullName} onChange={setFullName} colors={colors} text={text} />
        <Field label={t('employerCreate.email')} value={email} onChange={setEmail} colors={colors} text={text} keyboardType="email-address" />
        <Field label={t('employerCreate.phone')} value={phone} onChange={setPhone} colors={colors} text={text} keyboardType="phone-pad" />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[text.label, { marginBottom: spacing.sm }]}>{t('employerCreate.company')}</Text>
        <View style={s.chipRow}>
          {(companies.data ?? []).map((c) => (
            <Text
              key={c.id}
              onPress={() => setCompanyId(companyId === c.id ? null : c.id)}
              style={[s.chip, companyId === c.id && s.chipActive]}
            >
              {c.name}
            </Text>
          ))}
        </View>
        {!companies.data || companies.data.length === 0 ? (
          <Text style={text.caption}>{t('employerCreate.noCompanies')}</Text>
        ) : null}
      </Card>

      <View style={s.actions}>
        <Button label={t('common.save')} loading={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
  text,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: ThemeColors;
  text: ReturnType<typeof buildText>;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[text.label, { marginBottom: spacing.xs }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize="none"
        placeholderTextColor={colors.textLight}
        style={{
          minHeight: 46,
          borderRadius: radii.md,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          color: colors.textDark,
          ...text.body,
        }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    actions: { marginTop: spacing.xl },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      ...text.label,
      color: colors.textGray,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      overflow: 'hidden',
    },
    chipActive: { color: colors.onPrimary, backgroundColor: colors.primary, borderColor: colors.primary },
  });
}
