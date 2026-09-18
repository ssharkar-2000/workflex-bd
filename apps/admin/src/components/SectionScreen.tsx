import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ErrorState, Loading, Screen } from './ui';
import { errorText } from '../lib/error-message';
import { colors, font, space } from '../lib/theme';

/**
 * Every section beyond the tab bar has the same shape: a titled screen with a
 * Close back to the menu, one query, and the three states that query can be
 * in. Repeating that in twelve files was the alternative.
 */
export function SectionScreen<T>({
  title,
  subtitle,
  query,
  children,
}: {
  title: string;
  subtitle?: string;
  query: {
    data: T | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
    isRefetching?: boolean;
  };
  children: (data: T) => ReactNode;
}) {
  const router = useRouter();

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      right={
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      }
    >
      {query.isLoading ? (
        <Loading />
      ) : query.error || query.data === undefined ? (
        <ErrorState message={errorText(query.error)} onRetry={query.refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(query.isRefetching)}
              onRefresh={query.refetch}
              tintColor={colors.primary}
            />
          }
        >
          {children(query.data)}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { color: colors.primary, fontWeight: '800', fontSize: font.sm },
  body: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
});
