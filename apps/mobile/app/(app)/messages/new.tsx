import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiErrorCode, type Correspondent } from '@workflex/shared';
import { fetchMe } from '../../../src/api/auth';
import { toApiError } from '../../../src/api/client';
import { lookupPerson, startDirect } from '../../../src/api/messaging';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useOnline } from '../../../src/lib/chat-socket';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * Start a direct message from someone's WorkFlex id.
 *
 * The id has to be typed in full: the server matches it exactly and never
 * suggests near misses, so this finds the person who gave you their id and
 * nobody else. Your own id is shown at the top for the other direction —
 * the way to be found is to hand it out.
 */
export default function NewChatScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const [publicId, setPublicId] = useState('');
  const [copied, setCopied] = useState(false);

  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const lookup = useMutation({ mutationFn: (id: string) => lookupPerson(id) });

  const open = useMutation({
    mutationFn: (id: string) => startDirect(id),
    onSuccess: (conversation) =>
      router.replace({ pathname: '/(app)/messages/[id]', params: { id: conversation.id } }),
  });

  const canSearch = publicId.trim().length >= 3 && !lookup.isPending;

  const search = () => {
    if (!canSearch) return;
    open.reset();
    lookup.mutate(publicId.trim());
  };

  /** The two answers worth their own sentence; anything else is generic. */
  const describe = (error: unknown): string => {
    const apiError = toApiError(error);
    if (apiError.code === ApiErrorCode.NOT_FOUND) return t('messages.new.notFound');
    if (apiError.code === ApiErrorCode.VALIDATION_FAILED && apiError.statusCode === 400) {
      return t('messages.new.self');
    }
    return errorMessage(error);
  };

  const error = lookup.error ?? open.error;

  return (
    <MoneyScreen title={t('messages.new.title')} subtitle={t('messages.new.subtitle')}>
      {me.data ? (
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.label, { color: c.textMuted }]}>{t('messages.new.yourId')}</Text>
          <View style={s.idRow}>
            <Text style={[s.myId, { color: c.text }]} selectable>
              {me.data.publicId}
            </Text>
            <Pressable
              onPress={() => {
                void Clipboard.setStringAsync(me.data.publicId).then(() => setCopied(true));
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.copy,
                {
                  borderColor: c.primarySoftBorder,
                  backgroundColor: pressed ? c.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[s.copyText, { color: c.primary }]}>
                {copied ? t('messages.new.copied') : t('messages.new.copy')}
              </Text>
            </Pressable>
          </View>
          <Text style={[s.hint, { color: c.textMuted }]}>{t('messages.new.share')}</Text>
        </View>
      ) : null}

      <View style={s.searchRow}>
        <TextInput
          value={publicId}
          onChangeText={(text) => {
            setPublicId(text);
            if (lookup.data || lookup.error) lookup.reset();
          }}
          onSubmitEditing={search}
          placeholder={t('messages.new.placeholder')}
          placeholderTextColor={c.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={24}
          style={[s.input, { backgroundColor: c.fieldBg, borderColor: c.border, color: c.text }]}
          accessibilityLabel={t('messages.new.placeholder')}
        />
        <Pressable
          onPress={search}
          disabled={!canSearch}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.button,
            {
              backgroundColor: pressed ? c.primaryPressed : c.primary,
              opacity: canSearch ? 1 : 0.4,
            },
          ]}
        >
          {lookup.isPending ? (
            <ActivityIndicator color={c.primaryText} />
          ) : (
            <Text style={[s.buttonText, { color: c.primaryText }]}>{t('messages.new.search')}</Text>
          )}
        </Pressable>
      </View>

      <Text style={[s.hint, { color: c.textMuted }]}>{t('messages.new.exact')}</Text>

      {error ? <ErrorBanner message={describe(error)} tone="onSurface" /> : null}

      {lookup.data ? (
        <Person
          person={lookup.data}
          opening={open.isPending}
          onMessage={() => open.mutate(lookup.data.publicId)}
        />
      ) : null}
    </MoneyScreen>
  );
}

function Person({
  person,
  opening,
  onMessage,
}: {
  person: Correspondent;
  opening: boolean;
  onMessage: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const online = useOnline(person.id, person.online);
  const name = person.company ?? person.name;

  return (
    <View style={[s.card, s.person, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View>
        <View style={[s.avatar, { backgroundColor: c.primary }]}>
          <Text style={[s.avatarText, { color: c.primaryText }]}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        {online ? (
          <View style={[s.onlineDot, { backgroundColor: c.success, borderColor: c.surface }]} />
        ) : null}
      </View>

      <View style={s.personBody}>
        <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
          {name}
          {person.verified ? <Text style={{ color: c.success }}> ✓</Text> : null}
        </Text>
        {person.company ? (
          <Text style={[s.hint, { color: c.textMuted }]} numberOfLines={1}>
            {person.name}
          </Text>
        ) : null}
        <Text style={[s.hint, { color: c.textMuted }]}>
          {person.publicId}
          {online ? ` · ${t('messages.online')}` : ''}
        </Text>
      </View>

      <Pressable
        onPress={onMessage}
        disabled={opening}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.button,
          { backgroundColor: pressed ? c.primaryPressed : c.primary },
        ]}
      >
        {opening ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[s.buttonText, { color: c.primaryText }]}>{t('messages.new.message')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
    gap: 4,
  },
  label: { fontSize: font.xs, fontWeight: '800' },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myId: { fontSize: font.lg, fontWeight: '800', letterSpacing: 1 },
  copy: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  copyText: { fontSize: font.xs, fontWeight: '800' },
  hint: { fontSize: font.xs, lineHeight: 18 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: font.sm,
    letterSpacing: 0.5,
  },
  button: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  buttonText: { fontSize: font.sm, fontWeight: '800' },

  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.md, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  personBody: { flex: 1, gap: 2 },
  name: { fontSize: font.md, fontWeight: '800' },
});
