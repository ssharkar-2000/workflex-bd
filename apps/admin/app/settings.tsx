import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { changeAdminPasswordSchema } from '@workflex/shared';
import { changeAdminPassword } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { useAdminStore } from '../src/store/admin-store';
import { Button, Card, Screen } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const admin = useAdminStore((s) => s.admin);
  const signOut = useAdminStore((s) => s.signOut);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: async () => {
      const parsed = changeAdminPasswordSchema.safeParse({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Check the fields');
      }
      return changeAdminPassword(parsed.data);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setDone(true);
    },
    onError: (err) => {
      setDone(false);
      setError(
        err instanceof Error && !('code' in err) ? err.message : errorText(err),
      );
    },
  });

  return (
    <Screen
      title="Settings"
      subtitle={admin?.email ?? undefined}
      right={
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={styles.cardTitle}>Your account</Text>
          <Row label="Name" value={admin?.name ?? '—'} />
          <Row label="Email" value={admin?.email ?? '—'} />
          <Text style={styles.hint}>
            Staff addresses are fixed to the @admin.workflex.com.bd domain and
            are created by an operator, not from this screen.
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Change password</Text>

          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={(v) => {
              setCurrentPassword(v);
              setError(null);
              setDone(false);
            }}
            placeholder="Current password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={(v) => {
              setNewPassword(v);
              setError(null);
              setDone(false);
            }}
            placeholder="New password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              setError(null);
              setDone(false);
            }}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.saveWrap}>
            <Button
              label="Update password"
              onPress={() => change.mutate()}
              loading={change.isPending}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            />
          </View>

          {done ? (
            <Text style={styles.success}>✓ Password updated.</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.hint}>
            At least 8 characters with an uppercase letter, a lowercase letter,
            a digit and a symbol.
          </Text>
        </Card>

        <Pressable
          style={styles.signOut}
          onPress={() =>
            Alert.alert('Sign out', 'End this admin session?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: () => void signOut(),
              },
            ])
          }
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { color: colors.primary, fontWeight: '800', fontSize: font.sm },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  cardTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  rowLabel: { fontSize: font.sm, color: colors.textMuted },
  rowValue: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  hint: {
    fontSize: font.xs,
    color: colors.textFaint,
    lineHeight: 17,
    marginTop: space.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    marginBottom: space.sm,
  },
  saveWrap: { marginTop: space.sm },
  success: { color: colors.success, fontSize: font.sm, marginTop: space.md, fontWeight: '700' },
  error: { color: colors.danger, fontSize: font.sm, marginTop: space.md },
  signOut: { alignItems: 'center', paddingVertical: space.md },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: font.sm },
});
