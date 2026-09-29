import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTaka, type WalletSummary } from '@workflex/shared';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * The balance, drawn as the object it describes: notes fanned out of the top
 * of a wallet, the wallet itself below them with a clasp on its right edge.
 *
 * Built from plain views rather than an illustration file — it has to hold
 * live text, re-colour with the theme, and stay sharp at any width, none of
 * which a bitmap does. The notes are three rotated slabs behind the body;
 * the fold across the wallet is a lighter panel, and the clasp is a ring
 * half-outside the right edge, which is what makes the silhouette read as a
 * wallet rather than a card.
 *
 * Orange because that is this product's accent. The reference is a stock
 * illustration in the same family of colours, so the shape carries over
 * without the app borrowing a second palette.
 */
export function BalanceCard({
  wallet,
  name,
  publicId,
  onLoadMoney,
}: {
  wallet: WalletSummary | undefined;
  name: string | null;
  publicId: string | null;
  onLoadMoney: () => void;
}) {
  const t = useT();
  const { c, isDark } = useTheme();

  const body: [string, string] = isDark
    ? ['#C2551F', '#93400F']
    : ['#F0873F', '#DE6B27'];

  return (
    <View style={s.wallet}>
      {/* The notes, fanned behind the wallet's mouth. */}
      <View style={s.notes} pointerEvents="none">
        <View style={[s.note, s.noteLeft, { backgroundColor: '#B8E39A' }]} />
        <View style={[s.note, s.noteRight, { backgroundColor: '#8FD97F' }]} />
        <View style={[s.note, s.noteMiddle, { backgroundColor: '#CDEBAF' }]} />
      </View>

      {/* The wallet body. */}
      <LinearGradient
        colors={body}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.body}
      >
        {/* The fold: a lighter panel across the face, where the balance sits. */}
        <View style={[s.fold, { backgroundColor: isDark ? '#D9752F' : '#F5A468' }]} />

        <Text style={s.name} numberOfLines={1}>
          {name ?? t('wallet.noName')}
        </Text>
        <Text style={s.publicId} numberOfLines={1}>
          {publicId ?? '—'}
        </Text>

        <View style={s.amountRow}>
          {wallet ? (
            <Text
              style={s.balance}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={`${t('wallet.balance')} ${formatTaka(wallet.balance)}`}
            >
              {formatTaka(wallet.balance)}
            </Text>
          ) : (
            <ActivityIndicator color="#FFFFFF" style={s.loading} />
          )}

          <Pressable
            onPress={onLoadMoney}
            accessibilityRole="button"
            accessibilityLabel={t('wallet.addMoney')}
            style={({ pressed }) => [s.loadMoney, pressed && s.loadMoneyPressed]}
          >
            <Text style={s.loadMoneyText}>{t('wallet.loadMoney')}</Text>
          </Pressable>
        </View>

        <View style={s.tiles}>
          <Tile
            tone="#2F7D57"
            wash="rgba(255,255,255,0.22)"
            icon="↓"
            label={t('wallet.income')}
            value={wallet ? formatTaka(wallet.income) : '—'}
          />
          <Tile
            tone="#8A4A12"
            wash="rgba(255,255,255,0.22)"
            icon="＋"
            label={t('wallet.toppedUp')}
            value={wallet ? formatTaka(wallet.toppedUp) : '—'}
          />
        </View>

        {/* The clasp, half outside the right edge. */}
        <View style={[s.clasp, { backgroundColor: body[1], borderColor: '#1F2338' }]}>
          <View style={[s.claspStud, { backgroundColor: '#FFD166' }]} />
        </View>
      </LinearGradient>
    </View>
  );
}

function Tile({
  tone,
  wash,
  icon,
  label,
  value,
}: {
  tone: string;
  wash: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[s.tile, { backgroundColor: wash }]}>
      <View style={[s.tileIcon, { backgroundColor: '#FFFFFF' }]}>
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

const NOTE_PEEK = 34;

const s = StyleSheet.create({
  wallet: { marginTop: space.md, paddingTop: NOTE_PEEK, paddingRight: 10 },

  notes: { position: 'absolute', left: 24, right: 34, top: 0, height: NOTE_PEEK + 24 },
  note: {
    position: 'absolute',
    top: 0,
    height: NOTE_PEEK + 30,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: '#2B3A2B',
  },
  noteLeft: { left: 0, width: '46%', transform: [{ rotate: '-7deg' }] },
  noteRight: { right: 0, width: '46%', transform: [{ rotate: '6deg' }] },
  noteMiddle: { left: '22%', width: '56%' },

  body: {
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: 2,
    // The wallet sits in front of the notes it holds.
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fold: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 10,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    opacity: 0.6,
  },

  name: { color: '#FFFFFF', fontSize: font.md, fontWeight: '700' },
  publicId: { color: 'rgba(255,255,255,0.85)', fontSize: font.sm, letterSpacing: 1.5 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.md,
  },
  balance: {
    flex: 1,
    color: '#FFFFFF',
    // One size down from the display face: a seven-figure balance beside the
    // Load money pill has to fit on a 360pt phone without being cut off, and
    // shrink-to-fit does not work on web.
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  loading: { alignSelf: 'flex-start', marginVertical: space.sm },

  loadMoney: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  loadMoneyPressed: { opacity: 0.85 },
  loadMoneyText: { color: '#C2551F', fontSize: font.sm, fontWeight: '800' },

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
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconText: { fontSize: font.xs, fontWeight: '800' },
  tileBody: { flex: 1 },
  tileLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  tileValue: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '800' },

  clasp: {
    position: 'absolute',
    right: -10,
    top: '52%',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claspStud: { width: 12, height: 12, borderRadius: radius.pill },
});
