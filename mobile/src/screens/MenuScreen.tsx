import React, { useMemo } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Card, SectionHeader } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type Badges = {
  workers: number;
  newJobs: number;
  verifications: number;
  alerts: number;
  complaints: number;
  notifications: number;
};

/** Every row in the design's menu now resolves to a real screen. Labels are translation keys (item 12). */
const SECTIONS: { labelKey: string; icon: string; route: string; badge?: keyof Badges }[] = [
  { labelKey: 'dashboard.title', icon: '🏠', route: 'Home' },
  { labelKey: 'menu.workers', icon: '👷', route: 'Workers', badge: 'workers' },
  { labelKey: 'menu.employers', icon: '🏢', route: 'Employers' },
  { labelKey: 'menu.companies', icon: '🏬', route: 'Companies' },
  { labelKey: 'menu.jobs', icon: '💼', route: 'Jobs', badge: 'newJobs' },
  { labelKey: 'menu.verifications', icon: '✅', route: 'Verifications', badge: 'verifications' },
  // Item 10 — the interview list, alongside the rest of the hiring flow.
  { labelKey: 'menu.interviews', icon: '🗓️', route: 'Interviews' },
  { labelKey: 'menu.attendance', icon: '🕒', route: 'Attendance' },
  { labelKey: 'nav.payments', icon: '💳', route: 'Payments' },
  { labelKey: 'menu.subscriptions', icon: '⭐', route: 'Subscriptions' },
  { labelKey: 'menu.analytics', icon: '📊', route: 'Analytics' },
  // Item 13 — same screen, renamed everywhere a person reads it.
  { labelKey: 'menu.suspicious', icon: '🛡️', route: 'AIMonitoring', badge: 'alerts' },
  // Item 8 — irregular transactions and the 24-hour ban notices.
  { labelKey: 'menu.suspiciousTransactions', icon: '🚩', route: 'SuspiciousTransactions' },
  { labelKey: 'menu.complaints', icon: '💬', route: 'Complaints', badge: 'complaints' },
  { labelKey: 'menu.reports', icon: '📄', route: 'Reports' },
  { labelKey: 'menu.security', icon: '🔒', route: 'Security' },
  { labelKey: 'menu.cms', icon: '📝', route: 'Cms' },
  { labelKey: 'menu.system', icon: '⚙️', route: 'System' },
  { labelKey: 'menu.settings', icon: '🎛️', route: 'Settings' },
];

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
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
    redDot: {
      position: 'absolute',
      top: -2,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.red,
    },
    backlogText: { fontSize: 11, fontWeight: '700', color: colors.redText },
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
}

export function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { admin, signOut } = useAuth();
  const badges = useApi<Badges>('/dashboard/menu-badges');
  // "Onek din dhore jome ache" — a red dot on Complaints & Support when
  // tickets have sat OPEN/IN_PROGRESS/ESCALATED for 3+ days, separate from
  // the plain open-count badge above (which doesn't say anything about age).
  const backlog = useApi<{ count: number; thresholdDays: number }>('/complaints/backlog');

  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);

  const confirmSignOut = () => {
    RNAlert.alert(t('menu.signOut') + '?', t('menu.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('menu.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>{t('menu.title')}</Text>

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
        <SectionHeader title={t('settings.language')} />
        <Text style={[text.caption, { marginTop: -spacing.sm, marginBottom: spacing.md }]}>
          {t('settings.languageHint')}
        </Text>
        <View style={s.langRow}>
          {(['en', 'bn'] as const).map((code) => {
            const active = language === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLanguage(code)}
                style={[s.lang, active && s.langActive]}
              >
                <Text style={[s.langText, active && s.langTextActive]}>
                  {code === 'en' ? t('settings.languageEnglish') : t('settings.languageBangla')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {SECTIONS.map((section) => {
          const count = section.badge ? badges.data?.[section.badge] : undefined;
          const hasBacklog = section.route === 'Complaints' && (backlog.data?.count ?? 0) > 0;
          return (
            <Pressable
              key={section.labelKey}
              onPress={() => navigation.navigate(section.route)}
              style={({ pressed }) => [
                s.row,
                shadow.card,
                { backgroundColor: categoryTint(categoryPalette, section.labelKey).bg },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View>
                <Text style={s.rowIcon}>{section.icon}</Text>
                {hasBacklog ? <View style={s.redDot} /> : null}
              </View>
              <Text style={[text.body, { flex: 1, fontWeight: '500' }]}>{t(section.labelKey)}</Text>
              {hasBacklog ? (
                <Text style={s.backlogText}>
                  {t('menu.backlogDays', { days: backlog.data!.thresholdDays })}
                </Text>
              ) : null}
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
            {t('menu.signOut')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
