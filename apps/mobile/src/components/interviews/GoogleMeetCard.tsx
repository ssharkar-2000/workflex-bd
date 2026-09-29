import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disconnectGoogle, fetchGoogleStatus, googleConnectUrl } from '../../api/google';
import { ErrorBanner } from '../ErrorBanner';
import { useErrorMessage } from '../../lib/error-message';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * Where Google sends the browser back to once it is done.
 *
 * On the web that is this same page, so the recruiter lands where they left.
 * On a phone it is the app's own link, which reopens the app rather than
 * leaving them in a browser tab wondering whether it worked.
 */
function returnAddress(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/interviews`;
  }
  return 'workflex://interviews';
}

/**
 * Google Meet for the recruiter: connect once, and every video interview
 * after that gets a real Meet room on their own Google Calendar.
 *
 * Renders nothing when the server has no Google credentials — there is
 * nothing to connect, and a button that can only fail is worse than none.
 * Interviews still get a working Jitsi room in that case.
 *
 * Reads the `google` parameter Google's round trip leaves on the address, so
 * the recruiter is told whether it worked instead of having to guess from a
 * card that silently changed.
 */
export function GoogleMeetCard() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ google?: string }>();
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    if (params.google) {
      setOutcome(params.google);
      void queryClient.invalidateQueries({ queryKey: ['google-status'] });
    }
  }, [params.google, queryClient]);

  const status = useQuery({ queryKey: ['google-status'], queryFn: fetchGoogleStatus });

  const connect = useMutation({
    mutationFn: () => googleConnectUrl(returnAddress()),
    onSuccess: (url) => {
      // Same tab on the web: Google's page, then straight back here.
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
      else void Linking.openURL(url);
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: (next) => queryClient.setQueryData(['google-status'], next),
  });

  const data = status.data;
  if (!data || !data.configured) return null;

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.top}>
        <Text style={[s.brand, { color: c.text }]}>Google Meet</Text>
        {data.connected ? (
          <View style={[s.tag, { backgroundColor: c.successSoft }]}>
            <Text style={[s.tagText, { color: c.success }]}>{t('gmeet.connected')}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[s.body, { color: c.textMuted }]}>
        {data.connected
          ? t('gmeet.connectedBody', { email: data.email ?? '' })
          : t('gmeet.pitch')}
      </Text>

      {outcome && outcome !== 'connected' ? (
        <Text style={[s.outcome, { color: c.danger }]}>
          {t(`gmeet.outcome.${outcome}` as TranslationKey)}
        </Text>
      ) : null}
      {outcome === 'connected' && data.connected ? (
        <Text style={[s.outcome, { color: c.success }]}>{t('gmeet.outcome.connected')}</Text>
      ) : null}

      {connect.error ? <ErrorBanner message={errorMessage(connect.error)} tone="onSurface" /> : null}

      {data.connected ? (
        <Pressable
          onPress={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.secondary,
            { borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
          ]}
        >
          <Text style={[s.secondaryText, { color: c.textMuted }]}>{t('gmeet.disconnect')}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => connect.mutate()}
          disabled={connect.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.primary,
            { backgroundColor: c.primary, opacity: connect.isPending ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={s.primaryText}>{t('gmeet.connect')}</Text>
        </Pressable>
      )}

      <Text style={[s.note, { color: c.textMuted }]}>{t('gmeet.privacy')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brand: { flex: 1, fontSize: font.sm + 1, fontWeight: '900' },
  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: font.xs - 2, fontWeight: '900' },
  body: { fontSize: font.xs + 1, lineHeight: 18, marginTop: 4 },
  outcome: { fontSize: font.xs + 1, fontWeight: '700', marginTop: space.xs },
  primary: { borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center', marginTop: space.sm },
  primaryText: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: space.sm,
  },
  secondaryText: { fontSize: font.xs + 1, fontWeight: '700' },
  note: { fontSize: font.xs - 1, lineHeight: 15, marginTop: space.sm },
});
