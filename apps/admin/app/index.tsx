import { Redirect } from 'expo-router';

/** The gate in _layout.tsx decides where this actually lands. */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
