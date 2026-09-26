import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  WALLET_LIMITS,
  formatTaka,
  type ResolvedWallet,
} from '@workflex/shared';
import { resolveWallet, sendTransfer } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import {
  Card,
  Field,
  MoneyInput,
  MoneyScreen,
  Notice,
} from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

function newRequestId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/**
 * Sending money to another account by scanning its QR.
 *
 * Three steps, in this order on purpose: read the code, show whose wallet it
 * is, then ask for an amount. Nobody should type a figure before they can see
 * the name it is going to — a QR is unreadable to a person, so the app has to
 * do the reading out loud.
 *
 * The camera is not the only way in: a number typed by hand resolves the same
 * way, which matters when a screen is cracked or a camera will not focus.
 */
export default function ScanScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [permission, requestPermission] = useCameraPermissions();
  const [payee, setPayee] = useState<ResolvedWallet | null>(null);
  const [typed, setTyped] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  // One scan at a time: the camera fires this continuously while a code is
  // in frame, and every extra call is another lookup for the same wallet.
  const scanning = useRef(false);

  const lookUp = useMutation({
    mutationFn: (code: string) => resolveWallet(code),
    onSuccess: setPayee,
    onSettled: () => {
      scanning.current = false;
    },
  });

  const value = Number.parseInt(amount || '0', 10);
  const inRange = value >= WALLET_LIMITS.paymentMin && value <= WALLET_LIMITS.transferMax;

  const send = useMutation({
    mutationFn: () =>
      sendTransfer({
        code: payee!.userId,
        amount: value,
        note: note.trim() || undefined,
        requestId: newRequestId(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
      router.replace('/(app)/wallet');
    },
  });

  // --- step 2 and 3: who it is going to, and how much ---
  if (payee) {
    return (
      <MoneyScreen
        title={t('scan.sendTitle')}
        footer={
          <ShimmerButton
            label={t('scan.send', { amount: inRange ? formatTaka(value) : '' })}
            onPress={() => send.mutate()}
            disabled={!inRange || send.isPending}
            loading={send.isPending}
          />
        }
      >
        <Card style={styles.payee}>
          <View style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
            <Text style={[styles.avatarText, { color: c.primary }]}>
              {payee.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.grow}>
            <Text style={[styles.payeeName, { color: c.text }]}>{payee.name}</Text>
            <Text style={[styles.payeeMeta, { color: c.textMuted }]}>
              {payee.phone} · {payee.code}
            </Text>
          </View>
          <Pressable onPress={() => setPayee(null)} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.change, { color: c.primary }]}>{t('scan.change')}</Text>
          </Pressable>
        </Card>

        <MoneyInput label={t('addMoney.amount')} value={amount} onChange={setAmount} />

        <Field
          label={t('scan.note')}
          value={note}
          onChange={setNote}
          placeholder={t('scan.notePlaceholder')}
          optional
          autoCapitalize="sentences"
        />

        {send.error ? <ErrorBanner message={errorMessage(send.error)} tone="onSurface" /> : null}

        <Notice tone="info" body={t('scan.instant')} />
      </MoneyScreen>
    );
  }

  // --- step 1: read a code, or take one typed by hand ---
  const canScan = Platform.OS !== 'web' && permission?.granted;

  return (
    <MoneyScreen title={t('scan.title')} subtitle={t('scan.subtitle')}>
      {canScan ? (
        <View style={[styles.viewfinder, { borderColor: c.border }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (scanning.current || lookUp.isPending) return;
              scanning.current = true;
              lookUp.mutate(data);
            }}
          />
          <View style={styles.reticle} pointerEvents="none">
            <View style={[styles.reticleBox, { borderColor: '#FFFFFF' }]} />
          </View>
        </View>
      ) : Platform.OS === 'web' ? (
        <Notice tone="info" body={t('scan.webFallback')} />
      ) : (
        <Card style={styles.permission}>
          <Text style={[styles.permissionText, { color: c.text }]}>{t('scan.permission')}</Text>
          <Pressable
            onPress={() => void requestPermission()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.permissionButton,
              { backgroundColor: pressed ? c.primaryPressed : c.primary },
            ]}
          >
            <Text style={[styles.permissionButtonText, { color: c.primaryText }]}>
              {t('scan.allowCamera')}
            </Text>
          </Pressable>
        </Card>
      )}

      {lookUp.isPending ? <ActivityIndicator color={c.primary} style={styles.loading} /> : null}
      {lookUp.error ? <ErrorBanner message={errorMessage(lookUp.error)} tone="onSurface" /> : null}

      <Text style={[styles.or, { color: c.textMuted }]}>{t('scan.or')}</Text>

      <Field
        label={t('scan.byNumber')}
        value={typed}
        onChange={setTyped}
        placeholder="01XXXXXXXXX"
        keyboardType="phone-pad"
      />
      <Pressable
        onPress={() => lookUp.mutate(typed.trim())}
        disabled={typed.trim().length < 6 || lookUp.isPending}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.lookUp,
          {
            borderColor: c.primarySoftBorder,
            backgroundColor: pressed ? c.primarySoft : 'transparent',
            opacity: typed.trim().length < 6 ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.lookUpText, { color: c.primary }]}>{t('scan.lookUp')}</Text>
      </Pressable>
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    height: 320,
    marginTop: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  reticle: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center' },
  reticleBox: { width: 200, height: 200, borderWidth: 2, borderRadius: radius.lg, opacity: 0.9 },

  permission: { marginTop: space.md, gap: space.sm, alignItems: 'flex-start' },
  permissionText: { fontSize: font.sm, lineHeight: 20 },
  permissionButton: { borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 10 },
  permissionButtonText: { fontSize: font.sm, fontWeight: '800' },

  loading: { marginTop: space.md },
  or: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4, marginTop: space.lg },

  lookUp: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
  },
  lookUpText: { fontSize: font.sm, fontWeight: '800' },

  payee: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.lg, fontWeight: '800' },
  grow: { flex: 1 },
  payeeName: { fontSize: font.md, fontWeight: '800' },
  payeeMeta: { fontSize: font.xs },
  change: { fontSize: font.sm, fontWeight: '800' },
});
