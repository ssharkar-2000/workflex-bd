import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { maskPhone } from '@workflex/shared';
import { requestOtp, verifyOtp } from '../../src/api/auth';
import {
  fetchOnboardingStatus,
  saveOnboardingProfile,
} from '../../src/api/onboarding';
import { StepShell } from '../../src/components/onboarding/StepShell';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useAuthStore } from '../../src/store/auth-store';
import { useRegistrationDraft } from '../../src/store/registration-draft-store';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { useStepCount } from '../../src/lib/onboarding-steps';
import { font, radius } from '../../src/lib/theme';

const LENGTH = 6;

/**
 * Step two of registration: prove the number, then save the form.
 *
 * The order matters and is not cosmetic. POST /onboarding/profile is
 * authenticated by the session that verifying the code creates, so the draft
 * collected on the previous screen can only be written once the code checks
 * out. Both happen here, in that order, behind one button.
 */
export default function VerifyScreen() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { total, offset } = useStepCount();

  const draft = useRegistrationDraft((s) => s.draft);
  const phone = useRegistrationDraft((s) => s.phone);
  const clearDraft = useRegistrationDraft((s) => s.clear);
  const setSession = useAuthStore((s) => s.setSession);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Set the moment the profile is saved, so the guard below stops watching.
  // Without it, clearing the draft on success looks identical to losing it,
  // and the guard's redirect overrides the one to the documents step —
  // landing the user back on the form they just completed.
  const finished = useRef(false);

  // A reload or a backgrounded app loses the in-memory draft. Send them back
  // rather than showing a form that cannot possibly submit.
  useEffect(() => {
    if (finished.current) return;
    if (!draft || !phone) router.replace('/(onboarding)/details');
  }, [draft, phone, router]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!draft || !phone) throw new Error('NO_DRAFT');

      const session = await verifyOtp(phone, code);
      await setSession(session);

      // A verified number can already belong to a finished account — the check
      // above signs that person straight in, and saving a profile over it would
      // fail. Send them to sign-in instead of showing an error they cannot act on.
      const existing = await fetchOnboardingStatus().catch(() => null);
      if (existing?.submitted) {
        // Same ordering rule as the success path: mark done before clearing,
        // or the guard's redirect wins over this one.
        finished.current = true;
        await useAuthStore.getState().signOut();
        router.replace({
          pathname: '/(auth)/login',
          params: { phone, notice: 'exists' },
        });
        clearDraft();
        return null;
      }

      return saveOnboardingProfile(draft);
    },
    onSuccess: (status) => {
      if (!status) return;
      finished.current = true;
      queryClient.setQueryData(['onboarding-status'], status);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace('/(onboarding)/documents');
      // Cleared after navigating, not before — see the guard above.
      clearDraft();
    },
    onError: (err) => {
      setError(null);
      const message =
        err instanceof Error && err.message === 'NO_DRAFT'
          ? t('ob.draftLost')
          : errorMessage(err);
      requestAnimationFrame(() => setError(message));
    },
  });

  const resend = useMutation({
    mutationFn: () => requestOtp(phone ?? ''),
    onSuccess: (result) => {
      setSecondsLeft(result.resendAfter);
      setError(null);
      if (result.devCode) setCode(result.devCode);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (error) setError(null);
    // Deliberately no auto-submit on the sixth digit. With a Verify button
    // also on screen, a code entered and then confirmed fired twice — the
    // first call consumed it, the second failed as incorrect, and the error
    // landed on a code that was in fact right.
  };

  const digits = Array.from({ length: LENGTH }, (_, i) => code[i] ?? '');

  return (
    <StepShell
      step={2 + offset}
      total={total}
      title={t('ob.verify.title')}
      subtitle={t('ob.verify.subtitle', {
        phone: phone ? maskPhone(phone) : '',
      })}
      centerHeader
      showBrand
      footer={
        <ShimmerButton
          label={t('ob.verify.cta')}
          onPress={() => submit.mutate()}
          loading={submit.isPending}
          disabled={code.length < LENGTH}
        />
      }
    >
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { borderColor: c.accentOnBrand }]}>
          <Text style={styles.icon}>📱</Text>
        </View>
      </View>

      {/* One real input behind six painted boxes: a box-per-digit built from
          six TextInputs has to hand focus back and forth on every keystroke and
          backspace, which fights autofill and the SMS one-tap suggestion. */}
      <Pressable style={styles.boxRow} onPress={() => inputRef.current?.focus()}>
        {digits.map((d, i) => (
          <View
            key={i}
            style={[
              styles.box,
              {
                borderColor: error
                  ? c.danger
                  : d
                    ? c.accentOnBrand
                    : c.glassBorder,
                backgroundColor: d ? c.glassHighlight : c.glassFill,
              },
            ]}
          >
            <Text style={[styles.boxText, { color: c.textOnBrand }]}>{d}</Text>
          </View>
        ))}
      </Pressable>

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={LENGTH}
        autoFocus
        editable={!submit.isPending}
      />

      <ErrorBanner message={error} />

      <Pressable
        onPress={() => resend.mutate()}
        disabled={secondsLeft > 0 || resend.isPending}
        style={styles.resendRow}
        hitSlop={8}
      >
        {resend.isPending ? (
          <ActivityIndicator size="small" color={c.accentOnBrand} />
        ) : (
          <Text
            style={[
              styles.resend,
              {
                color: secondsLeft > 0 ? c.textMutedOnBrand : c.accentOnBrand,
              },
            ]}
          >
            {secondsLeft > 0
              ? t('ob.verify.resendIn', { seconds: secondsLeft })
              : t('otp.resend')}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.changeRow} hitSlop={8}>
        <Text style={[styles.change, { color: c.textMutedOnBrand }]}>
          {t('ob.verify.changeNumber')}
        </Text>
      </Pressable>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginBottom: 18 },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },

  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { fontSize: 24, fontWeight: '800' },

  // Kept in the tree, not display:none — a detached input cannot hold focus,
  // and the OS keyboard needs a real target to type into.
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },

  resendRow: { alignItems: 'center', marginTop: 20 },
  resend: { fontSize: font.sm, fontWeight: '700' },
  changeRow: { alignItems: 'center', marginTop: 12 },
  change: { fontSize: font.sm, fontWeight: '600' },
});
