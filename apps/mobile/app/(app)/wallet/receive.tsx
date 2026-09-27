import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { fetchWalletCode } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Card, MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

const QR_SIZE = 220;

/**
 * Your wallet, for someone else to scan.
 *
 * The QR is always drawn on white with dark modules whatever the theme is:
 * a scanner reads contrast, not taste, and an inverted code fails on plenty
 * of phone cameras.
 */
export default function ReceiveScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [copied, setCopied] = useState(false);

  const code = useQuery({ queryKey: ['wallet-code'], queryFn: fetchWalletCode });

  return (
    <MoneyScreen title={t('receive.title')} subtitle={t('receive.subtitle')}>
      {code.error ? <ErrorBanner message={errorMessage(code.error)} tone="onSurface" /> : null}

      <Card style={styles.card}>
        {code.data ? (
          <>
            <View style={styles.qr}>
              <QRCode value={code.data.payload} size={QR_SIZE} backgroundColor="#FFFFFF" color="#111120" />
            </View>

            {code.data.name ? (
              <Text style={[styles.name, { color: c.text }]}>{code.data.name}</Text>
            ) : null}

            <Text style={[styles.codeLabel, { color: c.textMuted }]}>{t('receive.code')}</Text>
            <Text style={[styles.code, { color: c.text }]} selectable>
              {code.data.code}
            </Text>

            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(code.data.code);
                setCopied(true);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.copy,
                {
                  borderColor: c.primarySoftBorder,
                  backgroundColor: pressed ? c.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[styles.copyText, { color: c.primary }]}>
                {copied ? t('receive.copied') : t('receive.copy')}
              </Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={c.primary} style={styles.loading} />
        )}
      </Card>

      <Text style={[styles.hint, { color: c.textMuted }]}>{t('receive.hint')}</Text>
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', marginTop: space.md, gap: space.xs },
  qr: { backgroundColor: '#FFFFFF', padding: space.md, borderRadius: radius.lg },
  name: { fontSize: font.lg, fontWeight: '800', marginTop: space.sm },
  codeLabel: { fontSize: font.xs, fontWeight: '700', marginTop: space.sm },
  code: { fontSize: font.xl, fontWeight: '800', letterSpacing: 1 },
  copy: {
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  copyText: { fontSize: font.sm, fontWeight: '800' },
  loading: { marginVertical: space.xl },
  hint: { fontSize: font.sm, lineHeight: 20, marginTop: space.md, textAlign: 'center' },
});
