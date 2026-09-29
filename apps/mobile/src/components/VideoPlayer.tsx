import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '../store/auth-store';
import { radius } from '../lib/theme';

/**
 * Plays a video the API serves, which means playing it with a token.
 *
 * Every file on this platform is behind an authenticated endpoint — a CV, an
 * NID photo, and now this — so a plain <video src> would get a 401. The
 * player is handed the same bearer token the rest of the app uses, and the
 * video never becomes a public URL that could be passed around.
 */
export function VideoPlayer({ url, height = 220 }: { url: string; height?: number }) {
  const token = useAuthStore((s) => s.accessToken);

  const player = useVideoPlayer(
    { uri: url, headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    (instance) => {
      instance.loop = false;
    },
  );

  return (
    <View style={[s.frame, { height }]}>
      <VideoView
        player={player}
        style={s.video}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginTop: 8,
  },
  video: { width: '100%', height: '100%' },
});
