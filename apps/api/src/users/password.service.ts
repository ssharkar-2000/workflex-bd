import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Password hashing with scrypt.
 *
 * scrypt ships with Node, so there is no node-gyp build on every developer
 * machine and in CI — which is what ruled out bcrypt and argon2 here. It is
 * memory-hard and an accepted choice for password storage; the cost of a
 * native dependency was not worth the marginal difference.
 *
 * Stored as `scrypt$<salt-hex>$<hash-hex>` so the algorithm is recorded
 * alongside the value and can be migrated later without guessing.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_BYTES);
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scryptAsync(
      password.normalize('NFKC'),
      Buffer.from(saltHex, 'hex'),
      expected.length,
    );

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
