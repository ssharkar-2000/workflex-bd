import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoom, deleteRoom, fetchRooms } from '../../../src/api/meetings';
import { Card, Field, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { ask } from '../../../src/components/meetings/meeting-actions';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * The rooms somebody can book for an in-person meeting. A room is a name and
 * a place, and the server refuses to book one twice at the same time.
 */
export default function RoomsScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [seats, setSeats] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const rooms = useQuery({ queryKey: ['meeting-rooms'], queryFn: fetchRooms });

  const add = useMutation({
    mutationFn: () =>
      createRoom({
        name: name.trim(),
        location: location.trim() || undefined,
        capacity: seats ? Number(seats) : undefined,
      }),
    onSuccess: () => {
      setName('');
      setLocation('');
      setSeats('');
      setProblem(null);
      void queryClient.invalidateQueries({ queryKey: ['meeting-rooms'] });
    },
    onError: (err) => setProblem(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRoom(id),
    onSuccess: () => {
      setProblem(null);
      void queryClient.invalidateQueries({ queryKey: ['meeting-rooms'] });
    },
    onError: (err) => setProblem(errorMessage(err)),
  });

  const canAdd = name.trim().length > 0 && !add.isPending;

  return (
    <MoneyScreen title={t('meetings.rooms.title')} subtitle={t('meetings.rooms.subtitle')}>
      {problem ? <Notice tone="danger" body={problem} /> : null}

      {rooms.isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (rooms.data ?? []).length === 0 ? (
        <Notice tone="info" body={t('meetings.rooms.empty')} />
      ) : (
        (rooms.data ?? []).map((room) => (
          <Card key={room.id} style={s.room}>
            <View style={s.grow}>
              <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
                {room.name}
              </Text>
              <Text style={[s.muted, { color: c.textMuted }]} numberOfLines={2}>
                {[room.location, room.capacity ? t('meetings.rooms.seats', { count: room.capacity }) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                ask(t('meetings.rooms.delete'), room.name, t('meetings.rooms.delete'), t('common.cancel'), () =>
                  remove.mutate(room.id),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`${t('meetings.rooms.delete')}: ${room.name}`}
              style={[s.remove, { borderColor: c.dangerBorder }]}
            >
              <Text style={[s.removeText, { color: c.danger }]}>{t('meetings.rooms.delete')}</Text>
            </Pressable>
          </Card>
        ))
      )}

      <Card>
        <Field
          label={t('meetings.rooms.name')}
          value={name}
          onChange={setName}
          placeholder={t('meetings.rooms.name')}
        />
        <Field
          label={t('meetings.rooms.location')}
          value={location}
          onChange={setLocation}
          placeholder={t('meetings.rooms.location')}
          optional
        />
        <Field
          label={t('meetings.rooms.capacity')}
          value={seats}
          onChange={(v) => setSeats(v.replace(/[^\d]/g, '').slice(0, 3))}
          placeholder="8"
          keyboardType="number-pad"
          autoCapitalize="none"
          optional
        />
        <Pressable
          onPress={() => canAdd && add.mutate()}
          disabled={!canAdd}
          accessibilityRole="button"
          testID="btn-add-room"
          style={({ pressed }) => [
            s.add,
            { backgroundColor: pressed ? c.primaryPressed : c.primary, opacity: canAdd ? 1 : 0.5 },
          ]}
        >
          {add.isPending ? (
            <ActivityIndicator color={c.primaryText} />
          ) : (
            <Text style={[s.addText, { color: c.primaryText }]}>{t('meetings.rooms.add')}</Text>
          )}
        </Pressable>
      </Card>
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: space.xl, alignItems: 'center' },
  grow: { flex: 1 },
  room: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontSize: font.md, fontWeight: '800' },
  muted: { fontSize: font.xs, lineHeight: 17, marginTop: 2 },
  remove: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  removeText: { fontSize: font.xs, fontWeight: '800' },
  add: {
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontSize: font.md, fontWeight: '800' },
});
