import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Worker } from '../api/types';
import {
  Avatar,
  BackButton,
  Button,
  Card,
  Chip,
  DetailRow,
  ErrorState,
  Loading,
  Meter,
  SectionHeader,
  StatusPill,
} from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { experience, longDate, taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

export function WorkerProfileScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette, shadow } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data: worker, loading, error, refetch } = useApi<Worker>(`/workers/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !worker) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!worker) return null;

  const act = async (path: string, body?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/workers/${id}/${path}`, { method: 'POST', body });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const confirmSuspend = () => {
    RNAlert.alert(
      t('workerProfile.suspendTitle'),
      t('workerProfile.suspendBody', { name: worker.fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workerProfile.suspend'),
          style: 'destructive',
          onPress: () => act('suspend', { reason: t('workerProfile.defaultSuspendReason') }),
        },
      ],
    );
  };

  const trustColor =
    worker.trustScore >= 85 ? colors.greenText : worker.trustScore >= 70 ? colors.amber : colors.red;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('workerProfile.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'identity').bg }}>
        <View style={s.identity}>
          <Avatar initials={worker.initials} size={64} />
          <View style={s.grow}>
            <Text style={s.name} numberOfLines={1}>
              {worker.fullName}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {worker.profession} · {worker.code}
            </Text>
            <View style={s.ratingRow}>
              <Text style={s.rating}>★ {worker.rating.toFixed(1)}</Text>
              <Text style={text.micro}>({worker.reviewCount})</Text>
              <StatusPill value={worker.status} />
            </View>
          </View>
        </View>

        <View style={s.trust}>
          <View style={s.trustHead}>
            <Text style={text.label}>{t('workerProfile.trustScore')}</Text>
            <Text style={[text.label, { color: trustColor }]}>{worker.trustScore}/100</Text>
          </View>
          <Meter percent={worker.trustScore} color={trustColor} />
        </View>

        <View style={s.statRow}>
          <Stat value={String(worker.totalJobs)} label={t('workerProfile.totalJobs')} styles={s} text={text} />
          <Stat value={taka(worker.totalEarnings, true)} label={t('workerProfile.totalEarnings')} styles={s} text={text} />
          <Stat value={`${worker.completionRate}%`} label={t('workerProfile.completionRate')} styles={s} text={text} />
        </View>
      </Card>

      <Pressable
        onPress={() => navigation.navigate('WorkerTransactions', { id, fullName: worker.fullName, balance: worker.balance })}
        style={({ pressed }) => [
          s.balanceRow,
          shadow.card,
          { backgroundColor: categoryTint(categoryPalette, 'balance').bg },
          pressed && { opacity: 0.9 },
        ]}
      >
        <View>
          <Text style={[text.caption, { color: categoryTint(categoryPalette, 'balance').fg }]}>
            {t('workerTransactions.balance')}
          </Text>
          <Text style={[s.balanceValue, { color: categoryTint(categoryPalette, 'balance').fg }]}>
            {taka(worker.balance, true)}
          </Text>
        </View>
        <Text style={[s.balanceArrow, { color: categoryTint(categoryPalette, 'balance').fg }]}>›</Text>
      </Pressable>

      {worker.bio ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'bio').bg }}>
          <SectionHeader title={t('workerProfile.bio')} />
          <Text style={text.body}>{worker.bio}</Text>
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'skills').bg }}>
        <SectionHeader title={t('workerProfile.skills')} />
        <View style={s.chipRow}>
          {(worker.skills ?? []).map((skill) => (
            <Chip key={skill.name} label={skill.name} />
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
        <DetailRow label={t('workerProfile.phone')} value={worker.phone} />
        <DetailRow label={t('workerProfile.email')} value={worker.email ?? '—'} />
        <DetailRow label={t('workerProfile.address')} value={worker.address} />
        <DetailRow label={t('workerProfile.joined')} value={longDate(worker.joinedAt)} />
        <DetailRow label={t('workerProfile.experience')} value={experience(worker.experienceMonths, t)} />
        <DetailRow label={t('workerProfile.education')} value={worker.education ?? '—'} />
        <DetailRow label={t('workerProfile.lastCompany')} value={worker.lastCompany ?? '—'} />
        <DetailRow
          label={t('workerProfile.preferredSalary')}
          value={
            worker.salaryMin && worker.salaryMax
              ? `${taka(worker.salaryMin)}–${taka(worker.salaryMax)}`
              : '—'
          }
        />
        <DetailRow
          label={t('workerProfile.availability')}
          value={worker.availability === 'FULL_TIME' ? t('workers.fullTime') : t('workers.partTime')}
        />
      </Card>

      {(worker.certifications ?? []).length > 0 ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'certifications').bg }}>
          <SectionHeader title={t('workerProfile.certifications')} />
          {worker.certifications!.map((cert) => (
            <View key={cert.id} style={s.certRow}>
              <Text style={s.certTick}>✓</Text>
              <Text style={text.body} numberOfLines={1}>
                {cert.name}
                {cert.issuer ? ` (${cert.issuer})` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={s.actions}>
        <Button
          label={t('workerProfile.editProfile')}
          variant="outline"
          onPress={() => navigation.navigate('EditWorker', { id })}
        />
        <Button
          label={t('workerProfile.viewHistory')}
          variant="outline"
          onPress={() => navigation.navigate('JobHistory', { id, name: worker.fullName })}
        />
        {/* Item 11 — every document filed under this worker's id, grouped by
            job, with their profile at the top of that screen. */}
        <Button
          label={t('workerProfile.documents')}
          variant="outline"
          onPress={() => navigation.navigate('Documents', { workerId: id })}
        />
        {/* Item 10 — the interviews this worker has been called to. */}
        <Button
          label={t('workerProfile.interviews')}
          variant="outline"
          onPress={() => navigation.navigate('Interviews', { workerId: id })}
        />
        {worker.status === 'SUSPENDED' ? (
          <Button label={t('workerProfile.reinstate')} variant="success" loading={busy} onPress={() => act('reinstate')} />
        ) : (
          <>
            {worker.status !== 'ACTIVE' ? (
              <Button label={t('common.verify')} variant="success" loading={busy} onPress={() => act('verify')} />
            ) : null}
            <Button label={t('workerProfile.suspend')} variant="danger" loading={busy} onPress={confirmSuspend} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, styles, text }: { value: string; label: string; styles: Styles; text: Txt }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[text.micro, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

    identity: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginTop: spacing.lg,
    },
    balanceValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
    balanceArrow: { fontSize: 22, fontWeight: '700' },
    grow: { flex: 1 },
    name: { fontSize: 18, fontWeight: '700', color: colors.textDark },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    rating: { fontSize: 13, fontWeight: '700', color: colors.amber },

    trust: { marginTop: spacing.xl },
    trustHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },

    statRow: {
      flexDirection: 'row',
      marginTop: spacing.xl,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingVertical: spacing.lg,
    },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
    statValue: { fontSize: 15, fontWeight: '700', color: colors.textDark },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    certRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
    certTick: { color: colors.greenText, fontWeight: '700' },

    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  });
}
