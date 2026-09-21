import React from 'react';
import { Alert as RNAlert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Card, SectionHeader } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';

type Badges = {
  workers: number;
  newJobs: number;
  verifications: number;
  alerts: number;
  complaints: number;
  notifications: number;
};

/** Every row in the design's menu now resolves to a real screen. */
const SECTIONS: { label: string; icon: string; route: string; badge?: keyof Badges }[] = [
  { label: 'Dashboard', icon: '🏠', route: 'Home' },
  { label: 'Workers Management', icon: '👷', route: 'Workers', badge: 'workers' },
  { label: 'Employer Management', icon: '🏢', route: 'Employers' },
  { label: 'Company Management', icon: '🏬', route: 'Companies' },
  { label: 'Job Management', icon: '💼', route: 'Jobs', badge: 'newJobs' },
  { label: 'Verification Center', icon: '✅', route: 'Verifications', badge: 'verifications' },
  { label: 'Attendance', icon: '🕒', route: 'Attendance' },
  { label: 'Payments', icon: '💳', route: 'Payments' },
  { label: 'Analytics', icon: '📊', route: 'Analytics' },
  { label: 'AI Monitoring', icon: '🛡️', route: 'AIMonitoring', badge: 'alerts' },
  { label: 'Support', icon: '💬', route: 'Complaints', badge: 'complaints' },
  { label: 'Notifications', icon: '🔔', route: 'Notifications', badge: 'notifications' },
  { label: 'Reports', icon: '📄', route: 'Reports' },
  { label: 'Security', icon: '🔒', route: 'Security' },
  { label: 'CMS', icon: '📝', route: 'Cms' },
  { label: 'System Management', icon: '⚙️', route: 'System' },
  { label: 'Settings', icon: '🎛️', route: 'Settings' },
];

export function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { admin, signOut, setLanguage } = useAuth();
  const badges = useApi<Badges>('/dashboard/menu-badges');

  const confirmSignOut = () => {
    RNAlert.alert('Sign out?', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>All Sections</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.profile}>
          <Avatar
            initials={(admin?.displayName ?? 'SA')
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
            size={48}
          />
          <View style={s.grow}>
            <Text style={text.cardTitle}>{admin?.displayName}</Text>
            <Text style={text.caption}>{admin?.email}</Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Language" />
        <Text style={[text.caption, { marginTop: -spacing.sm, marginBottom: spacing.md }]}>
          Choose display language
        </Text>
        <View style={s.langRow}>
          {(['en', 'bn'] as const).map((code) => {
            const active = admin?.language === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLanguage(code)}
                style={[s.lang, active && s.langActive]}
              >
                <Text style={[s.langText, active && s.langTextActive]}>
                  {code === 'en' ? 'EN' : 'বাংলা'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {SECTIONS.map((section) => {
          const count = section.badge ? badges.data?.[section.badge] : undefined;
          return (
            <Pressable
              key={section.label}
              onPress={() => navigation.navigate(section.route)}
              style={({ pressed }) => [s.row, shadow.card, pressed && { opacity: 0.9 }]}
            >
              <Text style={s.rowIcon}>{section.icon}</Text>
              <Text style={[text.body, { flex: 1, fontWeight: '500' }]}>{section.label}</Text>
              {count ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{count > 999 ? `${Math.round(count / 1000)}k` : count}</Text>
                </View>
              ) : (
                <Text style={s.chevron}>›</Text>
              )}
            </Pressable>
          );
        })}

        <Pressable onPress={confirmSignOut} style={[s.row, s.signOut, shadow.card]}>
          <Text style={s.rowIcon}>🚪</Text>
          <Text style={[text.body, { flex: 1, fontWeight: '600', color: colors.redText }]}>
            Sign Out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  profile: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  grow: { flex: 1 },

  langRow: { flexDirection: 'row', gap: spacing.sm },
  lang: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  langActive: { backgroundColor: colors.primary },
  langText: { ...text.label, color: colors.textGray },
  langTextActive: { color: colors.onPrimary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowIcon: { fontSize: 16, width: 22 },
  chevron: { fontSize: 20, color: colors.textLight },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  signOut: { marginTop: spacing.md, backgroundColor: colors.redBg },
});
