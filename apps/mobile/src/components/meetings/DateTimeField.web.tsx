import { View } from 'react-native';
import { Label } from '../wallet/WalletUi';
import { useTheme } from '../../lib/use-theme';
import { toLocalInputValue } from './meeting-format';

/**
 * A date and a time in one field, browser version: the browser's own
 * date-time control, which every phone browser turns into its native picker.
 * The phone version is DateTimeField.tsx.
 */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
}) {
  const { c, isDark } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <Label text={label} />
      <input
        type="datetime-local"
        aria-label={label}
        value={toLocalInputValue(value)}
        onChange={(event) => {
          const next = new Date(event.target.value);
          if (!Number.isNaN(next.getTime())) onChange(next);
        }}
        style={{
          backgroundColor: c.fieldBg,
          color: c.text,
          border: `1px solid ${c.border}`,
          borderRadius: 12,
          padding: '11px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
          colorScheme: isDark ? 'dark' : 'light',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </View>
  );
}
