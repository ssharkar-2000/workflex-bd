import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { BackButton, EmptyState, ErrorState, FilterTabs, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
  admin: { id: string; displayName: string; email: string };
};

type Session = {
  id: string;
  admin: { id: string; displayName: string; email: string };
  createdAt: string;
  expiresAt: string;
};

type Tab = 'AUDIT' | 'SESSIONS';
type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

/// "worker.suspend" -> "Worker suspend"
function readable(action: string): string {
  const label = action.replace(/[._]/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function SecurityScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [tab, setTab] = useState<Tab>('AUDIT');

  const overview = useApi<{
    activeSessions: number;
    actionsToday: number;
    admins: number;
    openAlerts: number;
  }>('/security/overview');
  const audit = useApi<Page<AuditEntry>>('/security/audit-log');
  const sessions = useApi<Session[]>('/security/sessions');

  const revoke = async (id: string) => {
    try {
      await api(`/security/sessions/${id}/revoke`, { method: 'POST' });
      await Promise.all([sessions.refetch(), overview.refetch()]);
    } catch (e) {
      RNAlert.alert(t('security.couldNotRevoke'), friendlyError(e, t));
    }
  };

  const header = (
    <View>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('security.title')}</Text>

      {overview.data ? (
        <View style={s.grid}>
          <Tile value={overview.data.activeSessions} label={t('security.activeSessions')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'activeSessions').bg} />
          <Tile value={overview.data.actionsToday} label={t('security.actions24h')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'actionsToday').bg} />
          <Tile value={overview.data.admins} label={t('security.admins')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'admins').bg} />
          <Tile value={overview.data.openAlerts} label={t('security.openAlerts')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'openAlerts').bg} />
        </View>
      ) : null}

      <FilterTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'AUDIT', label: t('security.auditLog') },
          { value: 'SESSIONS', label: t('security.sessions') },
        ]}
      />
    </View>
  );

  if (tab === 'SESSIONS') {
    return (
      <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
        <FlatList
          data={sessions.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={header}
          onRefresh={sessions.refetch}
          refreshing={sessions.loading}
          ListEmptyComponent={
            sessions.error ? (
              <ErrorState message={sessions.error} onRetry={sessions.refetch} />
            ) : sessions.loading ? (
              <Loading />
            ) : (
              <EmptyState title={t('security.noActiveSessions')} />
            )
          }
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
              <View style={s.grow}>
                <Text style={text.cardTitle} numberOfLines={1}>
                  {item.admin.displayName}
                </Text>
                <Text style={text.caption} numberOfLines={1}>
                  {item.admin.email}
                </Text>
                <Text style={[text.micro, { marginTop: 2 }]}>
                  {t('security.started', { time: timeAgo(item.createdAt, t) })}
                </Text>
              </View>
              <Pressable onPress={() => revoke(item.id)} hitSlop={8}>
                <Text style={s.revoke}>{t('security.revoke')}</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={audit.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={header}
        onRefresh={audit.refetch}
        refreshing={audit.loading}
        ListEmptyComponent={
          audit.error ? (
            <ErrorState message={audit.error} onRetry={audit.refetch} />
          ) : audit.loading ? (
            <Loading />
          ) : (
            <EmptyState title={t('security.nothingLogged')} hint={t('security.nothingLoggedHint')} />
          )
        }
        renderItem={({ item }) => (
          <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
            <View style={s.grow}>
              <View style={s.row}>
                <Text style={text.cardTitle} numberOfLines={2}>
                  {readable(item.action)}
                </Text>
                <Text style={text.micro}>{timeAgo(item.createdAt, t)}</Text>
              </View>
              <Text style={text.caption} numberOfLines={1}>
                {item.admin.displayName} · {item.entityType}
              </Text>
              {item.reason ? (
                <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={2}>
                  {item.reason}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function Tile({
  value,
  label,
  styles,
  text,
  shadow,
  tint,
}: {
  value: number;
  label: string;
  styles: Styles;
  text: Txt;
  shadow: { card: object };
  tint?: string;
}) {
  return (
    <View style={[styles.tile, shadow.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    grow: { flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    revoke: { ...text.label, color: colors.redText },
  });
}
