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
import { useMutation } from '@tanstack/react-query';
import { adminLoginSchema } from '@workflex/shared';
import { adminLogin } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { useAdminStore } from '../src/store/admin-store';
import { colors, font, radius, shadow, space } from '../src/lib/theme';

export default function LoginScreen() {
  const signIn = useAdminStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = adminLoginSchema.safeParse({ email, password });
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues[0]?.message ?? 'Enter a valid email address',
        );
      }
      return adminLogin(parsed.data.email, parsed.data.password);
    },
    onSuccess: async (tokens) => {
      await signIn(tokens);
    },
    onError: (err) => {
      // A plain Error here is the zod message, already written for a person.
      setError(
        err instanceof Error && !('code' in err) ? err.message : errorText(err),
      );
    },
  });

  const canSubmit = email.length > 3 && password.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoMark}>WF</Text>
            </View>
            <Text style={styles.brandName}>WorkFlex BD</Text>
            <Text style={styles.brandSub}>Admin Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              Staff access only. Use your @admin.workflex.com.bd address —
              personal email will not work here.
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(null);
              }}
              placeholder="you@admin.workflex.com.bd"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!submit.isPending}
            />

            <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!revealed}
                autoCapitalize="none"
                autoComplete="password"
                editable={!submit.isPending}
                onSubmitEditing={() => canSubmit && submit.mutate()}
                returnKeyType="go"
              />
              <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={10}>
                <Text style={styles.reveal}>{revealed ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              disabled={!canSubmit || submit.isPending}
              onPress={() => submit.mutate()}
            >
              {submit.isPending ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <Text style={styles.footnote}>
            Workers and employers sign in through the WorkFlex BD app, not here.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.lg },

  brand: { alignItems: 'center', marginBottom: space.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  logoMark: { color: '#fff', fontSize: font.xl, fontWeight: '800' },
  brandName: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  brandSub: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: space.lg,
  },

  label: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
  },
  labelSpaced: { marginTop: space.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: font.md,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceAlt,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: space.md,
    fontSize: font.md,
    color: colors.text,
  },
  reveal: { fontSize: font.xs, fontWeight: '700', color: colors.primary },

  button: {
    marginTop: space.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryText, fontSize: font.md, fontWeight: '800' },
  error: { color: colors.danger, fontSize: font.sm, marginTop: space.md },

  footnote: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: font.xs,
    marginTop: space.xl,
  },
});
