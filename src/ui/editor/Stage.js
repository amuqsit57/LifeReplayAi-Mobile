import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { GRADE_FILTER } from '../../lib/plan';
import { colors, spacing, type } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * How each transition reads as a movement of the incoming shot.
 *
 * The renderer hands these to FFmpeg's xfade, which composites two decoded
 * streams. Nothing here can do that, so each one is reduced to the gesture it
 * makes — a blend, a push from one side, a flash through a colour — which is the
 * part you are choosing between anyway. Anything unrecognised blends, because a
 * blend is what every transition is a variation of.
 */
const ENTRANCE = {
  cut: 'none',
  fade_black: 'black',
  fade_white: 'white',
  fade_grays: 'white',
  zoom_in: 'zoom',
  circle_open: 'zoom',
  circle_close: 'zoom',
  circle_crop: 'zoom',
  rect_crop: 'zoom',
  radial: 'zoom',
  squeeze_h: 'zoom',
  squeeze_v: 'zoom',
  pixelize: 'zoom',
  slide_left: 'left',
  smooth_left: 'left',
  wipe_left: 'left',
  cover_left: 'left',
  reveal_left: 'left',
  slice: 'left',
  slide_right: 'right',
  smooth_right: 'right',
  wipe_right: 'right',
  wind: 'right',
  diagonal: 'right',
  wipe_diagonal: 'right',
  slide_up: 'up',
  smooth_up: 'up',
  wipe_up: 'up',
  cover_up: 'up',
  reveal_up: 'up',
  vert_open: 'up',
  vert_close: 'up',
  slide_down: 'down',
  wipe_down: 'down',
  horz_open: 'left',
};

/** Where a still starts and ends, as a scale and a drift. Mirrors app/effects.py. */
const MOVES = {
  static: null,
  push_in: { from: 1, to: 1.18 },
  push_in_slow: { from: 1, to: 1.1 },
  pull_out: { from: 1.18, to: 1 },
  pan_right: { from: 1.16, to: 1.16, x: [-0.06, 0.06] },
  pan_left: { from: 1.16, to: 1.16, x: [0.06, -0.06] },
  tilt_down: { from: 1.16, to: 1.16, y: [-0.06, 0.06] },
  tilt_up: { from: 1.16, to: 1.16, y: [0.06, -0.06] },
};

/**
 * The picture.
 *
 * Grades are drawn for real — React Native 0.81 on the New Architecture supports
 * the `filter` style prop, so grayscale is grayscale rather than grey paint laid
 * over the shot. Camera moves and transitions run as animations. What none of it
 * can do is grain, which needs the noise plate the renderer composites, and none
 * of it is pixel-exact against FFmpeg. It is close enough to choose by.
 */
export default function Stage({
  clip,
  memory,
  index,
  total,
  playing,
  player,
  videoStatus,
  entrance,
  height,
  onTogglePlay,
}) {
  const isVideo = memory?.kind === 'video' && !!memory?.url;
  const filter = GRADE_FILTER[clip?.grade] ?? null;

  // The camera move, and the way the shot arrives. Both native-driver friendly.
  const move = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(1)).current;

  const seconds = Number(clip?.seconds) || 2.5;
  const motion = clip?.motion ?? 'static';
  const shape = !isVideo ? MOVES[motion] : null;

  useEffect(() => {
    move.setValue(0);
    if (!playing || !shape) return undefined;

    const run = Animated.timing(move, {
      toValue: 1,
      duration: seconds * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [playing, index, shape, seconds, move]);

  useEffect(() => {
    const kind = ENTRANCE[entrance] ?? 'blend';
    if (!playing || kind === 'none') {
      enter.setValue(1);
      return undefined;
    }

    enter.setValue(0);
    const run = Animated.timing(enter, {
      toValue: 1,
      // Long enough to read as a transition, short enough not to eat a two
      // second shot. The renderer's own durations vary per transition.
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [index, playing, entrance, enter]);

  const kind = ENTRANCE[entrance] ?? 'blend';
  const slide = (from) => ({
    transform: [
      {
        [from === 'left' || from === 'right' ? 'translateX' : 'translateY']:
          enter.interpolate({
            inputRange: [0, 1],
            outputRange: [from === 'left' || from === 'up' ? -260 : 260, 0],
          }),
      },
    ],
  });

  const entering =
    kind === 'none'
      ? null
      : kind === 'blend'
        ? { opacity: enter }
        : kind === 'zoom'
          ? {
              opacity: enter,
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] }) },
              ],
            }
          : kind === 'black' || kind === 'white'
            ? null
            : slide(kind);

  const scale = shape
    ? move.interpolate({ inputRange: [0, 1], outputRange: [shape.from, shape.to] })
    : 1;
  const driftX = shape?.x
    ? move.interpolate({ inputRange: [0, 1], outputRange: shape.x.map((v) => v * 240) })
    : 0;
  const driftY = shape?.y
    ? move.interpolate({ inputRange: [0, 1], outputRange: shape.y.map((v) => v * 240) })
    : 0;

  return (
    <View style={[styles.stage, { height }]}>
      {isVideo ? (
        // Concrete width and height, no absolute positioning, no filter, no
        // transform, no animated parent, no clipping above it.
        //
        // This is the shape the replay screen uses, and that one has always
        // worked. An absolutely-filled player inside a parent that clips is what
        // blacked the picture out here — the same combination that blacked it out
        // once before. A video shot therefore plays clean and ungraded, and the
        // bar below says as much: wrong colours would be a worse lie than none.
        //
        // nativeControls off because the stage has its own transport; leaving it
        // on put a second play button on top of the first.
        <VideoView
          player={player}
          style={{ width: SCREEN_WIDTH, height }}
          contentFit="contain"
          nativeControls={false}
        />
      ) : (
        // Stills get the full treatment, and the clipping the camera move needs.
        <Animated.View style={[styles.fill, styles.clip, entering]}>
          <Animated.View
            style={[
              styles.fill,
              { transform: [{ scale }, { translateX: driftX }, { translateY: driftY }] },
            ]}
          >
            <View style={[styles.fill, filter ? { filter } : null]}>
              {memory?.thumbnail_url ? (
                <Image
                  source={{ uri: memory.thumbnail_url }}
                  style={styles.fill}
                  contentFit="contain"
                  transition={0}
                  recyclingKey={memory.id}
                />
              ) : (
                <View style={styles.empty}>
                  <Feather name="film" size={30} color={colors.textMuted} />
                  <Text style={styles.emptyText}>
                    {total ? 'No preview for this shot' : 'Add your first shot below'}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* A transition through a colour is the colour clearing, not the shot
          arriving — so it is drawn over the top rather than applied to it. */}
      {!isVideo && (kind === 'black' || kind === 'white') ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              backgroundColor: kind === 'black' ? '#000' : '#fff',
              opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            },
          ]}
        />
      ) : null}

      {total ? (
        <Pressable
          style={styles.play}
          onPress={onTogglePlay}
          hitSlop={10}
          accessibilityLabel={playing ? 'Pause' : 'Play the edit from here'}
        >
          <Feather
            name={playing ? 'pause' : 'play'}
            size={20}
            color={colors.text}
            style={playing ? null : { marginLeft: 2 }}
          />
        </Pressable>
      ) : null}

      {clip ? (
        <View style={styles.bar} pointerEvents="none">
          <Text style={styles.barText} numberOfLines={1}>
            Shot {index + 1} of {total} · {Number(clip.seconds).toFixed(1)}s
          </Text>
          <Text style={styles.barNote} numberOfLines={1}>
            {isVideo && videoStatus === 'error'
              ? 'This clip would not load — it will still be cut into the render'
              : isVideo && videoStatus === 'loading'
                ? 'Loading this clip…'
                : isVideo
                  ? 'Video plays ungraded here — the grade is applied when you render'
                  : clip.texture && clip.texture !== 'none'
                    ? 'Grain and bloom only appear in the render'
                    : 'Preview — the render is sharper than this'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Dark behind the picture: it is the one place in the app showing a frame
  // rather than a page, and a white surround changes how a grade reads.
  // No `overflow: hidden` here. The camera move needs clipping, but putting it
  // on the parent of the video surface is half of what blacked the picture out,
  // so it lives on the stills wrapper instead.
  stage: { backgroundColor: '#0B0812', justifyContent: 'center', alignItems: 'center' },
  fill: { ...StyleSheet.absoluteFillObject },
  clip: { overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { ...type.caption, color: colors.textMuted },

  play: {
    position: 'absolute',
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(12,9,20,0.6)',
  },
  // On a picture, so fixed white rather than a theme token.
  barText: { ...type.caption, color: 'rgba(255,255,255,0.9)' },
  barNote: { ...type.caption, fontSize: 11, color: 'rgba(255,255,255,0.55)' },
});
