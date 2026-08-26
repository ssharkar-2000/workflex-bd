import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at boot.
 * A missing or malformed value crashes startup with a readable message
 * instead of surfacing as `undefined` somewhere in a request handler.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  // Secrets must be long enough to be worth signing with. The refusal to
  // start on a short secret is deliberate — dev placeholders must not ship.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  OTP_PEPPER: z.string().min(32, 'OTP_PEPPER must be >= 32 chars'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),

  /**
   * Return the OTP in the API response so the app can pre-fill it.
   * Convenient, but it means anyone can sign in as any number — the code is
   * handed to the caller. Off by default; read codes from the admin endpoint
   * or the API log instead.
   */
  OTP_EXPOSE_DEV_CODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * Admin accounts live in their own table and sign in with email + password
   * (see /auth/admin/login), never phone. This domain is the only thing that
   * makes an admin email recognisable as one — reserved so a regular user's
   * optional contact email can never collide with it (EmailVerificationService
   * enforces the other half of that).
   */
  ADMIN_EMAIL_DOMAIN: z.string().default('admin.workflex.com.bd'),
  /** Admin sessions have no refresh token — just a longer-lived access token. */
  ADMIN_JWT_TTL: z.string().default('8h'),

  // file      — appends to a dedicated SMS log file. Development default.
  // console   — prints the code to the application log. Development only.
  // bulksmsbd — BulkSMSBD-style HTTP gateway; also fits most BD resellers.
  // twilio    — no contract needed, costs more per message.
  SMS_PROVIDER: z
    .enum(['file', 'console', 'bulksmsbd', 'twilio'])
    .default('file'),
  SMS_LOG_FILE: z.string().default('./logs/sms.log'),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_ENDPOINT: z.string().url().default('http://bulksmsbd.net/api/smsapi'),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  // Email is an optional, secondary channel — a dev provider here is not the
  // security problem that a dev SMS provider is, so production is not blocked.
  MAIL_PROVIDER: z
    .enum(['file', 'console', 'smtp', 'resend'])
    .default('file'),
  MAIL_LOG_FILE: z.string().default('./logs/mail.log'),
  MAIL_FROM: z.string().default('WorkFlex BD <no-reply@workflex.com.bd>'),
  RESEND_API_KEY: z.string().optional(),

  // Google SMTP: smtp.gmail.com:465 with a Gmail App Password, not the
  // account password — Gmail rejects plain SMTP auth on accounts with 2FA,
  // which is required to generate an App Password in the first place.
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  /// Private root for KYC documents. Must not be inside any served directory.
  STORAGE_DIR: z.string().default('./storage'),

  /// face-api weights. Absent by default; the face stage reports SKIPPED
  /// rather than failing, so a fresh clone runs without a 10 MB download.
  FACE_MODELS_DIR: z.string().default('./models/face-api'),
  /// mediapipe is the better detector where it runs, but its vision tasks are
  /// browser-targeted and unreliable under Node.
  FACE_DETECTOR: z.enum(['faceapi', 'mediapipe']).default('faceapi'),
  /// Per-file ceiling. NID photos from a phone camera are ~1-4 MB.
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(8_000_000),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_DOCUMENTS: z.string().default('workflex-documents'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}\n\n` +
        `Copy .env.example to .env and fill in the missing values.`,
    );
  }

  // A real deployment must never run on the committed dev placeholders.
  if (parsed.data.NODE_ENV === 'production') {
    const placeholders = (['JWT_ACCESS_SECRET', 'OTP_PEPPER'] as const).filter(
      (k) => parsed.data[k].startsWith('dev_only_'),
    );
    if (placeholders.length > 0) {
      throw new Error(
        `Refusing to start in production with dev placeholder secrets: ${placeholders.join(', ')}`,
      );
    }
    if (parsed.data.SMS_PROVIDER === 'console' || parsed.data.SMS_PROVIDER === 'file') {
      throw new Error(
        `Refusing to start in production with SMS_PROVIDER=${parsed.data.SMS_PROVIDER} — ` +
          'codes would be written to a log instead of delivered. Set SMS_PROVIDER=bulksmsbd.',
      );
    }
    if (parsed.data.OTP_EXPOSE_DEV_CODE) {
      throw new Error(
        'Refusing to start in production with OTP_EXPOSE_DEV_CODE=true — it would hand every caller a valid login code.',
      );
    }
  }

  // Selecting a gateway without its credentials would fail at the first
  // signup attempt instead of at boot. Fail at boot.
  const missing = requiredCredentials(parsed.data);
  if (missing.length > 0) {
    throw new Error(
      `SMS_PROVIDER=${parsed.data.SMS_PROVIDER} requires: ${missing.join(', ')}`,
    );
  }

  const missingMail = requiredMailCredentials(parsed.data);
  if (missingMail.length > 0) {
    throw new Error(
      `MAIL_PROVIDER=${parsed.data.MAIL_PROVIDER} requires: ${missingMail.join(', ')}`,
    );
  }

  return parsed.data;
}

function requiredCredentials(env: Env): string[] {
  switch (env.SMS_PROVIDER) {
    case 'bulksmsbd':
      return (['SMS_API_KEY', 'SMS_SENDER_ID'] as const).filter(
        (k) => !env[k],
      );
    case 'twilio':
      return (
        ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'] as const
      ).filter((k) => !env[k]);
    default:
      return [];
  }
}

export function requiredMailCredentials(env: Env): string[] {
  switch (env.MAIL_PROVIDER) {
    case 'resend':
      return env.RESEND_API_KEY ? [] : ['RESEND_API_KEY'];
    case 'smtp':
      return (['SMTP_USER', 'SMTP_PASS'] as const).filter((k) => !env[k]);
    default:
      return [];
  }
}
