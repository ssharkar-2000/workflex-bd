import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiErrorCode,
  MEETING_LIMITS,
  type Meeting,
  type MeetingKind,
  type MeetingPerson,
  type MeetingRecurrence,
  type MeetingTemplate,
  type ScheduleMeetingInput,
} from '@workflex/shared';
import {
  deleteTemplate,
  fetchContacts,
  fetchRooms,
  fetchTemplates,
  scheduleMeeting,
} from '../../api/meetings';
import { toApiError } from '../../api/client';
import { lookupPerson } from '../../api/messaging';
import { Chip, Label, Field, walletStyles } from '../wallet/WalletUi';
import { DateTimeField } from './DateTimeField';
import { minutesBetween, roundUp } from './meeting-format';
import { useErrorMessage } from '../../lib/error-message';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

const KINDS: MeetingKind[] = ['VIDEO', 'IN_PERSON'];
const RECURRENCES: MeetingRecurrence[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];
/** One-tap lengths, under the two date boxes. */
const DURATIONS = [15, 30, 45, 60, 90];
const DEFAULT_MINUTES = 30;

/** The next quarter hour, at least five minutes away: what "Schedule" should offer first. */
function firstSlot(): Date {
  return roundUp(new Date(Date.now() + 5 * 60_000), 15);
}

/**
 * The "Schedule a Meeting" popup.
 *
 * It only exists while it is open, so every opening starts from a clean form.
 * Everything the server checks is checked here first, in the reader's
 * language — the server's own messages are English and are shown only as the
 * last resort.
 */
export function ScheduleMeetingModal({
  onClose,
  onScheduled,
  template,
}: {
  onClose: () => void;
  onScheduled: (meeting: Meeting) => void;
  /** A saved set-up to start from, when opened from the Templates tab. */
  template?: MeetingTemplate | null;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { width, height } = useWindowDimensions();
  const wide = width >= 720;

  const first = useMemo(firstSlot, []);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<MeetingKind>('VIDEO');
  const [starts, setStarts] = useState(first);
  const [ends, setEnds] = useState(new Date(first.getTime() + DEFAULT_MINUTES * 60_000));
  const [agenda, setAgenda] = useState('');
  const [notes, setNotes] = useState('');
  const [guests, setGuests] = useState<MeetingPerson[]>([]);
  const [idText, setIdText] = useState('');
  const [idError, setIdError] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>('NONE');
  const [repeatCount, setRepeatCount] = useState(4);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [panel, setPanel] = useState<'load' | 'manage' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contacts = useQuery({ queryKey: ['meeting-contacts'], queryFn: fetchContacts });
  const templatesQuery = useQuery({ queryKey: ['meeting-templates'], queryFn: fetchTemplates });
  const rooms = useQuery({
    queryKey: ['meeting-rooms'],
    queryFn: fetchRooms,
    enabled: kind === 'IN_PERSON',
  });
  const templates = templatesQuery.data ?? [];

  const minutes = minutesBetween(starts, ends);

  // A message about the form goes away as soon as the form changes.
  useEffect(() => {
    setError(null);
  }, [title, kind, starts, ends, guests, recurrence, roomId]);

  // --- date and time ---

  /** Moving the start carries the end with it, so the length is kept. */
  const changeStart = (next: Date) => {
    const keep = minutes >= MEETING_LIMITS.minMinutes ? minutes : DEFAULT_MINUTES;
    setStarts(next);
    setEnds(new Date(next.getTime() + keep * 60_000));
  };

  // --- people ---

  const toggleGuest = (person: MeetingPerson) => {
    setIdError(null);
    setGuests((list) =>
      list.some((g) => g.id === person.id)
        ? list.filter((g) => g.id !== person.id)
        : list.length >= MEETING_LIMITS.maxGuests
          ? list
          : [...list, person],
    );
  };

  const lookup = useMutation({
    mutationFn: (publicId: string) => lookupPerson(publicId),
    onSuccess: (person) => {
      if (guests.some((g) => g.id === person.id)) {
        setIdError(t('meetings.form.alreadyAdded'));
        return;
      }
      setGuests((list) => [
        ...list,
        {
          id: person.id,
          publicId: person.publicId,
          name: person.name,
          company: person.company,
          verified: person.verified,
        },
      ]);
      setIdText('');
      setIdError(null);
    },
    onError: (err) => {
      // The two answers worth their own sentence; anything else is generic.
      const apiError = toApiError(err);
      if (apiError.code === ApiErrorCode.NOT_FOUND) return setIdError(t('messages.new.notFound'));
      if (apiError.code === ApiErrorCode.VALIDATION_FAILED && apiError.statusCode === 400) {
        return setIdError(t('messages.new.self'));
      }
      setIdError(errorMessage(err));
    },
  });

  const addById = () => {
    const publicId = idText.trim().toUpperCase();
    if (publicId && !lookup.isPending) lookup.mutate(publicId);
  };

  // --- templates ---

  const applyTemplate = (template: MeetingTemplate) => {
    setTitle(template.title);
    setKind(template.kind);
    setEnds(new Date(starts.getTime() + template.durationMinutes * 60_000));
    setAgenda(template.agenda ?? '');
    setNotes(template.notes ?? '');
    setRecurrence(template.recurrence);
    setRepeatCount(Math.max(2, template.repeatCount));
    setGuests(template.participants);
    setRoomId(template.physicalRoomId);
    setError(null);
    setPanel(null);
  };

  // Opened from a saved template: start from it.
  useEffect(() => {
    if (template) applyTemplate(template);
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeTemplate = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meeting-templates'] });
      void queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // --- schedule ---

  const create = useMutation({
    mutationFn: (input: ScheduleMeetingInput) => scheduleMeeting(input),
    onSuccess: (meeting) => {
      void queryClient.invalidateQueries({ queryKey: ['meetings'] });
      void queryClient.invalidateQueries({ queryKey: ['meeting-templates'] });
      onScheduled(meeting);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const submit = () => {
    if (create.isPending) return;
    if (!title.trim()) return setError(t('meetings.form.needTitle'));
    if (starts.getTime() < Date.now() - MEETING_LIMITS.startGraceMinutes * 60_000) {
      return setError(t('meetings.form.pastStart'));
    }
    if (minutes < MEETING_LIMITS.minMinutes || minutes > MEETING_LIMITS.maxMinutes) {
      return setError(t('meetings.form.badDuration'));
    }
    setError(null);
    create.mutate({
      title: title.trim(),
      kind,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      agenda: agenda.trim() || undefined,
      notes: notes.trim() || undefined,
      participantIds: guests.map((g) => g.id),
      recurrence,
      repeatCount: recurrence === 'NONE' ? 1 : repeatCount,
      physicalRoomId: kind === 'IN_PERSON' && roomId ? roomId : undefined,
      saveAsTemplate,
    });
  };

  const goRooms = () => {
    onClose();
    router.push('/(app)/meetings/rooms' as never);
  };

  const togglePanel = (which: 'load' | 'manage') => setPanel((now) => (now === which ? null : which));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[s.backdrop, { justifyContent: wide ? 'center' : 'flex-end' }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.kav}
        >
          <View
            style={[
              s.sheet,
              { maxHeight: Math.round(height * 0.94), backgroundColor: c.surface, borderColor: c.border },
              wide && s.sheetWide,
            ]}
            testID="schedule-modal"
          >
            {/* Header: what this is, and the shortcut to a saved set-up. */}
            <View style={[s.header, { borderBottomColor: c.border }]}>
              <View style={s.headerText}>
                <Text style={[s.heading, { color: c.text }]} accessibilityRole="header">
                  {t('meetings.form.title')}
                </Text>
                <Text style={[s.sub, { color: c.textMuted }]}>{t('meetings.form.subtitle')}</Text>
              </View>
              <Pressable
                onPress={() => togglePanel('load')}
                accessibilityRole="button"
                testID="btn-load-template"
                style={[
                  s.pill,
                  {
                    borderColor: panel === 'load' ? c.primary : c.border,
                    backgroundColor: panel === 'load' ? c.primarySoft : c.surfaceAlt,
                  },
                ]}
              >
                <Text style={[s.pillText, { color: c.text }]} numberOfLines={1}>
                  {t('meetings.form.loadTemplate')}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {panel ? (
                <View style={[s.panel, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
                  {templates.length === 0 ? (
                    <Text style={[s.muted, { color: c.textMuted }]}>
                      {t('meetings.form.noSavedTemplates')}
                    </Text>
                  ) : (
                    templates.map((template) => (
                      <View key={template.id} style={s.tplRow}>
                        <View style={s.grow}>
                          <Text style={[s.tplName, { color: c.text }]} numberOfLines={1}>
                            {template.name}
                          </Text>
                          <Text style={[s.muted, { color: c.textMuted }]} numberOfLines={1}>
                            {t('meetings.form.minutes', { count: template.durationMinutes })} ·{' '}
                            {t(`meetings.recurrence.${template.recurrence}` as TranslationKey)}
                          </Text>
                        </View>
                        {panel === 'load' ? (
                          <SmallButton
                            label={t('meetings.useTemplate')}
                            tone="primary"
                            onPress={() => applyTemplate(template)}
                          />
                        ) : (
                          <SmallButton
                            label={t('meetings.deleteTemplate')}
                            tone="danger"
                            onPress={() => removeTemplate.mutate(template.id)}
                          />
                        )}
                      </View>
                    ))
                  )}
                </View>
              ) : null}

              <Field
                label={`${t('meetings.form.meetingTitle')} *`}
                value={title}
                onChange={setTitle}
                placeholder={t('meetings.form.meetingTitle')}
                autoCapitalize="sentences"
              />

              <View style={s.group}>
                <Label text={t('meetings.form.meetingType')} />
                <View style={walletStyles.chips}>
                  {KINDS.map((k) => (
                    <Chip
                      key={k}
                      label={t(`meetings.form.type.${k}` as TranslationKey)}
                      on={kind === k}
                      onPress={() => setKind(k)}
                    />
                  ))}
                </View>
              </View>

              {kind === 'IN_PERSON' ? (
                <View style={s.group}>
                  <Label text={t('meetings.form.room')} />
                  {rooms.isLoading ? (
                    <ActivityIndicator color={c.primary} />
                  ) : (rooms.data ?? []).length === 0 ? (
                    <Text style={[s.muted, { color: c.textMuted }]}>{t('meetings.form.noRooms')}</Text>
                  ) : (
                    <View style={walletStyles.chips}>
                      {(rooms.data ?? []).map((room) => (
                        <Chip
                          key={room.id}
                          label={room.name}
                          on={roomId === room.id}
                          onPress={() => setRoomId(roomId === room.id ? null : room.id)}
                        />
                      ))}
                    </View>
                  )}
                  <Pressable onPress={goRooms} accessibilityRole="link" hitSlop={8} style={s.linkGap}>
                    <Text style={[s.link, { color: c.primary }]}>{t('meetings.form.manageRooms')}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={s.group}>
                <Label text={t('meetings.form.dateTime')} />
                <View style={s.dateGrid}>
                  <View style={s.dateCell}>
                    <DateTimeField
                      label={t('meetings.form.starts')}
                      value={starts}
                      onChange={changeStart}
                    />
                  </View>
                  <View style={s.dateCell}>
                    <DateTimeField
                      label={t('meetings.form.ends')}
                      value={ends}
                      onChange={setEnds}
                    />
                  </View>
                </View>
                <View style={[walletStyles.chips, s.durations]}>
                  {DURATIONS.map((d) => (
                    <Chip
                      key={d}
                      label={t('meetings.form.minutes', { count: d })}
                      on={minutes === d}
                      onPress={() => setEnds(new Date(starts.getTime() + d * 60_000))}
                    />
                  ))}
                </View>
                {!DURATIONS.includes(minutes) && minutes > 0 ? (
                  <Text style={[s.muted, { color: c.textMuted }]} testID="duration">
                    {t('meetings.form.minutes', { count: minutes })}
                  </Text>
                ) : null}
              </View>

              <TextArea
                label={t('meetings.form.agenda')}
                value={agenda}
                onChange={setAgenda}
                placeholder={t('meetings.form.agendaHint')}
              />
              <TextArea
                label={t('meetings.form.notes')}
                value={notes}
                onChange={setNotes}
                placeholder={t('meetings.form.notesHint')}
              />

              {/* Guests: chosen ones on top, then who you already deal with, then a box for anyone else. */}
              <View style={s.group}>
                <View style={s.inviteHead}>
                  <Label text={t('meetings.form.invite')} />
                  <Text style={[s.muted, { color: c.textMuted }]} testID="selected-count">
                    {t('meetings.form.selected', { count: guests.length })}
                  </Text>
                </View>

                {guests.length > 0 ? (
                  <View style={[walletStyles.chips, s.selected]}>
                    {guests.map((person) => (
                      <Pressable
                        key={person.id}
                        onPress={() => toggleGuest(person)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('meetings.form.remove')}: ${person.name}`}
                        testID={`guest-${person.publicId}`}
                        style={[s.guest, { backgroundColor: c.primarySoft, borderColor: c.primary }]}
                      >
                        <Text style={[s.guestText, { color: c.text }]}>
                          {person.name} · {person.publicId}  ✕
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {(contacts.data ?? []).filter((p) => !guests.some((g) => g.id === p.id)).length > 0 ? (
                  <View style={s.suggest}>
                    <Text style={[s.muted, { color: c.textMuted }]}>{t('meetings.form.suggestions')}</Text>
                    <View style={walletStyles.chips}>
                      {(contacts.data ?? [])
                        .filter((p) => !guests.some((g) => g.id === p.id))
                        .map((person) => (
                          <Chip
                            key={person.id}
                            label={person.name}
                            on={false}
                            onPress={() => toggleGuest(person)}
                          />
                        ))}
                    </View>
                  </View>
                ) : null}

                <View style={s.suggest}>
                  <Text style={[s.muted, { color: c.textMuted }]}>{t('meetings.form.addById')}</Text>
                  <View style={s.idRow}>
                    <TextInput
                      value={idText}
                      onChangeText={(v) => {
                        setIdText(v);
                        setIdError(null);
                      }}
                      onSubmitEditing={addById}
                      placeholder={t('meetings.form.idPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      accessibilityLabel={t('meetings.form.addById')}
                      testID="guest-id-input"
                      style={[
                        s.input,
                        s.grow,
                        { backgroundColor: c.fieldBg, borderColor: idError ? c.danger : c.border, color: c.text },
                      ]}
                    />
                    <Pressable
                      onPress={addById}
                      disabled={!idText.trim() || lookup.isPending}
                      accessibilityRole="button"
                      testID="guest-id-add"
                      style={({ pressed }) => [
                        s.addButton,
                        {
                          backgroundColor: pressed ? c.primaryPressed : c.primary,
                          opacity: !idText.trim() || lookup.isPending ? 0.5 : 1,
                        },
                      ]}
                    >
                      {lookup.isPending ? (
                        <ActivityIndicator color={c.primaryText} />
                      ) : (
                        <Text style={[s.addText, { color: c.primaryText }]}>{t('meetings.form.add')}</Text>
                      )}
                    </Pressable>
                  </View>
                  {idError ? <Text style={[s.fieldError, { color: c.danger }]}>{idError}</Text> : null}
                </View>
              </View>

              <View style={s.group}>
                <Label text={t('meetings.form.recurrence')} />
                <View style={walletStyles.chips}>
                  {RECURRENCES.map((r) => (
                    <Chip
                      key={r}
                      label={t(`meetings.recurrence.${r}` as TranslationKey)}
                      on={recurrence === r}
                      onPress={() => setRecurrence(r)}
                    />
                  ))}
                </View>
                {recurrence !== 'NONE' ? (
                  <View style={s.stepperRow}>
                    <Text style={[s.stepperLabel, { color: c.text }]}>
                      {t('meetings.form.occurrences')}
                    </Text>
                    <View style={s.stepper}>
                      <Step
                        label="−"
                        disabled={repeatCount <= 2}
                        onPress={() => setRepeatCount((n) => Math.max(2, n - 1))}
                      />
                      <Text style={[s.stepperValue, { color: c.text }]} testID="repeat-count">
                        {repeatCount}
                      </Text>
                      <Step
                        label="+"
                        disabled={repeatCount >= MEETING_LIMITS.maxOccurrences}
                        onPress={() => setRepeatCount((n) => Math.min(MEETING_LIMITS.maxOccurrences, n + 1))}
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={s.templateRow}>
                <Pressable
                  onPress={() => setSaveAsTemplate((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: saveAsTemplate }}
                  testID="save-template"
                  style={s.check}
                >
                  <View
                    style={[
                      s.box,
                      {
                        borderColor: saveAsTemplate ? c.primary : c.border,
                        backgroundColor: saveAsTemplate ? c.primary : c.fieldBg,
                      },
                    ]}
                  >
                    {saveAsTemplate ? <Text style={[s.tick, { color: c.primaryText }]}>✓</Text> : null}
                  </View>
                  <Text style={[s.checkText, { color: c.text }]}>{t('meetings.form.saveTemplate')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => togglePanel('manage')}
                  accessibilityRole="button"
                  hitSlop={8}
                  testID="btn-manage-templates"
                >
                  <Text style={[s.link, { color: c.primary }]}>
                    {t('meetings.form.manageTemplates', { count: templates.length })}
                  </Text>
                </Pressable>
              </View>

            </ScrollView>

            {error ? (
              <View
                style={[s.error, { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder }]}
                accessibilityLiveRegion="polite"
              >
                <Text style={[s.errorText, { color: c.danger }]} testID="form-error">
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={[s.footer, { borderTopColor: c.border }]}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                testID="btn-cancel"
                style={({ pressed }) => [
                  s.cancel,
                  { borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
                ]}
              >
                <Text style={[s.cancelText, { color: c.text }]}>{t('meetings.form.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={create.isPending}
                accessibilityRole="button"
                testID="btn-submit"
                style={({ pressed }) => [
                  s.submit,
                  {
                    backgroundColor: pressed ? c.primaryPressed : c.primary,
                    opacity: create.isPending ? 0.7 : 1,
                  },
                ]}
              >
                {create.isPending ? (
                  <ActivityIndicator color={c.primaryText} />
                ) : (
                  <Text style={[s.submitText, { color: c.primaryText }]}>{t('meetings.form.submit')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.group}>
      <Label text={label} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        maxLength={2000}
        accessibilityLabel={label}
        style={[s.input, s.area, { backgroundColor: c.fieldBg, borderColor: c.border, color: c.text }]}
      />
    </View>
  );
}

function SmallButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'danger';
  onPress: () => void;
}) {
  const { c } = useTheme();
  const colour = tone === 'primary' ? c.primary : c.danger;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[s.small, { borderColor: colour }]}
    >
      <Text style={[s.smallText, { color: colour }]}>{label}</Text>
    </Pressable>
  );
}

function Step({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.step, { borderColor: c.border, backgroundColor: c.surfaceAlt, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[s.stepText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // The same dimming the app's other sheets use.
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.55)', alignItems: 'center' },
  kav: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetWide: { maxWidth: 620, borderRadius: radius.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1 },
  heading: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: font.xs + 1, lineHeight: 18, marginTop: 2 },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 150,
  },
  pillText: { fontSize: font.xs, fontWeight: '700' },
  scroll: { flexShrink: 1 },
  body: { padding: space.md, paddingBottom: space.lg },
  group: { marginBottom: 16 },
  grow: { flex: 1 },
  muted: { fontSize: font.xs, lineHeight: 17 },
  link: { fontSize: font.xs + 1, fontWeight: '800' },
  linkGap: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: font.md,
  },
  area: { minHeight: 84 },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Side by side where there is room, one above the other on a phone.
  dateCell: { flexGrow: 1, flexBasis: 230 },
  durations: { marginTop: 10 },
  inviteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { marginBottom: 8 },
  guest: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  guestText: { fontSize: font.xs + 1, fontWeight: '700' },
  suggest: { marginTop: 8, gap: 6 },
  idRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  addButton: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  addText: { fontSize: font.sm, fontWeight: '800' },
  fieldError: { fontSize: font.xs, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  stepperLabel: { flex: 1, fontSize: font.sm, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: font.lg, fontWeight: '800', lineHeight: 22 },
  stepperValue: { minWidth: 26, textAlign: 'center', fontSize: font.md, fontWeight: '800' },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: 8,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 13, fontWeight: '900' },
  checkText: { fontSize: font.sm, fontWeight: '600', flexShrink: 1 },
  panel: { borderWidth: 1, borderRadius: radius.md, padding: space.sm + 2, marginBottom: 16, gap: 10 },
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tplName: { fontSize: font.sm, fontWeight: '800' },
  small: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  smallText: { fontSize: font.xs, fontWeight: '800' },
  error: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm + 2,
    marginHorizontal: space.md,
    marginTop: space.sm,
  },
  errorText: { fontSize: font.sm, fontWeight: '700', lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
  },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: font.md, fontWeight: '700' },
  submit: {
    flex: 2,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: font.md, fontWeight: '800' },
});
