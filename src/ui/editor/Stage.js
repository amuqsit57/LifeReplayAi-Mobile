import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GRADE_FILTER, TEXTURE_PREVIEW } from '../../lib/plan';
import { colors, spacing, type } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

// The renderer draws its title band 360px tall in a 1920 frame — a little under a
// fifth of the height. This is the same share of the preview.
const CAPTION = 62;

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
  waiting,
  hasSource,
  frameReady,
  onFirstFrame,
  player,
  entrance,
  height,
  onTogglePlay,
}) {
  // A video shot only takes the player once it has a file to play. Until then it
  // shows its own still — an empty player is a black rectangle, and a black
  // rectangle is indistinguishable from a broken one.
  const view = useRef(null);
  const isVideo = memory?.kind === 'video' && !!memory?.url && hasSource;
  const grade = GRADE_FILTER[clip?.grade] ?? null;
  const texture = TEXTURE_PREVIEW[clip?.texture] ?? null;
  // The grade and the texture's own lift, as one chain.
  const filter = texture?.filter ? [...(grade ?? []), ...texture.filter] : grade;

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
      {/* Never unmounted between shots. A VideoView builds its surface on
          mount, which takes longer than a two second shot allows — so the first
          video always missed its turn and only looked right on a second pass.

          nativeControls off because the stage has its own transport. */}
      {player ? (
        // Graded and transitioned like everything else now.
        //
        // Video used to be exempt from both because a SurfaceView is punched
        // through the view hierarchy rather than drawn in it, so a filter or an
        // animated parent turned it black. On a TextureView it composites like
        // any other view, so the grade applies to the picture and the shot
        // arrives the way its transition says it should.
        <Animated.View style={[styles.videoWrap, isVideo ? entering : null]}>
          <VideoView
            ref={view}
            player={player}
            style={[{ width: SCREEN_WIDTH, height }, filter ? { filter } : null]}
            contentFit="contain"
            nativeControls={false}
            surfaceType="textureView"
            // The only honest signal that this clip is actually on screen. A
            // player can be open, seeked and playing while the view has still
            // drawn nothing — which is what a short clip looked like.
            onFirstFrameRender={onFirstFrame}
          />
        </Animated.View>
      ) : null}

      {/* Stills sit over the player rather than instead of it, so the surface
          underneath is never torn down. Opaque, so nothing shows through. */}
      {!isVideo || !frameReady ? (
        <Animated.View style={[styles.fill, styles.clip, styles.stills, entering]}>
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
      ) : null}

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

      {texture?.grain ? (
        <Image
          source={require('../../../assets/grain.png')}
          style={[styles.fill, { opacity: texture.grain }]}
          contentFit="cover"
          // Tiled rather than stretched: a 128px plate blown up to the screen is
          // blur, not grain.
          contentPosition="top left"
          pointerEvents="none"
        />
      ) : null}
      {texture?.wash ? (
        <View pointerEvents="none" style={[styles.fill, { backgroundColor: texture.wash }]} />
      ) : null}

      {/* The title, where it will actually land.
          Mirrors what the renderer draws — a dimmed band, a short rule, and the
          words in caps with wide tracking — so a caption can be placed by
          looking rather than by rendering and checking. */}
      {clip?.caption ? (
        <View
          pointerEvents="none"
          style={[
            styles.caption,
            (clip.caption_at ?? 'bottom') === 'top' && { top: 0 },
            (clip.caption_at ?? 'bottom') === 'middle' && { top: '50%', marginTop: -CAPTION / 2 },
            (clip.caption_at ?? 'bottom') === 'bottom' && { bottom: 0 },
          ]}
        >
          <Text style={styles.captionRule}>—</Text>
          <Text style={styles.captionText} numberOfLines={2}>
            {clip.caption.toUpperCase()}
          </Text>
        </View>
      ) : null}

      {waiting ? (
        // Held, not stuck. The run-through has paused itself until this clip can
        // be shown; saying so is the difference between waiting and broken.
        <View style={styles.wait}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.waitText}>Skipping</Text>
        </View>
      ) : total ? (
        <>
          {/* Only while paused: it is a way to look closer at a shot, not
              something to reach past a playing picture. */}
          {isVideo && !playing ? (
            <Pressable
              style={styles.expand}
              hitSlop={8}
              onPress={() => view.current?.enterFullscreen?.()}
              accessibilityLabel="Full screen"
            >
              <Feather name="maximize" size={15} color="#fff" />
            </Pressable>
          ) : null}
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
        </>
      ) : null}

      {clip ? (
        <View style={styles.bar} pointerEvents="none">
          <Text style={styles.barText} numberOfLines={1}>
            Shot {index + 1} of {total} · {Number(clip.seconds).toFixed(1)}s
          </Text>
          <Text style={styles.barNote} numberOfLines={1}>
            {waiting
              ? 'No preview — still in the render'
              : isVideo
                ? 'Preview'
                : clip.texture && clip.texture !== 'none'
                  ? 'Preview'
                  : 'Preview'}
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
  // Opaque, because it covers a live player rather than replacing it.
  stills: { backgroundColor: '#0B0812' },
  videoWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CAPTION,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  // On a picture, so fixed white rather than a theme token.
  captionRule: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 17 },
  captionText: {
    ...type.label,
    color: '#fff',
    letterSpacing: 2.4,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { ...type.caption, color: colors.textMuted },

  wait: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waitText: { ...type.caption, color: 'rgba(255,255,255,0.8)' },
  expand: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,9,20,0.6)',
  },
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
