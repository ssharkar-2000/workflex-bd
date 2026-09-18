import React, { useState } from 'react';
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
import { useApi } from '../api/hooks';
import { Card, ErrorState, Loading, SectionHeader } from '../components';
import { colors, radii, spacing, text } from '../theme';

type Setting = {
  key: string;
  value: string | number | boolean;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
  label: string;
  description: string | null;
};

type Group = { group: string; settings: Setting[] };

const GROUP_LABEL: Record<string, string> = {
  platform: 'Platform',
  payments: 'Payments',
  security: 'Security',
};

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<Group[]>('/system/settings');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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
    } catch (e: any) {
      RNAlert.alert('Could not save', e.message);
    }
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={text.screenTitle}>Settings</Text>

      {data.map((group) => (
        <Card key={group.group} style={{ marginTop: spacing.lg }}>
          <SectionHeader title={GROUP_LABEL[group.group] ?? group.group} />

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
                    onValueChange={(next) => save(setting.key, String(next))}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                ) : null}
              </View>

              {setting.valueType !== 'BOOLEAN' ? (
                <TextInput
                  value={drafts[setting.key] ?? String(setting.value)}
                  onChangeText={(v) => setDrafts((d) => ({ ...d, [setting.key]: v }))}
                  onBlur={() => {
                    const draft = drafts[setting.key];
                    if (draft !== undefined && draft !== String(setting.value)) {
                      save(setting.key, draft);
                    }
                  }}
                  keyboardType={setting.valueType === 'NUMBER' ? 'number-pad' : 'default'}
                  style={s.input}
                />
              ) : null}
            </View>
          ))}
        </Card>
      ))}

      <Text style={s.note}>Changes save when you finish editing a field.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
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
});
