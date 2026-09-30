/**
 * Seeds the credential ledger with genuinely signed credentials.
 *
 * Nothing here is mocked. Each institution gets a real ed25519 key pair, its
 * public half is registered, and every credential is signed with the private
 * half over the same canonical payload the API verifies against. The
 * signatures that appear in the app are therefore real signatures, and the
 * five checks on the screen are really being run — a credential edited in the
 * database afterwards will show as broken, which is the entire point.
 *
 * The private keys are printed once and then discarded. That is deliberate
 * and it is not laziness: in a working system the private half lives at the
 * university, never in this repository and never in this database. Anyone
 * who wants to issue more credentials for a demo should re-run this script,
 * which generates fresh keys and re-registers them.
 *
 *   npx tsx apps/api/prisma/seed-credentials.ts
 */
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { PrismaClient, type CredentialKind, type IssuerKind } from '@prisma/client';

const prisma = new PrismaClient();

const GENESIS = '0'.repeat(64);

/** Must match contentPayload() in credentials.service.ts, field for field. */
function contentPayload(row: {
  subjectId: string;
  issuerId: string;
  kind: string;
  title: string;
  field: string | null;
  grade: string | null;
  startDate: Date | null;
  endDate: Date | null;
  claims: unknown;
}): string {
  return [
    `v1`,
    `subject:${row.subjectId}`,
    `issuer:${row.issuerId}`,
    `kind:${row.kind}`,
    `title:${row.title.trim()}`,
    `field:${row.field?.trim() ?? ''}`,
    `grade:${row.grade?.trim() ?? ''}`,
    `start:${row.startDate?.toISOString() ?? ''}`,
    `end:${row.endDate?.toISOString() ?? ''}`,
    `claims:${row.claims === null ? '' : JSON.stringify(row.claims)}`,
  ].join('\n');
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Must match ledgerHash() in credentials.service.ts. */
function ledgerHash(p: {
  contentHash: string;
  index: number;
  prevHash: string;
  issuedAt: Date;
}): string {
  return sha256(
    [
      `v1`,
      `content:${p.contentHash}`,
      `index:${p.index}`,
      `prev:${p.prevHash}`,
      `issued:${p.issuedAt.toISOString()}`,
    ].join('\n'),
  );
}

/**
 * A `did:key`-shaped identifier derived from the public key.
 *
 * Not the full multibase/multicodec encoding the spec calls for — that needs
 * a base58btc dependency this repo does not carry, and nothing in the app
 * parses it. It is a stable, unique, portable string derived from the key
 * itself, which is what the screen uses it as. Swapping in a real did:key
 * encoder later changes this function and nothing else.
 */
function didFor(publicKeyDer: Buffer): string {
  return `did:key:z${sha256(publicKeyDer.toString('base64url')).slice(0, 44)}`;
}

const ISSUERS = [
  {
    key: 'buet',
    name: 'Bangladesh University of Engineering and Technology',
    kind: 'UNIVERSITY' as IssuerKind,
    website: 'https://www.buet.ac.bd',
    approved: true,
  },
  {
    key: 'employer',
    name: 'Brain Station 23',
    kind: 'EMPLOYER' as IssuerKind,
    website: 'https://brainstation-23.com',
    approved: true,
  },
  {
    key: 'centre',
    name: 'Dhaka Technical Training Centre',
    kind: 'TRAINING_CENTRE' as IssuerKind,
    website: null,
    // Left unapproved on purpose: the screen's fifth check is "is this key
    // really theirs", and with every issuer approved nobody would ever see
    // what a partial verification looks like.
    approved: false,
  },
];

type Draft = {
  issuer: string;
  kind: CredentialKind;
  title: string;
  field?: string;
  grade?: string;
  startDate?: string;
  endDate?: string;
};

const DRAFTS: Draft[] = [
  {
    issuer: 'buet',
    kind: 'DEGREE',
    title: 'BSc in Computer Science and Engineering',
    field: 'Computer Science',
    grade: 'CGPA 3.72',
    startDate: '2018-01-05',
    endDate: '2022-06-30',
  },
  {
    issuer: 'employer',
    kind: 'EXPERIENCE_LETTER',
    title: 'Software Engineer',
    field: 'Mobile development',
    startDate: '2022-09-01',
    endDate: '2025-03-31',
  },
  {
    issuer: 'centre',
    kind: 'CERTIFICATE',
    title: 'Electrical Safety Level 2',
    grade: 'Pass',
    endDate: '2024-11-20',
  },
];

async function main() {
  // Every credential goes to a real account, so the app has somebody to show
  // them to. Individuals only: a company account has no degree.
  const people = await prisma.user.findMany({
    where: { accountType: 'INDIVIDUAL', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  if (people.length === 0) {
    console.error('No individual accounts found. Seed users first.');
    process.exit(1);
  }

  console.log(`Seeding credentials for ${people.length} account(s).\n`);

  // --- the institutions, each with a real key pair ---
  const keys = new Map<string, { id: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'] }>();

  for (const spec of ISSUERS) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const der = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
    const did = didFor(der);

    const issuer = await prisma.issuer.create({
      data: {
        name: spec.name,
        kind: spec.kind,
        did,
        publicKey: der.toString('base64url'),
        website: spec.website,
        approvedAt: spec.approved ? new Date() : null,
      },
      select: { id: true },
    });

    keys.set(spec.key, { id: issuer.id, privateKey });
    console.log(`  issuer  ${spec.name}`);
    console.log(`          ${did}  ${spec.approved ? '(approved)' : '(NOT approved — shows a partial check)'}`);
  }
  console.log('');

  // --- the credentials, appended in order ---
  let head = await prisma.credential.findFirst({
    orderBy: { index: 'desc' },
    select: { index: true, hash: true },
  });

  let filed = 0;
  for (const person of people) {
    for (const draft of DRAFTS) {
      const issuer = keys.get(draft.issuer)!;

      const content = {
        subjectId: person.id,
        issuerId: issuer.id,
        kind: draft.kind,
        title: draft.title,
        field: draft.field ?? null,
        grade: draft.grade ?? null,
        startDate: draft.startDate ? new Date(draft.startDate) : null,
        endDate: draft.endDate ? new Date(draft.endDate) : null,
        claims: null,
      };

      const contentHash = sha256(contentPayload(content));
      // The institution signs. This is the real thing the API verifies.
      const signature = sign(null, Buffer.from(contentHash, 'utf8'), issuer.privateKey).toString(
        'base64url',
      );

      const index = head ? head.index + 1 : 0;
      const prevHash = head ? head.hash : GENESIS;
      const issuedAt = draft.endDate ? new Date(draft.endDate) : new Date();
      const hash = ledgerHash({ contentHash, index, prevHash, issuedAt });

      await prisma.credential.create({
        data: { ...content, contentHash, index, prevHash, hash, signature, issuedAt },
      });

      head = { index, hash };
      filed += 1;
    }

    const name =
      [person.firstName, person.lastName].filter(Boolean).join(' ') || person.phone;
    console.log(`  ${DRAFTS.length} credentials -> ${name}`);
  }

  console.log(`\n${filed} credentials filed. Ledger head is index ${head!.index}.`);
  console.log('Private keys were never stored — re-run this script to issue more.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
