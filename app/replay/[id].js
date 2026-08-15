import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { myProfile } from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import Comments from '../../src/ui/Comments';
import ErrorState from '../../src/ui/ErrorState';
import FilmCard from '../../src/ui/FilmCard';
import { RoundButton, ScreenHeader } from '../../src/ui/Header';
import { Shimmer } from '../../src/ui/Skeleton';

export default function ReplayScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // As big as the film can be while still fitting on the screen.
  //
  // The height was `width * 16 / 9` outright, which is exactly right on a tall
  // phone and taller than the whole display on a short one — on an SE the film
  // ran past the bottom edge and the shots, runtime and comments underneath
  // could only be reached by scrolling the picture off screen. Clamping the
  // height and taking the width back from it keeps the 9:16 exact, so there is
  // still nothing to letterbox: full bleed wherever it fits, scaled to fit
  // where it does not.
  //
  // Measured from the window rather than the module, so a rotation or a foldable
  // opening re-lays it out instead of keeping the size the app launched with.
  const room = windowHeight - insets.top - 104;
  const playerHeight = Math.min(Math.round((windowWidth * 16) / 9), room);
  const playerWidth = Math.round((playerHeight * 9) / 16);

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

  // A player carries on running when the screen stops being the one you are
  // looking at — navigating to the editor left the previous film playing, music
  // and all, underneath it.
  useFocusEffect(
    useCallback(
      () => () => {
        try {
          player.pause();
        } catch {
          // Already torn down; nothing to stop.
        }
      },
      [player]
    )
  );

  const ready = data?.status === 'succeeded' && data.url;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        compact
        title={
          <View>
            <Text style={styles.eyebrow}>
              {data?.is_edit ? 'Custom edit' : meta.label ?? 'Film'}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {plan.title ?? (data?.is_edit ? 'My edit' : 'Your film')}
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

      {/* The comment box is the last thing on this screen, so on a phone the
          keyboard opened straight over it — you typed into a field you could
          not see. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {replay.isError ? (
          <View style={styles.gutter}>
            <ErrorState
              title="Could not load this film"
              error={replay.error}
              onRetry={replay.refetch}
              retrying={replay.isFetching}
            />
          </View>
        ) : ready ? (
          // Full bleed, and sized to the film's own shape so `contain` has
          // nothing to letterbox. The bars were the 9:16 film sitting inside a
          // box that was neither its width nor its ratio.
          //
          // Still deliberately plain — no rounded corners, no elevation, nothing
          // laid over it. One of those was what blacked the picture out, and the
          // player is staying bare until it is worth finding out which.
          <VideoView
            player={player}
            style={[styles.player, { width: playerWidth, height: playerHeight }]}
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
          <Shimmer style={[styles.playerSkeleton, { width: playerWidth, height: playerHeight }]} />
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
      </KeyboardAvoidingView>
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

  // The films are rendered 1080x1920 and the box is sized to that ratio exactly,
  // which is why there are no bars. Width and height come from the component,
  // where the window is known.
  player: { alignSelf: 'center', backgroundColor: '#000' },
  // The same footprint as the player, so nothing shifts when the film arrives.
  playerSkeleton: { alignSelf: 'center', borderRadius: 0 },

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
