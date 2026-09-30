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
import { BrandWordmark } from '../components/Brand';
import { BrandMark } from '../components/BrandMark';
import { AppFooter } from '../components/AppFooter';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    // A sign-in screen is one short form; on a laptop it belongs in the
    // middle of the window rather than pinned to the top-left corner.
    /** Auto margins beat justifyContent, so the footer leaves the centred
     * form where it is and goes to the bottom edge on its own. */
    pushDown: { marginTop: 'auto' as const },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    centre: { width: '100%', maxWidth: 420, alignItems: 'center' },
    bar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    toggle: {
      width: 36,
      height: 32,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    toggleIcon: { fontSize: 15 },
    subtitle: { ...text.caption, marginTop: spacing.sm, textAlign: 'center' },
    form: { marginTop: spacing.xl, width: '100%' },
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
    langRow: { flexDirection: 'row', gap: spacing.xs },
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
  const { colors, text, mode, setMode } = useTheme();
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
      {/* Language and appearance, where the worker app keeps them: top right,
          reachable before signing in because somebody who cannot read the
          form needs them first. */}
      <View style={s.bar}>
        <View style={s.langRow}>
          {(['en', 'bn'] as const).map((code) => {
            const active = language === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLanguage(code)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[s.langChip, active && s.langChipActive]}
              >
                <Text style={[s.langChipText, active && s.langChipTextActive]}>
                  {code === 'en' ? t('settings.languageEnglish') : t('settings.languageBangla')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          accessibilityRole="button"
          accessibilityLabel={t('settings.appearance')}
          style={[s.toggle, mode === 'dark' && s.toggleOn]}
        >
          <Text style={s.toggleIcon}>{mode === 'dark' ? '☾' : '☀'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.centre}>
        <BrandMark size={128} interactive={false} />
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

        </View>
        <AppFooter mark={false} style={s.pushDown} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
