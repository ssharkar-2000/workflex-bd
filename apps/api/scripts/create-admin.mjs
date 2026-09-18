/**
 * Provisions an admin account. There is no signup form for this on purpose —
 * an admin is not something a request can create, only an operator with
 * database access.
 *
 *   npm run admin:create -w @workflex/api -- susmita@admin.workflex.com.bd "S0me!Passw0rd" "Susmita Sarkar"
 *
 * The email must end with ADMIN_EMAIL_DOMAIN (from .env) — that domain is
 * what makes an admin email unmistakable from a regular user's, and
 * EmailVerificationService refuses to let any user claim it.
 */
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const DEFAULT_DOMAIN = 'admin.workflex.com.bd';

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Mirrors PasswordService — same format, same parameters, on purpose. */
async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_BYTES);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

async function main() {
  const [email, password, name] = process.argv.slice(2);
  const domain = (process.env.ADMIN_EMAIL_DOMAIN ?? DEFAULT_DOMAIN).toLowerCase();

  if (!email || !password) {
    console.error(
      `Usage: npm run admin:create -w @workflex/api -- <email> <password> [name]\n` +
        `Email must end with @${domain}`,
    );
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.endsWith(`@${domain}`)) {
    console.error(`Email must end with @${domain} (got ${normalizedEmail})`);
    process.exit(1);
  }

  if (!PASSWORD_RULE.test(password)) {
    console.error(
      'Password must be 8-72 characters and include a lowercase letter, ' +
        'an uppercase letter, a digit, and a special character.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.admin.upsert({
      where: { email: normalizedEmail },
      update: { passwordHash, name: name ?? undefined },
      create: { email: normalizedEmail, passwordHash, name: name ?? null },
    });
    console.log(`Admin ready: ${admin.email} (id ${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
