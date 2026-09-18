import React, { useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  Pressable,
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
import { BackButton, Card, ErrorState, Loading, SectionHeader } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { Language } from '../i18n/translations';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type Setting = {
  key: string;
  value: string | number | boolean;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
  label: string;
  description: string | null;
};

type Group = { group: string; settings: Setting[] };

const GROUP_LABEL_KEY: Record<string, string> = {
  platform: 'settings.groupPlatform',
  payments: 'settings.groupPayments',
  security: 'settings.groupSecurity',
};

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    setting: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    settingHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    grow: { flex: 1 },
    input: {
      marginTop: spacing.sm,
      height: 42,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      ...text.body,
    },
    note: { ...text.micro, marginTop: spacing.lg },
    saveButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    saveButtonText: { ...text.label, color: colors.onPrimary, fontWeight: '700' },

    langRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    langOption: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    langOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    langOptionText: { ...text.label, color: colors.textBody },
    langOptionTextActive: { color: colors.onPrimary },
  });
}

export function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<Group[]>('/system/settings');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { colors, text, mode, toggleMode, categoryPalette } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const save = async (key: string, value: string) => {
    try {
      await api(`/system/settings/${key}`, { method: 'PATCH', body: { value } });
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('settings.couldNotSave'), friendlyError(e, t));
    }
  };

  const confirmAndSave = (key: string, value: string, label: string) => {
    RNAlert.alert(t('settings.confirmSaveTitle'), t('settings.confirmSaveBody', { setting: label }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.save'), onPress: () => save(key, value) },
    ]);
  };

  const languages: { value: Language; label: string }[] = [
    { value: 'en', label: t('settings.languageEnglish') },
    { value: 'bn', label: t('settings.languageBangla') },
  ];

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
      keyboardShouldPersistTaps="handled"
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('settings.title')}</Text>

      {/* Item 13 — dark mode toggle */}
      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'appearance').bg }}>
        <SectionHeader title={t('settings.appearance')} />
        <View style={s.setting}>
          <View style={s.settingHead}>
            <View style={s.grow}>
              <Text style={text.label}>{t('settings.darkMode')}</Text>
              <Text style={[text.micro, { marginTop: 2, lineHeight: 15 }]}>
                {t('settings.darkModeHint')}
              </Text>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={toggleMode}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>
      </Card>

      {/* Item 12 — language switcher */}
      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'language').bg }}>
        <SectionHeader title={t('settings.language')} />
        <Text style={text.micro}>{t('settings.languageHint')}</Text>
        <View style={s.langRow}>
          {languages.map((opt) => {
            const active = opt.value === language;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setLanguage(opt.value)}
                style={[s.langOption, active && s.langOptionActive]}
              >
                <Text style={[s.langOptionText, active && s.langOptionTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {data.map((group) => (
        <Card key={group.group} style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, group.group).bg }}>
          <SectionHeader title={GROUP_LABEL_KEY[group.group] ? t(GROUP_LABEL_KEY[group.group]) : group.group} />

          {group.settings.map((setting) => (
            <View key={setting.key} style={s.setting}>
              <View style={s.settingHead}>
                <View style={s.grow}>
                  <Text style={text.label}>{setting.label}</Text>
                  {setting.description ? (
                    <Text style={[text.micro, { marginTop: 2, lineHeight: 15 }]}>
                      {setting.description}
                    </Text>
                  ) : null}
                </View>

                {setting.valueType === 'BOOLEAN' ? (
                  <Switch
                    value={Boolean(setting.value)}
                    onValueChange={(next) => confirmAndSave(setting.key, String(next), setting.label)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                ) : null}
              </View>

              {setting.valueType !== 'BOOLEAN' ? (
                <>
                  <TextInput
                    value={drafts[setting.key] ?? String(setting.value)}
                    onChangeText={(v) => setDrafts((d) => ({ ...d, [setting.key]: v }))}
                    keyboardType={setting.valueType === 'NUMBER' ? 'number-pad' : 'default'}
                    style={s.input}
                    placeholderTextColor={colors.textLight}
                  />
                  {drafts[setting.key] !== undefined && drafts[setting.key] !== String(setting.value) ? (
                    <Pressable
                      onPress={() => confirmAndSave(setting.key, drafts[setting.key], setting.label)}
                      style={s.saveButton}
                    >
                      <Text style={s.saveButtonText}>{t('common.save')}</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
          ))}
        </Card>
      ))}

      <Text style={s.note}>{t('settings.note')}</Text>
    </ScrollView>
  );
}
