import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  onboardingProfileSchema,
  sanitizeAddress,
  sanitizeDesignation,
  sanitizeDigits,
  sanitizeOrganisationName,
  sanitizePersonName,
  sanitizeReferenceNumber,
  type AccountType,
  type ExperienceType,
  type OnboardingProfileInput,
} from '@workflex/shared';
import { StepShell } from '../../src/components/onboarding/StepShell';
import { GlassField } from '../../src/components/onboarding/GlassField';
import { PasswordStrength } from '../../src/components/onboarding/PasswordStrength';
import { ChoiceCards } from '../../src/components/onboarding/ChoiceCards';
import { useIntentStore } from '../../src/store/intent-store';
import { useTheme } from '../../src/lib/use-theme';
import { PhoneVerifyField } from '../../src/components/onboarding/PhoneVerifyField';
import { EmailVerifyField } from '../../src/components/onboarding/EmailVerifyField';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import {
  fetchOnboardingStatus,
  saveOnboardingProfile,
} from '../../src/api/onboarding';
import { useAuthStore } from '../../src/store/auth-store';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useStepCount } from '../../src/lib/onboarding-steps';

export default function DetailsScreen() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ accountType?: string }>();
  const accountType: AccountType =
    params.accountType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL';
  const isCompany = accountType === 'COMPANY';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [tin, setTin] = useState('');
  const [tradeLicenseNo, setTradeLicenseNo] = useState('');

  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [experienceType, setExperienceType] = useState<ExperienceType | null>(
    null,
  );

  const { c } = useTheme();
  const intent = useIntentStore((s) => s.intent);
  // Anyone who came through "find work". A recruiter registering as an
  // individual reaches this same form but answers a different question.
  const isJobSeeker = !isCompany && intent !== 'HIRE';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { total, offset } = useStepCount();
  const errorMessage = useErrorMessage();

  const save = useMutation({
    mutationFn: (input: OnboardingProfileInput) =>
      saveOnboardingProfile(input),
    onSuccess: (status) => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      if (status.warnings.length > 0) {
        Alert.alert(t('ob.details.title'), status.warnings.join('\n\n'));
      }
      router.push('/(onboarding)/documents');
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  /**
   * A verified number may already belong to a finished account — the SMS check
   * signs that user straight back in. Saving a profile over it would fail with
   * a conflict, so route them to sign-in instead of showing an error they can
   * do nothing about.
   */
  const checkExisting = async (phone: string) => {
    const status = await fetchOnboardingStatus().catch(() => null);
    if (!status?.submitted) return;

    await useAuthStore.getState().signOut();
    Alert.alert(t('ob.alreadyRegistered'), t('ob.alreadyRegisteredBody'));
    router.replace({
      pathname: '/(auth)/login',
      params: { phone, notice: 'exists' },
    });
  };

  const onSubmit = () => {
    setFormError(null);
    setFieldErrors({});

    // The saved profile is attached to the session the SMS check created, so
    // nothing can be submitted until the number is proven.
    if (!verifiedPhone) {
      requestAnimationFrame(() => setFormError(t('ob.verifyPhoneFirst')));
      return;
    }

    // Required by the form for job seekers, though the shared schema leaves it
    // optional so an individual recruiter — who is never asked — still passes.
    if (isJobSeeker && !experienceType) {
      setFieldErrors({ experienceType: t('ob.experienceRequired') });
      return;
    }

    const input = {
      accountType,
      firstName,
      lastName,
      address,
      password,
      confirmPassword,
      email: email.trim() || undefined,
      ...(isJobSeeker && experienceType ? { experienceType } : {}),
      ...(isCompany
        ? {
            companyName,
            companyRegistrationNumber,
            designation,
            tin,
            tradeLicenseNo,
          }
        : {}),
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

    save.mutate(parsed.data);
  };

  return (
    <StepShell
      step={1 + offset}
      total={total}
      title={t('ob.details.title')}
      subtitle={t('ob.details.subtitle')}
      canGoBack={offset > 0}
      centerHeader
      footer={
        <ShimmerButton
          label={t('ob.registerNow')}
          onPress={onSubmit}
          loading={save.isPending}
        />
      }
    >
      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          <GlassField
            label={t('ob.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            sanitize={sanitizePersonName}
            error={fieldErrors.firstName}
            placeholder={t('ob.firstNamePlaceholder')}
            icon="👤"
            required
            autoComplete="name"
          />
        </View>
        <View style={styles.nameCol}>
          <GlassField
            label={t('ob.lastName')}
            value={lastName}
            onChangeText={setLastName}
            sanitize={sanitizePersonName}
            error={fieldErrors.lastName}
            placeholder={t('ob.lastNamePlaceholder')}
            required
          />
        </View>
      </View>

      <PhoneVerifyField
        verified={verifiedPhone !== null}
        onVerified={(phone) => {
          setVerifiedPhone(phone);
          if (formError) setFormError(null);
          void checkExisting(phone);
        }}
      />

      {isCompany ? (
        <>
          <GlassField
            label={t('ob.companyName')}
            value={companyName}
            onChangeText={setCompanyName}
            sanitize={sanitizeOrganisationName}
            error={fieldErrors.companyName}
          />
          <GlassField
            label={t('ob.companyRegistrationNumber')}
            value={companyRegistrationNumber}
            onChangeText={setCompanyRegistrationNumber}
            sanitize={sanitizeReferenceNumber}
            error={fieldErrors.companyRegistrationNumber}
            autoCapitalize="none"
          />
          <GlassField
            label={t('ob.designation')}
            value={designation}
            onChangeText={setDesignation}
            sanitize={sanitizeDesignation}
            placeholder={t('ob.designationPlaceholder')}
            error={fieldErrors.designation}
          />
        </>
      ) : null}

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

      {isCompany ? (
        <>
          {/* Full width rather than side by side: both labels are long enough
              to wrap on a phone, which left the two inputs at different
              heights and clipped the "optional" tag. */}
          <GlassField
            label={t('ob.tin')}
            value={tin}
            onChangeText={setTin}
            sanitize={(v) => sanitizeDigits(v, 15)}
            error={fieldErrors.tin}
            optional
            autoCapitalize="none"
            keyboardType="number-pad"
          />
          <GlassField
            label={t('ob.tradeLicenseNo')}
            value={tradeLicenseNo}
            onChangeText={setTradeLicenseNo}
            sanitize={sanitizeReferenceNumber}
            error={fieldErrors.tradeLicenseNo}
            optional
            autoCapitalize="none"
          />
        </>
      ) : null}

      <EmailVerifyField
        enabled={verifiedPhone !== null}
        verifiedEmail={email || null}
        onVerified={setEmail}
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

      {/* Job seekers only. A recruiter has no use for "I'm a fresher", and has
          already answered the equivalent question — individual or company — on
          the previous screen. */}
      {isJobSeeker ? (
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
      ) : null}

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
  nameRow: { flexDirection: 'row', gap: 10 },
  nameCol: { flex: 1 },
  terms: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  termsLink: { fontWeight: '800', textDecorationLine: 'underline' },
});
