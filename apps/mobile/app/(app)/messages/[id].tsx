import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationThread, Message } from '@workflex/shared';
import { blockConversation, fetchThread, sendMessage } from '../../../src/api/messaging';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';
import { ago } from './index';

/**
 * One conversation, with the job it is about pinned to the top.
 *
 * The context header is the point: somebody juggling four applications and
 * two shifts cannot tell from "can you come at 3?" which job is being
 * discussed, and a chat that makes them guess is worse than no chat.
 *
 * The actions under it change with the relationship — an applicant can open
 * the job, a hired worker can open the shift — so the thread is part of the
 * work rather than a place to talk about it.
 */
export default function ConversationScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [draft, setDraft] = useState('');

  const thread = useQuery<ConversationThread>({
    queryKey: ['thread', id],
    queryFn: () => fetchThread(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['thread', id] });
    void queryClient.invalidateQueries({ queryKey: ['inbox'] });
  };

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(id!, { body }),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
  });

  const block = useMutation({
    mutationFn: (on: boolean) => blockConversation(id!, on),
    onSuccess: refresh,
  });

  const conversation = thread.data?.conversation;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Who, and about what */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/messages/index'))}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={[s.back, { color: c.primary }]}>←</Text>
        </Pressable>

        <View style={s.headerBody}>
          <Text style={[s.headerName, { color: c.text }]} numberOfLines={1}>
            {conversation
              ? (conversation.correspondent.company ?? conversation.correspondent.name)
              : ''}
            {conversation?.correspondent.verified ? (
              <Text style={{ color: c.success }}> ✓</Text>
            ) : null}
          </Text>
          {conversation ? (
            <Text style={[s.headerJob, { color: c.textMuted }]} numberOfLines={1}>
              {conversation.job.title}
              {conversation.applicationStatus
                ? ` · ${t(`messages.application.${conversation.applicationStatus}` as TranslationKey)}`
                : ''}
            </Text>
          ) : null}
        </View>

        {conversation ? (
          <Pressable
            onPress={() => block.mutate(!conversation.blocked)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              conversation.blocked ? t('messages.unblock') : t('messages.block')
            }
          >
            <Text style={[s.more, { color: conversation.blocked ? c.danger : c.textMuted }]}>
              {conversation.blocked ? '⊘' : '⋮'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* What this thread lets you do */}
      {conversation ? (
        <View style={[s.actions, { borderBottomColor: c.border }]}>
          <Action
            label={t('messages.viewJob')}
            onPress={() =>
              router.push({ pathname: '/(app)/job/[id]', params: { id: conversation.job.id } })
            }
          />
          {conversation.shift ? (
            <Action
              label={t('messages.viewShift')}
              onPress={() =>
                router.push({
                  pathname: '/(app)/shifts/[id]',
                  params: { id: conversation.shift!.id },
                })
              }
            />
          ) : null}
          {conversation.section === 'HIRING' ? (
            <Action
              label={t('messages.viewApplicants')}
              onPress={() =>
                router.push({
                  pathname: '/(app)/applicants/[jobId]',
                  params: { jobId: conversation.job.id },
                })
              }
            />
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {thread.error ? (
            <ErrorBanner message={errorMessage(thread.error)} tone="onSurface" />
          ) : null}

          {thread.isLoading ? (
            <ActivityIndicator color={c.primary} style={s.loading} />
          ) : (thread.data?.messages.length ?? 0) === 0 ? (
            <Text style={[s.empty, { color: c.textMuted }]}>{t('messages.startHere')}</Text>
          ) : (
            thread.data!.messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))
          )}

          {send.error ? <ErrorBanner message={errorMessage(send.error)} tone="onSurface" /> : null}
        </ScrollView>

        {/* Writing */}
        {conversation?.blocked ? (
          <View style={[s.blocked, { borderTopColor: c.border }]}>
            <Text style={[s.blockedText, { color: c.textMuted }]}>
              {conversation.blockedByMe ? t('messages.youBlocked') : t('messages.theyBlocked')}
            </Text>
          </View>
        ) : (
          <View style={[s.composer, { borderTopColor: c.border, backgroundColor: c.bg }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('messages.write')}
              placeholderTextColor={c.textMuted}
              multiline
              style={[
                s.input,
                { backgroundColor: c.surface, borderColor: c.border, color: c.text },
              ]}
              accessibilityLabel={t('messages.write')}
            />
            <Pressable
              onPress={() => send.mutate(draft)}
              disabled={!draft.trim() || send.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('messages.send')}
              style={({ pressed }) => [
                s.sendButton,
                {
                  backgroundColor: pressed ? c.primaryPressed : c.primary,
                  opacity: draft.trim() ? 1 : 0.4,
                },
              ]}
            >
              <Text style={[s.sendText, { color: c.primaryText }]}>➤</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: Message }) {
  const { c } = useTheme();

  if (message.kind === 'SYSTEM') {
    return (
      <Text style={[s.system, { color: c.textMuted }]}>{message.body}</Text>
    );
  }

  return (
    <View
      style={[
        s.bubble,
        message.mine
          ? { alignSelf: 'flex-end', backgroundColor: c.primary }
          : { alignSelf: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
      ]}
    >
      <Text style={[s.bubbleText, { color: message.mine ? c.primaryText : c.text }]}>
        {message.body}
      </Text>
      <Text
        style={[
          s.bubbleTime,
          { color: message.mine ? 'rgba(255,255,255,0.75)' : c.textMuted },
        ]}
      >
        {new Date(message.createdAt).toLocaleTimeString('en-GB', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}
      </Text>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.action,
        {
          borderColor: c.primarySoftBorder,
          backgroundColor: pressed ? c.primarySoft : 'transparent',
        },
      ]}
    >
      <Text style={[s.actionText, { color: c.primary }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
  back: { fontSize: font.xl, fontWeight: '800' },
  headerBody: { flex: 1 },
  headerName: { fontSize: font.md, fontWeight: '800' },
  headerJob: { fontSize: font.xs },
  more: { fontSize: font.lg, fontWeight: '800' },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
  },
  action: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  actionText: { fontSize: font.xs, fontWeight: '800' },

  scroll: { padding: space.md, gap: space.sm },
  loading: { marginTop: space.lg },
  empty: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: space.xl },

  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10 },
  bubbleText: { fontSize: font.sm, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  system: { fontSize: font.xs, textAlign: 'center', paddingVertical: space.sm },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: font.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: font.md, fontWeight: '800' },

  blocked: { padding: space.md, borderTopWidth: 1, alignItems: 'center' },
  blockedText: { fontSize: font.sm, textAlign: 'center' },
});
