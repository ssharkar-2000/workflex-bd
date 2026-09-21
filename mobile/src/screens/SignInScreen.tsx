import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components';
import { colors, radii, spacing, text } from '../theme';

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('admin@workflexbd.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.logo}>
          <Text style={s.logoMark}>⚡</Text>
        </View>
        <Text style={s.title}>WorkFlex BD</Text>
        <Text style={s.subtitle}>Admin console</Text>

        <View style={s.form}>
          <Text style={s.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={s.input}
            placeholder="admin@workflexbd.com"
            placeholderTextColor={colors.textLight}
          />

          <Text style={s.label}>Password</Text>
          <View style={[s.passwordContainer, Boolean(error) && s.inputError]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={s.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
              onSubmitEditing={submit}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={s.eyeButton}
            >
              <Text style={s.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
            </Pressable>
          </View>

          {Boolean(error) && <Text style={s.error}>{error}</Text>}

          <Button label="Sign in" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: 100 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { fontSize: 24 },
  title: { ...text.screenTitle, fontSize: 26, marginTop: spacing.lg },
  subtitle: { ...text.caption, marginTop: spacing.xs },
  form: { marginTop: spacing.xxl },
  label: { ...text.label, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...text.body,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    ...text.body,
  },
  eyeButton: {
    paddingLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  inputError: { borderColor: '#DC2626' },
  error: { ...text.caption, color: '#DC2626', marginTop: spacing.xs },
});