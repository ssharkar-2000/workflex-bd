import { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { maskPhone, passwordResetConfirmSchema } from '@workflex/shared';
import { confirmPasswordReset } from '../../src/api/auth';
import { useErrorMessage } from '../../src/lib/error-message';
import { GlassCard } from '../../src/components/GlassCard';
import { GlassField } from '../../src/components/onboarding/GlassField';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius } from '../../src/lib/theme';

export default function ResetPasswordScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const params = useLocalSearchParams<{ phone: string }>();
  const phone = params.phone ?? '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = passwordResetConfirmSchema.safeParse({
        phone,
        code,
        password,
        confirmPassword,
      });
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (typeof key === 'string' && !errors[key]) {
            errors[key] = issue.message;
          }
        }
        setFieldErrors(errors);
        throw new Error('VALIDATION');
      }
      setFieldErrors({});
      await confirmPasswordReset(parsed.data);
    },
    onSuccess: () => {
      // Straight to sign-in rather than auto-logging in: the reset revoked
      // every session, and using the new password once confirms it landed.
      router.replace({
        pathname: '/(auth)/login',
        params: { phone, notice: 'reset' },
      });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'VALIDATION') return;
      setError(null);
      const message = errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: c.textOnBrand }]}>← {t('ob.back')}</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <GlassCard tone="dark" intensity={55} style={styles.sheet}>
              <View style={[styles.iconCircle, { borderColor: c.accentOnBrand }]}>
                <Text style={styles.icon}>💬</Text>
              </View>

              <Text style={[styles.title, { color: c.textOnBrand }]}>
                {t('reset.codeTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: c.textMutedOnBrand }]}>
                {t('reset.codeSubtitle', {
                  phone: phone ? maskPhone(phone) : '—',
                })}
              </Text>

              <Text style={[styles.label, { color: c.textOnBrand }]}>
                {t('reset.code')}
              </Text>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    color: c.textOnBrand,
                    borderColor: fieldErrors.code
                      ? 'rgba(255,150,145,0.85)'
                      : c.accentOnBrand,
                  },
                ]}
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
                placeholder="------"
                placeholderTextColor={c.textMutedOnBrand}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
              />

              <View style={styles.spacer} />

              <GlassField
                label={t('reset.newPassword')}
                value={password}
                onChangeText={setPassword}
                error={fieldErrors.password}
                secureTextEntry
                autoCapitalize="none"
                maxLength={72}
                hint={t('ob.passwordHint')}
              />

              <GlassField
                label={t('reset.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={fieldErrors.confirmPassword}
                secureTextEntry
                autoCapitalize="none"
                maxLength={72}
              />

              <ShimmerButton
                label={t('reset.submit')}
                onPress={() => submit.mutate()}
                loading={submit.isPending}
                disabled={code.length < 6}
              />

              <ErrorBanner message={error} />
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8 },
  back: { fontSize: font.sm, fontWeight: '700' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },

  sheet: { borderRadius: radius.xl, padding: 22 },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(128,128,128,0.10)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 24 },
  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, marginTop: 5, marginBottom: 20, lineHeight: 20 },

  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 6 },
  codeInput: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 12,
    textAlign: 'center',
  },
  spacer: { height: 18 },
});
