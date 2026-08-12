import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '../../src/lib/api';
import { myProfile } from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import Comments from '../../src/ui/Comments';
import FilmCard from '../../src/ui/FilmCard';
import { RoundButton, ScreenHeader } from '../../src/ui/Header';
import { Shimmer } from '../../src/ui/Skeleton';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

  // Open this cut in the editor. Seeded from the plan rather than starting
  // blank, so the model's edit is the first draft — which is what makes it worth
  // having generated one at all.
  const openInEditor = useMutation({
    mutationFn: () =>
      api.draft({
        event_id: replay.data.event_id,
        album_id: replay.data.album_id ?? null,
        style: replay.data.style,
        from_replay_id: id,
        title: `${replay.data.editing_plan?.title ?? 'This film'} — my edit`,
      }),
    onSuccess: (draft) => router.push(`/editor/${draft.id}`),
    onError: (problem) => Alert.alert('Could not open the editor', problem.message),
  });

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
            <View style={styles.headActions}>
              <RoundButton
                name={openInEditor.isPending ? 'loader' : 'edit-3'}
                label="Edit this cut"
                onPress={() => !openInEditor.isPending && openInEditor.mutate()}
              />
              <RoundButton
                name="share-2"
                label="Share"
                onPress={() =>
                  Share.share({ message: `Watch our Life Replay film: ${data.url}` }).catch(() => {})
                }
              />
            </View>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {ready ? (
          // Full bleed, and sized to the film's own shape so `contain` has
          // nothing to letterbox. The bars were the 9:16 film sitting inside a
          // box that was neither its width nor its ratio.
          //
          // Still deliberately plain — no rounded corners, no elevation, nothing
          // laid over it. One of those was what blacked the picture out, and the
          // player is staying bare until it is worth finding out which.
          <VideoView
            player={player}
            style={styles.player}
            contentFit="contain"
            nativeControls
          />
        ) : data?.status === 'failed' ? (
          <View style={styles.gutter}>
            <View style={[styles.card, { borderColor: colors.danger }]}>
              <Feather name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.cardTitle}>Could not make this film</Text>
              <Text style={styles.cardBody}>
                {data.error ?? 'Something went wrong while cutting it.'}
              </Text>
            </View>
          </View>
        ) : !data ? (
          // Nothing known yet. Falling through to the card below would have shown
          // its idle state — a "Make Highlights" offer — for the half second
          // before the finished film arrived, which is what was flashing up when
          // you opened a video from the feed.
          <Shimmer style={styles.playerSkeleton} />
        ) : (
          // The same card the event page uses, so a film being made looks the
          // same wherever you meet it — with the real stage and progress rather
          // than the word "Queued" and a spinner.
          <View style={styles.gutter}>
            <FilmCard style={data.style} replay={data} onGenerate={() => {}} />
            <Text style={styles.leaveHint}>
              You can leave this screen — it keeps going, and lands in the feed when it is done.
            </Text>
          </View>
        )}

        {ready ? (
          <View style={[styles.gutter, styles.facts]}>
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

        {ready ? (
          <View style={styles.gutter}>
            <Comments replayId={id} myId={me.data?.id} />
          </View>
        ) : null}
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
  headActions: { flexDirection: 'row', gap: spacing.sm },
  // No horizontal padding here: the player is full bleed, so the gutter is
  // applied by the sections that want it rather than to everything. The top
  // space keeps the title off the picture — they were touching.
  content: { paddingTop: spacing.sm, gap: spacing.xl, paddingBottom: spacing.xxxl },
  gutter: { paddingHorizontal: spacing.lg },

  eyebrow: { ...type.tiny, color: colors.primary, textTransform: 'uppercase' },
  title: { ...type.title, color: colors.text },

  // The films are rendered 1080x1920, so the height follows the screen width at
  // that ratio. Measured rather than guessed at, which is why there are no bars.
  player: {
    width: SCREEN_WIDTH,
    height: Math.round((SCREEN_WIDTH * 16) / 9),
    backgroundColor: '#000',
  },
  // The same footprint as the player, so nothing shifts when the film arrives.
  playerSkeleton: {
    width: SCREEN_WIDTH,
    height: Math.round((SCREEN_WIDTH * 16) / 9),
    borderRadius: 0,
  },

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
  leaveHint: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },

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
