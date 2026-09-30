import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { joinMeeting, leaveMeeting } from '../src/api/meetings';
import MeetingRoom from '../src/components/meetings/MeetingRoom';
import { useAuthStore } from '../src/store/auth-store';
import { useErrorMessage } from '../src/lib/error-message';
import { useT } from '../src/i18n';
import { useTheme } from '../src/lib/use-theme';
import { font, radius, space } from '../src/lib/theme';

/** A pass into one room, and the meeting it belongs to when that is known. */
interface Pass {
  url: string;
  token: string;
  title: string;
  meetingId: string | null;
}

/**
 * The pass a phone hands the browser. It travels after the `#` in the
 * address, which a browser never sends to any server, so it stays between the
 * two devices. Read once and then removed from the address bar.
 */
function passFromAddress(): Pass | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const url = params.get('u');
  const token = params.get('t');
  if (!url || !token) return null;
  return { url, token, title: params.get('n') ?? '', meetingId: params.get('m') };
}

/**
 * The video room as an address of its own.
 *
 * It is outside the signed-in area on purpose. A phone that opens a meeting
 * hands the browser a pass and nothing else — the browser has no session — and
 * a link someone pasted into a message has to lead somewhere sensible for a
 * person who is not signed in yet. So this screen works in two ways:
 *
 *  - with a pass in the address (from the phone app): it goes straight in;
 *  - with `?m=<meeting id>` (the shared link, or the button in the web app):
 *    it asks the server for a pass, which needs a session, and otherwise says
 *    to sign in and open the link again.
 *
 * The room itself is MeetingRoom.web.tsx; on a phone the same route only
 * explains that calls open in the browser.
 */
export default function MeetingRoomScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const { m } = useLocalSearchParams<{ m?: string }>();
  const status = useAuthStore((state) => state.status);

  const [pass, setPass] = useState<Pass | null>(passFromAddress);
  const [failure, setFailure] = useState<string | null>(null);
  const asked = useRef(false);

  // Once read, the pass leaves the address bar so it is not copied or
  // bookmarked. The router writes the address back once while the screen opens,
  // so this waits until that has happened — cleaning it straight away gets undone.
  useEffect(() => {
    if (Platform.OS !== 'web' || !pass) return undefined;
    const strip = () => {
      if (window.location.hash) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      }
    };
    const timers = [setTimeout(strip, 700), setTimeout(strip, 2500)];
    return () => timers.forEach(clearTimeout);
  }, [pass]);

  // No pass in the address: ask for one, as the signed-in person.
  useEffect(() => {
    if (pass || !m || status !== 'authenticated' || asked.current) return;
    asked.current = true;
    joinMeeting(m).then(
      (result) => setPass({ url: result.url, token: result.token, title: result.title, meetingId: m }),
      (err) => setFailure(errorMessage(err)),
    );
  }, [pass, m, status, errorMessage]);

  const leave = () => {
    const meetingId = pass?.meetingId ?? m;
    // The room's own webhook records the departure too; this is the quick path.
    if (meetingId && status === 'authenticated') leaveMeeting(meetingId).catch(() => undefined);
    if (status === 'authenticated') {
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/meetings' as never);
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <MeetingRoom
        url=""
        token=""
        title={pass?.title ?? ''}
        onLeave={() => (router.canGoBack() ? router.back() : router.replace('/(app)/meetings' as never))}
      />
    );
  }

  if (pass) {
    return <MeetingRoom url={pass.url} token={pass.token} title={pass.title} onLeave={leave} />;
  }

  return (
    <View style={[s.wrap, { backgroundColor: c.bg }]}>
      {failure ? (
        <>
          <Text style={[s.title, { color: c.text }]}>{t('meetings.call.error')}</Text>
          <Text style={[s.body, { color: c.textMuted }]} testID="room-error">
            {failure}
          </Text>
          <Button label={t('meetings.call.back')} onPress={leave} />
        </>
      ) : status !== 'authenticated' || !m ? (
        <>
          <Text style={[s.body, { color: c.text }]} testID="room-signin">
            {t('meetings.call.signIn')}
          </Text>
          <Button label={t('meetings.call.signInButton')} onPress={() => router.replace('/(auth)/welcome')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={c.primary} />
          <Text style={[s.body, { color: c.textMuted }]}>{t('meetings.call.getting')}</Text>
        </>
      )}
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, { backgroundColor: pressed ? c.primaryPressed : c.primary }]}
    >
      <Text style={[s.buttonText, { color: c.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  title: { fontSize: font.lg, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: font.md, textAlign: 'center', lineHeight: 22, maxWidth: 420 },
  button: { borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 12 },
  buttonText: { fontSize: font.sm, fontWeight: '800' },
});
