import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTaka, type ReceivedPayment } from '@workflex/shared';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * "You have been paid."
 *
 * Shown once per device per payment, with everything the person needs to know
 * who paid and what for — amount, job, payer's name, their WorkFlex id and
 * their number — because a payment that arrives unexplained is one they have
 * to go and ask about.
 */
export function PaymentReceivedModal({
  payment,
  onDismiss,
}: {
  payment: ReceivedPayment | null;
  onDismiss: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  if (!payment) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[s.badge, { backgroundColor: c.successSoft }]}>
            <Text style={[s.badgeText, { color: c.success }]}>✓</Text>
          </View>

          <Text style={[s.title, { color: c.text }]}>{t('received.title')}</Text>
          <Text style={[s.amount, { color: c.success }]}>+{formatTaka(payment.amount)}</Text>

          <View style={[s.rows, { borderColor: c.border }]}>
            <Row label={t('received.from')} value={payment.senderName} />
            <Row label={t('received.senderId')} value={payment.senderPublicId} />
            <Row label={t('received.senderPhone')} value={payment.senderPhone} />
            {payment.jobTitle ? <Row label={t('received.job')} value={payment.jobTitle} /> : null}
            {payment.jobId ? <Row label={t('received.jobId')} value={payment.jobId} mono /> : null}
            {payment.note ? <Row label={t('received.note')} value={payment.note} /> : null}
          </View>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.button,
              { backgroundColor: pressed ? c.primaryPressed : c.primary },
            ]}
          >
            <Text style={[s.buttonText, { color: c.primaryText }]}>{t('received.done')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.rowValue, { color: c.text }, mono && s.mono]}
        numberOfLines={mono ? 1 : 2}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  badge: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: font.lg, fontWeight: '800' },
  title: { fontSize: font.lg, fontWeight: '800', marginTop: space.sm },
  amount: { fontSize: font.display, fontWeight: '800', letterSpacing: -0.5 },

  rows: { alignSelf: 'stretch', borderTopWidth: 1, marginTop: space.md, paddingTop: space.sm, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  rowLabel: { flex: 1, fontSize: font.sm },
  rowValue: { flex: 1.4, fontSize: font.sm, fontWeight: '700', textAlign: 'right' },
  mono: { fontSize: font.xs, letterSpacing: 0.2 },

  button: {
    alignSelf: 'stretch',
    marginTop: space.lg,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: font.sm, fontWeight: '800' },
});
