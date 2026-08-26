import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchOnboardingStatus } from '../api/onboarding';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

/**
 * Shows where the application stands once it has been submitted.
 *
 * A rejection has to say what was wrong and offer the way back in — an
 * applicant who is told only "rejected" has no route forward and is lost.
 */
export function KycStatusCard() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const { data } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
  });

  if (!data) return null;

  if (data.kycStatus === 'PENDING_REVIEW') {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: c.warningSoft, borderColor: c.warningBorder },
        ]}
      >
        <Text style={[styles.title, { color: c.warning }]}>
          ⏳ {t('ob.pending.title')}
        </Text>
        <Text style={[styles.body, { color: c.text }]}>
          {t('ob.pending.body')}
        </Text>
      </View>
    );
  }

  if (data.kycStatus === 'REJECTED') {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
        ]}
      >
        <Text style={[styles.title, { color: c.danger }]}>
          ⚠ {t('ob.rejected.title')}
        </Text>
        {data.rejectReason ? (
          <Text style={[styles.body, { color: c.text }]}>
            {data.rejectReason}
          </Text>
        ) : null}
        <Pressable
          style={[styles.retry, { backgroundColor: c.danger }]}
          onPress={() => router.push('/(onboarding)/documents')}
        >
          <Text style={styles.retryText}>{t('ob.rejected.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    marginBottom: space.lg,
  },
  title: { fontWeight: '800', fontSize: font.sm, marginBottom: 4 },
  body: { fontSize: font.sm, lineHeight: 21, marginBottom: space.sm },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  // Sits on the danger fill in both modes, so it stays white.
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: font.sm },
});
