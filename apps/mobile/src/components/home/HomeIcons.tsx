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

/**
 * The notification bell, drawn rather than typed.
 *
 * It replaces a 🔔, which the header could not colour: an emoji arrives in
 * its own palette, so the one control beside the search sat in a different
 * set of colours from everything around it.
 */
export function BellIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z"
        stroke={color}
        {...LINE}
      />
      <Path d="M13.7 19a2 2 0 0 1-3.4 0" stroke={color} {...LINE} />
    </Svg>
  );
}

/**
 * The save mark on a job card, filled once it is saved.
 *
 * The emoji it replaces had the same problem in reverse: 🔖 and 📑 read as
 * two different actions rather than one control in two states, and neither
 * could take the theme's colour.
 */
export function BookmarkIcon({
  size,
  color,
  filled,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4.2L5.5 20V5a1 1 0 0 1 1-1z"
        stroke={color}
        {...LINE}
        fill={filled ? color : 'none'}
      />
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

/**
 * The tab bar's four icons.
 *
 * Drawn from the shapes that were asked for — a house, a briefcase inside a
 * magnifier, a checklist with a clock — in this file's line style rather than
 * traced as filled glyphs, so they take the theme's colour and change with
 * the active tab. The profile icon was not asked for and is here because the
 * bar has four tabs: three drawn icons beside one bare label would read as
 * something missing.
 */
export function HomeIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 10.6 12 3.2l9 7.4" stroke={color} {...LINE} />
      <Path d="M5.6 9.6V20.4h12.8V9.6" stroke={color} {...LINE} />
      {/* The chimney and the door, which are what make it a house rather
          than an arrow over a box. */}
      <Path d="M16.1 5.4h2.3v2.4" stroke={color} {...LINE} />
      <Path d="M9.9 20.4v-5.3h4.2v5.3" stroke={color} {...LINE} />
    </Svg>
  );
}

export function JobSearchIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={10.1} cy={10.1} r={7.7} stroke={color} {...LINE} />
      <Path d="M15.6 15.6 20.9 20.9" stroke={color} {...LINE} />
      {/* A briefcase inside the glass: looking for work, not for anything.
          Two strokes only — a lid and a body. The divider and the clasp that
          make a briefcase obvious at 44pt turn it to mush at 22. */}
      <Rect x={6.6} y={9.1} width={7} height={4.6} rx={1.1} stroke={color} {...LINE} />
      <Path d="M8.9 9.1V8.3c0-.5.4-.9.9-.9h0.6c.5 0 .9.4.9.9v0.8" stroke={color} {...LINE} />
    </Svg>
  );
}

export function ActivityIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M13.4 4H15a1.6 1.6 0 0 1 1.6 1.6v5"
        stroke={color}
        {...LINE}
      />
      <Path
        d="M10.6 20.4H5.4A1.6 1.6 0 0 1 3.8 18.8V5.6A1.6 1.6 0 0 1 5.4 4H7"
        stroke={color}
        {...LINE}
      />
      <Rect x={7.8} y={2.4} width={4.8} height={3.2} rx={1} stroke={color} {...LINE} />
      {/* Two ticked rows: enough to read as a list of things done. */}
      <Path d="M6.3 9.4l1 1 1.6-1.8M10.6 9.8h3" stroke={color} {...LINE} />
      <Path d="M6.3 13.4l1 1 1.6-1.8M10.6 13.8h2" stroke={color} {...LINE} />
      <Circle cx={17.4} cy={16.6} r={4.6} stroke={color} {...LINE} />
      <Path d="M17.4 14.2v2.6h2" stroke={color} {...LINE} />
    </Svg>
  );
}

export function ProfileIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.4} r={3.9} stroke={color} {...LINE} />
      <Path d="M4.6 20.6c1.6-4.1 4.3-6.2 7.4-6.2s5.8 2.1 7.4 6.2" stroke={color} {...LINE} />
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
