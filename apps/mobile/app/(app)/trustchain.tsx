import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  credentialListSchema,
  ledgerReportSchema,
  type Credential,
  type CredentialCheck,
  type CredentialList,
  type LedgerReport,
} from '@workflex/shared';
import { api } from '../../src/api/client';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

async function fetchMine(): Promise<CredentialList> {
  const { data } = await api.get('/credentials/me');
  return credentialListSchema.parse(data);
}

async function fetchApplicant(jobId: string, userId: string): Promise<CredentialList> {
  const { data } = await api.get(`/credentials/applicant/${jobId}/${userId}`);
  return credentialListSchema.parse(data);
}

async function checkLedger(): Promise<LedgerReport> {
  const { data } = await api.get('/credentials/ledger');
  return ledgerReportSchema.parse(data);
}

/**
 * TrustChain.
 *
 * The same screen serves both readings of a credential. Opened plain, it
 * shows your own; opened with a job and an applicant, it shows theirs — which
 * is the one-click check that replaces telephoning a university.
 *
 * Every credential shows its five checks rather than a single tick. A green
 * tick teaches a reader to stop reading; five lines teach them what was
 * actually established, and one of the five — whether the key really belongs
 * to the named institution — is a human judgement rather than a
 * cryptographic fact. Merging them would hide exactly the thing a careful
 * recruiter needs to see.
 */
export default function TrustChainScreen() {
  const { jobId, userId, name } = useLocalSearchParams<{
    jobId?: string;
    userId?: string;
    name?: string;
  }>();
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const forSomeoneElse = Boolean(jobId && userId);

  const list = useQuery({
    queryKey: forSomeoneElse ? ['credentials', jobId, userId] : ['credentials', 'me'],
    queryFn: () => (forSomeoneElse ? fetchApplicant(jobId!, userId!) : fetchMine()),
  });

  const ledger = useMutation({ mutationFn: checkLedger });

  const data = list.data;

  return (
    <MoneyScreen
      title={t('chain.title')}
      subtitle={forSomeoneElse ? (name ?? t('chain.applicant')) : t('chain.subtitle')}
    >
      {list.error ? <ErrorBanner message={errorMessage(list.error)} tone="onSurface" /> : null}

      {list.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : !data ? null : (
        <>
          <View style={[s.head, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <Text style={[s.headCount, { color: c.text }]}>
              {t('chain.validOf', {
                valid: data.validCount,
                total: data.credentials.length,
              })}
            </Text>
            <Text style={[s.headNote, { color: c.textMuted }]}>
              {t('chain.ledgerLength', { n: data.ledgerLength })}
            </Text>
          </View>

          {data.credentials.length === 0 ? (
            <Notice
              tone="info"
              title={t('chain.emptyTitle')}
              body={forSomeoneElse ? t('chain.emptyOther') : t('chain.emptyMine')}
            />
          ) : (
            data.credentials.map((credential) => (
              <CredentialCard key={credential.id} credential={credential} />
            ))
          )}

          {/* The audit anyone can run: walk the whole record, not one row. */}
          <Pressable
            onPress={() => ledger.mutate()}
            disabled={ledger.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.audit,
              {
                borderColor: c.primary,
                backgroundColor: pressed ? c.primarySoft : 'transparent',
                opacity: ledger.isPending ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[s.auditText, { color: c.primary }]}>{t('chain.audit')}</Text>
          </Pressable>

          {ledger.data ? (
            <Notice
              tone={ledger.data.intact ? 'success' : 'danger'}
              title={ledger.data.intact ? t('chain.intact') : t('chain.broken')}
              body={ledger.data.detail}
            />
          ) : null}
          {ledger.error ? (
            <ErrorBanner message={errorMessage(ledger.error)} tone="onSurface" />
          ) : null}

          {/*
            Said plainly rather than implied. The signatures and the linked
            record are real and do the work; a public chain would add one
            thing on top, and until it exists this says so.
          */}
          <Notice
            tone={data.anchored ? 'success' : 'info'}
            title={t('chain.howTitle')}
            body={data.anchored ? t('chain.anchoredYes') : t('chain.anchoredNo')}
          />

          <Text style={[s.note, { color: c.textMuted }]}>{t('chain.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

function CredentialCard({ credential }: { credential: Credential }) {
  const t = useT();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  const tone = credential.revoked ? c.danger : credential.valid ? c.success : c.warning;
  const badge = credential.revoked
    ? t('chain.withdrawn')
    : credential.valid
      ? t('chain.verified')
      : t('chain.unverified');

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: tone }]}>
      <View style={s.cardTop}>
        <View style={s.cardWho}>
          <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={2}>
            {credential.title}
          </Text>
          <Text style={[s.cardIssuer, { color: c.textMuted }]} numberOfLines={1}>
            {credential.issuer.name}
            {credential.field ? ` · ${credential.field}` : ''}
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: tone }]}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      </View>

      <Text style={[s.cardMeta, { color: c.textMuted }]}>
        {[
          credential.grade,
          span(credential.startDate, credential.endDate),
          t('chain.kind.' + credential.kind.toLowerCase() as never),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      <Pressable
        onPress={() => setOpen((held) => !held)}
        accessibilityRole="button"
        hitSlop={8}
        style={s.toggle}
      >
        <Text style={[s.toggleText, { color: c.primary }]}>
          {open ? t('chain.hideChecks') : t('chain.showChecks')}
        </Text>
      </Pressable>

      {open ? (
        <View style={s.checks}>
          {credential.checks.map((check) => (
            <CheckRow key={check.key} check={check} />
          ))}

          <Text style={[s.hashLabel, { color: c.textMuted }]}>{t('chain.fingerprint')}</Text>
          <Text style={[s.hash, { color: c.textMuted }]} numberOfLines={2}>
            {credential.hash}
          </Text>
          <Text style={[s.hashLabel, { color: c.textMuted }]}>{t('chain.issuerId')}</Text>
          <Text style={[s.hash, { color: c.textMuted }]} numberOfLines={2}>
            {credential.issuer.did}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CheckRow({ check }: { check: CredentialCheck }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View style={s.check}>
      <View style={[s.checkDot, { backgroundColor: check.ok ? c.success : c.danger }]} />
      <View style={s.checkBody}>
        <Text style={[s.checkName, { color: c.text }]}>
          {t(('chain.check.' + check.key) as never)}
        </Text>
        <Text style={[s.checkDetail, { color: c.textMuted }]}>{check.detail}</Text>
      </View>
    </View>
  );
}

function span(start: string | null, end: string | null): string {
  const year = (value: string | null) =>
    value ? String(new Date(value).getFullYear()) : null;
  const from = year(start);
  const to = year(end);
  if (from && to) return `${from}–${to}`;
  return from ?? to ?? '';
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.md },

  head: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  headCount: { fontSize: font.md, fontWeight: '900' },
  headNote: { fontSize: font.xs, marginTop: 2 },

  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  cardWho: { flex: 1 },
  cardTitle: { fontSize: font.sm + 1, fontWeight: '800', lineHeight: 20 },
  cardIssuer: { fontSize: font.xs, marginTop: 2 },
  cardMeta: { fontSize: font.xs, marginTop: space.xs },

  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#FFFFFF', fontSize: font.xs - 1, fontWeight: '900' },

  toggle: { alignSelf: 'flex-start', marginTop: space.sm },
  toggleText: { fontSize: font.xs, fontWeight: '800' },

  checks: { marginTop: space.sm, gap: space.sm },
  check: { flexDirection: 'row', gap: space.sm },
  checkDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  checkBody: { flex: 1 },
  checkName: { fontSize: font.xs + 1, fontWeight: '800' },
  checkDetail: { fontSize: font.xs, lineHeight: 16, marginTop: 1 },

  hashLabel: { fontSize: font.xs - 2, fontWeight: '800', letterSpacing: 0.4, marginTop: space.xs },
  hash: { fontSize: font.xs - 1, fontFamily: 'monospace', lineHeight: 14 },

  audit: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  auditText: { fontSize: font.xs, fontWeight: '800' },
});
