import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CvStatus } from '@workflex/shared';
import { removeIntro, uploadIntro } from '../api/cv';
import { ErrorBanner } from './ErrorBanner';
import { ShimmerButton } from './ShimmerButton';
import { VideoPlayer } from './VideoPlayer';
import { useErrorMessage } from '../lib/error-message';
import { useT } from '../i18n';
import { env } from '../lib/env';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

/** A minute, enforced where the video is made. */
const MAX_SECONDS = 60;

/**
 * The one-minute introduction, beside the CV.
 *
 * A recruiter with thirty applicants reads none of the CVs and watches two of
 * the videos, which is the whole argument for this: sixty seconds of somebody
 * speaking says things a text CV cannot, and it says them to people who would
 * never have read to the bottom of the page.
 *
 * The minute is capped at the camera rather than checked afterwards. Refusing
 * a two-minute video after the upload finishes wastes somebody's data and
 * their time; the picker simply stops recording at sixty seconds.
 */
export function IntroVideoCard({ status }: { status: CvStatus | null }) {
  const t = useT();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [watching, setWatching] = useState(false);

  const refresh = (next: CvStatus) => {
    queryClient.setQueryData(['cv'], next);
    void queryClient.invalidateQueries({ queryKey: ['cv'] });
  };

  const upload = useMutation({
    mutationFn: async (source: 'camera' | 'library') => {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['videos'],
        videoMaxDuration: MAX_SECONDS,
        quality: 0.7,
      };

      const picked =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (picked.canceled) return null;
      const asset = picked.assets[0];
      if (!asset) return null;

      return uploadIntro({
        uri: asset.uri,
        name: asset.fileName ?? 'intro.mp4',
        mimeType: asset.mimeType ?? 'video/mp4',
      });
    },
    onSuccess: (next) => next && refresh(next),
  });

  const remove = useMutation({
    mutationFn: removeIntro,
    onSuccess: (next) => {
      setWatching(false);
      refresh(next);
    },
  });

  const intro = status?.intro ?? null;

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.title, { color: c.text }]}>{t('intro.video.title')}</Text>
      <Text style={[s.body, { color: c.textMuted }]}>{t('intro.video.what')}</Text>

      {intro ? (
        <>
          <Text style={[s.have, { color: c.success }]}>
            {t('intro.video.have', {
              size: Math.max(1, Math.round(intro.sizeBytes / 100_000) / 10),
            })}
          </Text>

          {watching ? (
            <VideoPlayer url={`${env.apiUrl}/cv/intro`} />
          ) : (
            <Action label={t('intro.video.watch')} onPress={() => setWatching(true)} primary />
          )}

          <View style={s.row}>
            <Action
              label={t('intro.video.replace')}
              onPress={() => upload.mutate('camera')}
              busy={upload.isPending}
            />
            <Action
              label={t('intro.video.remove')}
              onPress={() => remove.mutate()}
              busy={remove.isPending}
              danger
            />
          </View>
        </>
      ) : (
        <>
          {/*
            A full-width button, the same shape as Upload CV above it. The
            two pills this replaced were findable only if you already knew
            the feature existed — somebody looking for "a button to upload
            the video", next to the button that uploads the CV, was looking
            for exactly this and not finding it.
          */}
          <View style={s.primaryRow}>
            <ShimmerButton
              label={t('intro.video.upload')}
              onPress={() => upload.mutate('library')}
              loading={upload.isPending}
            />
          </View>
          <Action
            label={t('intro.video.record')}
            onPress={() => upload.mutate('camera')}
            busy={upload.isPending}
          />
        </>
      )}

      {upload.error ? (
        <ErrorBanner message={errorMessage(upload.error)} tone="onSurface" />
      ) : null}
      {remove.error ? (
        <ErrorBanner message={errorMessage(remove.error)} tone="onSurface" />
      ) : null}

      <Text style={[s.note, { color: c.textMuted }]}>{t('intro.video.note')}</Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  busy,
  primary,
  danger,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const ink = danger ? c.danger : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.action,
        {
          borderColor: danger ? c.dangerBorder : primary ? c.primary : c.primarySoftBorder,
          backgroundColor: pressed || primary ? c.primarySoft : 'transparent',
          opacity: busy ? 0.6 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={ink} size="small" />
      ) : (
        <Text style={[s.actionText, { color: ink }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
    gap: space.xs,
  },
  title: { fontSize: font.md, fontWeight: '800' },
  body: { fontSize: font.sm, lineHeight: 20 },
  have: { fontSize: font.sm, fontWeight: '700' },
  primaryRow: { marginTop: space.sm, marginBottom: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  action: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    minWidth: 110,
    alignItems: 'center',
  },
  actionText: { fontSize: font.xs, fontWeight: '800' },
  note: { fontSize: font.xs, lineHeight: 16, marginTop: space.xs },
});
