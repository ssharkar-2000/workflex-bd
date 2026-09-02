import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AuthUser } from '@workflex/shared';
import { Avatar } from '../Avatar';
import { NotificationBell } from '../NotificationBell';
import { DashboardMenu } from '../DashboardMenu';
import { Greeting, ProfileStrengthBadge } from './DashboardSections';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * The dashboard's header: controls, then search, then the greeting.
 *
 * Three rows rather than the two the design sketched, because the sketch is a
 * desktop width. Fitting a menu, a wordmark, a search field, a bell and an
 * avatar on one line of a 375px phone leaves the search field about 90px wide
 * — a box too narrow to read its own placeholder. Search gets the full width
 * of its own row instead, which is also where every marketplace app on a phone
 * puts it.
 */
export function DashboardHeader({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const [query, setQuery] = useState('');

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  // Initials beat the last two digits of a phone number as a fallback, but an
  // account that has not registered yet has neither — hence the number.
  const initials = fullName
    ? fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : user.phone.slice(-2);

  /**
   * Search hands off to the jobs screen rather than filtering here.
   *
   * That screen already owns the query, the filters and the paging; a second
   * search that had to stay in step with it would be two sources of truth for
   * one question. Submitting empty still navigates — someone who taps search
   * and presses go wants the job list.
   */
  const submit = () => {
    const term = query.trim();
    router.push(
      term
        ? { pathname: '/(app)/jobs', params: { q: term } }
        : '/(app)/jobs',
    );
  };

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <DashboardMenu user={user} onSignOut={onSignOut} />

        <Text style={[styles.wordmark, { color: c.text }]} numberOfLines={1}>
          {t('app.name')}
        </Text>

        <View style={styles.spacer} />

        <ProfileStrengthBadge />
        <NotificationBell />

        <Pressable
          onPress={() => router.push('/(app)/profile')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.title')}
        >
          <Avatar
            hasPhoto={user.hasPhoto}
            initials={initials}
            size={36}
            // Re-fetches when the account's photo state flips, so a selfie
            // taken during verification shows up without a restart.
            version={String(user.hasPhoto)}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.search,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder={t('dash.searchHint')}
          placeholderTextColor={c.textMuted}
          style={[styles.searchInput, { color: c.text }]}
          accessibilityLabel={t('dash.searchHint')}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('jobs.clearSearch')}
          >
            <Text style={[styles.clear, { color: c.textMuted }]}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <Greeting name={user.firstName ?? user.phone} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wordmark: { fontSize: font.md, fontWeight: '800', letterSpacing: -0.3 },
  spacer: { flex: 1 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: font.sm, paddingVertical: 0 },
  clear: { fontSize: font.md, fontWeight: '700' },
});
