import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSupportTicketSchema,
  type MySupportTicket,
} from '@workflex/shared';
import { createTicket, fetchMyTickets } from '../../src/api/support';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/** Status → the translation key describing it to the person who reported it. */
const STATUS_KEYS: Record<MySupportTicket['status'], TranslationKey> = {
  OPEN: 'support.status.OPEN',
  IN_PROGRESS: 'support.status.IN_PROGRESS',
  RESOLVED: 'support.status.RESOLVED',
  CLOSED: 'support.status.CLOSED',
};

export default function SupportScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: fetchMyTickets,
  });

  const submit = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      setSubject('');
      setMessage('');
      setError(null);
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: ['support'] });
    },
    onError: (err) => {
      setSent(false);
      setError(errorMessage(err));
    },
  });

  const onSubmit = () => {
    // Validated with the same schema the server enforces, so the length rules
    // cannot drift apart and the user hears about a short message here rather
    // than after a round trip.
    const parsed = createSupportTicketSchema.safeParse({ subject, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('error.VALIDATION_FAILED'));
      return;
    }
    submit.mutate(parsed.data);
  };

  const tickets = data?.tickets ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>
            ← {t('notif.back')}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: c.text }]}>
            {t('support.title')}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {t('support.subtitle')}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.label, { color: c.text }]}>
              {t('support.subject')}
            </Text>
            <TextInput
              value={subject}
              onChangeText={(v) => {
                setSubject(v);
                if (error) setError(null);
                if (sent) setSent(false);
              }}
              placeholder={t('support.subjectHint')}
              placeholderTextColor={c.textMuted}
              maxLength={120}
              style={[
                styles.input,
                {
                  backgroundColor: c.surfaceAlt,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
            />

            <Text style={[styles.label, { color: c.text }]}>
              {t('support.message')}
            </Text>
            <TextInput
              value={message}
              onChangeText={(v) => {
                setMessage(v);
                if (error) setError(null);
                if (sent) setSent(false);
              }}
              placeholder={t('support.messageHint')}
              placeholderTextColor={c.textMuted}
              multiline
              numberOfLines={5}
              maxLength={2000}
              textAlignVertical="top"
              style={[
                styles.input,
                styles.textarea,
                {
                  backgroundColor: c.surfaceAlt,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
            />

            <ErrorBanner message={error} />

            {sent ? (
              <View
                style={[
                  styles.sentNote,
                  { backgroundColor: c.successSoft, borderColor: c.success },
                ]}
              >
                <Text style={[styles.sentText, { color: c.success }]}>
                  {t('support.sent')}
                </Text>
              </View>
            ) : null}

            <View style={styles.submit}>
              <ShimmerButton
                label={t('support.submit')}
                onPress={onSubmit}
                loading={submit.isPending}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {t('support.mine')}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={c.primary} style={styles.loading} />
          ) : tickets.length === 0 ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              {t('support.noneYet')}
            </Text>
          ) : (
            tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TicketCard({ ticket }: { ticket: MySupportTicket }) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  const answered = ticket.response !== null;

  return (
    <View
      style={[
        styles.ticket,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.ticketTop}>
        <Text style={[styles.ticketSubject, { color: c.text }]} numberOfLines={2}>
          {ticket.subject}
        </Text>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: answered ? c.successSoft : c.warningSoft,
              borderColor: answered ? c.success : c.warningBorder,
            },
          ]}
        >
          <Text
            style={[styles.pillText, { color: answered ? c.success : c.warning }]}
          >
            {t(STATUS_KEYS[ticket.status])}
          </Text>
        </View>
      </View>

      <Text style={[styles.ticketBody, { color: c.textMuted }]}>
        {ticket.message}
      </Text>

      {answered ? (
        <View style={[styles.reply, { borderLeftColor: c.success }]}>
          <Text style={[styles.replyLabel, { color: c.success }]}>
            {t('support.reply')}
          </Text>
          <Text style={[styles.replyText, { color: c.text }]}>
            {ticket.response}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.ticketDate, { color: c.textMuted }]}>
        {new Date(ticket.createdAt).toLocaleDateString(
          locale === 'bn' ? 'bn-BD' : 'en-GB',
          { day: 'numeric', month: 'short', year: 'numeric' },
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { fontSize: font.sm, fontWeight: '700' },

  scroll: { padding: space.md, paddingBottom: space.xl },
  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: font.md,
    marginBottom: 14,
  },
  textarea: { minHeight: 110, paddingTop: 11 },

  sentNote: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 11,
    marginBottom: 4,
  },
  sentText: { fontSize: font.sm, fontWeight: '600' },
  submit: { marginTop: 8 },

  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  loading: { marginTop: space.md },
  empty: { fontSize: font.sm, lineHeight: 20 },

  ticket: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  ticketTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ticketSubject: { flex: 1, fontSize: font.md, fontWeight: '700' },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: { fontSize: font.xs - 1, fontWeight: '800' },
  ticketBody: { fontSize: font.sm, lineHeight: 20, marginTop: 8 },

  reply: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginTop: 12,
  },
  replyLabel: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4 },
  replyText: { fontSize: font.sm, lineHeight: 20, marginTop: 3 },

  ticketDate: { fontSize: font.xs, marginTop: 10 },
});
