import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { Button, Card } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

/// Item 23 follow-up: POST /companies already worked on the backend but had
/// no create UI anywhere in the app.
export function CompanyCreateScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      RNAlert.alert(t('companyCreate.missingTitle'), t('companyCreate.missingName'));
      return;
    }
    setBusy(true);
    try {
      await api('/companies', {
        method: 'POST',
        body: { name: name.trim(), industry: industry.trim() || undefined, address: address.trim() || undefined },
      });
      navigation.goBack();
    } catch (e) {
      RNAlert.alert(t('companyCreate.saveFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={text.screenTitle}>{t('companyCreate.title')}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Field label={t('companyCreate.name')} value={name} onChange={setName} colors={colors} text={text} />
        <Field label={t('companyCreate.industry')} value={industry} onChange={setIndustry} colors={colors} text={text} />
        <Field label={t('companyCreate.address')} value={address} onChange={setAddress} colors={colors} text={text} multiline />
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
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: ThemeColors;
  text: ReturnType<typeof buildText>;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[text.label, { marginBottom: spacing.xs }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={colors.textLight}
        style={{
          minHeight: multiline ? 90 : 46,
          borderRadius: radii.md,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          textAlignVertical: multiline ? 'top' : 'center',
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
  });
}
