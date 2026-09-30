import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from 'react-native';

/** Where a message I wrote has got to. */
export type TickState = 'PENDING' | 'FAILED' | 'SENT' | 'SEEN';

/**
 * The receipt beside a message I wrote, as in WhatsApp: a clock while it is
 * on its way, one tick once the server has it, two once the other person
 * has opened the thread since. A failed send shows "!" and can be tapped.
 *
 * Drawn in the colour it is given — the bubble's own time colour — so it
 * follows the theme rather than bringing a colour of its own.
 */
export function MessageTicks({
  state,
  color,
  label,
}: {
  state: TickState;
  color: string;
  /** Read out by screen readers: "Sent", "Seen"… */
  label: string;
}) {
  if (state === 'FAILED') {
    return (
      <Text accessibilityLabel={label} style={{ color, fontSize: 12, fontWeight: '800' }}>
        !
      </Text>
    );
  }

  if (state === 'PENDING') {
    return (
      <Svg width={13} height={13} viewBox="0 0 16 16" accessibilityLabel={label}>
        <Circle cx={8} cy={8} r={6.25} stroke={color} strokeWidth={1.6} fill="none" />
        <Path d="M8 4.6V8l2.4 1.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={12} viewBox="0 0 18 12" accessibilityLabel={label}>
      <Path
        d={state === 'SEEN' ? 'M1 6.5l3.2 3.2L11.5 2.2' : 'M4 6.5l3.2 3.2L14.5 2.2'}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {state === 'SEEN' ? (
        <Path
          d="M7.6 8.4l1.3 1.3L16.2 2.2"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
}
