import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { maskPhone } from '@workflex/shared';
import { requestOtp, verifyOtp } from '../../src/api/auth';
import { useErrorMessage } from '../../src/lib/error-message';
import { MeshBackground } from '../../src/components/MeshBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useAuthStore } from '../../src/store/auth-store';
import { useLaunchStore } from '../../src/store/launch-store';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius } from '../../src/lib/theme';

const RESEND_SECONDS = 60;

export default function OtpScreen() {
  const router = useRouter();
  const t = useT();
  const { c, isDark } = useTheme();
  const params = useLocalSearchParams<{ phone: string; devCode?: string }>();
  const phone = params.phone ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const errorMessage = useErrorMessage();

  // In dev the API may return the code, so nobody waits on an SMS gateway
  // that has not been provisioned yet.
  const [code, setCode] = useState(params.devCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: () => verifyOtp(phone, code),
    onSuccess: async (session) => {
      await setSession(session);
      // Verified this launch, so the landing gate no longer applies.
      useLaunchStore.getState().open();
      router.replace('/(app)/home');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const resend = useMutation({
    mutationFn: () => requestOtp(phone),
    onSuccess: (result) => {
      setSecondsLeft(result.resendAfter);
      setError(null);
      if (result.devCode) setCode(result.devCode);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onChangeCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === 6 && !verify.isPending) verify.mutate();
  };

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

        <View style={styles.body}>
          <GlassCard tone="dark" intensity={55} style={styles.sheet}>
            <View
              style={[
                styles.iconCircle,
                { borderColor: c.accentOnBrand, backgroundColor: c.glassFill },
              ]}
            >
              <Text style={styles.icon}>✉</Text>
            </View>

            <Text style={[styles.title, { color: c.textOnBrand }]}>
              {t('otp.title')}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMutedOnBrand }]}>
              {t('otp.sentTo', { phone: phone ? maskPhone(phone) : '—' })}
            </Text>

            <TextInput
              style={[
                styles.codeInput,
                {
                  color: c.textOnBrand,
                  borderColor: error
                    ? 'rgba(255,150,145,0.85)'
                    : c.accentOnBrand,
                  backgroundColor: c.glassFill,
                },
              ]}
              value={code}
              onChangeText={onChangeCode}
              placeholder="------"
              placeholderTextColor={c.textMutedOnBrand}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
              editable={!verify.isPending}
            />

            <ErrorBanner message={error} />

            <View style={styles.buttonWrap}>
              <ShimmerButton
                label={t('otp.verify')}
                onPress={() => verify.mutate()}
                loading={verify.isPending}
                disabled={code.length < 6}
              />
            </View>

            <Pressable
              onPress={() => resend.mutate()}
              disabled={secondsLeft > 0 || resend.isPending}
              style={styles.linkRow}
            >
              {resend.isPending ? (
                <ActivityIndicator color={c.accentOnBrand} />
              ) : (
                <Text
                  style={[
                    styles.link,
                    {
                      color:
                        secondsLeft > 0 ? c.textMutedOnBrand : c.accentOnBrand,
                    },
                  ]}
                >
                  {secondsLeft > 0
                    ? t('otp.resendIn', { seconds: secondsLeft })
                    : t('otp.resend')}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.linkRow}>
              <Text style={[styles.link, { color: c.textMutedOnBrand }]}>
                {t('otp.changeNumber')}
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8 },
  back: { fontSize: font.sm, fontWeight: '700' },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },

  sheet: { borderRadius: radius.xl, padding: 22 },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 24 },
  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, marginTop: 5, marginBottom: 20 },

  codeInput: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 16,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 14,
    textAlign: 'center',
  },

  buttonWrap: { marginTop: 18 },
  linkRow: { marginTop: 14, alignItems: 'center' },
  link: { fontSize: font.sm, fontWeight: '700' },
});
