import React, { useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Alert } from '../api/types';
import { Button, Card, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { colors, spacing, text } from '../theme';
import { humanise, timeAgo } from '../theme/format';

export function AlertDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { data: alert, loading, error, refetch } = useApi<Alert>(`/alerts/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !alert) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!alert) return null;

  const run = async (action: 'resolve' | 'escalate') => {
    setBusy(true);
    try {
      await api(`/alerts/${id}/${action}`, {
        method: 'POST',
        body:
          action === 'resolve'
            ? { actionTaken: 'Reviewed and closed by admin' }
            : { actionTaken: 'Escalated to authorities' },
      });
      await refetch();
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Alert Details</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.head}>
          <StatusPill value={alert.severity} />
          <StatusPill value={alert.status} />
        </View>
        <Text style={[text.caption, { marginTop: spacing.sm }]}>
          {humanise(alert.kind)} · {timeAgo(alert.detectedAt)}
        </Text>
        <Text style={[text.cardTitle, { marginTop: spacing.sm, fontSize: 16 }]}>{alert.message}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="User" value={alert.subjectName} />
        {alert.worker ? <DetailRow label="User ID" value={alert.worker.code} /> : null}
        {alert.latitude !== null ? (
          <DetailRow label="Latitude" value={`${Math.abs(alert.latitude).toFixed(4)}° N`} />
        ) : null}
        {alert.longitude !== null ? (
          <DetailRow label="Longitude" value={`${Math.abs(alert.longitude).toFixed(4)}° E`} />
        ) : null}
        <DetailRow label="Device" value={alert.device ?? 'Unknown'} />
        <DetailRow label="Action Taken" value={alert.actionTaken ?? 'None yet'} />
      </Card>

      <View style={s.actions}>
        {alert.worker ? (
          <Button
            label="View User"
            variant="outline"
            onPress={() => navigation.navigate('WorkerProfile', { id: alert.worker!.id })}
          />
        ) : null}
        {alert.status !== 'RESOLVED' ? (
          <>
            <Button label="Escalate" variant="danger" loading={busy} onPress={() => run('escalate')} />
            <Button label="Mark as Resolved" variant="success" loading={busy} onPress={() => run('resolve')} />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  head: { flexDirection: 'row', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
});
