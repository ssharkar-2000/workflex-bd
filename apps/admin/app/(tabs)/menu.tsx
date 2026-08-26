import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAdminStore } from '../../src/store/admin-store';
import { Screen } from '../../src/components/ui';
import { colors, font, radius, shadow, space } from '../../src/lib/theme';

type Section = {
  icon: string;
  label: string;
  href: string;
};

/** Every section in the design, each reaching a working screen. */
const SECTIONS: Section[] = [
  { icon: '⌂', label: 'Dashboard', href: '/(tabs)' },
  { icon: '👤', label: 'Workers Management', href: '/(tabs)/workers' },
  { icon: '🏢', label: 'Employer Management', href: '/employers' },
  { icon: '🏭', label: 'Company Management', href: '/companies' },
  { icon: '💼', label: 'Job Management', href: '/(tabs)/jobs' },
  { icon: '✅', label: 'Verification Center', href: '/verification' },
  { icon: '🕒', label: 'Attendance', href: '/attendance' },
  { icon: '৳', label: 'Payments', href: '/(tabs)/payments' },
  { icon: '📊', label: 'Analytics', href: '/analytics' },
  { icon: '🤖', label: 'AI Monitoring', href: '/ai-monitoring' },
  { icon: '🛡️', label: 'Fraud Detection', href: '/fraud' },
  { icon: '💬', label: 'Support', href: '/support' },
  { icon: '🔔', label: 'Notifications', href: '/notifications' },
  { icon: '📄', label: 'Reports', href: '/reports' },
  { icon: '🔒', label: 'Security', href: '/security' },
  { icon: '📝', label: 'CMS', href: '/cms' },
  { icon: '⚙️', label: 'System Management', href: '/system' },
  { icon: '🔧', label: 'Settings', href: '/settings' },
];

export default function MenuScreen() {
  const router = useRouter();
  const admin = useAdminStore((s) => s.admin);
  const signOut = useAdminStore((s) => s.signOut);

  const onSignOut = () => {
    Alert.alert('Sign out', 'End this admin session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <Screen title="All Sections" subtitle={admin?.email ?? undefined}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => router.push(s.href as never)}
              style={styles.tile}
            >
              <Text style={styles.tileIcon}>{s.icon}</Text>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.signOut} onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    ...shadow.card,
  },
  tileIcon: { fontSize: 22 },
  tileLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: space.sm,
  },
  signOut: {
    marginTop: space.xl,
    alignItems: 'center',
    paddingVertical: space.md,
  },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: font.sm },
});
