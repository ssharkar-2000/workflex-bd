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
import { emailSchema, sanitizeEmail } from '@workflex/shared';
import { setEmail, verifyEmail } from '../../api/email';
import { useErrorMessage } from '../../lib/error-message';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

/**
 * Optional email, verified inline the same way the phone number is.
 *
 * It only becomes usable once the phone check has run, because the request
 * that sends the email code is authenticated by the session that check
 * creates. Skipping it entirely stays a valid outcome — email is never
 * required to finish registration.
 */
export function EmailVerifyField({
  enabled,
  verifiedEmail,
  onVerified,
}: {
  enabled: boolean;
  verifiedEmail: string | null;
  onVerified: (email: string) => void;
}) {
  const t = useT();
  const { c } = useTheme();

  const errorMessage = useErrorMessage();

  const [email, setEmailValue] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'email' | 'code' | null>(null);

  const reveal = useRef(new Animated.Value(0)).current;

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
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid email');
      }
      const result = await setEmail(parsed.data);
      return { result, normalised: parsed.data };
    },
    onSuccess: ({ result }) => {
      setCodeSent(true);
      setError(null);
      if (result.devCode) setCode(result.devCode);
    },
    onError: (err) => {
      setError(null);
      // A plain Error here is the zod message from the field above, which is
      // already written for a person ("Enter a valid email").
      const message =
        err instanceof Error && !('code' in err)
          ? err.message
          : errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  const verify = useMutation({
    mutationFn: () => verifyEmail(code),
    onSuccess: (status) => {
      setError(null);
      onVerified(status.email ?? email);
    },
    onError: (err) => {
      setError(null);
      const message = errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  if (verifiedEmail) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: c.textOnBrand }]}>
          {t('ob.emailLabel')}
        </Text>
        <View style={[styles.verifiedRow, { borderColor: c.accentOnBrand }]}>
          <Text
            style={[styles.verifiedValue, { color: c.textOnBrand }]}
            numberOfLines={1}
          >
            {verifiedEmail}
          </Text>
          <View style={[styles.badge, { backgroundColor: c.accentOnBrand }]}>
            {/* See PhoneVerifyField: accentOnBrand inverts between modes, so
                the label on it must too. */}
            <Text style={[styles.badgeText, { color: c.primaryText }]}>
              ✓ {t('ob.emailVerified')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const borderFor = (field: 'email' | 'code') =>
    error && focused !== field
      ? c.danger
      : focused === field
        ? c.accentOnBrand
        : c.glassBorder;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: c.textOnBrand }]}>
          {t('ob.emailLabel')}
        </Text>
        <Text style={[styles.optional, { color: c.textMutedOnBrand }]}>
          {t('ob.optionalField')}
        </Text>
      </View>

      <View
        style={[
          styles.inputRow,
          { borderColor: borderFor('email') },
          !enabled && styles.disabled,
        ]}
      >
        <TextInput
          style={[styles.input, { color: c.textOnBrand }]}
          value={email}
          onChangeText={(v) => {
            setEmailValue(sanitizeEmail(v));
            if (error) setError(null);
            if (codeSent) setCodeSent(false);
          }}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
          placeholder={t('email.placeholder')}
          placeholderTextColor={c.textMutedOnBrand}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={enabled && !send.isPending && !verify.isPending}
        />
        <Pressable
          onPress={() => send.mutate()}
          disabled={!enabled || email.length < 5 || send.isPending}
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
                    !enabled || email.length < 5
                      ? c.locked
                      : c.accentOnBrand,
                },
              ]}
            >
              {codeSent ? t('otp.resend') : t('ob.emailSendCode')}
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
            {t('ob.emailCodeHint', { email })}
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

      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : (
        <Text style={[styles.hint, { color: c.textMutedOnBrand }]}>
          {enabled ? t('ob.emailSkip') : t('ob.emailVerifyFirst')}
        </Text>
      )}
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
  optional: { flexShrink: 0, fontSize: font.xs, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: 'rgba(128,128,128,0.10)',
    paddingHorizontal: 14,
  },
  disabled: { opacity: 0.55 },
  codeRow: { marginTop: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: font.md },
  codeInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: font.lg,
    fontWeight: '700',
    letterSpacing: 8,
  },
  action: { fontSize: font.sm, fontWeight: '800' },
  hint: { marginTop: 8, fontSize: font.xs, lineHeight: 17 },
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
  verifiedValue: { flex: 1, fontSize: font.md, fontWeight: '600' },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: font.xs, fontWeight: '800' },
});
