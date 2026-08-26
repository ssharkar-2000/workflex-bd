import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AccountType } from '@workflex/shared';
import { StepShell } from '../../src/components/onboarding/StepShell';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';

const OPTIONS: {
  type: AccountType;
  emoji: string;
  title: TranslationKey;
  body: TranslationKey;
  needs: TranslationKey;
}[] = [
  {
    type: 'INDIVIDUAL',
    emoji: '🧑',
    title: 'ob.type.individual',
    body: 'ob.type.individualBody',
    needs: 'ob.type.needIndividual',
  },
  {
    type: 'COMPANY',
    emoji: '🏢',
    title: 'ob.type.company',
    body: 'ob.type.companyBody',
    needs: 'ob.type.needCompany',
  },
];

export default function AccountTypeScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const [selected, setSelected] = useState<AccountType | null>(null);

  return (
    <StepShell
      step={1}
      total={4}
      title={t('ob.recruiterType.title')}
      subtitle={t('ob.recruiterType.subtitle')}
      footer={
        <ShimmerButton
          label={t('ob.continue')}
          disabled={!selected}
          onPress={() =>
            router.push({
              pathname: '/(onboarding)/details',
              params: { accountType: selected ?? 'INDIVIDUAL' },
            })
          }
        />
      }
    >
      {OPTIONS.map((option) => {
        const active = selected === option.type;
        return (
          <Pressable
            key={option.type}
            onPress={() => setSelected(option.type)}
            style={[
              styles.card,
              active && {
                borderColor: c.accentOnBrand,
                backgroundColor: c.glassHighlight,
              },
            ]}
          >
            <View style={styles.row}>
              <Text style={styles.emoji}>{option.emoji}</Text>
              <View style={styles.text}>
                <Text style={[styles.title, { color: c.textOnBrand }]}>{t(option.title)}</Text>
                <Text style={[styles.body, { color: c.textMutedOnBrand }]}>
                  {t(option.body)}
                </Text>
              </View>
              <View
                style={[
                  styles.radio,
                  active && { borderColor: c.accentOnBrand },
                ]}
              >
                {active ? (
                  <View
                    style={[
                      styles.radioDot,
                      { backgroundColor: c.accentOnBrand },
                    ]}
                  />
                ) : null}
              </View>
            </View>
            <View style={[styles.needs, active && styles.needsActive]}>
              <Text
                style={[
                  styles.needsText,
                  { color: c.textMutedOnBrand },
                  active && { color: c.accentOnBrand },
                ]}
              >
                {t(option.needs)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </StepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.24)',
    backgroundColor: 'rgba(128,128,128,0.10)',
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 26 },
  text: { flex: 1 },
  title: { fontSize: 15.5, fontWeight: '800' },
  body: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  needs: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(128,128,128,0.10)',
  },
  needsActive: { backgroundColor: 'rgba(44,124,69,0.14)' },
  needsText: { fontSize: 11.5, fontWeight: '600' },
});
