import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Line icons for the dashboard's search and role buttons.
 *
 * Drawn rather than typed as emoji: an emoji is whatever the phone's font
 * makes of it, in that font's colours, so it cannot follow the theme or sit
 * on a coloured button without clashing. These take the colour they are given.
 */
interface IconProps {
  size: number;
  color: string;
}

const LINE = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

export function SearchIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} stroke={color} {...LINE} />
      <Path d="M20 20l-4.2-4.2" stroke={color} {...LINE} />
    </Svg>
  );
}

export function BriefcaseIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={7} width={18} height={13} rx={2.5} stroke={color} {...LINE} />
      <Path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        stroke={color}
        {...LINE}
      />
      <Path d="M3 12.5h7M14 12.5h7M10 11.5h4v2.5h-4z" stroke={color} {...LINE} />
    </Svg>
  );
}

/** A person with a plus beside them: someone being added to a team. */
export function HireIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={9} cy={8} r={3.5} stroke={color} {...LINE} />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" stroke={color} {...LINE} />
      <Path d="M19 8v6M16 11h6" stroke={color} {...LINE} />
    </Svg>
  );
}

export function ArrowIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} {...LINE} />
    </Svg>
  );
}

export function CloseIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} {...LINE} />
    </Svg>
  );
}
