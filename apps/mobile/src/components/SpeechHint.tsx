import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

/**
 * Shown in place of nothing when the device has no voice for the current
 * language.
 *
 * The speak control hides itself rather than produce noise, which is correct
 * but silent — someone whose phone lacks the Bangla voice pack would never
 * learn that a free download brings the feature back. This says so, once, and
 * then stays gone.
 *
 * `useSpeech` drops its cached answer whenever the app returns to the
 * foreground, so following these steps and coming back makes the hint
 * disappear on its own without a restart.
 */
export function SpeechHint({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  const { c } = useTheme();

  // The path differs per platform and a wrong one is worse than none — it
  // sends someone hunting through settings that do not exist on their phone.
  const stepsKey =
    Platform.OS === 'android'
      ? 'speech.hint.stepsAndroid'
      : Platform.OS === 'ios'
        ? 'speech.hint.stepsIos'
        : 'speech.hint.stepsWeb';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.warningSoft, borderColor: c.warningBorder },
      ]}
    >
      <View style={styles.head}>
        <Text style={styles.icon}>🔇</Text>
        <Text style={[styles.title, { color: c.warning }]}>
          {t('speech.hint.title')}
        </Text>
      </View>

      <Text style={[styles.body, { color: c.text }]}>
        {t('speech.hint.body')}
      </Text>

      <Text style={[styles.steps, { color: c.textMuted }]}>{t(stepsKey)}</Text>

      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        style={styles.dismiss}
      >
        <Text style={[styles.dismissText, { color: c.warning }]}>
          {t('speech.hint.dismiss')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 15 },
  title: { fontSize: font.sm, fontWeight: '800', flex: 1 },
  body: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },
  steps: { fontSize: font.xs, lineHeight: 18, marginTop: 8 },
  dismiss: { alignSelf: 'flex-end', marginTop: 6, padding: 4 },
  dismissText: { fontSize: font.sm, fontWeight: '700' },
});
