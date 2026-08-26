import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import type { KycQueueItem } from '@workflex/shared';
import {
  approveKyc,
  authImageHeaders,
  fetchKycQueue,
  fetchSmsOutbox,
  kycDocumentUrl,
  rejectKyc,
} from '../../src/api/admin';
import { useErrorMessage } from '../../src/lib/error-message';
import { useAuthStore } from '../../src/store/auth-store';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

export default function AdminDashboardScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const admin = useAuthStore((s) => s.admin);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]}>
            {t('admin.title')}
          </Text>
          {admin ? (
            <Text style={[styles.subtitleEmail, { color: c.textMuted }]}>
              {admin.email}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            void signOut().then(() => router.replace('/(auth)/welcome'));
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('home.signOut')}
        >
          <Text style={[styles.signOut, { color: c.danger }]}>
            {t('home.signOut')}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <SmsOutboxSection />
        <KycQueueSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function SmsOutboxSection() {
  const t = useT();
  const { c } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sms-outbox'],
    queryFn: fetchSmsOutbox,
    // A real SMS gateway makes this 404 forever; no point retrying that.
    retry: false,
  });

  // Null means the endpoint does not apply here (a real gateway is
  // configured) — the section simply does not exist for this deployment.
  if (!isLoading && !data) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t('admin.outbox.title')}
      </Text>
      <Text style={[styles.sectionSubtitle, { color: c.textMuted }]}>
        {t('admin.outbox.subtitle')}
      </Text>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.spinner} />
      ) : data && data.messages.length === 0 ? (
        <Text style={[styles.emptyText, { color: c.textMuted }]}>
          {t('admin.outbox.empty')}
        </Text>
      ) : (
        data?.messages.map((m, i) => (
          <View
            key={`${m.phone}-${m.sentAt}-${i}`}
            style={[
              styles.outboxRow,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.outboxPhone, { color: c.text }]}>
              {m.maskedPhone}
            </Text>
            <Text style={[styles.outboxCode, { color: c.primary }]}>
              {m.code ?? '—'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function KycQueueSection() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-kyc-queue'],
    queryFn: fetchKycQueue,
  });

  return (
    <View style={styles.section}>
      <View style={styles.queueHeadRow}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          {t('admin.queue.title')}
        </Text>
        {data ? (
          <Text style={[styles.sectionSubtitle, { color: c.textMuted }]}>
            {t('admin.queue.count', { count: data.count })}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.spinner} />
      ) : error ? (
        <Text style={[styles.emptyText, { color: c.danger }]}>
          {errorMessage(error)}
        </Text>
      ) : data && data.submissions.length === 0 ? (
        <Text style={[styles.emptyText, { color: c.textMuted }]}>
          {t('admin.queue.empty')}
        </Text>
      ) : (
        data?.submissions.map((item) => (
          <SubmissionCard key={item.id} item={item} />
        ))
      )}
    </View>
  );
}

function SubmissionCard({ item }: { item: KycQueueItem }) {
  const t = useT();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-kyc-queue'] });
  };

  const approve = useMutation({
    mutationFn: () => approveKyc(item.id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: () => rejectKyc(item.id, reason),
    onSuccess: () => {
      setRejecting(false);
      setReason('');
      invalidate();
    },
  });

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.cardHeadRow}>
        <Text style={[styles.applicantName, { color: c.text }]}>
          {item.applicant.name || item.applicant.phone}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder },
          ]}
        >
          <Text style={[styles.badgeText, { color: c.primary }]}>
            {item.accountType}
          </Text>
        </View>
      </View>

      <Text style={[styles.applicantPhone, { color: c.textMuted }]}>
        {item.applicant.phone}
      </Text>
      <Text style={[styles.waiting, { color: c.textMuted }]}>
        {t('admin.waitingHours', { hours: item.waitingHours })}
      </Text>

      {item.applicant.company ? (
        <Text style={[styles.companyLine, { color: c.text }]}>
          {item.applicant.company.name}
          {item.applicant.company.tin
            ? ` · TIN ${item.applicant.company.tin}`
            : ''}
        </Text>
      ) : null}

      <Text style={[styles.docsLabel, { color: c.textMuted }]}>
        {t('admin.documents')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.docRow}>
          {item.applicant.documents.map((doc) => (
            <Image
              key={doc.kind}
              source={{
                uri: kycDocumentUrl(item.applicant.userId, doc.kind),
                headers: authImageHeaders(),
              }}
              style={[styles.docImage, { borderColor: c.border }]}
              resizeMode="cover"
            />
          ))}
        </View>
      </ScrollView>

      {rejecting ? (
        <View style={styles.rejectBox}>
          <TextInput
            style={[
              styles.input,
              { borderColor: c.border, backgroundColor: c.bg, color: c.text },
            ]}
            value={reason}
            onChangeText={setReason}
            placeholder={t('admin.reject.placeholder')}
            placeholderTextColor={c.textMuted}
            multiline
          />
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.dangerButton,
                { backgroundColor: c.danger },
                (reason.trim().length < 5 || reject.isPending) &&
                  styles.disabled,
              ]}
              disabled={reason.trim().length < 5 || reject.isPending}
              onPress={() => reject.mutate()}
            >
              <Text style={styles.dangerButtonText}>
                {reject.isPending
                  ? t('admin.reject.sending')
                  : t('admin.reject.confirm')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() => {
                setRejecting(false);
                setReason('');
              }}
            >
              <Text style={[styles.ghostText, { color: c.textMuted }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
          {reject.isError ? (
            <Text style={[styles.errorText, { color: c.danger }]}>
              {errorMessage(reject.error)}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: c.primary },
              approve.isPending && styles.disabled,
            ]}
            disabled={approve.isPending}
            onPress={() => approve.mutate()}
          >
            <Text style={[styles.primaryButtonText, { color: c.primaryText }]}>
              {approve.isPending ? t('admin.approving') : t('admin.approve')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.dangerOutline, { borderColor: c.danger }]}
            onPress={() => setRejecting(true)}
          >
            <Text style={[styles.dangerOutlineText, { color: c.danger }]}>
              {t('admin.reject')}
            </Text>
          </Pressable>
        </View>
      )}

      {approve.isError ? (
        <Text style={[styles.errorText, { color: c.danger }]}>
          {errorMessage(approve.error)}
        </Text>
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
  headerText: { flexShrink: 1 },
  title: { fontSize: font.md, fontWeight: '700' },
  subtitleEmail: { fontSize: font.xs, marginTop: 2 },
  signOut: { fontSize: font.sm, fontWeight: '700' },

  container: { padding: space.lg, paddingTop: 0, paddingBottom: space.xl },

  section: { marginBottom: space.xl },
  queueHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: font.md, fontWeight: '700' },
  sectionSubtitle: { fontSize: font.xs, marginTop: space.xs },
  spinner: { marginTop: space.md },
  emptyText: { fontSize: font.sm, marginTop: space.md },

  outboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginTop: space.sm,
  },
  outboxPhone: { fontSize: font.sm },
  outboxCode: { fontSize: font.md, fontWeight: '800', letterSpacing: 2 },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    marginTop: space.md,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  applicantName: { fontSize: font.md, fontWeight: '700', flexShrink: 1 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  applicantPhone: { fontSize: font.sm, marginTop: space.xs },
  waiting: { fontSize: font.xs, marginTop: 2 },
  companyLine: { fontSize: font.sm, marginTop: space.sm },

  docsLabel: { fontSize: font.xs, marginTop: space.md, marginBottom: space.sm },
  docRow: { flexDirection: 'row', gap: space.sm },
  docImage: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  primaryButton: {
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  primaryButtonText: { fontSize: font.sm, fontWeight: '700' },
  dangerOutline: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  dangerOutlineText: { fontSize: font.sm, fontWeight: '700' },
  dangerButton: {
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '700' },
  ghost: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  ghostText: { fontSize: font.sm },
  disabled: { opacity: 0.5 },

  rejectBox: { marginTop: space.md },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  errorText: { fontSize: font.xs, marginTop: space.sm },
});
