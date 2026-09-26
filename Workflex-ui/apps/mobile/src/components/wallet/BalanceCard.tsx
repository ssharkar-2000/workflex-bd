import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTaka, type WalletSummary } from '@workflex/shared';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * The hero of the wallet screen: who you are, what you have, and the two
 * figures that qualify it.
 *
 * A deep card on a light page, because the balance is the one number on this
 * screen that should be findable without reading anything — the contrast does
 * that work, not a larger font alone. The gradient runs in the brand's own
 * indigo rather than the teal of the reference design, so the wallet still
 * looks like the rest of the app.
 */
export function BalanceCard({
  wallet,
  name,
}: {
  wallet: WalletSummary | undefined;
  name: string | null;
}) {
  const t = useT();
  const { c, isDark } = useTheme();

  // Dark mode already has a dark page, so the card lifts off it instead of
  // sinking into it.
  const gradient: [string, string] = isDark
    ? ['#2A2550', '#1A1A2B']
    : ['#3A34A0', '#231F6B'];

  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
      <View style={s.top}>
        <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
          <Text style={s.avatarText}>{initials || '👤'}</Text>
        </View>
        <View style={s.who}>
          <Text style={s.welcome}>{t('wallet.welcome')}</Text>
          {name ? (
            <Text style={s.name} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={s.label}>{t('wallet.balance')}</Text>
      {wallet ? (
        <Text
          style={s.balance}
          accessibilityLabel={`${t('wallet.balance')} ${formatTaka(wallet.balance)}`}
        >
          {formatTaka(wallet.balance)}
        </Text>
      ) : (
        <ActivityIndicator color="#FFFFFF" style={s.loading} />
      )}

      <View style={s.tiles}>
        <Tile
          tone="#6BD1A0"
          icon="↓"
          label={t('wallet.withdrawable')}
          value={wallet ? formatTaka(wallet.withdrawable) : '—'}
        />
        <Tile
          tone={c.accent}
          icon="↑"
          label={t('wallet.beingWithdrawn')}
          value={wallet ? formatTaka(wallet.pendingWithdrawals) : '—'}
        />
      </View>
    </LinearGradient>
  );
}

function Tile({
  tone,
  icon,
  label,
  value,
}: {
  tone: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[s.tile, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
      <View style={[s.tileIcon, { borderColor: tone }]}>
        <Text style={[s.tileIconText, { color: tone }]}>{icon}</Text>
      </View>
      <View style={s.tileBody}>
        <Text style={s.tileLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.tileValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.xs,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '700' },
  who: { flex: 1 },
  welcome: { color: 'rgba(255,255,255,0.72)', fontSize: font.xs },
  name: { color: '#FFFFFF', fontSize: font.md, fontWeight: '600' },

  label: { color: 'rgba(255,255,255,0.72)', fontSize: font.xs, letterSpacing: 0.3 },
  balance: { color: '#FFFFFF', fontSize: font.display, fontWeight: '700', letterSpacing: -0.5 },
  loading: { alignSelf: 'flex-start', marginVertical: space.sm },

  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconText: { fontSize: font.sm, fontWeight: '700' },
  tileBody: { flex: 1 },
  tileLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11 },
  tileValue: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '700' },
});
