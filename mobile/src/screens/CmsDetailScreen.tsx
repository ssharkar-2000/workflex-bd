import React, { useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Button, Card, ErrorState, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type CmsBlock = {
  id: string;
  kind: 'BANNER' | 'PAGE' | 'FAQ';
  slug: string;
  title: string;
  titleBn: string | null;
  body: string | null;
  bodyBn: string | null;
  imageUrl: string | null;
  position: number;
  published: boolean;
};

const KINDS: CmsBlock['kind'][] = ['BANNER', 'PAGE', 'FAQ'];
type Styles = ReturnType<typeof createStyles>;

export function CmsDetailScreen({ route, navigation }: any) {
  const { id } = route.params ?? {};
  const isNew = !id;
  const insets = useSafeAreaInsets();
  const { colors, text } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const existing = useApi<CmsBlock>(isNew ? null : `/cms/${id}`, [id]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{
    kind: CmsBlock['kind'];
    slug: string;
    title: string;
    titleBn: string;
    body: string;
    bodyBn: string;
    imageUrl: string;
    position: string;
    published: boolean;
  } | null>(
    isNew
      ? {
          kind: 'PAGE',
          slug: '',
          title: '',
          titleBn: '',
          body: '',
          bodyBn: '',
          imageUrl: '',
          position: '0',
          published: false,
        }
      : null,
  );

  const data = existing.data;
  if (!isNew && !form && data) {
    setForm({
      kind: data.kind,
      slug: data.slug,
      title: data.title,
      titleBn: data.titleBn ?? '',
      body: data.body ?? '',
      bodyBn: data.bodyBn ?? '',
      imageUrl: data.imageUrl ?? '',
      position: String(data.position ?? 0),
      published: data.published,
    });
  }

  if (!isNew && existing.loading && !data) return <Loading />;
  if (!isNew && existing.error) return <ErrorState message={existing.error} onRetry={existing.refetch} />;
  if (!form) return null;

  const save = async () => {
    if (!form.title.trim() || (isNew && !form.slug.trim())) {
      RNAlert.alert(t('cmsDetail.missingDetailsTitle'), isNew ? t('cmsDetail.titleAndSlugRequired') : t('cmsDetail.titleRequired'));
      return;
    }
    const position = form.position.trim() === '' ? undefined : Number(form.position);
    if (position !== undefined && (!Number.isInteger(position) || position < 0)) {
      RNAlert.alert(t('cmsDetail.missingDetailsTitle'), t('cmsDetail.position'));
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        await api('/cms', {
          method: 'POST',
          body: {
            kind: form.kind,
            slug: form.slug.trim(),
            title: form.title,
            titleBn: form.titleBn || undefined,
            body: form.body || undefined,
            bodyBn: form.bodyBn || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
            position,
          },
        });
      } else {
        await api(`/cms/${id}`, {
          method: 'PATCH',
          body: {
            title: form.title,
            titleBn: form.titleBn || null,
            body: form.body || null,
            bodyBn: form.bodyBn || null,
            imageUrl: form.imageUrl.trim() || null,
            position,
            published: form.published,
          },
        });
      }
      navigation.goBack();
    } catch (e) {
      RNAlert.alert(t('cmsDetail.couldNotSave'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    RNAlert.alert(t('cmsDetail.deleteTitle'), t('cmsDetail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cmsDetail.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api(`/cms/${id}`, { method: 'DELETE' });
            navigation.goBack();
          } catch (e) {
            RNAlert.alert(t('cmsDetail.couldNotDelete'), friendlyError(e, t));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={text.screenTitle}>{isNew ? t('cmsDetail.newBlock') : t('cmsDetail.editContent')}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        {isNew ? (
          <>
            <View style={s.kindRow}>
              {KINDS.map((k) => (
                <Text
                  key={k}
                  onPress={() => setForm({ ...form, kind: k })}
                  style={[s.kindChip, form.kind === k && s.kindChipActive]}
                >
                  {k}
                </Text>
              ))}
            </View>
            <Field label={t('cmsDetail.slug')} value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} styles={s} colors={colors} />
          </>
        ) : null}
        <Field label={t('cmsDetail.titleEnglish')} value={form.title} onChange={(v) => setForm({ ...form, title: v })} styles={s} colors={colors} />
        <Field
          label={t('cmsDetail.titleBangla')}
          value={form.titleBn}
          onChange={(v) => setForm({ ...form, titleBn: v })}
          styles={s}
          colors={colors}
        />
        <Field
          label={t('cmsDetail.bodyEnglish')}
          value={form.body}
          onChange={(v) => setForm({ ...form, body: v })}
          multiline
          styles={s}
          colors={colors}
        />
        <Field
          label={t('cmsDetail.bodyBangla')}
          value={form.bodyBn}
          onChange={(v) => setForm({ ...form, bodyBn: v })}
          multiline
          styles={s}
          colors={colors}
        />
        <Field
          label={t('cmsDetail.imageUrl')}
          value={form.imageUrl}
          onChange={(v) => setForm({ ...form, imageUrl: v })}
          styles={s}
          colors={colors}
          hint={t('cmsDetail.imageUrlHint')}
          autoCapitalize="none"
        />
        <Field
          label={t('cmsDetail.position')}
          value={form.position}
          onChange={(v) => setForm({ ...form, position: v.replace(/[^0-9]/g, '') })}
          styles={s}
          colors={colors}
          hint={t('cmsDetail.positionHint')}
          numeric
        />
        {!isNew ? (
          <View style={s.publishRow}>
            <Text style={s.label}>{t('cmsDetail.published')}</Text>
            <Switch
              value={form.published}
              onValueChange={(v) => setForm({ ...form, published: v })}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        ) : null}
      </Card>

      <View style={s.actions}>
        {!isNew ? <Button label={t('cmsDetail.delete')} variant="danger" disabled={busy} onPress={remove} /> : null}
        <Button label={t('cmsDetail.save')} loading={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  numeric,
  hint,
  autoCapitalize,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  hint?: string;
  autoCapitalize?: 'none' | 'sentences';
  styles: Styles;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.textLight}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    field: { marginBottom: spacing.md },
    label: { ...text.label, marginBottom: spacing.xs },
    hint: { ...text.caption, color: colors.textLight, marginTop: spacing.xs },
    input: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...text.body,
    },
    multiline: { minHeight: 100, textAlignVertical: 'top' },
    kindRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    kindChip: {
      ...text.label,
      color: colors.textGray,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      overflow: 'hidden',
    },
    kindChipActive: { color: colors.onPrimary, backgroundColor: colors.primary, borderColor: colors.primary },
    publishRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  });
}
