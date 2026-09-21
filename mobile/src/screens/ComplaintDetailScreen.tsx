import React, { useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Complaint } from '../api/types';
import { BackButton, Button, Card, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

export function ComplaintDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data: complaint, loading, error, refetch } = useApi<Complaint>(`/complaints/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (loading && !complaint) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!complaint) return null;

  const run = async (action: string, key: string, body?: Record<string, unknown>) => {
    setBusy(key);
    try {
      await api(`/complaints/${id}/${action}`, { method: 'POST', body });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(null);
    }
  };

  const sendReply = async () => {
    if (!message.trim()) return;
    setBusy('reply');
    try {
      await api(`/complaints/${id}/reply`, { method: 'POST', body: { message: message.trim() } });
      setMessage('');
      await refetch();
    } catch (e) {
      RNAlert.alert(t('complaintDetail.couldNotSendReply'), friendlyError(e, t));
    } finally {
      setBusy(null);
    }
  };

  const isOpenState = complaint.status === 'OPEN' || complaint.status === 'IN_PROGRESS' || complaint.status === 'ESCALATED';

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.headRow}>
          <Text style={s.code}>{complaint.code}</Text>
          <StatusPill value={complaint.status} />
        </View>
        <Text style={text.screenTitle} numberOfLines={3}>
          {complaint.subject}
        </Text>

        <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
          <DetailRow label={t('complaintDetail.reportedBy')} value={complaint.reporterName} />
          <DetailRow label={t('complaintDetail.opened')} value={longDate(complaint.createdAt)} />
          <DetailRow
            label={t('complaintDetail.assignedTo')}
            value={complaint.assignedAdmin ? complaint.assignedAdmin.displayName : t('complaintDetail.unassigned')}
          />
          {complaint.resolvedAt ? (
            <DetailRow label={t('complaintDetail.closedResolved')} value={longDate(complaint.resolvedAt)} />
          ) : null}
        </Card>

        <Card style={{ marginTop: spacing.md, backgroundColor: categoryTint(categoryPalette, 'message').bg }}>
          <Text style={s.label}>{t('complaintDetail.message')}</Text>
          <Text style={text.body}>{complaint.body}</Text>
        </Card>

        {complaint.resolution ? (
          <Card style={[{ marginTop: spacing.md }, s.resolutionCard]}>
            <Text style={s.resolutionTitle}>{t('complaintDetail.resolution')}</Text>
            <Text style={text.body}>{complaint.resolution}</Text>
          </Card>
        ) : null}

        <Text style={[text.sectionTitle, { marginTop: spacing.lg }]}>{t('complaintDetail.conversation')}</Text>
        {(complaint.replies ?? []).length === 0 ? (
          <Text style={[text.caption, { marginTop: spacing.xs }]}>{t('complaintDetail.noRepliesYet')}</Text>
        ) : (
          (complaint.replies ?? []).map((r) => {
            // Item 9: the thread now holds three kinds of author. The user's
            // own messages sit on the other side of the conversation, and the
            // instant auto-reply is labelled as automatic so nobody mistakes
            // it for an agent having already looked at the ticket.
            const fromUser = r.authorType === 'USER';
            const author =
              r.admin?.displayName ??
              r.authorName ??
              (fromUser ? complaint.reporterName : t('complaintDetail.supportBot'));
            return (
              <View
                key={r.id}
                style={[
                  s.replyBubble,
                  fromUser ? s.replyFromUser : null,
                  { backgroundColor: fromUser ? colors.primarySoft : categoryTint(categoryPalette, r.id).bg },
                ]}
              >
                <View style={s.replyHead}>
                  <Text style={s.replyAuthor} numberOfLines={1}>
                    {author}
                  </Text>
                  <Text style={text.micro}>{longDate(r.createdAt)}</Text>
                </View>
                {r.auto ? (
                  <Text style={s.autoTag}>{t('complaintDetail.autoReply')}</Text>
                ) : null}
                <Text style={text.body}>{r.message}</Text>
              </View>
            );
          })
        )}

        <View style={s.replyRow}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('complaintDetail.replyPlaceholder')}
            placeholderTextColor={colors.textLight}
            style={s.replyInput}
            multiline
          />
          <Button label={t('complaintDetail.send')} loading={busy === 'reply'} disabled={!message.trim()} onPress={sendReply} />
        </View>

        <View style={s.actions}>
          {!complaint.assignedAdmin ? (
            <Button
              label={t('complaintDetail.assignToMe')}
              variant="outline"
              loading={busy === 'assign'}
              onPress={() => run('assign', 'assign')}
            />
          ) : null}
          {complaint.status !== 'ESCALATED' && isOpenState ? (
            <Button
              label={t('complaintDetail.escalate')}
              variant="outline"
              loading={busy === 'escalate'}
              onPress={() => run('escalate', 'escalate')}
            />
          ) : null}
          {isOpenState ? (
            <Button
              label={t('complaintDetail.markResolved')}
              variant="success"
              loading={busy === 'resolve'}
              onPress={() => run('resolve', 'resolve', { resolution: t('complaintDetail.defaultResolution') })}
            />
          ) : null}
          {complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' ? (
            <Button
              label={t('complaintDetail.reopen')}
              variant="outline"
              loading={busy === 'reopen'}
              onPress={() => run('reopen', 'reopen')}
            />
          ) : null}
          {complaint.status !== 'CLOSED' ? (
            <Button
              label={t('complaintDetail.closeTicket')}
              variant="danger"
              loading={busy === 'close'}
              onPress={() => run('close', 'close')}
            />
          ) : null}
          <Button
            label={t('complaintDetail.viewHistory')}
            variant="outline"
            onPress={() =>
              navigation.navigate('EntityHistory', {
                entityType: 'Complaint',
                entityId: id,
                title: complaint.subject,
              })
            }
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    code: { fontSize: 12, fontWeight: '700', color: colors.textGray },
    label: { ...text.label, marginBottom: spacing.xs },
    resolutionCard: { backgroundColor: colors.greenBg },
    resolutionTitle: { ...text.label, color: colors.greenText, marginBottom: spacing.xs },
    replyBubble: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    replyFromUser: { marginLeft: spacing.xl },
    autoTag: {
      ...text.micro,
      color: colors.primary,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    replyHead: { flexDirection: 'row', justifyContent: 'space-between' },
    replyAuthor: { ...text.label, color: colors.textDark },
    replyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.md },
    replyInput: {
      flex: 1,
      minHeight: 46,
      maxHeight: 120,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...text.body,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  });
}
