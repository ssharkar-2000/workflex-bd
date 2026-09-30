import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';
import type { MeetingRoomProps } from './room-types';

/**
 * The video room, phone version: it points to the browser.
 *
 * Calls run in a web page, which every phone can open without anything extra
 * installed, and which behaves the same in Expo Go and in the installed app.
 * Joining from the phone app opens that page directly with the pass already
 * in it (see openMeeting in meeting-actions.ts), so this screen is only what
 * someone sees if they reach the room route inside the app itself.
 *
 * The browser version, which is the room, is MeetingRoom.web.tsx.
 */
export default function MeetingRoom({ title, onLeave }: MeetingRoomProps) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={[s.wrap, { backgroundColor: c.bg }]}>
      <Text style={[s.title, { color: c.text }]}>{title}</Text>
      <Text style={[s.body, { color: c.textMuted }]}>{t('meetings.call.openInBrowser')}</Text>
      <Pressable
        onPress={onLeave}
        accessibilityRole="button"
        style={[s.button, { backgroundColor: c.primary }]}
      >
        <Text style={[s.buttonText, { color: c.primaryText }]}>{t('meetings.call.back')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  title: { fontSize: font.lg, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: font.sm, textAlign: 'center', lineHeight: 20 },
  button: { borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 12 },
  buttonText: { fontSize: font.sm, fontWeight: '800' },
});
