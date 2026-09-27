// Run with a separately installed @electric-sql/pglite module path supplied as argv[2].
// This validates wallet SQL only; full PostGIS migration checks remain in CI.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite} = await import(process.argv[2]);
const db = new PGlite();
const sql = async (path) => db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
await db.exec('CREATE TABLE users (id UUID PRIMARY KEY);');
await sql('../prisma/migrations/20260911201216_wallet/migration.sql');
await db.exec(`INSERT INTO users VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO wallets (id,"userId","updatedAt") VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',now());`);
await sql('../prisma/migrations/20260926130000_wallet_deposits_transfers/migration.sql');
const old = await db.query('SELECT "publicId" FROM wallets');
assert.match(old.rows[0].publicId, /^WF-\d{10}$/);
await db.exec(`INSERT INTO wallets (id,"userId","updatedAt") VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',now());`);
const wallets = await db.query('SELECT "publicId" FROM wallets');
assert.equal(new Set(wallets.rows.map(w=>w.publicId)).size, 2);
await db.exec(`INSERT INTO wallet_top_ups (id,"userId",amount,gateway,"tranId","depositMethod",reference,"updatedAt") VALUES (gen_random_uuid(),'11111111-1111-4111-8111-111111111111',100,'manual','request-1','BKASH','TX123',now());`);
await assert.rejects(db.exec(`INSERT INTO wallet_top_ups (id,"userId",amount,gateway,"tranId","depositMethod",reference,"updatedAt") VALUES (gen_random_uuid(),'22222222-2222-4222-8222-222222222222',100,'manual','request-2','BKASH','TX123',now());`), /unique/);
await db.exec(`INSERT INTO wallet_payments (id,"payerId","payeeId",amount,"requestId") VALUES (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',100,gen_random_uuid());`);
await assert.rejects(db.exec('UPDATE wallets SET balance = -1'), /check constraint/);
console.log('PASS: existing-wallet backfill, stable unique IDs, nullable transfer jobs, duplicate deposit prevention, balance constraint');
await db.close();
