import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { KycQueueItem } from '@workflex/shared';
import {
  approveKyc,
  authImageHeaders,
  fetchKycQueue,
  kycDocumentUrl,
  rejectKyc,
} from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
} from '../src/components/ui';
import { colors, font, radius, shadow, space } from '../src/lib/theme';

export default function VerificationScreen() {
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-kyc-queue'],
    queryFn: fetchKycQueue,
  });

  return (
    <Screen
      title="Verification Center"
      subtitle={data ? `${data.count} awaiting review` : undefined}
      right={
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      }
    >
      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={errorText(error)} onRetry={() => void refetch()} />
      ) : data.submissions.length === 0 ? (
        <EmptyState text="Nothing waiting for review." />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {data.submissions.map((item) => (
            <SubmissionCard key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function SubmissionCard({ item }: { item: KycQueueItem }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-kyc-queue'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const approve = useMutation({
    mutationFn: () => approveKyc(item.id),
    onSuccess: invalidate,
    onError: (err) => Alert.alert('Could not approve', errorText(err)),
  });

  const reject = useMutation({
    mutationFn: () => rejectKyc(item.id, reason),
    onSuccess: () => {
      setRejecting(false);
      setReason('');
      invalidate();
    },
    onError: (err) => Alert.alert('Could not reject', errorText(err)),
  });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.name}>
            {item.applicant.name || item.applicant.phone}
          </Text>
          <Text style={styles.meta}>{item.applicant.phone}</Text>
        </View>
        <Badge text={item.accountType} tone="info" />
      </View>

      <Text style={styles.waiting}>
        Waiting {item.waitingHours}h
        {item.applicant.address ? ` · ${item.applicant.address}` : ''}
      </Text>

      {item.applicant.company ? (
        <Text style={styles.company}>
          {item.applicant.company.name}
          {item.applicant.company.tin
            ? ` · TIN ${item.applicant.company.tin}`
            : ''}
        </Text>
      ) : null}

      <Text style={styles.docsLabel}>Documents</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.docRow}>
          {item.applicant.documents.map((doc) => (
            <View key={doc.kind}>
              <Image
                source={{
                  uri: kycDocumentUrl(item.applicant.userId, doc.kind),
                  headers: authImageHeaders(),
                }}
                style={styles.doc}
                resizeMode="cover"
              />
              <Text style={styles.docKind}>{doc.kind.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {rejecting ? (
        <View style={styles.rejectBox}>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Reason the applicant can act on"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <View style={styles.actionRow}>
            <View style={styles.grow}>
              <Button
                label="Send rejection"
                tone="danger"
                disabled={reason.trim().length < 5}
                loading={reject.isPending}
                onPress={() => reject.mutate()}
              />
            </View>
            <View style={styles.grow}>
              <Button
                label="Cancel"
                tone="outline"
                onPress={() => {
                  setRejecting(false);
                  setReason('');
                }}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <View style={styles.grow}>
            <Button
              label="Approve"
              onPress={() => approve.mutate()}
              loading={approve.isPending}
            />
          </View>
          <View style={styles.grow}>
            <Button
              label="Reject"
              tone="outline"
              onPress={() => setRejecting(true)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  close: { color: colors.primary, fontWeight: '800', fontSize: font.sm },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  headText: { flex: 1 },
  name: { fontSize: font.md, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  waiting: { fontSize: font.xs, color: colors.textMuted, marginTop: space.sm },
  company: { fontSize: font.sm, color: colors.text, marginTop: space.sm },

  docsLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: space.md,
    marginBottom: space.sm,
    fontWeight: '700',
  },
  docRow: { flexDirection: 'row', gap: space.sm },
  doc: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  docKind: {
    fontSize: 9,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 4,
  },

  actionRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  grow: { flex: 1 },
  rejectBox: { marginTop: space.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceAlt,
  },
});
