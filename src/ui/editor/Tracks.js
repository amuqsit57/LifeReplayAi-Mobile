import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MAX_SECONDS, MIN_SECONDS, transitionLabel } from '../../lib/plan';
import { colors, radius, spacing, type } from '../../theme';

// A shot is as wide as it is long. The reason to look at a timeline rather than
// a list is to see the shape of the film — where it lingers, where it hurries.
const BASE_WIDTH = 30;
export const PER_SECOND = 15;
const LANE = 58;
const JOIN = 24;
const GUTTER = 16;

export const widthFor = (seconds) =>
  BASE_WIDTH + Math.max(0, Number(seconds) || 0) * PER_SECOND;

/**
 * The tracks.
 *
 * Two lanes, the way an editor has them: the picture, and the sound under it.
 * A playhead runs across both while the edit plays, and the right edge of the
 * selected shot can be dragged to make it hold longer — which is how long is
 * decided in every editor, rather than by typing a number somewhere else.
 */
export default function Tracks({
  clips,
  byId,
  selected,
  playing,
  musicLabel,
  onSelect,
  onSelectJoin,
  onResize,
  onResizeEnd,
  onAdd,
  onOpenMusic,
}) {
  const scroller = useRef(null);
  const head = useRef(new Animated.Value(0)).current;

  // Where each shot begins, in pixels. Recomputed whenever a length changes so
  // the playhead and the auto-scroll never drift from what is drawn.
  const offsets = useMemo(() => {
    const out = [];
    let x = GUTTER;
    clips.forEach((clip, index) => {
      out.push(x);
      x += widthFor(clip.seconds) + (index < clips.length - 1 ? JOIN : 0);
    });
    return out;
  }, [clips]);

  const total = (offsets[clips.length - 1] ?? GUTTER) + widthFor(clips[clips.length - 1]?.seconds);

  // The playhead crosses the selected shot over its own duration, then the next
  // one takes over — the same handoff the stage makes.
  useEffect(() => {
    const start = offsets[selected];
    if (start == null) return undefined;

    const clip = clips[selected];
    const width = widthFor(clip?.seconds);
    head.setValue(start);

    if (!playing) return undefined;

    const run = Animated.timing(head, {
      toValue: start + width,
      duration: (Number(clip?.seconds) || 1) * 1000,
      easing: Easing.linear,
      // Left is not a transform, and animating translateX instead would need the
      // playhead laid out at zero and pushed — this is one thin view, so the JS
      // driver is not worth the extra indirection.
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [playing, selected, clips, offsets, head]);

  // Follow the playhead, and keep a newly selected shot on screen. Suppressed
  // while scrubbing: the scroll and the finger end up chasing each other.
  const scrubbing = useRef(false);
  useEffect(() => {
    if (scrubbing.current) return;
    const x = offsets[selected];
    if (x != null) scroller.current?.scrollTo({ x: Math.max(0, x - 96), animated: true });
  }, [selected, offsets]);

  // Dragging the playhead. Everything it reads lives in a ref, because the
  // responder is built once and the offsets change every time a shot is trimmed.
  const laneLeft = useRef(0);
  const scrollX = useRef(0);
  const scrub = useRef({ offsets, clips, onSelect, selected });
  scrub.current = { offsets, clips, onSelect, selected };

  const shotAt = (x) => {
    const { offsets: marks, clips: reel } = scrub.current;
    for (let i = reel.length - 1; i >= 0; i -= 1) {
      if (x >= marks[i]) return i;
    }
    return 0;
  };

  const headDrag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        scrubbing.current = true;
        Haptics.selectionAsync().catch(() => {});
      },
      onPanResponderMove: (_event, gesture) => {
        // moveX is screen space; the lane's own origin and its scroll offset are
        // what turn it back into a position on the timeline.
        const x = gesture.moveX - laneLeft.current + scrollX.current;
        head.setValue(Math.max(GUTTER, x));
        const index = shotAt(x);
        if (index !== scrub.current.selected) scrub.current.onSelect(index);
      },
      onPanResponderRelease: () => {
        scrubbing.current = false;
      },
      onPanResponderTerminate: () => {
        scrubbing.current = false;
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.canvas}
        scrollEnabled={!scrubbing.current}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollX.current = event.nativeEvent.contentOffset.x;
        }}
        onLayout={(event) => {
          // Screen position of the lane, so a finger's x can be turned back into
          // a position on the timeline.
          event.target?.measureInWindow?.((x) => {
            laneLeft.current = x;
          });
        }}
      >
        <View>
          {/* ------------------------------------------------ the picture */}
          <View style={styles.lane}>
            {clips.map((clip, index) => (
              <Shot
                key={`${clip.memory_id}-${index}`}
                clip={clip}
                memory={byId[clip.memory_id]}
                selected={index === selected}
                last={index === clips.length - 1}
                onSelect={() => onSelect(index)}
                onSelectJoin={() => onSelectJoin(index)}
                onResize={(seconds) => onResize(index, seconds)}
                onResizeEnd={onResizeEnd}
              />
            ))}

            <Pressable style={styles.add} onPress={onAdd}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>

          {/* -------------------------------------------------- the sound */}
          <Pressable
            style={[styles.music, { width: Math.max(total, 160) }]}
            onPress={onOpenMusic}
          >
            <Feather
              name={musicLabel === 'Silent' ? 'volume-x' : 'music'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.musicText} numberOfLines={1}>
              {musicLabel}
            </Text>
            <View style={styles.wave}>
              {/* Not a real waveform — the track is not decoded here. A steady
                  pattern says "sound runs under all of this" without pretending
                  to describe music nobody has analysed. */}
              {Array.from({ length: Math.max(6, Math.floor(total / 14)) }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    { height: 4 + ((i * 7) % 11) },
                    musicLabel === 'Silent' && { opacity: 0.3 },
                  ]}
                />
              ))}
            </View>
          </Pressable>

          {/* The playhead crosses both lanes, because it is one moment in time.
              Drag it to move through the edit — the knob is the handle, and it is
              deliberately larger than the line it draws. */}
          {clips.length ? (
            <Animated.View style={[styles.head, { left: head }]} {...headDrag.panHandlers}>
              <View style={styles.headGrab}>
                <View style={styles.headKnob} />
              </View>
              <View style={styles.headLine} />
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** One shot, with a handle on its out point. */
function Shot({ clip, memory, selected, last, onSelect, onSelectJoin, onResize, onResizeEnd }) {
  const width = widthFor(clip.seconds);

  // The responder is built once, so anything it reads has to come from a ref.
  // Closing over the props directly meant the second drag measured from the
  // length the shot had on first render — which is why stretching twice snapped
  // back to where the first stretch began.
  const now = useRef({ seconds: clip.seconds, onResize, onResizeEnd, onSelect });
  now.current = { seconds: clip.seconds, onResize, onResizeEnd, onSelect };
  const start = useRef(1);

  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 2,
      // The lane scrolls horizontally, so without this the ScrollView takes the
      // gesture the instant a finger moves and the handle never drags.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        Haptics.selectionAsync().catch(() => {});
        start.current = Number(now.current.seconds) || 1;
        now.current.onSelect();
      },
      onPanResponderMove: (_event, gesture) => {
        const next = start.current + gesture.dx / PER_SECOND;
        now.current.onResize(
          Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(next * 10) / 10))
        );
      },
      onPanResponderRelease: () => now.current.onResizeEnd?.(),
      onPanResponderTerminate: () => now.current.onResizeEnd?.(),
    })
  ).current;

  return (
    <View style={styles.unit}>
      <Pressable onPress={onSelect} style={[styles.shot, { width }, selected && styles.shotOn]}>
        {memory?.thumbnail_url ? (
          <Image
            source={{ uri: memory.thumbnail_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={100}
            recyclingKey={clip.memory_id}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.shotEmpty]}>
            <Feather name="image" size={13} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.stamp}>
          <Text style={styles.stampText}>{Number(clip.seconds).toFixed(1)}s</Text>
        </View>

        {memory?.kind === 'video' ? (
          <View style={styles.kind}>
            <Feather name="video" size={9} color="#fff" />
          </View>
        ) : null}

        {/* Drag to hold longer. Only on the selected shot: a handle on every one
            turns the whole lane into a minefield of accidental trims. */}
        {selected ? (
          <View style={styles.handle} {...drag.panHandlers}>
            <View style={styles.handleGrip} />
          </View>
        ) : null}
      </Pressable>

      {!last ? (
        <Pressable
          style={styles.join}
          onPress={onSelectJoin}
          hitSlop={6}
          accessibilityLabel={`Transition after this shot: ${transitionLabel(clip.transition)}`}
        >
          <View style={[styles.joinPip, clip.transition === 'cut' && styles.joinCut]}>
            <Feather
              name={clip.transition === 'cut' ? 'minus' : 'more-horizontal'}
              size={11}
              color={clip.transition === 'cut' ? colors.textMuted : colors.primary}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceAlt, paddingVertical: spacing.sm },
  canvas: { paddingHorizontal: GUTTER, paddingRight: 80 },
  lane: { flexDirection: 'row', alignItems: 'center' },
  unit: { flexDirection: 'row', alignItems: 'center' },

  shot: {
    height: LANE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.mediaPlaceholder,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shotOn: { borderColor: colors.primary },
  shotEmpty: { alignItems: 'center', justifyContent: 'center' },

  stamp: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(12,9,20,0.66)',
    borderTopRightRadius: 5,
  },
  stampText: { ...type.tiny, fontSize: 9, color: '#fff' },
  kind: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(12,9,20,0.62)',
    borderRadius: radius.pill,
    padding: 3,
  },

  handle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,78,230,0.85)',
  },
  handleGrip: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#fff',
  },

  join: { width: JOIN, alignItems: 'center', justifyContent: 'center' },
  joinPip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  joinCut: { backgroundColor: colors.surfaceSunk },

  add: {
    height: LANE,
    width: 58,
    marginLeft: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { ...type.tiny, fontSize: 9.5, color: colors.primary },

  music: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  musicText: { ...type.tiny, fontSize: 10, color: colors.primary },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, overflow: 'hidden' },
  waveBar: { width: 2, borderRadius: 1, backgroundColor: colors.primary, opacity: 0.55 },

  // Wider than the line it draws so there is something to actually grab; the
  // line itself is centred inside it.
  head: {
    position: 'absolute',
    top: -8,
    bottom: -2,
    width: 34,
    marginLeft: -16,
    alignItems: 'center',
  },
  headGrab: { width: 34, height: 22, alignItems: 'center', justifyContent: 'center' },
  headLine: { flex: 1, width: 2, backgroundColor: colors.accent },
  headKnob: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
