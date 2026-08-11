import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { myProfile } from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import Comments from '../../src/ui/Comments';
import { RoundButton, ScreenHeader } from '../../src/ui/Header';

export default function ReplayScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const replay = useQuery({
    queryKey: ['replay', id],
    queryFn: () => api.replay(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 4000 : false;
    },
  });

  const me = useQuery({ queryKey: ['myProfile'], queryFn: myProfile });

  const data = replay.data;
  const meta = STYLE_META[data?.style] ?? {};
  const plan = data?.editing_plan ?? {};

  // Starts on its own once the file is there. Opening a film and being shown a
  // still with no controls is the thing people read as "stuck".
  const player = useVideoPlayer(data?.url ?? null, (instance) => {
    instance.loop = true;
    instance.play();
  });

  const ready = data?.status === 'succeeded' && data.url;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        compact
        title={
          <View>
            <Text style={styles.eyebrow}>{meta.label ?? 'Film'}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {plan.title ?? 'Your film'}
            </Text>
          </View>
        }
        left={<RoundButton name="chevron-left" label="Back" onPress={() => router.back()} />}
        right={
          ready ? (
            <RoundButton
              name="share-2"
              label="Share"
              onPress={() =>
                Share.share({ message: `Watch our Life Replay film: ${data.url}` }).catch(() => {})
              }
            />
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {ready ? (
          // Deliberately plain: no rounded corners clipping it, no elevation, and
          // nothing laid over the top. Every one of those has been a cause of a
          // black picture with working sound on Android, so the player is being
          // kept bare until it is known to work, and styled back afterwards.
          <View style={styles.playerWrap}>
            <VideoView
              player={player}
              style={styles.player}
              contentFit="contain"
              nativeControls
            />
          </View>
        ) : data?.status === 'failed' ? (
          <View style={[styles.card, { borderColor: colors.danger }]}>
            <Feather name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.cardTitle}>Could not make this film</Text>
            <Text style={styles.cardBody}>
              {data.error ?? 'Something went wrong while cutting it.'}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.cardTitle}>
              {data?.status === 'running' ? 'Cutting your film…' : 'Queued…'}
            </Text>
            <Text style={styles.cardBody}>
              Choosing the moments and rendering them takes a few minutes. You can leave and come
              back.
            </Text>
          </View>
        )}

        {ready ? (
          <View style={styles.facts}>
            {plan.clips?.length ? (
              <Fact icon="scissors" label={`${plan.clips.length} shots`} />
            ) : null}
            {data.duration_seconds ? (
              <Fact
                icon="clock"
                label={`${Math.floor(data.duration_seconds / 60)}:${String(
                  Math.round(data.duration_seconds % 60)
                ).padStart(2, '0')}`}
              />
            ) : null}
            <Fact icon="music" label="Original score" />
          </View>
        ) : null}

        {ready ? <Comments replayId={id} myId={me.data?.id} /> : null}
      </ScrollView>
    </View>
  );
}

function Fact({ icon, label }) {
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={13} color={colors.textSoft} />
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },

  eyebrow: { ...type.tiny, color: colors.primary, textTransform: 'uppercase' },
  title: { ...type.title, color: colors.text },

  playerWrap: { backgroundColor: '#000' },
  player: { width: '100%', height: 460 },

  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...type.bodyStrong, color: colors.text },
  cardBody: { ...type.caption, color: colors.textMuted, textAlign: 'center' },

  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  factText: { ...type.caption, color: colors.textSoft },
});
