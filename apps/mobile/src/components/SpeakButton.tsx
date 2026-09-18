import { Pressable, StyleSheet, Text } from 'react-native';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

/**
 * Reads a block of content aloud.
 *
 * Paired with `useSpeech`, which owns the "only one thing speaks at a time"
 * rule — this is only the control. It renders nothing when the device has no
 * voice for the current language, because a button that produces noise is
 * worse than no button.
 */
export function SpeakButton({
  speaking,
  supported,
  onPress,
  /** What is being read, for the screen-reader label. */
  label,
}: {
  speaking: boolean;
  supported: boolean;
  onPress: () => void;
  label: string;
}) {
  const t = useT();
  const { c } = useTheme();

  if (!supported) return null;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        speaking ? t('speak.stopLabel') : t('speak.startLabel', { label })
      }
      accessibilityState={{ selected: speaking }}
      style={[
        styles.button,
        {
          backgroundColor: speaking ? c.primary : c.surfaceAlt,
          borderColor: speaking ? c.primary : c.border,
        },
      ]}
    >
      <Text style={styles.icon}>{speaking ? '⏹' : '🔊'}</Text>
      <Text
        style={[
          styles.text,
          { color: speaking ? c.primaryText : c.textMuted },
        ]}
      >
        {speaking ? t('speak.stop') : t('speak.listen')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  icon: { fontSize: 12 },
  text: { fontSize: font.xs, fontWeight: '700' },
});
