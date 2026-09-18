import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/use-theme';

export default function OnboardingLayout() {
  const { c } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Only ever seen for a frame during the push transition, before
        // MeshBackground paints over it — but a hardcoded navy flashing
        // between two pastel screens is exactly the kind of seam that reads
        // as a bug. Follows the theme so it disappears instead.
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );
}
