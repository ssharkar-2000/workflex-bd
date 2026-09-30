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
  /**
   * Lets production run with SMS_PROVIDER=console: sign-up and reset codes
   * are written to the server log, which only the owner of the hosting
   * account can read, instead of being sent. For a demo deployment with no
   * SMS gateway yet — password sign-in works as normal, and the owner reads
   * a new user's code from the log. Never exposes a code to the caller.
   */
  ALLOW_OTP_IN_LOGS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMS_LOG_FILE: z.string().default('./logs/sms.log'),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_ENDPOINT: z.string().url().default('http://bulksmsbd.net/api/smsapi'),

  // --- CV understanding ---
  // Turning a CV into structured skills is the one job here that genuinely
  // needs a language model: the input is free-form prose in two languages and
  // no two CVs share a layout. Matching *against* those skills afterwards is
  // arithmetic, and is never sent to a model.
  //
  // 'off' keeps every other feature working — CVs upload and store, they are
  // simply not parsed, and jobs carry no match score. That is the correct
  // behaviour without a key rather than a broken screen.
  CV_PARSER: z.enum(['off', 'claude']).default('off'),
  ANTHROPIC_API_KEY: z.string().optional(),
  CV_PARSER_MODEL: z.string().default('claude-opus-5'),

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

  /// Object storage. When all three of endpoint, key and secret are set,
  /// uploads go here instead of STORAGE_DIR — see StorageService. Any
  /// S3-compatible store works: Cloudflare R2 (region "auto"), Backblaze B2,
  /// DigitalOcean Spaces, AWS S3 or MinIO.
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_DOCUMENTS: z.string().default('workflex-documents'),

  /// Google Meet for video interviews. With both set, a recruiter can connect
  /// their Google account and video interviews get a real Meet link, created
  /// on their own calendar. Without them, video interviews fall back to a
  /// Jitsi room and nothing else changes. From Google Cloud Console →
  /// APIs & Services → Credentials → OAuth client (type: Web application).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /// Where Google sends the browser back to. Must match the redirect URI
  /// registered on the OAuth client exactly. Defaults to this API's own
  /// /google/callback under API_PUBLIC_URL (or localhost in development).
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  /// Video meetings run on LiveKit (https://livekit.io). LIVEKIT_URL is the
  /// address the apps connect to: wss://<project>.livekit.cloud, or
  /// ws://localhost:7880 for the server in docker-compose. Leave all three
  /// blank and meetings can still be scheduled; joining a video call then
  /// says that calls are not set up yet.
  LIVEKIT_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().regex(/^wss?:\/\//, 'LIVEKIT_URL must start with ws:// or wss://').optional(),
  ),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  /// Where the web app is served, for meeting links, e.g.
  /// https://workflex-bd.onrender.com. Defaults to the first APP_WEB_ORIGINS
  /// entry, then to http://localhost:8081.
  WEB_APP_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),

  /// Where uploads go. Unset means disk in development and S3 in production.
  /// Development deliberately ignores the S3 variables unless asked: the
  /// .env.example ships MinIO values most machines are not running, and
  /// honouring them would make every upload fail on a fresh clone.
  STORAGE_DRIVER: z.enum(['disk', 's3']).optional(),

  /// Set to true only when STORAGE_DIR is on a volume that survives a
  /// redeploy. Production refuses local-disk storage without it — see the
  /// check in validateEnv.
  STORAGE_DISK_PERSISTENT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // --- wallet top-ups ---
  // off        — no gateway; the wallet works, adding money does not. What a
  //              production deployment gets until a gateway is configured.
  // simulator  — a stand-in payment page served by this API, for developing
  //              without a merchant account. Development only.
  // sslcommerz — SSLCommerz's hosted payment page: bKash, Nagad, Rocket,
  //              cards and internet banking behind one integration.
  //
  // Unset means simulator in development and off in production — see
  // validateEnv.
  // --- payments ---
  //
  // off        — no gateway. Money can still move between wallets and be
  //              declared as a deposit, but nothing can be charged.
  // simulator  — a stand-in payment page served by this API, for developing
  //              without a merchant account. Development only.
  // sslcommerz — SSLCommerz's hosted page: bKash, Nagad, Rocket, cards and
  //              internet banking behind one integration.
  PAYMENT_PROVIDER: z.enum(['off', 'simulator', 'sslcommerz']).default('simulator'),
  SSLCOMMERZ_STORE_ID: z.string().optional(),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),
  /** The sandbox moves no real money, which is why production refuses it. */
  SSLCOMMERZ_SANDBOX: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // --- the wallet's own accounts ---
  //
  // There is no payment gateway. Money is added by sending it to one of
  // these accounts and declaring the transaction id, which someone checks
  // against the receiving statement before anything is credited. An account
  // left unset simply is not offered on the add-money screen.
  WALLET_DEPOSIT_BKASH: z.string().trim().max(100).optional(),
  WALLET_DEPOSIT_NAGAD: z.string().trim().max(100).optional(),
  /** Bank name, branch and account details in one line. */
  WALLET_DEPOSIT_BANK: z.string().trim().max(300).optional(),
  /** The name on those accounts, so the sender can check it before sending. */
  WALLET_DEPOSIT_NAME: z.string().trim().max(100).optional(),
  /**
   * Credit declared deposits the moment they are declared, with no review.
   *
   * For development, where waiting for a person to approve every deposit
   * makes the wallet impossible to try. Production ignores it — see
   * validateEnv — because it would let anyone credit themselves any amount.
   */
  WALLET_AUTO_APPROVE_DEPOSITS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * This API's address as the outside world reaches it, ending in /api/v1.
   * The gateway posts results to it and sends the payer's browser back
   * through it, so it has to be reachable from both. Optional in
   * development, where it is taken from each request's own host.
   */
  /** Where video interviews are held. Defaults to the public Jitsi. */
  INTERVIEW_MEETING_BASE_URL: z.string().url().optional(),

  API_PUBLIC_URL: z.string().url().optional(),
  /**
   * Web addresses a payer may be sent back to, comma separated — the
   * production web app, for instance. The app's own link (workflex://) is
   * always allowed, and outside production so are localhost, LAN addresses
   * and Expo Go's exp:// links.
   */
  APP_WEB_ORIGINS: z.string().default(''),
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

  const paymentProblem = paymentConfigProblem(parsed.data);
  if (paymentProblem) throw new Error(paymentProblem);

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
    const logged = parsed.data.SMS_PROVIDER === 'console' && parsed.data.ALLOW_OTP_IN_LOGS;
    if ((parsed.data.SMS_PROVIDER === 'console' || parsed.data.SMS_PROVIDER === 'file') && !logged) {
      throw new Error(
        `Refusing to start in production with SMS_PROVIDER=${parsed.data.SMS_PROVIDER} — ` +
          'codes would be written to a log instead of delivered. Set SMS_PROVIDER=bulksmsbd, ' +
          'or for a demo set SMS_PROVIDER=console with ALLOW_OTP_IN_LOGS=true.',
      );
    }
    if (logged) {
      console.warn(
        'SMS_PROVIDER=console with ALLOW_OTP_IN_LOGS=true: sign-up codes go to this log, not by SMS. Demo use only.',
      );
    }
    if (parsed.data.OTP_EXPOSE_DEV_CODE) {
      throw new Error(
        'Refusing to start in production with OTP_EXPOSE_DEV_CODE=true — it would hand every caller a valid login code.',
      );
    }

    // A container's own disk is wiped on every deploy. Storing NID photos,
    // CVs and intro videos there works perfectly until the next push, and
    // then every one of them is gone with nothing logged. Failing at boot is
    // the only way that mistake gets noticed before it costs anybody their
    // documents.
    const s3 =
      (parsed.data.STORAGE_DRIVER ?? 's3') === 's3' &&
      Boolean(parsed.data.S3_ENDPOINT) &&
      Boolean(parsed.data.S3_ACCESS_KEY) &&
      Boolean(parsed.data.S3_SECRET_KEY);
    if (!s3 && !parsed.data.STORAGE_DISK_PERSISTENT) {
      throw new Error(
        'Refusing to start in production with uploads on local disk — a redeploy would delete ' +
          'every stored CV, NID photo and video. Set S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY ' +
          '(Cloudflare R2 has a free tier), or set STORAGE_DISK_PERSISTENT=true if STORAGE_DIR ' +
          'is on a persistent volume.',
      );
    }
  }

  // Selecting a gateway without its credentials would fail at the first
  // signup attempt instead of at boot. Fail at boot.
  const missing = requiredCredentials(parsed.data);
  if (parsed.data.CV_PARSER === 'claude' && !parsed.data.ANTHROPIC_API_KEY) {
    throw new Error(
      'CV_PARSER=claude requires ANTHROPIC_API_KEY. Set the key, or use CV_PARSER=off.',
    );
  }

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

/**
 * Payment settings that would take or credit money wrongly. Each one is a
 * refusal to start rather than a warning, because every alternative surfaces
 * later as someone's money going missing.
 */
function paymentConfigProblem(env: Env): string | null {
  const production = env.NODE_ENV === 'production';

  if (production && env.PAYMENT_PROVIDER === 'simulator') {
    return (
      'Refusing to start in production with PAYMENT_PROVIDER=simulator — anyone ' +
      'could add money to their wallet without paying. Use sslcommerz, or off.'
    );
  }

  if (env.PAYMENT_PROVIDER === 'sslcommerz') {
    const missing = (['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'] as const).filter(
      (k) => !env[k],
    );
    if (missing.length > 0) {
      return `PAYMENT_PROVIDER=sslcommerz requires: ${missing.join(', ')}`;
    }

    if (production && env.SSLCOMMERZ_SANDBOX) {
      return (
        'Refusing to start in production with SSLCOMMERZ_SANDBOX=true — sandbox ' +
        'payments are not real money, and they would be credited as if they were.'
      );
    }
  }

  if (env.NODE_ENV === 'production' && env.WALLET_AUTO_APPROVE_DEPOSITS) {
    return (
      'Refusing to start in production with WALLET_AUTO_APPROVE_DEPOSITS=true — ' +
      'anyone could credit their own wallet without sending money.'
    );
  }

  return null;
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
