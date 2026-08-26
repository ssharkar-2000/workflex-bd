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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { bdPhoneSchema, sanitizeDigits } from '@workflex/shared';
import { login } from '../../src/api/auth';
import { useErrorMessage } from '../../src/lib/error-message';
import { MeshBackground } from '../../src/components/MeshBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { GlassCard } from '../../src/components/GlassCard';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useAuthStore } from '../../src/store/auth-store';
import { useLaunchStore } from '../../src/store/launch-store';
import { useIntentStore, type Intent } from '../../src/store/intent-store';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius } from '../../src/lib/theme';

type Tab = 'login' | 'register';

const INTENTS: {
  intent: Intent;
  emoji: string;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  { intent: 'WORK', emoji: '🔎', title: 'auth.role.work', body: 'auth.role.workBody' },
  { intent: 'HIRE', emoji: '📋', title: 'auth.role.hire', body: 'auth.role.hireBody' },
];

/**
 * One screen, two tabs — sign in and registration entry share it rather than
 * living on separate screens. Existing fields are untouched; this only
 * restructures how they're reached. `?tab=register` opens straight to the
 * second tab (the welcome screen's "Get started" button does this); the
 * three redirects into this route after registration/reset/an existing
 * account (details.tsx, review.tsx, reset-password.tsx) all still land on
 * the Login tab with their `phone` + `notice` params intact.
 */
export default function LoginScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const params = useLocalSearchParams<{
    phone?: string;
    notice?: string;
    tab?: string;
  }>();
  const setSession = useAuthStore((s) => s.setSession);
  const setIntent = useIntentStore((s) => s.setIntent);
  const errorMessage = useErrorMessage();

  const [tab, setTab] = useState<Tab>(params.tab === 'register' ? 'register' : 'login');

  const [phone, setPhone] = useState(
    params.phone ? sanitizeDigits(params.phone.replace(/^\+880/, '0'), 11) : '',
  );
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'phone' | 'password' | null>(
    null,
  );
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);

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
      const parsed = bdPhoneSchema.safeParse(phone);
      if (!parsed.success) throw new Error('INVALID_PHONE');
      return login(parsed.data, password);
    },
    onSuccess: async (session) => {
      await setSession(session);
      useLaunchStore.getState().open();
      router.replace('/(app)/home');
    },
    onError: (err) => {
      // Cleared first so the banner re-animates on a repeated failure.
      setError(null);
      const message =
        err instanceof Error && err.message === 'INVALID_PHONE'
          ? t('auth.invalidNumber')
          : errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  const canSubmit = phone.length >= 10 && password.length > 0;

  const onContinueRegister = () => {
    if (!selectedIntent) return;
    void setIntent(selectedIntent);
    // A job seeker is always an individual, so that question is not worth
    // asking — only a recruiter can be a company.
    if (selectedIntent === 'WORK') {
      router.push({
        pathname: '/(onboarding)/details',
        params: { accountType: 'INDIVIDUAL' },
      });
    } else {
      router.push('/(onboarding)/account-type');
    }
  };

  const fieldStyle = (field: 'phone' | 'password') => [
    styles.inputRow,
    {
      borderColor:
        error && !focusedField
          ? 'rgba(255,150,145,0.8)'
          : focusedField === field
            ? c.accentOnBrand
            : c.glassBorder,
      backgroundColor:
        focusedField === field
          ? c.glassHighlight
          : c.glassFill,
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MeshBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/(auth)/welcome')} hitSlop={12}>
            <Text style={[styles.back, { color: c.textOnBrand }]}>← {t('ob.back')}</Text>
          </Pressable>
          <View style={styles.toggles}>
            <ThemeToggle tone="light" />
            <LanguageToggle tone="light" />
          </View>
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
              <View style={styles.brandRow}>
                <BrandMark size={56} interactive={false} />
                <Text style={[styles.brandName, { color: c.textOnBrand }]}>
                  WorkFlex BD
                </Text>
              </View>

              <View
                style={[
                  styles.tabBar,
                  { backgroundColor: c.glassFill, borderColor: c.glassBorder },
                ]}
              >
                <Pressable
                  style={[
                    styles.tabOption,
                    tab === 'login' && { backgroundColor: c.primary },
                  ]}
                  onPress={() => setTab('login')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === 'login' }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: tab === 'login' ? c.primaryText : c.textOnBrand },
                    ]}
                  >
                    {t('login.tabLogin')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tabOption,
                    tab === 'register' && { backgroundColor: c.primary },
                  ]}
                  onPress={() => setTab('register')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === 'register' }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: tab === 'register' ? c.primaryText : c.textOnBrand,
                      },
                    ]}
                  >
                    {t('login.tabRegister')}
                  </Text>
                </Pressable>
              </View>

              <GlassCard tone="dark" intensity={55} style={styles.sheet}>
                {tab === 'login' ? (
                  <>
                    <Text style={[styles.title, { color: c.textOnBrand }]}>
                      {t('login.title')}
                    </Text>
                    <Text style={[styles.subtitle, { color: c.textMutedOnBrand }]}>
                      {t('login.subtitle')}
                    </Text>

                    {/* Shown after registration, so the handover to sign-in does
                        not look like the app forgot what was just submitted. */}
                    {params.notice === 'registered' ? (
                      <View style={[styles.notice, { borderColor: c.accentOnBrand }]}>
                        <Text style={[styles.noticeText, { color: c.textOnBrand }]}>
                          ✓ {t('login.registered')}
                        </Text>
                      </View>
                    ) : params.notice === 'reset' ? (
                      <View style={[styles.notice, { borderColor: c.accentOnBrand }]}>
                        <Text style={[styles.noticeText, { color: c.textOnBrand }]}>
                          ✓ {t('reset.done')}
                        </Text>
                      </View>
                    ) : params.notice === 'exists' ? (
                      <View style={[styles.notice, { borderColor: c.accentOnBrand }]}>
                        <Text style={[styles.noticeText, { color: c.textOnBrand }]}>
                          {t('login.exists')}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={[styles.label, { color: c.textOnBrand }]}>
                      {t('login.phone')}
                    </Text>
                    <View style={fieldStyle('phone')}>
                      <Text style={styles.flag}>🇧🇩</Text>
                      <Text style={[styles.prefix, { color: c.textOnBrand }]}>
                        +880
                      </Text>
                      <View style={styles.divider} />
                      <TextInput
                        style={[styles.input, { color: c.textOnBrand }]}
                        value={phone}
                        onChangeText={(v) => {
                          setPhone(sanitizeDigits(v, 11));
                          if (error) setError(null);
                        }}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        placeholder={t('auth.phonePlaceholder')}
                        placeholderTextColor={c.textMutedOnBrand}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        maxLength={11}
                        editable={!submit.isPending}
                      />
                    </View>

                    <Text
                      style={[styles.label, styles.labelSpaced, { color: c.textOnBrand }]}
                    >
                      {t('login.password')}
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

                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(auth)/forgot-password',
                          params: { phone },
                        })
                      }
                      style={styles.forgotRow}
                      hitSlop={8}
                    >
                      <Text style={[styles.forgot, { color: c.accentOnBrand }]}>
                        {t('login.forgot')}
                      </Text>
                    </Pressable>

                    <View style={styles.buttonWrap}>
                      <ShimmerButton
                        label={t('login.submit')}
                        onPress={() => submit.mutate()}
                        loading={submit.isPending}
                        disabled={!canSubmit}
                      />
                    </View>

                    {/* Below the button, as asked — the eye lands there after a
                        failed tap rather than back up at the fields. */}
                    <ErrorBanner message={error} />
                  </>
                ) : (
                  <>
                    <Text style={[styles.title, { color: c.textOnBrand }]}>
                      {t('auth.role.title')}
                    </Text>
                    <Text style={[styles.subtitle, { color: c.textMutedOnBrand }]}>
                      {t('auth.role.subtitle')}
                    </Text>

                    {INTENTS.map((option) => {
                      const active = selectedIntent === option.intent;
                      return (
                        <Pressable
                          key={option.intent}
                          onPress={() => setSelectedIntent(option.intent)}
                          style={[
                            styles.intentCard,
                            {
                              borderColor: active ? c.primary : c.glassBorder,
                              backgroundColor: active
                                ? c.glassHighlight
                                : c.glassFill,
                            },
                          ]}
                        >
                          <Text style={styles.intentEmoji}>{option.emoji}</Text>
                          <View style={styles.intentText}>
                            <Text
                              style={[styles.intentTitle, { color: c.textOnBrand }]}
                            >
                              {t(option.title)}
                            </Text>
                            <Text
                              style={[
                                styles.intentBody,
                                { color: c.textMutedOnBrand },
                              ]}
                            >
                              {t(option.body)}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.radio,
                              { borderColor: active ? c.primary : c.glassBorder },
                            ]}
                          >
                            {active ? (
                              <View
                                style={[styles.radioDot, { backgroundColor: c.primary }]}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}

                    <View style={styles.buttonWrap}>
                      <ShimmerButton
                        label={t('ob.continue')}
                        onPress={onContinueRegister}
                        disabled={!selectedIntent}
                      />
                    </View>
                  </>
                )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  toggles: { flexDirection: 'row', gap: 8 },
  back: { fontSize: font.sm, fontWeight: '700' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },

  brandRow: { alignItems: 'center', marginBottom: 14 },
  brandName: {
    fontSize: font.md,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.2,
  },

  tabBar: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  tabOption: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: font.sm, fontWeight: '800' },

  sheet: { borderRadius: radius.xl, padding: 22 },
  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, marginTop: 5, marginBottom: 18 },

  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: 'rgba(128,128,128,0.10)',
    padding: 12,
    marginBottom: 18,
  },
  noticeText: { fontSize: font.sm, lineHeight: 20, fontWeight: '600' },

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
  flag: { fontSize: 18 },
  prefix: { fontSize: font.md, fontWeight: '700' },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(128,128,128,0.24)',
    marginHorizontal: 4,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: font.md, fontWeight: '600' },
  reveal: { fontSize: font.xs, fontWeight: '700' },

  forgotRow: { alignSelf: 'flex-end', marginTop: 12 },
  forgot: { fontSize: font.sm, fontWeight: '700' },

  buttonWrap: { marginTop: 18 },

  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },
  intentEmoji: { fontSize: 26 },
  intentText: { flex: 1 },
  intentTitle: { fontSize: font.md, fontWeight: '800' },
  intentBody: { fontSize: font.xs, marginTop: 3, lineHeight: 17 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
