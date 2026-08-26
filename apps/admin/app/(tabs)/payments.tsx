import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Screen } from '../../src/components/ui';
import { colors, font, space } from '../../src/lib/theme';

/**
 * Same reasoning as the Jobs tab: payments needs Transaction, Payout and
 * PlatformFee tables plus a payment provider integration (bKash/Nagad in this
 * market). Fabricated figures on a money screen are worse than an empty one.
 */
export default function PaymentsScreen() {
  return (
    <Screen title="Payments" subtitle="Not yet connected">
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={styles.title}>Payments is next</Text>
          <Text style={styles.body2}>
            The design covers transactions, revenue analytics, platform fees,
            refunds and failed-payment handling. That needs Transaction,
            Payout and Fee tables, plus a bKash or Nagad integration.
          </Text>
          <Text style={styles.body2}>
            Revenue is reported as “—” on the dashboard for the same reason: a
            confident ৳0 would read as “no earnings”, not “not built yet”.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg },
  title: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.sm,
  },
  body2: {
    fontSize: font.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: space.sm,
  },
});
