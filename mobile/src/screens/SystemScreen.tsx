import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { MaintenanceWindow } from '../api/types';
import { BackButton, Button, Card, DetailRow, ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Health = {
  database: { reachable: boolean; latencyMs: number };
  uptimeSeconds: number;
  nodeVersion: string;
  rowCounts: { workers: number; jobs: number; transactions: number; alerts: number };
};

/// 93784 -> "1d 2h 3m"
function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

export function SystemScreen() {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data, loading, error, refetch } = useApi<Health>('/system/health');
  const maintenance = useApi<MaintenanceWindow[]>('/system/maintenance');

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const schedule = async () => {
    if (!title.trim() || !date.trim() || !time.trim()) {
      RNAlert.alert(t('maintenance.invalidDateTime'), '');
      return;
    }
    const scheduledAt = new Date(`${date.trim()}T${time.trim()}:00`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      RNAlert.alert(t('maintenance.invalidDateTime'), '');
      return;
    }
    setBusy(true);
    try {
      await api('/system/maintenance', {
        method: 'POST',
        body: { title: title.trim(), message: message.trim() || undefined, scheduledAt: scheduledAt.toISOString() },
      });
      setTitle('');
      setMessage('');
      setDate('');
      setTime('');
      await maintenance.refetch();
      RNAlert.alert(t('maintenance.scheduledToast'), '');
    } catch (e) {
      RNAlert.alert(t('maintenance.couldNotSchedule'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const cancelWindow = (id: string) => {
    RNAlert.alert(t('maintenance.confirmCancelTitle'), t('maintenance.confirmCancelBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('maintenance.cancelWindow'),
        style: 'destructive',
        onPress: async () => {
          setCancellingId(id);
          try {
            await api(`/system/maintenance/${id}`, { method: 'DELETE' });
            await maintenance.refetch();
          } catch (e) {
            RNAlert.alert(t('maintenance.couldNotCancel'), friendlyError(e, t));
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('system.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'database').bg }}>
        <View style={s.row}>
          <Text style={text.sectionTitle}>{t('system.database')}</Text>
          <StatusPill
            value={data.database.reachable ? 'APPROVED' : 'FAILED'}
            label={data.database.reachable ? t('system.reachable') : t('system.down')}
          />
        </View>
        <Text style={[text.caption, { marginTop: spacing.xs }]}>
          {t('system.respondedIn', { ms: data.database.latencyMs })}
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'runtime').bg }}>
        <SectionHeader title={t('system.runtime')} />
        <DetailRow label={t('system.uptime')} value={uptime(data.uptimeSeconds)} />
        <DetailRow label={t('system.node')} value={data.nodeVersion} />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'tableSizes').bg }}>
        <SectionHeader title={t('system.tableSizes')} />
        <DetailRow label={t('menu.workers')} value={data.rowCounts.workers.toLocaleString('en-IN')} />
        <DetailRow label={t('menu.jobs')} value={data.rowCounts.jobs.toLocaleString('en-IN')} />
        <DetailRow label={t('system.transactions')} value={data.rowCounts.transactions.toLocaleString('en-IN')} />
        <DetailRow label={t('system.alerts')} value={data.rowCounts.alerts.toLocaleString('en-IN')} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('maintenance.schedule')} />
        <Field label={t('maintenance.titleLabel')} value={title} onChange={setTitle} placeholder={t('maintenance.titlePlaceholder')} colors={colors} text={text} />
        <Field label={t('maintenance.messageLabel')} value={message} onChange={setMessage} placeholder={t('maintenance.messagePlaceholder')} colors={colors} text={text} multiline />
        <View style={s.dateTimeRow}>
          <View style={s.dateTimeField}>
            <Field label={t('maintenance.dateLabel')} value={date} onChange={setDate} placeholder={t('maintenance.datePlaceholder')} colors={colors} text={text} />
          </View>
          <View style={s.dateTimeField}>
            <Field label={t('maintenance.timeLabel')} value={time} onChange={setTime} placeholder={t('maintenance.timePlaceholder')} colors={colors} text={text} />
          </View>
        </View>
        <Text style={[text.caption, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
          {t('maintenance.notifyNote')}
        </Text>
        <Button label={t('maintenance.scheduleButton')} loading={busy} onPress={schedule} />
      </Card>

      {(maintenance.data ?? []).length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title={t('maintenance.upcoming')} />
          {maintenance.data!.map((window) => (
            <View key={window.id} style={s.windowRow}>
              <View style={s.grow}>
                <Text style={[text.label, { color: colors.textDark }]}>{window.title}</Text>
                <Text style={text.micro}>
                  {t('maintenance.scheduledFor')}: {longDate(window.scheduledAt)}
                </Text>
                <Text style={text.micro}>
                  {window.notified60At ? t('maintenance.notified60') : t('maintenance.notNotifiedYet')}
                  {window.notified30At ? ` · ${t('maintenance.notified30')}` : ''}
                </Text>
              </View>
              <Button
                label={t('maintenance.cancelWindow')}
                variant="danger"
                loading={cancellingId === window.id}
                onPress={() => cancelWindow(window.id)}
              />
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  colors,
  text,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  colors: ThemeColors;
  text: ReturnType<typeof buildText>;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[text.label, { marginBottom: spacing.xs }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline={multiline}
        autoCapitalize="none"
        placeholderTextColor={colors.textLight}
        style={{
          minHeight: multiline ? 72 : 46,
          borderRadius: radii.md,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingTop: multiline ? spacing.sm : 0,
          textAlignVertical: multiline ? 'top' : 'center',
          color: colors.textDark,
          ...text.body,
        }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    grow: { flex: 1 },
    dateTimeRow: { flexDirection: 'row', gap: spacing.md },
    dateTimeField: { flex: 1 },
    windowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
}
