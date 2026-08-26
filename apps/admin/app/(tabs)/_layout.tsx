import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, font, radius } from '../../src/lib/theme';

/**
 * Five tabs, matching the bottom bar in the mockups: Home, Workers, Jobs,
 * Payments, Menu. Everything beyond these lives behind Menu ("All Sections"),
 * which is how the design keeps eighteen areas reachable from a phone.
 *
 * Glyphs are text rather than an icon font: the mockups use Font Awesome via
 * CDN, which has no equivalent in React Native without shipping the font, and
 * these read identically at tab size.
 */
const ICONS: Record<string, string> = {
  index: '⌂',
  workers: '👤',
  jobs: '💼',
  payments: '৳',
  menu: '☰',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text
        style={[
          styles.icon,
          { color: focused ? colors.primary : colors.textFaint },
        ]}
      >
        {ICONS[name] ?? '•'}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="workers" options={{ title: 'Workers' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.borderLight,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
  label: { fontSize: font.xs, fontWeight: '700' },
  iconWrap: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  icon: { fontSize: 17, fontWeight: '700' },
});
