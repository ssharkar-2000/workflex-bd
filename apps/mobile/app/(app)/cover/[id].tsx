import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatTaka, type ReplacementCandidate } from '@workflex/shared';
import { askCover, confirmCover, fetchCover } from '../../../src/api/cover';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * The Replacement Matcher, second screen: who can cover.
 *
 * The order is decided on the server and shown with its reasons, because an
 * employer who cannot see why a name is at the top will not act on it at
 * eleven at night. Everything on this screen is a fact from the record —
 * shifts completed, no-shows, the skills that matched — and the model's only
 * job is to put those facts into a sentence.
 *
 * Two deliberate frictions. The message is editable and nothing is sent until
 * the employer presses the button, because it arrives under their name. And
 * confirming somebody is a separate, single choice: several people are asked
 * and only one slot exists.
 */
export default function CoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const cover = useQuery({
    queryKey: ['cover', id],
    queryFn: () => fetchCover(id),
    enabled: Boolean(id),
  });

  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  // Seeded once the draft arrives, and not again: the employer may have
  // started editing by the time a refetch lands, and overwriting what
  // somebody is typing is never the right answer.
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!edited && cover.data?.draftMessage) setMessage(cover.data.draftMessage);
  }, [cover.data?.draftMessage, edited]);

  const ask = useMutation({
    mutationFn: () => askCover(id, { workerIds: picked, message: message.trim() }),
    onSuccess: (result) => {
      setPicked([]);
      void queryClient.invalidateQueries({ queryKey: ['cover', id] });
      Alert.alert(t('cover.askedTitle'), t('cover.askedBody', { n: result.asked }));
    },
  });

  const confirm = useMutation({
    mutationFn: (workerId: string) => confirmCover(id, { workerId }),
    onSuccess: (shift) => {
      void queryClient.invalidateQueries({ queryKey: ['cover'] });
      void queryClient.invalidateQueries({ queryKey: ['shifts'] });
      router.replace({ pathname: '/(app)/shifts/[id]', params: { id: shift.id } });
    },
  });

  const gap = cover.data?.gap;
  const candidates = cover.data?.candidates ?? [];

  const toggle = (userId: string) =>
    setPicked((held) =>
      held.includes(userId) ? held.filter((one) => one !== userId) : [...held, userId],
    );

  const onAsk = () => {
    if (picked.length === 0 || message.trim().length === 0) return;
    Alert.alert(t('cover.askConfirmTitle'), t('cover.askConfirmBody', { n: picked.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cover.send'), onPress: () => ask.mutate() },
    ]);
  };

  const onConfirm = (person: ReplacementCandidate) => {
    Alert.alert(
      t('cover.confirmTitle'),
      t('cover.confirmBody', { name: person.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('cover.confirmYes'), onPress: () => confirm.mutate(person.userId) },
      ],
    );
  };

  return (
    <MoneyScreen title={t('cover.matchTitle')} subtitle={gap?.jobTitle ?? ''}>
      {cover.error ? <ErrorBanner message={errorMessage(cover.error)} tone="onSurface" /> : null}
      {ask.error ? <ErrorBanner message={errorMessage(ask.error)} tone="onSurface" /> : null}
      {confirm.error ? (
        <ErrorBanner message={errorMessage(confirm.error)} tone="onSurface" />
      ) : null}

      {cover.isLoading ? (
        <>
          <ActivityIndicator color={c.primary} style={s.loading} />
          <Text style={[s.note, { color: c.textMuted }]}>{t('cover.working')}</Text>
        </>
      ) : !gap ? null : (
        <>
          <View style={[s.gap, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <Text style={[s.gapWhen, { color: c.text }]}>
              {new Date(gap.startsAt).toLocaleString()}
            </Text>
            <Text style={[s.gapMeta, { color: c.textMuted }]}>
              {gap.location} · {formatTaka(Math.round(gap.pay / 100))}
            </Text>
            <Text style={[s.gapMeta, { color: c.textMuted }]}>
              {t('cover.cancelledBy', { name: gap.workerName })}
            </Text>
          </View>

          <Text style={[s.heading, { color: c.text }]}>
            {t('cover.shortlist', { n: candidates.length })}
          </Text>
          <Text style={[s.note, { color: c.textMuted }]}>
            {cover.data?.busyCount
              ? t('cover.rankedBusy', { n: cover.data.busyCount })
              : t('cover.ranked')}
          </Text>

          {candidates.length === 0 ? (
            <Notice tone="warning" title={t('cover.emptyTitle')} body={t('cover.emptyBody')} />
          ) : (
            candidates.map((person) => (
              <CandidateCard
                key={person.userId}
                person={person}
                picked={picked.includes(person.userId)}
                onToggle={() => toggle(person.userId)}
                onConfirm={() => onConfirm(person)}
                busy={confirm.isPending}
              />
            ))
          )}

          {candidates.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('cover.message')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('cover.messageNote')}</Text>
              <TextInput
                value={message}
                onChangeText={(text) => {
                  setEdited(true);
                  setMessage(text);
                }}
                multiline
                textAlignVertical="top"
                style={[
                  s.input,
                  { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                ]}
                placeholderTextColor={c.textMuted}
                placeholder={t('cover.messagePlaceholder')}
              />

              <ShimmerButton
                label={
                  picked.length === 0
                    ? t('cover.pickFirst')
                    : t('cover.askN', { n: picked.length })
                }
                onPress={onAsk}
                loading={ask.isPending}
                disabled={picked.length === 0 || message.trim().length === 0}
              />
            </>
          ) : null}

          <Text style={[s.note, { color: c.textMuted }]}>{t('cover.footnote2')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

function CandidateCard({
  person,
  picked,
  onToggle,
  onConfirm,
  busy,
}: {
  person: ReplacementCandidate;
  picked: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View
      style={[
        s.card,
        { backgroundColor: c.surface, borderColor: picked ? c.primary : c.border },
      ]}
    >
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: picked }} style={s.cardTop}>
        <View
          style={[
            s.box,
            {
              borderColor: picked ? c.primary : c.border,
              backgroundColor: picked ? c.primary : 'transparent',
            },
          ]}
        >
          {picked ? <Text style={s.tick}>✓</Text> : null}
        </View>

        <View style={s.who}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
            {person.name}
          </Text>
          {person.area ? (
            <Text style={[s.area, { color: c.textMuted }]} numberOfLines={1}>
              {person.area}
            </Text>
          ) : null}
        </View>

        <Text style={[s.score, { color: c.primary }]}>{person.score}</Text>
      </Pressable>

      <Text style={[s.why, { color: c.text }]}>{person.why}</Text>

      {/* The three axes, so the number above can be argued with. */}
      <View style={s.axes}>
        <Axis label={t('cover.axisSkills')} value={person.skillScore} of={40} />
        <Axis label={t('cover.axisRecord')} value={person.reliabilityScore} of={35} />
        <Axis label={t('cover.axisNear')} value={person.nearbyScore} of={25} />
      </View>

      <View style={s.actions}>
        {person.asked ? (
          <Text style={[s.asked, { color: c.textMuted }]}>{t('cover.asked')}</Text>
        ) : (
          <View />
        )}
        {/* A compact pill rather than the shared OutlineButton, which is
            built to span a screen and leaves a long Bangla label sitting
            outside its own border at this width. */}
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.pill,
            {
              borderColor: c.primary,
              backgroundColor: pressed ? c.primarySoft : 'transparent',
              opacity: busy ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[s.pillText, { color: c.primary }]}>{t('cover.confirmShort')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Axis({ label, value, of }: { label: string; value: number; of: number }) {
  const { c } = useTheme();
  return (
    <View style={s.axis}>
      <Text style={[s.axisLabel, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
        <View
          style={[
            s.fill,
            { backgroundColor: c.primary, width: `${Math.round((value / of) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },

  gap: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  gapWhen: { fontSize: font.sm + 1, fontWeight: '800' },
  gapMeta: { fontSize: font.xs, marginTop: 3 },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', lineHeight: 15 },
  who: { flex: 1 },
  name: { fontSize: font.sm + 1, fontWeight: '800' },
  area: { fontSize: font.xs, marginTop: 1 },
  score: { fontSize: font.md, fontWeight: '900' },

  why: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.xs },

  axes: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  axis: { flex: 1 },
  axisLabel: { fontSize: font.xs - 2, fontWeight: '700', marginBottom: 3 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  asked: { fontSize: font.xs, fontWeight: '700' },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  pillText: { fontSize: font.xs, fontWeight: '800' },

  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: 120,
    fontSize: font.sm,
    lineHeight: 20,
    marginBottom: space.md,
  },
});
