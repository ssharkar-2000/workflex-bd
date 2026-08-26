import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { bdPhoneSchema, sanitizeDigits } from '@workflex/shared';
import { requestOtp, verifyOtp } from '../../api/auth';
import { useErrorMessage } from '../../lib/error-message';
import { useAuthStore } from '../../store/auth-store';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

const RESEND_SECONDS = 60;

/**
 * Phone number plus its SMS check, inline in the registration form.
 *
 * Verifying here rather than on a screen of its own means the applicant sees
 * what they are signing up for before being asked to prove a number — and the
 * successful check quietly establishes the session the rest of the form needs
 * to save against.
 */
export function PhoneVerifyField({
  onVerified,
  verified,
}: {
  verified: boolean;
  onVerified: (phone: string) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const errorMessage = useErrorMessage();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'phone' | 'code' | null>(null);

  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: codeSent ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [codeSent, reveal]);

  const send = useMutation({
    mutationFn: async () => {
      const parsed = bdPhoneSchema.safeParse(phone);
      if (!parsed.success) throw new Error('INVALID_PHONE');
      return { normalised: parsed.data, result: await requestOtp(parsed.data) };
    },
    onSuccess: ({ result }) => {
      setCodeSent(true);
      setSecondsLeft(result.resendAfter);
      setError(null);
      if (result.devCode) setCode(result.devCode);
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

  const verify = useMutation({
    mutationFn: async () => {
      const parsed = bdPhoneSchema.safeParse(phone);
      if (!parsed.success) throw new Error('INVALID_PHONE');
      const session = await verifyOtp(parsed.data, code);
      return { session, normalised: parsed.data };
    },
    onSuccess: async ({ session, normalised }) => {
      // The session created here is what authorises the rest of the form.
      await setSession(session);
      setError(null);
      onVerified(normalised);
    },
    onError: (err) => {
      setError(null);
      const message = errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  if (verified) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: c.textOnBrand }]}>
          {t('login.phone')}
        </Text>
        <View style={[styles.verifiedRow, { borderColor: c.accentOnBrand }]}>
          <Text style={styles.flag}>🇧🇩</Text>
          <Text style={[styles.verifiedNumber, { color: c.textOnBrand }]}>
            +880 {phone}
          </Text>
          <View style={[styles.badge, { backgroundColor: c.accentOnBrand }]}>
            {/* primaryText, not a fixed navy: accentOnBrand is a dark coral
                in light mode and a pale one in dark, so the label has to
                invert with it or it disappears in one of the two. */}
            <Text style={[styles.badgeText, { color: c.primaryText }]}>
              ✓ {t('ob.phoneVerified')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const borderFor = (field: 'phone' | 'code') =>
    error && focused !== field
      ? c.danger
      : focused === field
        ? c.accentOnBrand
        : c.glassBorder;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: c.textOnBrand }]}>
          {t('login.phone')}
        </Text>
        <Text style={[styles.required, { color: c.accentOnBrand }]}>
          {t('ob.phoneRequired')}
        </Text>
      </View>

      <View style={[styles.inputRow, { borderColor: borderFor('phone') }]}>
        <Text style={styles.flag}>🇧🇩</Text>
        <Text style={[styles.prefix, { color: c.textOnBrand }]}>+880</Text>
        <View style={styles.divider} />
        <TextInput
          style={[styles.input, { color: c.textOnBrand }]}
          value={phone}
          onChangeText={(v) => {
            setPhone(sanitizeDigits(v, 11));
            if (error) setError(null);
            if (codeSent) setCodeSent(false);
          }}
          onFocus={() => setFocused('phone')}
          onBlur={() => setFocused(null)}
          placeholder={t('auth.phonePlaceholder')}
          placeholderTextColor={c.textMutedOnBrand}
          keyboardType="phone-pad"
          maxLength={11}
          editable={!send.isPending && !verify.isPending}
        />
        <Pressable
          onPress={() => send.mutate()}
          disabled={phone.length < 10 || send.isPending || secondsLeft > 0}
          hitSlop={8}
        >
          {send.isPending ? (
            <ActivityIndicator size="small" color={c.accentOnBrand} />
          ) : (
            <Text
              style={[
                styles.action,
                {
                  color:
                    phone.length < 10 || secondsLeft > 0
                      ? c.locked
                      : c.accentOnBrand,
                },
              ]}
            >
              {secondsLeft > 0
                ? `${secondsLeft}s`
                : codeSent
                  ? t('otp.resend')
                  : t('ob.sendCode')}
            </Text>
          )}
        </Pressable>
      </View>

      {codeSent ? (
        <Animated.View
          style={{
            opacity: reveal,
            transform: [
              {
                translateY: reveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          }}
        >
          <Text style={[styles.hint, { color: c.textMutedOnBrand }]}>
            {t('ob.codeSentHint')}
          </Text>
          <View
            style={[
              styles.inputRow,
              styles.codeRow,
              { borderColor: borderFor('code') },
            ]}
          >
            <TextInput
              style={[styles.codeInput, { color: c.textOnBrand }]}
              value={code}
              onChangeText={(v) => {
                setCode(v.replace(/\D/g, '').slice(0, 6));
                if (error) setError(null);
              }}
              onFocus={() => setFocused('code')}
              onBlur={() => setFocused(null)}
              placeholder="------"
              placeholderTextColor={c.textMutedOnBrand}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={6}
              editable={!verify.isPending}
            />
            <Pressable
              onPress={() => verify.mutate()}
              disabled={code.length < 6 || verify.isPending}
              hitSlop={8}
            >
              {verify.isPending ? (
                <ActivityIndicator size="small" color={c.accentOnBrand} />
              ) : (
                <Text
                  style={[
                    styles.action,
                    {
                      color:
                        code.length < 6
                          ? c.locked
                          : c.accentOnBrand,
                    },
                  ]}
                >
                  {t('otp.verify')}
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  label: { fontSize: font.sm, fontWeight: '700', letterSpacing: 0.2 },
  required: { fontSize: font.xs, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: 'rgba(128,128,128,0.10)',
    paddingHorizontal: 14,
  },
  codeRow: { marginTop: 8 },
  flag: { fontSize: 18 },
  prefix: { fontSize: font.md, fontWeight: '700' },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(128,128,128,0.24)',
  },
  input: { flex: 1, paddingVertical: 13, fontSize: font.md, fontWeight: '600' },
  codeInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: font.lg,
    fontWeight: '700',
    letterSpacing: 8,
  },
  action: { fontSize: font.sm, fontWeight: '800' },
  hint: { marginTop: 10, fontSize: font.xs, lineHeight: 17 },
  error: { marginTop: 8, fontSize: font.xs, fontWeight: '600' },

  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: 'rgba(128,128,128,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  verifiedNumber: { flex: 1, fontSize: font.md, fontWeight: '700' },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: font.xs, fontWeight: '800' },
});
