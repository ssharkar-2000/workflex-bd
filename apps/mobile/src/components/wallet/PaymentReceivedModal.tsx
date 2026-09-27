import { useEffect, useState } from 'react';
import { AppState, Modal, Platform, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatTaka, receiptQuerySchema, type ReceiptQuery } from '@workflex/shared';
import { fetchReceipts } from '../../api/wallet';
import { useAuthStore } from '../../store/auth-store';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';

/** An account-scoped cursor survives restarts; equal timestamps use the payment id. */
export function PaymentReceivedModal() {
  const userId = useAuthStore((s) => s.user?.id);
  return userId ? <ReceiptInbox key={userId} userId={userId} /> : null;
}
function ReceiptInbox({userId}: {userId: string}) {
  const key = `workflex.receipts.${userId}`;
  const [cursor, setCursor] = useState<ReceiptQuery | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const t = useT();
  const {c} = useTheme();
  const client = useQueryClient();
  useEffect(() => {
    let mounted = true;
    const initial = {since: new Date().toISOString()};
    void (async () => {
      let next = initial;
      try {
        const raw = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
        const parsed = receiptQuerySchema.safeParse(raw ? JSON.parse(raw) : null);
        if (parsed.success) next = parsed.data;
        else if (Platform.OS === 'web') localStorage.setItem(key, JSON.stringify(next));
        else await SecureStore.setItemAsync(key, JSON.stringify(next));
      } catch {}
      if (mounted) setCursor(next);
    })();
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => {mounted = false; sub.remove();};
  }, [key]);
  const receipts = useQuery({queryKey: ['wallet-receipts', userId, cursor], queryFn: () => fetchReceipts(cursor!), enabled: cursor !== null && active, refetchInterval: 15000});
  const payment = receipts.data?.[0];
  useEffect(() => {
    if (!payment) return;
    void client.invalidateQueries({queryKey: ['wallet']});
    void client.invalidateQueries({queryKey: ['wallet-statement']});
  }, [payment?.id, client]);
  const dismiss = async () => {
    if (!payment) return;
    const next = {since: payment.receivedAt, afterId: payment.id};
    try {
      if (Platform.OS === 'web') localStorage.setItem(key, JSON.stringify(next));
      else await SecureStore.setItemAsync(key, JSON.stringify(next));
    } catch {}
    setCursor(next);
  };
  return <Modal visible={Boolean(payment)} transparent animationType="fade" onRequestClose={() => void dismiss()}>
    <View style={{flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <View accessibilityViewIsModal style={{padding: 24, borderRadius: 20, backgroundColor: c.surface, gap: 12}}>
        <Text style={{color: c.text, fontSize: 22, fontWeight: '700'}}>{t('received.title')}</Text>
        <Text style={{color: c.success, fontSize: 30}}>{formatTaka(payment?.amount ?? 0)}</Text>
        <Text style={{color: c.text}}>{t('received.from')}: {payment?.payerName}</Text>
        {payment?.jobTitle ? <Text style={{color: c.text}}>{payment.jobTitle}</Text> : null}
        {payment?.note ? <Text style={{color: c.textMuted}}>{payment.note}</Text> : null}
        <Text selectable style={{color: c.textMuted}}>{payment?.id}</Text>
        <Pressable accessibilityRole="button" onPress={() => void dismiss()} style={{padding: 14, borderRadius: 12, backgroundColor: c.primary}}>
          <Text style={{color: c.primaryText, textAlign: 'center'}}>{t('received.done')}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
