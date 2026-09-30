import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InterviewMode } from '@workflex/shared';
import { scheduleInterview } from '../../../src/api/interviews';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { GoogleMeetCard } from '../../../src/components/interviews/GoogleMeetCard';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { Field, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

const MODES: InterviewMode[] = ['VIDEO', 'PHONE', 'IN_PERSON'];
const DURATIONS = [15, 30, 45, 60];

/** Tomorrow, on the hour — the slot most invitations actually want. */
function defaultSlot(): { date: string; time: string } {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setMinutes(0, 0, 0);
  at.setHours(at.getHours() + 1);
  return {
    date: at.toISOString().slice(0, 10),
    time: at.toTimeString().slice(0, 5),
  };
}

/**
 * Inviting an applicant to an interview.
 *
 * Three kinds, and the form changes with the choice: an online meeting needs
 * nothing but a time, because this system hands out the room; a call needs a
 * time; a meeting in person needs an address, which is what a company
 * representative interviewing at an office actually has to give.
 *
 * Nothing is sent until the candidate is told, and what they get is a
 * message in the thread about this job, not a notification that vanishes.
 */
export default function ScheduleInterviewScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const { jobId, candidateId, candidateName } = useLocalSearchParams<{
    jobId?: string;
    candidateId?: string;
    candidateName?: string;
  }>();

  const slot = defaultSlot();
  const [mode, setMode] = useState<InterviewMode>('VIDEO');
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.time);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [notes, setNotes] = useState('');

  // Built from the two fields as the phone's own clock reads them, so
  // "3 pm" means three in the afternoon where the employer is standing.
  const scheduledAt = new Date(`${date}T${time}`);
  const validTime = !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now();
  const complete =
    Boolean(jobId && candidateId) &&
    validTime &&
    (mode !== 'IN_PERSON' || location.trim().length > 3);

  const invite = useMutation({
    mutationFn: () =>
      scheduleInterview({
        jobId: jobId!,
        candidateId: candidateId!,
        mode,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: duration,
        location: mode === 'IN_PERSON' ? location.trim() : undefined,
        interviewerName: interviewerName.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interviews'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      router.replace('/(app)/interviews');
    },
  });

  return (
    <MoneyScreen
      title={t('interviews.schedule')}
      subtitle={candidateName ? t('interviews.with', { name: candidateName }) : undefined}
      footer={
        <ShimmerButton
          label={t('interviews.send')}
          onPress={() => invite.mutate()}
          disabled={!complete || invite.isPending}
          loading={invite.isPending}
        />
      }
    >
      <Text style={[s.label, { color: c.textMuted }]}>{t('interviews.how')}</Text>
      <View style={s.modes}>
        {MODES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setMode(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === option }}
            style={[
              s.mode,
              {
                backgroundColor: mode === option ? c.primarySoft : c.surface,
                borderColor: mode === option ? c.primary : c.border,
              },
            ]}
          >
            <Text
              style={[s.modeText, { color: mode === option ? c.primary : c.text }]}
            >
              {t(`interviews.mode.${option}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.row}>
        <View style={s.grow}>
          <Field
            label={t('interviews.date')}
            value={date}
            onChange={setDate}
            placeholder="2026-09-27"
            autoCapitalize="none"
          />
        </View>
        <View style={s.grow}>
          <Field
            label={t('interviews.time')}
            value={time}
            onChange={setTime}
            placeholder="15:00"
            autoCapitalize="none"
          />
        </View>
      </View>

      <Text style={[s.label, { color: c.textMuted }]}>{t('interviews.duration')}</Text>
      <View style={s.durations}>
        {DURATIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setDuration(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: duration === option }}
            style={[
              s.duration,
              {
                backgroundColor: duration === option ? c.primarySoft : 'transparent',
                borderColor: duration === option ? c.primarySoftBorder : c.border,
              },
            ]}
          >
            <Text
              style={[
                s.durationText,
                { color: duration === option ? c.primary : c.textMuted },
              ]}
            >
              {t('interviews.minutes', { count: String(option) })}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'IN_PERSON' ? (
        <Field
          label={t('interviews.where')}
          value={location}
          onChange={setLocation}
          placeholder={t('interviews.wherePlaceholder')}
          autoCapitalize="sentences"
        />
      ) : null}

      <Field
        label={t('interviews.interviewer')}
        value={interviewerName}
        onChange={setInterviewerName}
        placeholder={t('interviews.interviewerPlaceholder')}
        optional
      />

      <Field
        label={t('interviews.notes')}
        value={notes}
        onChange={setNotes}
        placeholder={t('interviews.notesPlaceholder')}
        optional
        autoCapitalize="sentences"
      />

      {!validTime && date && time ? (
        <Notice tone="warning" body={t('interviews.pastTime')} />
      ) : null}

      {invite.error ? (
        <ErrorBanner message={errorMessage(invite.error)} tone="onSurface" />
      ) : null}

      <Notice
        tone="info"
        body={
          mode === 'VIDEO'
            ? t('interviews.onlineNote')
            : mode === 'PHONE'
              ? t('interviews.phoneNote')
              : t('interviews.inPersonNote')
        }
      />

      {/* Only for an online interview: this is the moment the choice between
          a Google Meet room and a Jitsi one is actually made. */}
      {mode === 'VIDEO' ? <GoogleMeetCard /> : null}
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  label: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4, marginTop: space.md },
  modes: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  mode: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md,
  },
  modeText: { fontSize: font.xs, fontWeight: '800', textAlign: 'center' },

  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  grow: { flex: 1 },

  durations: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, marginBottom: space.sm },
  duration: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  durationText: { fontSize: font.xs, fontWeight: '800' },
});
