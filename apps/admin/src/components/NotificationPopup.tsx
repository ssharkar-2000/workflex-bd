import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Notification } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { buildText, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

/**
 * Item 9 — "sms asar sate sate display er upore pop up asbe".
 *
 * Notifications already existed as a screen you had to go and open, so an
 * incoming support message was invisible until someone happened to look.
 * This mounts once above the whole navigator and polls the feed; anything
 * that arrives while the app is open slides in over whatever screen is
 * showing, and tapping it opens the Notifications list.
 *
 * Three decisions worth knowing:
 *
 * - **It polls rather than using push.** Push needs a notification service,
 *   device tokens and native config that this project does not have yet; a
 *   10-second poll delivers the same in-app behaviour with no new
 *   infrastructure, and the component is small enough to swap for a real
 *   socket/push handler later without touching any screen.
 * - **Nothing already seen can pop.** On the first poll after mount every
 *   existing id is recorded as seen, so opening the app never fires a burst
 *   of popups for old rows — only genuinely new ones do.
 * - **It queues.** Two messages landing in the same poll show one after the
 *   other instead of overwriting each other.
 */
const POLL_MS = 10_000;
const VISIBLE_MS = 5_000;

export function NotificationPopup() {
  const { admin } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, text } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);

  const [current, setCurrent] = useState<Notification | null>(null);
  const queue = useRef<Notification[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const slide = useRef(new Animated.Value(-160)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `showNext` and `dismiss` call each other (a dismissed popup shows the
  // next queued one; a shown popup auto-dismisses), so one of them has to be
  // reached through a ref rather than by name — otherwise they can't both be
  // defined before the other is referenced.
  const showNextRef = useRef<() => void>(() => {});

  const dismiss = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.timing(slide, {
      toValue: -160,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrent(null);
      // Give the exit animation room before the next one slides in.
      if (queue.current.length > 0) setTimeout(() => showNextRef.current(), 220);
    });
  }, [slide]);

  const showNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) return;
    setCurrent(next);
    Animated.timing(slide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    hideTimer.current = setTimeout(() => dismiss(), VISIBLE_MS);
  }, [slide, dismiss]);

  showNextRef.current = showNext;

  useEffect(() => {
    if (!admin) {
      // Signed out: drop anything pending so a popup can't survive a session
      // change and show one admin's message to the next.
      queue.current = [];
      seen.current = null;
      setCurrent(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const feed = await api<{ items: Notification[]; unread: number }>('/notifications');
        if (cancelled) return;

        if (seen.current === null) {
          // First pass after sign-in: everything here is history, not news.
          seen.current = new Set(feed.items.map((item) => item.id));
          return;
        }

        const fresh = feed.items.filter((item) => !seen.current!.has(item.id) && !item.read);
        for (const item of fresh) seen.current!.add(item.id);

        if (fresh.length > 0) {
          // Oldest first, so a burst reads in the order it happened.
          queue.current.push(...fresh.reverse());
          if (!current) showNext();
        }
      } catch {
        // A failed poll is not worth telling anyone about — the next tick
        // will pick the messages up, and the Notifications screen still
        // works. Silence here is deliberate.
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, current, showNext]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (!current) return null;

  const open = () => {
    dismiss();
    navigation.navigate('Notifications');
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[s.wrap, { paddingTop: insets.top + spacing.xs, transform: [{ translateY: slide }] }]}
    >
      <Pressable onPress={open} style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}>
        <View style={s.row}>
          <Text style={s.icon}>{ICONS[current.kind] ?? '🔔'}</Text>
          <View style={s.grow}>
            <Text style={s.title} numberOfLines={1}>
              {current.title}
            </Text>
            {current.body ? (
              <Text style={s.body} numberOfLines={2}>
                {current.body}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={dismiss} hitSlop={10}>
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
        <Text style={s.hint}>{t('popup.tapToOpen')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const ICONS: Record<string, string> = {
  SOS: '🆘',
  VERIFICATION: '✅',
  PAYMENT: '💳',
  FRAUD: '🛡️',
  JOB: '💼',
  MAINTENANCE: '🛠️',
};

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      zIndex: 999,
      elevation: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    grow: { flex: 1 },
    icon: { fontSize: 18 },
    title: { ...text.cardTitle, fontSize: 14 },
    body: { ...text.caption, marginTop: 2 },
    close: { fontSize: 14, color: colors.textLight, paddingHorizontal: 4 },
    hint: { ...text.micro, color: colors.primary, marginTop: spacing.xs },
  });
}
