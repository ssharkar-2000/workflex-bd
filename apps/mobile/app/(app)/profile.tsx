import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  maskPhone,
  profileUpdateSchema,
  sanitizeAddress,
  sanitizeDesignation,
  sanitizeDigits,
  sanitizeOrganisationName,
  sanitizePersonName,
  sanitizeReferenceNumber,
  type AuthUser,
  type MyProfile,
} from '@workflex/shared';
import { fetchMyProfile, updateMyProfile } from '../../src/api/profile';
import { fetchMe } from '../../src/api/auth';
import { removeEmail } from '../../src/api/email';
import { useErrorMessage } from '../../src/lib/error-message';
import { Avatar } from '../../src/components/Avatar';
import { EmailCard } from '../../src/components/EmailCard';
import { KycStatusCard } from '../../src/components/KycStatusCard';
import { VerificationCard } from '../../src/components/VerificationCard';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
  });

  // Drives the verification card, which reads the account's level rather than
  // anything editable here.
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={[styles.back, { color: c.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>
          {t('profile.title')}
        </Text>
        <View style={styles.backSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : error || !data ? (
        <View style={styles.centered}>
          <Text style={[styles.errorBody, { color: c.textMuted }]}>
            {errorMessage(error)}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: c.primary }]}
            onPress={() => void refetch()}
          >
            <Text style={[styles.retryButtonText, { color: c.primaryText }]}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* The verification selfie, shown where someone looks for their
              own photo. `me` carries hasPhoto; MyProfile does not, and the
              dashboard has already warmed this query. */}
          {me ? <ProfilePhoto user={me} profile={data} /> : null}

          <InformationCard profile={data} />
          <UpdateSection profile={data} />
          <EmailCard />
          <KycStatusCard />
          {me ? <VerificationCard level={me.verificationLevel} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * The account's own face, from the verification step.
 *
 * Falls back to initials when no selfie has been uploaded — the same
 * component the dashboard uses, so a photo taken during verification appears
 * in both places without either screen knowing how it is fetched.
 */
function ProfilePhoto({
  user,
  profile,
}: {
  user: AuthUser;
  profile: MyProfile;
}) {
  const t = useT();
  const { c } = useTheme();

  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;
  const initials = fullName
    ? fullName
        .split(/s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : profile.phone.slice(-2);

  return (
    <View style={styles.photoWrap}>
      <Avatar
        hasPhoto={user.hasPhoto}
        initials={initials}
        size={92}
        // Re-fetches when the photo state flips, so a selfie taken during
        // verification shows up without restarting the app.
        version={String(user.hasPhoto)}
      />
      <Text style={[styles.photoName, { color: c.text }]} numberOfLines={1}>
        {fullName || maskPhone(profile.phone)}
      </Text>
      {!user.hasPhoto ? (
        <Text style={[styles.photoHint, { color: c.textMuted }]}>
          {t('profile.noPhoto')}
        </Text>
      ) : null}
    </View>
  );
}

/** Everything the account holds from registration, read-only. */
function InformationCard({ profile }: { profile: MyProfile }) {
  const t = useT();
  const { c } = useTheme();

  const isCompany = profile.accountType === 'COMPANY';
  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Text style={[styles.cardTitle, { color: c.text }]}>
        {t('profile.info')}
      </Text>

      <Row label={t('profile.phone')} value={maskPhone(profile.phone)} />
      <Row label={t('profile.name')} value={fullName} />
      <Row
        label={t('profile.accountType')}
        value={
          profile.accountType
            ? isCompany
              ? t('profile.typeCompany')
              : t('profile.typeIndividual')
            : null
        }
      />
      <Row label={t('ob.address')} value={profile.address} />
      <Row
        label={t('email.title')}
        value={profile.email}
        badge={
          profile.email
            ? profile.emailVerified
              ? t('email.verified')
              : t('email.pending')
            : undefined
        }
        badgeTone={profile.emailVerified ? 'success' : 'warning'}
      />

      {isCompany ? (
        <>
          <Row label={t('ob.designation')} value={profile.designation} />
          <Row label={t('ob.companyName')} value={profile.company?.name ?? null} />
          <Row
            label={t('ob.companyRegistrationNumber')}
            value={profile.company?.registrationNumber ?? null}
          />
          <Row label={t('ob.tin')} value={profile.company?.tin ?? null} />
          <Row
            label={t('ob.tradeLicenseNo')}
            value={profile.company?.tradeLicenseNo ?? null}
          />
        </>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  badge,
  badgeTone = 'success',
}: {
  label: string;
  value: string | null;
  badge?: string;
  badgeTone?: 'success' | 'warning';
}) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <Text style={[styles.rowLabel, { color: c.textMuted }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text
          style={[
            styles.rowValue,
            { color: value ? c.text : c.textMuted },
            !value && styles.rowValueEmpty,
          ]}
        >
          {value || t('profile.notGiven')}
        </Text>
        {badge ? (
          <View
            style={[
              styles.rowBadge,
              {
                backgroundColor:
                  badgeTone === 'success' ? c.successSoft : c.warningSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.rowBadgeText,
                { color: badgeTone === 'success' ? c.success : c.warning },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Collapsed by default. Showing the same fields as editable inputs directly
 * under the read-only list would print every value on screen twice and leave
 * it ambiguous which copy is authoritative.
 */
function UpdateSection({ profile }: { profile: MyProfile }) {
  const t = useT();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View
      style={[
        styles.card,
        styles.cardSpaced,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Pressable
        style={styles.updateHead}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.updateHeadText}>
          <Text style={[styles.cardTitle, styles.cardTitleTight, { color: c.text }]}>
            {t('profile.update')}
          </Text>
          <Text style={[styles.updateHint, { color: c.textMuted }]}>
            {t('profile.updateHint')}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: c.textMuted }]}>
          {open ? '⌃' : '⌄'}
        </Text>
      </Pressable>

      {open ? (
        <DetailsForm
          profile={profile}
          onSaved={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

function DetailsForm({
  profile,
  onSaved,
}: {
  profile: MyProfile;
  onSaved: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const isCompany = profile.accountType === 'COMPANY';

  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [address, setAddress] = useState(profile.address ?? '');
  const [designation, setDesignation] = useState(profile.designation ?? '');
  const [companyName, setCompanyName] = useState(profile.company?.name ?? '');
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState(
    profile.company?.registrationNumber ?? '',
  );
  const [tin, setTin] = useState(profile.company?.tin ?? '');
  const [tradeLicenseNo, setTradeLicenseNo] = useState(
    profile.company?.tradeLicenseNo ?? '',
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Collapses back to the summary shortly after a save, so the updated values
  // are read where they are now authoritative rather than in the form.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      setSaved(false);
      onSaved();
    }, 1200);
    return () => clearTimeout(timer);
  }, [saved, onSaved]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = profileUpdateSchema.safeParse({
        firstName,
        lastName,
        address,
        designation: isCompany ? designation : '',
        companyName: isCompany ? companyName : '',
        companyRegistrationNumber: isCompany ? companyRegistrationNumber : '',
        tin: isCompany ? tin : '',
        tradeLicenseNo: isCompany ? tradeLicenseNo : '',
      });

      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? '');
          if (key && !errors[key]) errors[key] = issue.message;
        }
        setFieldErrors(errors);
        throw new Error('VALIDATION');
      }

      setFieldErrors({});
      return updateMyProfile(parsed.data);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-profile'], updated);
      // The dashboard greeting and the KYC queue both read from /me.
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      setFormError(null);
      setSaved(true);
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'VALIDATION') return;
      setFormError(errorMessage(err));
    },
  });

  const clearErrors = () => {
    if (formError) setFormError(null);
    if (saved) setSaved(false);
  };

  return (
    <View style={styles.form}>
      {profile.nameEditable ? (
        <>
          <Field
            label={t('ob.firstName')}
            value={firstName}
            onChangeText={(v) => {
              setFirstName(sanitizePersonName(v));
              clearErrors();
            }}
            error={fieldErrors.firstName}
            disabled={save.isPending}
          />
          <Field
            label={t('ob.lastName')}
            value={lastName}
            onChangeText={(v) => {
              setLastName(sanitizePersonName(v));
              clearErrors();
            }}
            error={fieldErrors.lastName}
            disabled={save.isPending}
          />
        </>
      ) : (
        <View style={styles.lockedNote}>
          <Text style={[styles.hint, { color: c.textMuted }]}>
            {profile.kycStatus === 'APPROVED'
              ? t('profile.nameLockedApproved')
              : t('profile.nameLockedReview')}
          </Text>
        </View>
      )}

      <Field
        label={t('ob.address')}
        value={address}
        onChangeText={(v) => {
          setAddress(sanitizeAddress(v));
          clearErrors();
        }}
        error={fieldErrors.address}
        disabled={save.isPending}
        multiline
      />

      {isCompany ? (
        <>
          <Field
            label={t('ob.designation')}
            value={designation}
            onChangeText={(v) => {
              setDesignation(sanitizeDesignation(v));
              clearErrors();
            }}
            error={fieldErrors.designation}
            disabled={save.isPending}
          />
          <Field
            label={t('ob.companyName')}
            value={companyName}
            onChangeText={(v) => {
              setCompanyName(sanitizeOrganisationName(v));
              clearErrors();
            }}
            error={fieldErrors.companyName}
            disabled={save.isPending}
          />
          <Field
            label={t('ob.companyRegistrationNumber')}
            value={companyRegistrationNumber}
            onChangeText={(v) => {
              setCompanyRegistrationNumber(sanitizeReferenceNumber(v));
              clearErrors();
            }}
            error={fieldErrors.companyRegistrationNumber}
            disabled={save.isPending}
          />
          <Field
            label={t('ob.tin')}
            value={tin}
            onChangeText={(v) => {
              setTin(sanitizeDigits(v, 15));
              clearErrors();
            }}
            error={fieldErrors.tin}
            disabled={save.isPending}
            keyboardType="number-pad"
          />
          <Field
            label={t('ob.tradeLicenseNo')}
            value={tradeLicenseNo}
            onChangeText={(v) => {
              setTradeLicenseNo(sanitizeReferenceNumber(v));
              clearErrors();
            }}
            error={fieldErrors.tradeLicenseNo}
            disabled={save.isPending}
          />
        </>
      ) : null}

      <Pressable
        style={[
          styles.saveButton,
          { backgroundColor: c.primary },
          save.isPending && styles.disabled,
        ]}
        disabled={save.isPending}
        onPress={() => save.mutate()}
      >
        <Text style={[styles.saveButtonText, { color: c.primaryText }]}>
          {save.isPending ? t('profile.saving') : t('profile.saveChanges')}
        </Text>
      </Pressable>

      {saved ? (
        <Text style={[styles.savedNote, { color: c.success }]}>
          ✓ {t('profile.saved')}
        </Text>
      ) : null}
      {formError ? (
        <Text style={[styles.errorText, { color: c.danger }]}>{formError}</Text>
      ) : null}

      <DeleteEmailSection profile={profile} />
    </View>
  );
}

/**
 * Email is optional on every account — the schema treats it that way for
 * individuals and companies alike — so removing one has to be possible
 * without it looking like the account is being damaged. Kept behind a
 * confirmation because the address is also the recovery channel.
 */
function DeleteEmailSection({ profile }: { profile: MyProfile }) {
  const t = useT();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const remove = useMutation({
    mutationFn: removeEmail,
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['email-status'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const confirm = () => {
    Alert.alert(
      t('profile.deleteEmail'),
      t('profile.deleteEmailConfirm', { email: profile.email ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteEmailAction'),
          style: 'destructive',
          onPress: () => remove.mutate(),
        },
      ],
    );
  };

  return (
    <View style={[styles.dangerZone, { borderTopColor: c.border }]}>
      <Text style={[styles.dangerTitle, { color: c.text }]}>
        {t('profile.deleteEmail')}
      </Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {t('profile.deleteEmailHint')}
      </Text>

      {profile.email ? (
        <>
          <Text style={[styles.dangerEmail, { color: c.text }]}>
            {profile.email}
          </Text>
          <Pressable
            style={[
              styles.dangerButton,
              { borderColor: c.danger },
              remove.isPending && styles.disabled,
            ]}
            disabled={remove.isPending}
            onPress={confirm}
            accessibilityRole="button"
          >
            <Text style={[styles.dangerButtonText, { color: c.danger }]}>
              {remove.isPending
                ? t('profile.deleting')
                : t('profile.deleteEmailAction')}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.dangerEmpty, { color: c.textMuted }]}>
          {t('email.none')}
        </Text>
      )}

      {error ? (
        <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  disabled,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  const { c } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: error ? c.danger : c.border,
            backgroundColor: c.bg,
            color: c.text,
          },
          multiline && styles.inputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
      />
      {error ? (
        <Text style={[styles.fieldError, { color: c.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  back: { fontSize: font.lg, fontWeight: '700' },
  backSpacer: { width: font.lg },
  title: { fontSize: font.md, fontWeight: '700' },

  container: { padding: space.lg, paddingTop: 0, paddingBottom: space.fab },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },

  photoWrap: { alignItems: 'center', paddingBottom: 18 },
  photoName: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  photoHint: { fontSize: 12, marginTop: 4, textAlign: 'center' },

  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.md },
  cardSpaced: { marginTop: space.lg },
  cardTitle: { fontSize: font.md, fontWeight: '700', marginBottom: space.md },
  cardTitleTight: { marginBottom: 2 },

  row: {
    borderTopWidth: 1,
    paddingVertical: space.sm,
  },
  rowLabel: { fontSize: font.xs, marginBottom: 2 },
  rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowValue: { flexShrink: 1, fontSize: font.sm, fontWeight: '600' },
  rowValueEmpty: { fontStyle: 'italic', fontWeight: '400' },
  rowBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  rowBadgeText: { fontSize: font.xs, fontWeight: '700' },

  updateHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  updateHeadText: { flex: 1 },
  updateHint: { fontSize: font.xs, lineHeight: 17 },
  chevron: { fontSize: font.md, fontWeight: '800' },

  form: { marginTop: space.md },
  field: { marginTop: space.md },
  fieldLabel: { fontSize: font.xs, marginBottom: space.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.md,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  fieldError: { fontSize: font.xs, marginTop: space.xs },

  lockedNote: { marginTop: space.xs },
  hint: { fontSize: font.xs, lineHeight: 17 },

  saveButton: {
    marginTop: space.lg,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  saveButtonText: { fontSize: font.md, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  savedNote: { fontSize: font.sm, marginTop: space.sm, fontWeight: '600' },
  errorText: { fontSize: font.sm, marginTop: space.sm },

  dangerZone: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
  },
  dangerTitle: { fontSize: font.sm, fontWeight: '700', marginBottom: 2 },
  dangerEmail: {
    fontSize: font.sm,
    fontWeight: '600',
    marginTop: space.sm,
  },
  dangerEmpty: { fontSize: font.sm, marginTop: space.sm, fontStyle: 'italic' },
  dangerButton: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  dangerButtonText: { fontSize: font.sm, fontWeight: '700' },

  errorBody: { fontSize: font.sm, textAlign: 'center', marginBottom: space.md },
  retryButton: {
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  retryButtonText: { fontSize: font.md, fontWeight: '600' },
});
