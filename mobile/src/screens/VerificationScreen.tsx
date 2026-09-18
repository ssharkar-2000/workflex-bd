import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Page, VerificationRequest, VerificationType } from '../api/types';
import { Avatar, BackButton, Button, ErrorState, Loading, SectionHeader } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const TYPE_LABEL_KEY: Record<VerificationType, string> = {
  NID: 'verification.typeNid',
  FACE: 'verification.typeFace',
  BUSINESS: 'verification.typeBusiness',
  WORKER: 'verification.typeWorker',
  EMPLOYER: 'verification.typeEmployer',
  COMPANY: 'verification.typeCompany',
};

export function VerificationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [type, setType] = useState<VerificationType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useApi<{ total: number; byType: { type: VerificationType; pending: number }[] }>(
    '/verifications/pending-by-type',
  );
  const { data, loading, error, refetch } = useApi<Page<VerificationRequest>>(
    `/verifications${type ? `?type=${type}` : ''}`,
    [type],
  );

  const review = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      await api(`/verifications/${id}/${action}`, { method: 'POST', body: {} });
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={text.screenTitle}>{t('verification.title')}</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {t('verification.pendingCount', { count: counts.data?.total ?? 0 })}
            </Text>

            <View style={s.grid}>
              {(counts.data?.byType ?? []).map((entry) => {
                const active = type === entry.type;
                return (
                  <Pressable
                    key={entry.type}
                    onPress={() => setType(active ? null : entry.type)}
                    style={[
                      s.tile,
                      shadow.card,
                      !active && { backgroundColor: categoryTint(categoryPalette, entry.type).bg },
                      active && s.tileActive,
                    ]}
                  >
                    <View style={s.tileLabelRow}>
                      {!active ? (
                        <View
                          style={[s.tileDot, { backgroundColor: categoryTint(categoryPalette, entry.type).fg }]}
                        />
                      ) : null}
                      <Text style={[s.tileLabel, active && s.tileLabelActive]} numberOfLines={2}>
                        {t(TYPE_LABEL_KEY[entry.type])}
                      </Text>
                    </View>
                    <Text style={[s.tileCount, active && s.tileLabelActive]}>
                      {t('verification.pendingShort', { count: entry.pending })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title={type ? t(TYPE_LABEL_KEY[type]) : t('verification.pendingQueue')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <View style={s.empty}>
              <Text style={text.cardTitle}>{t('verification.queueClear')}</Text>
              <Text style={[text.caption, { marginTop: spacing.xs }]}>
                {t('verification.nothingWaiting')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
            <View style={s.row}>
              <Avatar
                initials={item.subjectName
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
                size={40}
              />
              <View style={s.grow}>
                <Text style={text.cardTitle} numberOfLines={1}>
                  {item.subjectName}
                </Text>
                <View style={s.metaRow}>
                  <View
                    style={[s.typeBadge, { backgroundColor: categoryTint(categoryPalette, item.type).bg }]}
                  >
                    <Text style={[s.typeBadgeText, { color: categoryTint(categoryPalette, item.type).fg }]}>
                      {t(TYPE_LABEL_KEY[item.type])}
                    </Text>
                  </View>
                  <Text style={text.caption}>{longDate(item.submittedAt)}</Text>
                </View>
              </View>
            </View>
            <View style={s.actions}>
              <Button
                label={t('common.reject')}
                variant="danger"
                loading={busyId === item.id}
                onPress={() => review(item.id, 'reject')}
              />
              <Button
                label={t('common.approve')}
                variant="success"
                loading={busyId === item.id}
                onPress={() => review(item.id, 'approve')}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
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
      gap: spacing.xs,
    },
    tileActive: { backgroundColor: colors.primary },
    tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    tileDot: { width: 8, height: 8, borderRadius: 4 },
    tileLabel: { ...text.label, flexShrink: 1 },
    tileLabelActive: { color: colors.onPrimary },
    tileCount: { ...text.caption, color: colors.primary, fontWeight: '700' },

    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
    row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
    typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
    typeBadgeText: { fontSize: 11, fontWeight: '700' },
    grow: { flex: 1 },
    actions: { flexDirection: 'row', gap: spacing.sm },
    empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  });
}
