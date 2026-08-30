import { z } from 'zod';
import { emailSchema } from './email';

export const accountTypeSchema = z.enum(['INDIVIDUAL', 'COMPANY']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const documentKindSchema = z.enum([
  'NID_FRONT',
  'NID_BACK',
  'SELFIE',
  'TIN_CERTIFICATE',
  'TRADE_LICENSE',
]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

/**
 * What everyone must prove, regardless of what they intend to do here.
 *
 * There is one kind of account. Someone can look for shift work in the
 * morning and hire a cleaner in the afternoon, so splitting the requirements
 * by a role chosen at signup asked a question nobody could answer honestly
 * and then held them to the answer.
 */
export const REQUIRED_DOCUMENTS: DocumentKind[] = [
  'NID_FRONT',
  'NID_BACK',
  'SELFIE',
];

/**
 * Never blocks registration. A verified trade licence is what unlocks posting
 * jobs *as a company* — it is a capability someone earns later, not a hurdle
 * in front of the front door.
 */
export const OPTIONAL_DOCUMENTS: DocumentKind[] = [
  'TRADE_LICENSE',
  'TIN_CERTIFICATE',
];

export function requiredDocuments(): DocumentKind[] {
  return REQUIRED_DOCUMENTS;
}

/**
 * Asked of job seekers at registration. Recruiters are never asked, so this
 * stays optional in the shared schema and the API drops it for a COMPANY
 * account rather than storing an answer nobody gave.
 */
export const experienceTypeSchema = z.enum(['EXPERIENCED', 'FRESHER']);
export type ExperienceType = z.infer<typeof experienceTypeSchema>;

export const kycStatusSchema = z.enum([
  'NOT_STARTED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
]);
export type KycStatus = z.infer<typeof kycStatusSchema>;

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(60)
  // Bangla and Latin letters, spaces, dots and hyphens. No digits.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u, 'Enter a valid name');

/** Business names carry digits and punctuation that personal names do not. */
const organisationNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter the company name')
  .max(120)
  .regex(
    /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\s.,&'()\-/]*$/u,
    'Enter a valid company name',
  );

/** Registration and licence numbers: letters, digits and separators only. */
const referenceNumberSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9\-/ ]*$/, 'Use letters and numbers only');

const designationSchema = z
  .string()
  .trim()
  .min(2, 'Enter your designation')
  .max(80)
  .regex(
    /^[\p{L}\p{M}][\p{L}\p{M}\s.&'()\-/]*$/u,
    'Enter a valid designation',
  );

/**
 * Addresses legitimately contain digits, commas, slashes and dashes
 * ("House 12/A, Road 5"), so this only rejects control characters and the
 * angle brackets that signal an injection attempt rather than an address.
 */
const addressSchema = z
  .string()
  .trim()
  .min(5, 'Enter your full address')
  .max(255)
  .regex(
    /^[\p{L}\p{M}\p{N}\s.,#\-/()'&]+$/u,
    'Enter a valid address',
  );

/**
 * Account password.
 *
 * Phone OTP remains the primary way in; this is a second factor for the web
 * admin surface and a fallback when a SIM is lost. Each class is checked
 * separately so the message names the one thing that is missing rather than
 * restating the whole rule.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[a-z]/, 'Include a small letter')
  .regex(/[A-Z]/, 'Include a capital letter')
  .regex(/\d/, 'Include a digit')
  .regex(/[^A-Za-z0-9]/, 'Include a special character');

/**
 * Choosing a new password after an SMS check.
 *
 * Same rules as registration — a reset must not be a way to set a weaker
 * password than the one it replaces.
 */
export const passwordResetConfirmSchema = z
  .object({
    phone: z.string().trim().min(1),
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
  });
export type PasswordResetConfirmInput = z.input<
  typeof passwordResetConfirmSchema
>;
export type PasswordResetConfirmDto = z.output<
  typeof passwordResetConfirmSchema
>;

/** NBR TINs are 9-15 digits depending on issue date. */
const tinSchema = z
  .string()
  .trim()
  .regex(/^\d{9,15}$/, 'A TIN is 9 to 15 digits');

/**
 * Registration details.
 *
 * `companyName` is required only for a company account, which is enforced by
 * the discriminated union rather than by a runtime check in the controller,
 * so the API and the app cannot disagree about when it is mandatory.
 */
/**
 * One registration form for everyone.
 *
 * This used to be a discriminated union on `accountType`, with a company
 * branch asking for a trade name, registration number and job title. Those
 * questions have moved to the point where they are actually needed — posting
 * a job as a company — because asking them at signup forced a person to
 * declare at the front door whether they were here to work or to hire, and
 * most people are eventually both.
 */
export const onboardingProfileSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    address: addressSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    /** Optional throughout — phone remains the mandatory identity. */
    email: emailSchema.optional().or(z.literal('')),
    /** Used for job matching; everyone is a potential job seeker now. */
    experienceType: experienceTypeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
  });
export type OnboardingProfileInput = z.input<typeof onboardingProfileSchema>;
export type OnboardingProfileDto = z.output<typeof onboardingProfileSchema>;

/**
 * Editing registration details afterwards, from My Profile.
 *
 * Deliberately not the registration schema with `.partial()`: password and
 * email are absent because both already have their own flows (password reset
 * by SMS, email by its own verification round trip), and routing them through
 * a plain profile save would skip those checks.
 *
 * `accountType` is absent too — switching between individual and company
 * after the fact would invalidate whichever documents were already uploaded
 * against the old type.
 */
export const profileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  address: addressSchema,
  /** Company accounts only; ignored by the API for an individual. */
  designation: designationSchema.optional().or(z.literal('')),
  companyName: organisationNameSchema.optional().or(z.literal('')),
  companyRegistrationNumber: referenceNumberSchema
    .max(60)
    .optional()
    .or(z.literal('')),
  tin: tinSchema.optional().or(z.literal('')),
  tradeLicenseNo: referenceNumberSchema.max(60).optional().or(z.literal('')),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdateDto = z.output<typeof profileUpdateSchema>;

/** Current values plus what the server will actually let this account change. */
export const myProfileSchema = z.object({
  accountType: accountTypeSchema.nullable(),
  phone: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  address: z.string().nullable(),
  designation: z.string().nullable(),
  /**
   * Read-only here. Present so the "your information" summary is one request
   * rather than two — changing it still goes through /me/email, which sends
   * a code to the new address before anything is stored.
   */
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  company: z
    .object({
      name: z.string(),
      registrationNumber: z.string().nullable(),
      tin: z.string().nullable(),
      tradeLicenseNo: z.string().nullable(),
    })
    .nullable(),
  /**
   * False once the name has been checked against an NID — see
   * ProfileService.update. The app renders those two fields read-only rather
   * than letting the user type a change the server will reject.
   */
  nameEditable: z.boolean(),
  kycStatus: kycStatusSchema,
});
export type MyProfile = z.infer<typeof myProfileSchema>;

export const analysisStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'PASSED',
  'NEEDS_REVIEW',
  'FAILED',
  'SKIPPED',
]);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

/**
 * Automated checks on one document. These assist the reviewer and give the
 * applicant instant feedback on an unreadable photo; they never approve an
 * application on their own.
 */
export const documentAnalysisSchema = z.object({
  status: analysisStatusSchema,
  /** 0..1, higher is sharper. Low values mean an unreadable photo. */
  sharpness: z.number().nullable(),
  /** 0..1, higher is worse — reflections washing out the card. */
  glare: z.number().nullable(),
  cardFound: z.boolean().nullable(),
  facesDetected: z.number().int().nullable(),
  /** Descriptor distance selfie vs NID portrait; lower is more similar. */
  faceMatch: z.number().nullable(),
  extractedNid: z.string().nullable(),
  extractedName: z.string().nullable(),
  extractedDob: z.string().nullable(),
  notes: z.string().nullable(),
});
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

export const uploadedDocumentSchema = z.object({
  kind: documentKindSchema,
  uploadedAt: z.string(),
  sizeBytes: z.number().int(),
  analysis: documentAnalysisSchema.nullable(),
});
export type UploadedDocument = z.infer<typeof uploadedDocumentSchema>;

export const onboardingStatusSchema = z.object({
  accountType: accountTypeSchema.nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  address: z.string().nullable(),
  companyName: z.string().nullable(),
  companyRegistrationNumber: z.string().nullable(),
  designation: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  documents: z.array(uploadedDocumentSchema),
  /** Kinds still missing for the chosen account type. */
  missingDocuments: z.array(documentKindSchema),
  /**
   * Non-blocking problems from the last write — currently only a failed
   * verification email. Email is optional, so a mail outage must not stop
   * registration, but the applicant still deserves to be told.
   */
  warnings: z.array(z.string()).default([]),
  profileComplete: z.boolean(),
  submitted: z.boolean(),
  kycStatus: kycStatusSchema,
  rejectReason: z.string().nullable(),
});
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
