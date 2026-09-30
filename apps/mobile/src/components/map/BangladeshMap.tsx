import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import type { AreaDemand, DemandBand } from '@workflex/shared';
import { useTheme } from '../../lib/use-theme';

/**
 * The country, drawn once.
 *
 * A schematic outline, not a survey: roughly forty points traced around
 * Bangladesh's border, enough that the shape is recognisable — the wide
 * north, the narrow waist above the delta, the Chittagong strip running
 * south-east, the Sundarbans corner in the south-west. It is not accurate at
 * the scale of a district and nothing on this screen depends on it being so.
 * The dots carry the data; the outline only tells a reader what they are
 * looking at.
 *
 * Kept as longitude/latitude pairs rather than as a ready-made SVG path so
 * that the same projection places both the border and the division points,
 * which is the only way the two can be guaranteed to line up.
 */
const OUTLINE: [number, number][] = [
  [88.1, 25.52],
  [88.4, 26.6],
  [88.75, 26.3],
  [89.05, 26.4],
  [89.65, 26.15],
  [89.83, 25.3],
  [90.35, 25.18],
  [91.0, 25.22],
  [91.7, 25.2],
  [92.15, 25.1],
  [92.38, 24.9],
  [92.05, 24.3],
  [91.35, 24.02],
  [91.15, 23.6],
  [91.4, 23.05],
  [91.75, 22.98],
  [92.25, 22.9],
  [92.65, 22.15],
  [92.58, 21.4],
  [92.32, 20.8],
  [92.1, 21.3],
  [91.8, 21.55],
  [91.45, 22.3],
  [90.95, 22.25],
  [90.6, 21.95],
  [90.28, 21.85],
  [89.9, 21.75],
  [89.52, 21.62],
  [89.1, 21.75],
  [88.88, 21.95],
  [88.95, 22.45],
  [88.72, 22.85],
  [88.78, 23.2],
  [88.55, 23.45],
  [88.12, 23.9],
  // The Padma bend west of Rajshahi. Drawn at the river rather than east of
  // it, which had the border cutting through Rajshahi city itself.
  [88.15, 24.3],
  [88.03, 24.7],
  [88.18, 25.18],
];

const BOUNDS = { west: 87.9, east: 92.8, south: 20.6, north: 26.8 };
const W = 300;
const H = 400;

const project = (lng: number, lat: number): [number, number] => [
  ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W,
  ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H,
];

/**
 * How big a division's dot is.
 *
 * Square-rooted, because a circle's area is what the eye reads: scaling the
 * radius by the count would make a division with four times the vacancies
 * look sixteen times as busy. Floored at a size that stays visible, since a
 * division with no postings still has to be there to say so.
 */
function radiusFor(vacancies: number, most: number): number {
  if (most <= 0) return 9;
  return 9 + Math.sqrt(vacancies / most) * 15;
}

/** Half the side of a dot's touch target, in viewBox units. */
const TOUCH = 24;

export function BangladeshMap({
  areas,
  selected,
  onSelect,
}: {
  areas: AreaDemand[];
  selected: string | null;
  onSelect: (division: string) => void;
}) {
  const { c } = useTheme();

  const colourFor = (band: DemandBand) =>
    band === 'SHORT_OF_WORKERS' ? c.danger : band === 'SHORT_OF_WORK' ? c.success : c.warning;

  const path = useMemo(
    () =>
      `${OUTLINE.map((point, i) => {
        const [x, y] = project(point[0], point[1]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')} Z`,
    [],
  );

  const most = Math.max(...areas.map((area) => area.vacancies), 0);
  const placed = areas.map((area) => {
    const [x, y] = project(area.lng, area.lat);
    return { area, x, y, r: radiusFor(area.vacancies, most) };
  });

  return (
    <View style={s.wrap}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <Path d={path} fill={c.surfaceAlt} stroke={c.border} strokeWidth={1.5} />

        {placed.map(({ area, x, y, r }) => {
          const colour = colourFor(area.band);
          const isOn = selected === area.division;
          return (
            <Circle
              key={area.division}
              cx={x}
              cy={y}
              r={r}
              fill={colour}
              fillOpacity={isOn ? 0.95 : 0.55}
              stroke={isOn ? c.text : colour}
              strokeWidth={isOn ? 2.5 : 1}
            />
          );
        })}

        {placed.map(({ area, x, y, r }) => (
          <SvgText
            key={area.division}
            x={x}
            y={y + r + 11}
            fontSize={10}
            fontWeight={selected === area.division ? '800' : '600'}
            fill={c.text}
            textAnchor="middle"
          >
            {area.en}
          </SvgText>
        ))}
      </Svg>

      {/*
        Taps are handled by plain views laid over the drawing rather than by
        `onPress` on the SVG nodes. react-native-svg turns those into the
        native responder props, which the web build silently drops — the map
        looked interactive and did nothing. A Pressable behaves the same on
        both, and it also gives every division the same comfortable target
        whatever the size of its dot.
      */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {placed.map(({ area, x, y }) => (
          <Pressable
            key={area.division}
            onPress={() => onSelect(area.division)}
            accessibilityRole="button"
            accessibilityLabel={area.en}
            accessibilityState={{ selected: selected === area.division }}
            style={{
              position: 'absolute',
              left: `${((x - TOUCH) / W) * 100}%`,
              top: `${((y - TOUCH) / H) * 100}%`,
              width: `${((TOUCH * 2) / W) * 100}%`,
              height: `${((TOUCH * 2) / H) * 100}%`,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { aspectRatio: W / H, width: '100%' },
});
