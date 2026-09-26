import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  bdPhoneSchema,
  onboardingProfileSchema,
  sanitizeAddress,
  sanitizePersonName,
  type ExperienceType,
  type OnboardingProfileInput,
} from '@workflex/shared';
import { StepShell } from '../../src/components/onboarding/StepShell';
import { GlassField } from '../../src/components/onboarding/GlassField';
import { PasswordStrength } from '../../src/components/onboarding/PasswordStrength';
import { ChoiceCards } from '../../src/components/onboarding/ChoiceCards';
import { useTheme } from '../../src/lib/use-theme';
import { PhoneField } from '../../src/components/onboarding/PhoneField';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { requestOtp } from '../../src/api/auth';
import { useRegistrationDraft } from '../../src/store/registration-draft-store';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useStepCount } from '../../src/lib/onboarding-steps';

export default function DetailsScreen() {
  const t = useT();
  const router = useRouter();

  // One field for the whole name, by request, rather than first and last:
  // it is stored as written and never split (see the shared schema).
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');

  const [phone, setPhone] = useState('');
  const [experienceType, setExperienceType] = useState<ExperienceType | null>(
    null,
  );
  const setDraft = useRegistrationDraft((s) => s.set);

  const { c } = useTheme();
  // Anyone who came through "find work". A recruiter registering as an
  // individual reaches this same form but answers a different question.

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { total, offset } = useStepCount();
  const errorMessage = useErrorMessage();

  /**
   * "Register Now" sends the SMS code and moves to the verify screen. The
   * profile itself is saved there, because POST /onboarding/profile is
   * authenticated by the session that verifying the code creates.
   */
  const sendCode = useMutation({
    mutationFn: async (args: {
      input: OnboardingProfileInput;
      phone: string;
    }) => {
      await requestOtp(args.phone);
      return args;
    },
    onSuccess: ({ input, phone: normalised }) => {
      setDraft(input, normalised);
      router.push('/(onboarding)/verify');
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const onSubmit = () => {
    setFormError(null);
    setFieldErrors({});

    const parsedPhone = bdPhoneSchema.safeParse(phone);
    if (!parsedPhone.success) {
      setFieldErrors({ phone: t('auth.invalidNumber') });
      return;
    }

    // Everyone is a potential job seeker now, so everyone is asked. The
    // shared schema keeps it optional so an older record without an answer
    // still validates.
    if (!experienceType) {
      setFieldErrors({ experienceType: t('ob.experienceRequired') });
      return;
    }

    const input = {
      fullName,
      address,
      password,
      confirmPassword,
      email: email.trim() || undefined,
      ...(experienceType ? { experienceType } : {}),
    } as OnboardingProfileInput;

    // Validated with the same schema the API uses, so nothing can pass here
    // and fail server-side.
    const parsed = onboardingProfileSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    // The profile cannot be written yet — that endpoint needs the session the
    // SMS check creates. Hold the form, send the code, and let the verify
    // screen save it once the number is proven.
    sendCode.mutate({ input: parsed.data, phone: parsedPhone.data });
  };

  return (
    <StepShell
      step={1 + offset}
      total={total}
      title={t('ob.details.title')}
      subtitle={t('ob.details.subtitle')}
      // Back to the sign-in page this form is opened from (its Create an
      // account button). That is also where Back goes if the form was
      // reloaded and has no history.
      backTo="/(auth)/login"
      centerHeader
      showBrand
      footer={
        <ShimmerButton
          label={t('ob.registerNow')}
          onPress={onSubmit}
          loading={sendCode.isPending}
        />
      }
    >
      <GlassField
        label={t('ob.fullName')}
        value={fullName}
        onChangeText={setFullName}
        sanitize={sanitizePersonName}
        error={fieldErrors.fullName}
        placeholder={t('ob.fullNamePlaceholder')}
        icon="👤"
        required
        autoComplete="name"
      />

      <PhoneField
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (fieldErrors.phone) setFieldErrors((e) => ({ ...e, phone: '' }));
          if (formError) setFormError(null);
        }}
        error={fieldErrors.phone}
        editable={!sendCode.isPending}
      />

      <GlassField
        label={t('ob.address')}
        value={address}
        onChangeText={setAddress}
        placeholder={t('ob.addressPlaceholder')}
        error={fieldErrors.address}
        sanitize={sanitizeAddress}
        autoCapitalize="sentences"
        multiline
      />

      {/* A plain field now. Saving the profile sends a verification code to
          whatever is entered, and the user confirms it later from My Profile —
          which also keeps this form submittable in one pass. */}
      <GlassField
        label={t('ob.emailLabel')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('email.placeholder')}
        error={fieldErrors.email}
        optional
        icon="✉"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <GlassField
        label={t('ob.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        placeholder={t('ob.passwordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        maxLength={72}
        required
        icon="🔒"
      />
      <PasswordStrength password={password} />

      <GlassField
        label={t('ob.confirmPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={fieldErrors.confirmPassword}
        placeholder={t('ob.confirmPasswordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        maxLength={72}
        required
        icon="🔒"
      />

      {/* Asked of everyone. There is one kind of account now, and anybody
          may look for work — so the question applies to anybody. */}
      <ChoiceCards
        label={t('ob.experienceLabel')}
        choices={EXPERIENCE_CHOICES}
        selected={experienceType}
        onSelect={(v) => {
          setExperienceType(v);
          if (fieldErrors.experienceType) {
            setFieldErrors((e) => ({ ...e, experienceType: '' }));
          }
        }}
        error={fieldErrors.experienceType}
      />

      <ErrorBanner message={formError} />

      <Text style={[styles.terms, { color: c.textMutedOnBrand }]}>
        {t('ob.termsPrefix')}{' '}
        <Text style={[styles.termsLink, { color: c.accentOnBrand }]}>
          {t('ob.termsLink')}
        </Text>{' '}
        {t('ob.termsAnd')}{' '}
        <Text style={[styles.termsLink, { color: c.accentOnBrand }]}>
          {t('ob.privacyLink')}
        </Text>{' '}
        {t('ob.termsSuffix')}
      </Text>
    </StepShell>
  );
}

const EXPERIENCE_CHOICES = [
  {
    value: 'EXPERIENCED' as const,
    emoji: '💼',
    title: 'ob.experienced' as const,
    body: 'ob.experiencedBody' as const,
  },
  {
    value: 'FRESHER' as const,
    emoji: '🎓',
    title: 'ob.fresher' as const,
    body: 'ob.fresherBody' as const,
  },
];

const styles = StyleSheet.create({
  terms: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  termsLink: { fontWeight: '800', textDecorationLine: 'underline' },
});
