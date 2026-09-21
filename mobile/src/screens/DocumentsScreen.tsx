import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { DocumentsByUser, StoredDocument } from '../api/types';
import {
  Avatar,
  BackButton,
  Button,
  Card,
  Chip,
  DetailRow,
  EmptyState,
  ErrorState,
  Loading,
  SectionHeader,
  StatusPill,
} from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { experience, longDate, taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const KIND_KEY: Record<string, string> = {
  NID: 'documents.kindNid',
  PASSPORT: 'documents.kindPassport',
  BIRTH_CERTIFICATE: 'documents.kindBirthCertificate',
  CERTIFICATE: 'documents.kindCertificate',
  CV: 'documents.kindCv',
  CONTRACT: 'documents.kindContract',
  PHOTO: 'documents.kindPhoto',
  TRADE_LICENSE: 'documents.kindTradeLicense',
  OTHER: 'documents.kindOther',
};

/**
 * Item 11 — "document storage hoye thakbe based on user id + job id and user
 * full info dakabe."
 *
 * One request (`/documents/by-user`) returns both halves: the person's full
 * profile at the top, and their files below grouped into one folder per job
 * (plus a "general" folder for documents that belong to the person rather
 * than any one job). That grouping mirrors how the files are actually laid
 * out in storage — the key is `worker/<workerId>/job/<jobId>/...` — so what
 * an admin sees on screen matches what is on disk.
 */
export function DocumentsScreen({ route, navigation }: any) {
  const { workerId, employerId, jobId } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = [
    workerId ? `workerId=${workerId}` : '',
    employerId ? `employerId=${employerId}` : '',
    jobId ? `jobId=${jobId}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const { data, loading, error, refetch } = useApi<DocumentsByUser>(
    query ? `/documents/by-user?${query}` : null,
    [query],
  );

  if (!query) {
    return (
      <View style={[s.flex, { paddingTop: insets.top + spacing.lg }]}>
        <EmptyState title={t('documents.noUserTitle')} hint={t('documents.noUserHint')} />
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const user = data.user;

  const open = async (doc: StoredDocument) => {
    if (!doc.url) {
      RNAlert.alert(t('documents.noFileTitle'), t('documents.noFileBody', { key: doc.storageKey }));
      return;
    }
    try {
      await Linking.openURL(doc.url);
    } catch {
      RNAlert.alert(t('documents.noFileTitle'), t('documents.couldNotOpen'));
    }
  };

  const confirmRemove = (doc: StoredDocument) => {
    RNAlert.alert(
      t('documents.removeTitle'),
      t('documents.removeBody', { name: doc.fileName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('cmsDetail.delete'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(doc.id);
            try {
              await api(`/documents/${doc.id}`, { method: 'DELETE' });
              await refetch();
            } catch (e) {
              RNAlert.alert(t('documents.actionFailed'), friendlyError(e, t));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('documents.title')}</Text>

      {/* The "user full info" half — everything needed to check a document
          against the person it claims to belong to, without leaving. */}
      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'head').bg }}>
        <View style={s.head}>
          <Avatar initials={user.initials ?? '??'} size={52} />
          <View style={s.grow}>
            <Text style={s.name} numberOfLines={1}>
              {user.fullName}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {user.profession ? `${user.profession} · ` : ''}
              {user.code}
            </Text>
          </View>
          {user.status ? <StatusPill value={user.status} /> : null}
        </View>

        <View style={s.chipRow}>
          {user.experienceMonths !== undefined ? (
            <Chip label={experience(user.experienceMonths, t)} />
          ) : null}
          {user.trustScore !== undefined ? (
            <Chip label={`${t('workers.trust')}: ${user.trustScore}`} />
          ) : null}
          {user.totalJobs !== undefined ? (
            <Chip label={t('documents.jobsDone', { count: user.totalJobs })} />
          ) : null}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
        <DetailRow label={t('workerProfile.phone')} value={user.phone ?? '—'} />
        <DetailRow label={t('workerProfile.email')} value={user.email ?? '—'} />
        <DetailRow label={t('workerProfile.address')} value={user.address ?? '—'} />
        {user.education ? <DetailRow label={t('workerProfile.education')} value={user.education} /> : null}
        {user.joinedAt ? (
          <DetailRow label={t('documents.joined')} value={longDate(user.joinedAt)} />
        ) : null}
        {user.totalEarnings !== undefined ? (
          <DetailRow label={t('documents.totalEarnings')} value={taka(user.totalEarnings)} />
        ) : null}
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={t('documents.filesTitle', { count: data.total })} />
      </View>

      {data.groups.length === 0 ? (
        <EmptyState title={t('documents.emptyTitle')} hint={t('documents.emptyHint')} />
      ) : (
        data.groups.map((group) => (
          <View key={group.jobId ?? 'general'} style={{ marginTop: spacing.md }}>
            <View style={s.folderHead}>
              <Text style={s.folderTitle} numberOfLines={1}>
                📁 {group.job ? group.job.title : t('documents.generalFolder')}
              </Text>
              {group.job ? <Text style={text.micro}>{group.job.code}</Text> : null}
            </View>

            {group.documents.map((doc) => (
              <Card
                key={doc.id}
                style={{
                  marginTop: spacing.sm,
                  backgroundColor: categoryTint(categoryPalette, doc.kind).bg,
                }}
              >
                <View style={s.docHead}>
                  <View style={s.grow}>
                    <Text style={text.cardTitle} numberOfLines={1}>
                      {doc.fileName}
                    </Text>
                    <Text style={[text.caption, { marginTop: 2 }]} numberOfLines={1}>
                      {t(KIND_KEY[doc.kind] ?? 'documents.kindOther')} · {longDate(doc.uploadedAt)}
                    </Text>
                  </View>
                  {doc.sizeBytes ? <Text style={text.micro}>{fileSize(doc.sizeBytes)}</Text> : null}
                </View>

                {/* The derived key is shown on purpose: it is the exact path
                    the file sits at, which is what someone chasing a missing
                    upload needs to see. */}
                <Pressable onLongPress={() => RNAlert.alert(t('documents.storageKey'), doc.storageKey)}>
                  <Text style={s.key} numberOfLines={1}>
                    {doc.storageKey}
                  </Text>
                </Pressable>

                {doc.note ? (
                  <Text style={[text.body, { marginTop: spacing.xs }]}>{doc.note}</Text>
                ) : null}

                <View style={s.actions}>
                  <Button label={t('documents.open')} variant="outline" onPress={() => open(doc)} />
                  <Button
                    label={t('cmsDetail.delete')}
                    variant="danger"
                    loading={busyId === doc.id}
                    onPress={() => confirmRemove(doc)}
                  />
                </View>
              </Card>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    name: { fontSize: 17, fontWeight: '700', color: colors.textDark },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },

    folderHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    folderTitle: { ...text.label, color: colors.textDark, flex: 1 },

    docHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    key: {
      ...text.micro,
      color: colors.textLight,
      marginTop: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });
}
