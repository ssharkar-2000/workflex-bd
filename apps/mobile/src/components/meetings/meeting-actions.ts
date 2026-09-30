import { Alert, Linking, Platform } from 'react-native';
import type { useRouter } from 'expo-router';
import { joinMeeting } from '../../api/meetings';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Go into a meeting.
 *
 * In a browser that is the room screen, which asks for its own pass. On a
 * phone the room is a web page — every phone can open one, in Expo Go and in
 * the installed app alike — so this fetches a pass and hands the browser the
 * room address with the pass in its fragment, which is never sent to a server.
 */
export async function openMeeting(id: string, router: AppRouter): Promise<void> {
  if (Platform.OS === 'web') {
    router.push({ pathname: '/meeting-room', params: { m: id } });
    return;
  }
  const pass = await joinMeeting(id);
  await Linking.openURL(pass.joinUrl);
}

/** A yes/no question, asked whichever way this platform asks them. */
export function ask(
  title: string,
  message: string,
  yes: string,
  no: string,
  onYes: () => void,
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: no, style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}
