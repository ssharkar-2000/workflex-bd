import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { adminLoginSchema } from '@workflex/shared';
import { adminLogin } from '../../src/api/admin';
import { useErrorMessage } from '../../src/lib/error-message';
import { MeshBackground } from '../../src/components/MeshBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useAuthStore } from '../../src/store/auth-store';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius } from '../../src/lib/theme';

/**
 * Deliberately its own screen, not a toggle on the regular login form — an
 * admin is a different identity (email + password against a separate table,
 * see the Admin Prisma model), not a phone account with a flag set. Reached
 * only through the small "Admin" link on the welcome screen; nothing here
 * links back into the phone/OTP flow.
 */
export default function AdminLoginScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const setAdminSession = useAuthStore((s) => s.setAdminSession);
  const errorMessage = useErrorMessage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(
    null,
  );

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 9,
      tension: 55,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = adminLoginSchema.safeParse({ email, password });
      if (!parsed.success) throw new Error('INVALID_EMAIL');
      return adminLogin(parsed.data.email, parsed.data.password);
    },
    onSuccess: async (tokens) => {
      await setAdminSession(tokens);
      router.replace('/(admin)/dashboard');
    },
    onError: (err) => {
      setError(null);
      const message =
        err instanceof Error && err.message === 'INVALID_EMAIL'
          ? t('adminLogin.invalidEmail')
          : errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  const canSubmit = email.length > 3 && password.length > 0;

  const fieldStyle = (field: 'email' | 'password') => [
    styles.inputRow,
    {
      borderColor:
        error && !focusedField
          ? 'rgba(255,150,145,0.8)'
          : focusedField === field
            ? c.accentOnBrand
            : c.glassBorder,
      backgroundColor: focusedField === field ? c.glassHighlight : c.glassFill,
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MeshBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: c.textOnBrand }]}>
              ← {t('ob.back')}
            </Text>
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
            <Animated.View
              style={{
                opacity: enter,
                transform: [
                  {
                    translateY: enter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              }}
            >
              <GlassCard tone="dark" intensity={55} style={styles.sheet}>
                <View
                  style={[styles.iconCircle, { borderColor: c.accentOnBrand }]}
                >
                  <Text style={styles.icon}>🛠</Text>
                </View>

                <Text style={[styles.title, { color: c.textOnBrand }]}>
                  {t('adminLogin.title')}
                </Text>
                <Text style={[styles.subtitle, { color: c.textMutedOnBrand }]}>
                  {t('adminLogin.subtitle')}
                </Text>

                <Text style={[styles.label, { color: c.textOnBrand }]}>
                  {t('adminLogin.email')}
                </Text>
                <View style={fieldStyle('email')}>
                  <TextInput
                    style={[styles.input, { color: c.textOnBrand }]}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (error) setError(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder={t('adminLogin.emailPlaceholder')}
                    placeholderTextColor={c.textMutedOnBrand}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!submit.isPending}
                  />
                </View>

                <Text
                  style={[
                    styles.label,
                    styles.labelSpaced,
                    { color: c.textOnBrand },
                  ]}
                >
                  {t('adminLogin.password')}
                </Text>
                <View style={fieldStyle('password')}>
                  <TextInput
                    style={[styles.input, { color: c.textOnBrand }]}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (error) setError(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    placeholderTextColor={c.textMutedOnBrand}
                    secureTextEntry={!revealed}
                    autoCapitalize="none"
                    autoComplete="password"
                    maxLength={72}
                    editable={!submit.isPending}
                    onSubmitEditing={() => canSubmit && submit.mutate()}
                    returnKeyType="go"
                  />
                  <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={10}>
                    <Text style={[styles.reveal, { color: c.accentOnBrand }]}>
                      {revealed ? t('ob.passwordHide') : t('ob.passwordShow')}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.buttonWrap}>
                  <ShimmerButton
                    label={t('adminLogin.submit')}
                    onPress={() => submit.mutate()}
                    loading={submit.isPending}
                    disabled={!canSubmit}
                  />
                </View>

                <ErrorBanner message={error} />
              </GlassCard>
            </Animated.View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
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
  subtitle: { fontSize: font.sm, marginTop: 5, marginBottom: 18 },

  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 6 },
  labelSpaced: { marginTop: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: font.md, fontWeight: '600' },
  reveal: { fontSize: font.xs, fontWeight: '700' },

  buttonWrap: { marginTop: 18 },
});
