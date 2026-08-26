import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailSchema, sanitizeEmail } from '@workflex/shared';
import { fetchEmailStatus, setEmail, verifyEmail } from '../api/email';
import { useErrorMessage } from '../lib/error-message';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

type Mode = 'idle' | 'editing' | 'confirming';

/**
 * Email is presented as clearly optional throughout — labelled "Optional",
 * removable, and granting no verification level. Phone remains the account's
 * identity; this is a notification and recovery channel.
 */
export function EmailCard() {
  const t = useT();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['email-status'],
    queryFn: fetchEmailStatus,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['email-status'] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const submitEmail = useMutation({
    mutationFn: (email: string) => setEmail(email),
    onSuccess: () => {
      setMode('confirming');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const submitCode = useMutation({
    mutationFn: () => verifyEmail(code),
    onSuccess: () => {
      setMode('idle');
      setCode('');
      setDraft('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmitEmail = () => {
    const parsed = emailSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email');
      return;
    }
    submitEmail.mutate(parsed.data);
  };

  const inputStyle = [
    styles.input,
    { borderColor: c.border, backgroundColor: c.bg, color: c.text },
  ];

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: c.text }]}>{t('email.title')}</Text>
        <View style={[styles.pill, { backgroundColor: c.surfaceAlt }]}>
          <Text style={[styles.pillText, { color: c.textMuted }]}>
            {t('email.optional')}
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: c.textMuted }]}>
        {t('email.description')}
      </Text>

      {isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : mode === 'confirming' ? (
        <>
          <Text style={[styles.hint, { color: c.text }]}>
            {t('email.enterCode', { email: data?.pendingEmail ?? draft })}
          </Text>
          <TextInput
            style={inputStyle}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            placeholder="------"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            maxLength={6}
          />
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.primary,
                { backgroundColor: c.primary },
                code.length < 6 && styles.disabled,
              ]}
              disabled={code.length < 6 || submitCode.isPending}
              onPress={() => submitCode.mutate()}
            >
              <Text style={[styles.primaryText, { color: c.primaryText }]}>
                {t('email.confirm')}
              </Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => setMode('idle')}>
              <Text style={[styles.ghostText, { color: c.textMuted }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </>
      ) : mode === 'editing' ? (
        <>
          <TextInput
            style={inputStyle}
            value={draft}
            onChangeText={(v) => {
              setDraft(sanitizeEmail(v));
              if (error) setError(null);
            }}
            placeholder={t('email.placeholder')}
            placeholderTextColor={c.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.primary,
                { backgroundColor: c.primary },
                submitEmail.isPending && styles.disabled,
              ]}
              disabled={submitEmail.isPending}
              onPress={onSubmitEmail}
            >
              <Text style={[styles.primaryText, { color: c.primaryText }]}>
                {t('common.save')}
              </Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => setMode('idle')}>
              <Text style={[styles.ghostText, { color: c.textMuted }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.statusRow}>
            <Text style={[styles.email, { color: c.text }]} numberOfLines={1}>
              {data?.email ?? data?.pendingEmail ?? t('email.none')}
            </Text>
            {data?.verified ? (
              <View style={[styles.pill, { backgroundColor: c.successSoft }]}>
                <Text style={[styles.pillText, { color: c.success }]}>
                  ✓ {t('email.verified')}
                </Text>
              </View>
            ) : data?.pendingEmail ? (
              <View style={[styles.pill, { backgroundColor: c.warningSoft }]}>
                <Text style={[styles.pillText, { color: c.warning }]}>
                  {t('email.pending')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.primary, { backgroundColor: c.primary }]}
              onPress={() => {
                setDraft(data?.email ?? '');
                setMode('editing');
              }}
            >
              <Text style={[styles.primaryText, { color: c.primaryText }]}>
                {data?.email ? t('email.change') : t('email.add')}
              </Text>
            </Pressable>
            {/* Removing an address lives in Update profile, next to the other
                destructive edits — two delete buttons on one screen only
                raises the question of whether they do the same thing. */}
          </View>
        </>
      )}

      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: font.md, fontWeight: '700' },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  pillText: { fontSize: font.xs, fontWeight: '700' },
  description: {
    fontSize: font.xs,
    lineHeight: 18,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  hint: { fontSize: font.xs, marginBottom: space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  email: { flexShrink: 1, fontSize: font.md, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  primary: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  primaryText: { fontWeight: '700', fontSize: font.sm },
  disabled: { opacity: 0.5 },
  ghost: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  ghostText: { fontSize: font.sm },
  error: { marginTop: space.sm, fontSize: font.xs },
});
