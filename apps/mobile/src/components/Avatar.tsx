import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { authHeaders } from '../api/client';
import { env } from '../lib/env';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

/**
 * The verification selfie, or initials while it loads / if there is none.
 *
 * Downloaded to the cache directory and rendered from a `file://` URI. Two
 * earlier approaches failed on device and are worth recording so nobody
 * reaches for them again:
 *
 *  - `<Image source={{ uri, headers }} />` — the native image loader owns the
 *    request and does not reliably forward the Authorization header under the
 *    New Architecture. The server answered 401 and Image failed silently,
 *    leaving an empty circle with no error anywhere.
 *  - `fetch()` then `response.blob()` — React Native warns that its Blob
 *    implementation is non-standard, and the read fails outright.
 *
 * A native download handles auth headers properly, writes straight to disk
 * instead of holding the image in memory, and hands back a URI that Image
 * loads without any of the above.
 */
export function Avatar({
  hasPhoto,
  initials,
  size = 50,
  /** Changes when the photo does, forcing a refetch past the cached copy. */
  version,
}: {
  hasPhoto: boolean;
  initials: string;
  size?: number;
  version?: string | number;
}) {
  const { c } = useTheme();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) {
      setUri(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const dir = new Directory(Paths.cache, 'avatar');
        if (!dir.exists) dir.create({ intermediates: true });

        // Written under a fresh name each time: overwriting in place leaves
        // Image showing the previous bytes from its own cache, which is
        // exactly the "photo does not update" bug this is meant to fix.
        const target = new File(dir, `me-${Date.now()}.jpg`);

        const file = await File.downloadFileAsync(
          `${env.apiUrl}/me/photo`,
          target,
          { headers: authHeaders() },
        );

        if (cancelled) {
          file.delete();
          return;
        }
        setUri(file.uri);
      } catch {
        // Falls through to initials — an avatar is never worth an error state.
        if (!cancelled) setUri(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPhoto, version]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          backgroundColor: c.tints[0],
          borderColor: c.tintBorders[0],
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <Text
          style={[
            styles.initials,
            { color: c.accentOnBrand, fontSize: size * 0.34 },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Android will not clip a child image to the rounded corner without this.
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  initials: { fontWeight: '700', fontSize: font.md },
});
