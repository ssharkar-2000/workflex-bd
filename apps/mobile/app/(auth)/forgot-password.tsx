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
import { bdPhoneSchema, sanitizeDigits } from '@workflex/shared';
import { requestPasswordReset } from '../../src/api/auth';
import { useErrorMessage } from '../../src/lib/error-message';
import { MeshBackground } from '../../src/components/MeshBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius } from '../../src/lib/theme';

export default function ForgotPasswordScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const params = useLocalSearchParams<{ phone?: string }>();

  const [phone, setPhone] = useState(params.phone ?? '');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = bdPhoneSchema.safeParse(phone);
      if (!parsed.success) throw new Error('INVALID_PHONE');
      await requestPasswordReset(parsed.data);
      return parsed.data;
    },
    onSuccess: (normalised) => {
      router.push({
        pathname: '/(auth)/reset-password',
        params: { phone: normalised },
      });
    },
    onError: (err) => {
      setError(null);
      const message =
        err instanceof Error && err.message === 'INVALID_PHONE'
          ? t('auth.invalidNumber')
          : errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MeshBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: c.textOnBrand }]}>← {t('reset.backToLogin')}</Text>
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
                <Text style={styles.icon}>🔑</Text>
              </View>

              <Text style={[styles.title, { color: c.textOnBrand }]}>
                {t('reset.title')}
              </Text>
              <Text style={[styles.subtitle, { color: c.textMutedOnBrand }]}>
                {t('reset.subtitle')}
              </Text>

              <View
                style={[
                  styles.inputRow,
                  {
                    borderColor: error
                      ? 'rgba(255,150,145,0.8)'
                      : focused
                        ? c.accentOnBrand
                        : c.glassBorder,
                    backgroundColor: focused
                      ? c.glassHighlight
                      : c.glassFill,
                  },
                ]}
              >
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
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={t('auth.phonePlaceholder')}
                  placeholderTextColor={c.textMutedOnBrand}
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoFocus
                  editable={!submit.isPending}
                />
              </View>

              <View style={styles.buttonWrap}>
                <ShimmerButton
                  label={t('reset.send')}
                  onPress={() => submit.mutate()}
                  loading={submit.isPending}
                  disabled={phone.length < 10}
                />
              </View>

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
  buttonWrap: { marginTop: 18 },
});
