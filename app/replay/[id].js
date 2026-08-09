import { useQuery } from '@tanstack/react-query';
import { ResizeMode, Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { STYLE_META, colors, radius, spacing, type } from '../../src/theme';
import { Button, Card, Screen } from '../../src/ui';

export default function ReplayScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const video = useRef(null);

  const replay = useQuery({
    queryKey: ['replay', id],
    queryFn: () => api.replay(id),
    // Poll while the render is still in flight; stop once it settles either way.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 4000 : false;
    },
  });

  const data = replay.data;
  const meta = STYLE_META[data?.style] ?? {};
  const plan = data?.editing_plan ?? {};

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={[type.label, { color: colors.primary }]}>‹ Back</Text>
      </Pressable>

      <View>
        <Text style={[type.label, { color: meta.tint ?? colors.accent }]}>
          {meta.emoji} {meta.label?.toUpperCase() ?? 'REPLAY'}
        </Text>
        <Text style={[type.display, { color: colors.text, marginTop: 2 }]}>
          {plan.title ?? 'Your Replay'}
        </Text>
      </View>

      {data?.status === 'succeeded' && data.url ? (
        <>
          <Video
            ref={video}
            source={{ uri: data.url }}
            style={styles.player}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
          />
          <Button
            label="Share this Replay"
            icon="📤"
            onPress={() =>
              Share.share({ message: `Watch our Life Replay: ${data.url}` }).catch(() => {})
            }
          />
        </>
      ) : data?.status === 'failed' ? (
        <Card style={{ borderColor: colors.danger, gap: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: colors.danger }]}>Rendering failed</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            {data.error ?? 'Something went wrong while cutting the film.'}
          </Text>
        </Card>
      ) : (
        <Card style={styles.working}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[type.bodyStrong, { color: colors.text }]}>
            {data?.status === 'running' ? 'Cutting your film…' : 'Queued…'}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            AI is choosing the moments and rendering them. This takes a few minutes —
            you can leave and come back.
          </Text>
        </Card>
      )}

      {(plan.clips ?? []).length ? (
        <View>
          <Text style={[type.heading, { color: colors.text, marginBottom: spacing.md }]}>
            How AI cut it
          </Text>
          <Card padded={false} style={{ paddingVertical: spacing.xs }}>
            {plan.clips.map((clip, index) => (
              <View
                key={`${clip.memory_id}-${index}`}
                style={[styles.row, index < plan.clips.length - 1 && styles.divider]}
              >
                <Text style={[type.caption, { color: colors.textMuted, width: 26 }]}>
                  {index + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: colors.text }]}>
                    {clip.caption || clip.reason || 'Moment'}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>
                    {clip.seconds}s · {clip.transition}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: radius.md,
    backgroundColor: '#000',
  },
  working: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
