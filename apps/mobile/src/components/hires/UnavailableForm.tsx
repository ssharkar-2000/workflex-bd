import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  hireUnavailableReasonSchema,
  type AvailabilityChanged,
  type HireUnavailableReason,
  type ReviewRole,
} from '@workflex/shared';
import { markUnavailable } from '../../api/replacement';
import { useErrorMessage } from '../../lib/error-message';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

const REASONS = hireUnavailableReasonSchema.options;

/**
 * "This hired worker cannot do the job."
 *
 * One form for both sides: the employer saying it about someone who has
 * stopped turning up, and the worker saying it about themselves. It only asks
 * why — a short list, and an optional note — because whoever is saying it is
 * usually in a hurry, and the next step (choosing a replacement) is the
 * employer's, not this form's.
 *
 * The confirmation is inline rather than a system alert, which the web build
 * does not show.
 */
export function UnavailableForm({
  jobId,
  workerId,
  workerName,
  side,
  onCancel,
  onDone,
}: {
  jobId: string;
  /** The hired worker: the person's own id when the worker is the one speaking. */
  workerId: string;
  workerName: string;
  side: ReviewRole;
  onCancel: () => void;
  onDone: (result: AvailabilityChanged) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const client = useQueryClient();
  const [reason, setReason] = useState<HireUnavailableReason | null>(null);
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () =>
      markUnavailable(jobId, workerId, { reason: reason!, note: note.trim() || undefined }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['hires'] });
      void client.invalidateQueries({ queryKey: ['my-jobs'] });
      void client.invalidateQueries({ queryKey: ['replacement'] });
      onDone(result);
    },
  });

  return (
    <View
      style={[s.box, { borderColor: c.warningBorder, backgroundColor: c.warningSoft }]}
      testID="unavailable-form"
    >
      <Text style={[s.title, { color: c.text }]}>
        {side === 'RECRUITER'
          ? t('repl.formTitle', { name: workerName })
          : t('repl.formTitleSelf')}
      </Text>

      <View style={s.chips}>
        {REASONS.map((r) => {
          const on = reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`reason-${r}`}
              style={[
                s.chip,
                {
                  backgroundColor: on ? c.primarySoft : c.surface,
                  borderColor: on ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[s.chipText, { color: c.text }]}>
                {on ? '✓ ' : ''}
                {t(`repl.reason.${r}` as TranslationKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('repl.notePlaceholder')}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={t('repl.note')}
        maxLength={300}
        testID="unavailable-note"
        style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.fieldBg }]}
      />

      <Text style={[s.info, { color: c.textMuted }]}>
        {side === 'RECRUITER'
          ? t('repl.flagInfoEmployer', { name: workerName })
          : t('repl.flagInfoWorker')}
      </Text>

      {save.error ? <Text style={[s.error, { color: c.danger }]}>{errorMessage(save.error)}</Text> : null}

      <View style={s.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          style={[s.button, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Text style={[s.buttonText, { color: c.text }]}>{t('repl.confirmNo')}</Text>
        </Pressable>
        <Pressable
          onPress={() => reason && save.mutate()}
          disabled={!reason || save.isPending}
          accessibilityRole="button"
          testID="btn-confirm-unavailable"
          style={({ pressed }) => [
            s.button,
            {
              borderColor: c.primary,
              backgroundColor: pressed ? c.primaryPressed : c.primary,
              opacity: !reason ? 0.5 : 1,
            },
          ]}
        >
          {save.isPending ? (
            <ActivityIndicator color={c.primaryText} />
          ) : (
            <Text style={[s.buttonText, { color: c.primaryText }]}>{t('repl.confirmFlag')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space.sm + 2, marginTop: 12, gap: 8 },
  title: { fontSize: font.md, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: font.xs + 1, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: font.sm,
  },
  info: { fontSize: font.xs, lineHeight: 17 },
  error: { fontSize: font.sm },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  buttonText: { fontSize: font.sm, fontWeight: '800' },
});
