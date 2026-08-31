import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { DocumentAnalysis, DocumentKind } from '@workflex/shared';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';

const HINTS: Record<DocumentKind, TranslationKey> = {
  NID_FRONT: 'ob.doc.hintNid',
  NID_BACK: 'ob.doc.hintNid',
  SELFIE: 'ob.doc.hintSelfie',
  TIN_CERTIFICATE: 'ob.doc.hintBusiness',
  TRADE_LICENSE: 'ob.doc.hintBusiness',
};

const ICONS: Record<DocumentKind, string> = {
  NID_FRONT: '🪪',
  NID_BACK: '🔄',
  SELFIE: '🤳',
  TIN_CERTIFICATE: '🧾',
  TRADE_LICENSE: '📜',
};

export function DocumentTile({
  kind,
  uploaded,
  onPicked,
  uploading,
  analysis,
}: {
  kind: DocumentKind;
  uploaded: boolean;
  uploading: boolean;
  analysis?: DocumentAnalysis | null;
  onPicked: (file: { uri: string; name: string; type: string }) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [preview, setPreview] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setPreview(asset.uri);
    const name = asset.fileName ?? `${kind.toLowerCase()}.jpg`;
    onPicked({
      uri: asset.uri,
      name,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const fromCamera = async () => {
    setChoosing(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      // Shown on the tile rather than in a system dialog: `Alert.alert` is an
      // empty function on react-native-web, so a refusal announced that way
      // would be silent on the web build.
      setDenied(true);
      return;
    }
    setDenied(false);

    const result = await ImagePicker.launchCameraAsync({
      // The selfie is the one shot that must come from the front camera and
      // must not be cropped — a face check needs the whole frame.
      cameraType:
        kind === 'SELFIE'
          ? ImagePicker.CameraType.front
          : ImagePicker.CameraType.back,
      allowsEditing: kind !== 'SELFIE',
      quality: 0.75,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) handleAsset(result.assets[0]);
  };

  const fromGallery = async () => {
    setChoosing(false);
    setDenied(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: kind !== 'SELFIE',
      quality: 0.75,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) handleAsset(result.assets[0]);
  };

  /**
   * Offers camera or gallery.
   *
   * This used to call `Alert.alert` with two buttons. On react-native-web that
   * method is an empty function — not a dialog without buttons, but a complete
   * no-op — so on the web build every tile except the selfie did nothing at
   * all when tapped. An in-app sheet works on both platforms, and reads better
   * than a system dialog on either.
   */
  const choose = () => {
    // A selfie taken from the gallery proves nothing, so that path is not
    // offered for the face check.
    if (kind === 'SELFIE') {
      void fromCamera();
      return;
    }
    setChoosing(true);
  };

  return (
    <>
      <ChoiceSheet
        visible={choosing}
        title={t(`ob.doc.${kind}` as TranslationKey)}
        onCamera={() => void fromCamera()}
        onGallery={() => void fromGallery()}
        onCancel={() => setChoosing(false)}
      />

      <Pressable
        style={[styles.tile, uploaded && styles.tileDone]}
        onPress={choose}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={`${t(`ob.doc.${kind}` as TranslationKey)} — ${
          uploaded ? t('ob.doc.retake') : t('ob.doc.upload')
        }`}
      >
      <View style={styles.thumb}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.thumbImage} />
        ) : (
          <Text style={styles.icon}>{ICONS[kind]}</Text>
        )}
        {uploading ? (
          <View style={styles.thumbOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: c.textOnBrand }]}>
            {t(`ob.doc.${kind}` as TranslationKey)}
          </Text>
          {denied ? (
            <Text style={[styles.bad, { color: c.danger }]} numberOfLines={2}>
              {t('ob.doc.permission')}
            </Text>
          ) : uploaded && analysis ? (
            <AnalysisLine analysis={analysis} />
          ) : (
            <Text
              style={[styles.hint, { color: c.textMutedOnBrand }]}
              numberOfLines={2}
            >
              {t(HINTS[kind])}
            </Text>
          )}
        </View>

        <View style={[styles.action, uploaded && styles.actionDone]}>
          <Text
            style={[
              styles.actionText,
              { color: uploaded ? c.accentOnBrand : c.textOnBrand },
            ]}
          >
            {uploaded ? `✓ ${t('ob.doc.retake')}` : t('ob.doc.upload')}
          </Text>
        </View>
      </Pressable>
    </>
  );
}

/**
 * Camera or gallery, as an in-app sheet.
 *
 * Deliberately not `Alert.alert`: that is a no-op on react-native-web, which
 * is what made these tiles unresponsive on the web build in the first place.
 */
function ChoiceSheet({
  visible,
  title,
  onCamera,
  onGallery,
  onCancel,
}: {
  visible: boolean;
  title: string;
  onCamera: () => void;
  onGallery: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* Tapping the dimmed area closes, the way a system sheet does. */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Its own Pressable, so a tap on the sheet does not reach the
            backdrop behind it and close what the person just opened. */}
        <Pressable
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => undefined}
        >
          <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>

          <Pressable
            style={[styles.sheetRow, { borderColor: c.border }]}
            onPress={onCamera}
            accessibilityRole="button"
          >
            <Text style={styles.sheetIcon}>📷</Text>
            <Text style={[styles.sheetLabel, { color: c.text }]}>
              {t('ob.doc.camera')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.sheetRow, { borderColor: c.border }]}
            onPress={onGallery}
            accessibilityRole="button"
          >
            <Text style={styles.sheetIcon}>🖼️</Text>
            <Text style={[styles.sheetLabel, { color: c.text }]}>
              {t('ob.doc.gallery')}
            </Text>
          </Pressable>

          <Pressable
            style={styles.sheetCancel}
            onPress={onCancel}
            accessibilityRole="button"
          >
            <Text style={[styles.sheetCancelText, { color: c.textMuted }]}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * One line of plain-language feedback from the automated checks.
 *
 * The specific reason matters: "too blurry" tells someone what to do next,
 * where a bare "rejected" a day later tells them nothing and loses them.
 */
function AnalysisLine({ analysis }: { analysis: DocumentAnalysis }) {
  const t = useT();
  const { c } = useTheme();

  if (analysis.status === 'QUEUED' || analysis.status === 'RUNNING') {
    return (
      <Text style={[styles.checking, { color: c.textMutedOnBrand }]}>
        {t('ob.analysis.checking')}
      </Text>
    );
  }

  if (analysis.status === 'SKIPPED') {
    return (
      <Text style={[styles.hint, { color: c.textMutedOnBrand }]}>
        {t('ob.analysis.skipped')}
      </Text>
    );
  }

  const problems: string[] = [];
  if (analysis.sharpness !== null && analysis.sharpness < 0.18) {
    problems.push(t('ob.analysis.blurred'));
  }
  if (analysis.glare !== null && analysis.glare > 0.12) {
    problems.push(t('ob.analysis.glare'));
  }
  if (analysis.cardFound === false) problems.push(t('ob.analysis.noCard'));
  if (analysis.facesDetected === 0) problems.push(t('ob.analysis.noFace'));
  if (analysis.faceMatch !== null && analysis.faceMatch > 0.72) {
    problems.push(t('ob.analysis.faceMismatch'));
  }

  if (analysis.status === 'FAILED') {
    return (
      <Text style={[styles.bad, { color: c.danger }]} numberOfLines={2}>
        {problems.length > 0
          ? `${problems.join(' · ')} — ${t('ob.analysis.failed')}`
          : t('ob.analysis.failed')}
      </Text>
    );
  }

  if (analysis.status === 'NEEDS_REVIEW') {
    return (
      <Text style={[styles.warn, { color: c.warning }]} numberOfLines={2}>
        {problems.length > 0 ? problems.join(' · ') : t('ob.analysis.review')}
      </Text>
    );
  }

  const good =
    analysis.faceMatch !== null && analysis.faceMatch <= 0.6
      ? t('ob.analysis.faceMatch')
      : analysis.extractedNid
        ? t('ob.analysis.nidRead', { nid: analysis.extractedNid })
        : t('ob.analysis.passed');

  return (
    <Text style={[styles.good, { color: c.accentOnBrand }]} numberOfLines={2}>
      ✓ {good}
    </Text>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.24)',
    backgroundColor: 'rgba(128,128,128,0.10)',
    marginBottom: 10,
  },
  tileDone: {
    borderColor: 'rgba(44,124,69,0.5)',
    backgroundColor: 'rgba(44,124,69,0.12)',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  hint: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.10)',
  },
  actionDone: { backgroundColor: 'rgba(44,124,69,0.18)' },
  actionText: { fontSize: 11.5, fontWeight: '700' },
  checking: {
    fontSize: 11.5,
    marginTop: 2,
    fontStyle: 'italic',
  },
  good: { fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  warn: { fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  bad: { fontSize: 11.5, marginTop: 2, lineHeight: 15 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sheetIcon: { fontSize: 20 },
  sheetLabel: { fontSize: 15, fontWeight: '700' },
  sheetCancel: { alignItems: 'center', paddingVertical: 12 },
  sheetCancelText: { fontSize: 14, fontWeight: '700' },
});
