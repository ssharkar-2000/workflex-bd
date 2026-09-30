import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Label } from '../wallet/WalletUi';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';
import { dateLabel, timeLabel } from './meeting-format';

/**
 * A date and a time in one field, phone version.
 *
 * Android asks for the date and then the time, one after the other, as its own
 * dialogs. iOS shows its compact picker inline. The browser version, which is
 * a single native control, is DateTimeField.web.tsx.
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
  const [showIos, setShowIos] = useState(false);

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: false,
          onChange: (timeEvent: DateTimePickerEvent, time?: Date) => {
            if (timeEvent.type === 'set' && time) onChange(time);
          },
        });
      },
    });
  };

  return (
    <View style={s.group}>
      <Label text={label} />
      <Pressable
        onPress={() => (Platform.OS === 'android' ? openAndroid() : setShowIos((v) => !v))}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[s.field, { backgroundColor: c.fieldBg, borderColor: c.border }]}
      >
        <Text style={[s.text, { color: c.text }]}>
          {dateLabel(value)}, {timeLabel(value)}
        </Text>
        <Text style={{ color: c.textMuted }}>📅</Text>
      </Pressable>
      {Platform.OS === 'ios' && showIos ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="spinner"
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_event: DateTimePickerEvent, date?: Date) => {
            if (date) onChange(date);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  group: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  text: { fontSize: font.sm },
});
