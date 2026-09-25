import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { friendlyError } from '../api/errors';
import { Button } from '../components';
import { BrandMark, BrandWordmark } from '../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl, paddingTop: 100 },
    subtitle: { ...text.caption, marginTop: spacing.sm },
    form: { marginTop: spacing.xxl },
    label: { ...text.label, marginBottom: spacing.xs, marginTop: spacing.md },
    input: {
      height: 50,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      ...text.body,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 50,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
    },
    passwordInput: {
      flex: 1,
      height: '100%',
      ...text.body,
    },
    eyeButton: {
      paddingLeft: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eyeIcon: {
      fontSize: 18,
    },
    inputError: { borderColor: colors.redText },
    error: { ...text.caption, color: colors.redText, marginTop: spacing.xs },
    langRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
    langChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    langChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    langChipText: { ...text.caption, fontWeight: '600' },
    langChipTextActive: { color: colors.primary },
  });
}

export function SignInScreen() {
  const { signIn } = useAuth();
  const { colors, text } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);

  const [email, setEmail] = useState('admin@workflexbd.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BrandMark size={60} />
        <View style={{ marginTop: spacing.lg }}>
          <BrandWordmark size={28} />
        </View>
        <Text style={s.subtitle}>{t('signIn.subtitle')}</Text>

        <View style={s.form}>
          <Text style={s.label}>{t('signIn.email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={s.input}
            placeholder="admin@workflexbd.com"
            placeholderTextColor={colors.textLight}
          />

          <Text style={s.label}>{t('signIn.password')}</Text>
          <View style={[s.passwordContainer, Boolean(error) && s.inputError]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={s.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
              onSubmitEditing={submit}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={s.eyeButton}
            >
              <Text style={s.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
            </Pressable>
          </View>

          {Boolean(error) && <Text style={s.error}>{error}</Text>}

          <Button label={t('signIn.submit')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
        </View>

        <View style={s.langRow}>
          {(['en', 'bn'] as const).map((code) => {
            const active = language === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLanguage(code)}
                style={[s.langChip, active && s.langChipActive]}
              >
                <Text style={[s.langChipText, active && s.langChipTextActive]}>
                  {code === 'en' ? t('settings.languageEnglish') : t('settings.languageBangla')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
