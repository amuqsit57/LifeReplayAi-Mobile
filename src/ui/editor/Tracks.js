import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MAX_SECONDS, MAX_VIDEO_SECONDS, MIN_SECONDS, transitionLabel } from '../../lib/plan';
import { colors, radius, spacing, type } from '../../theme';

// A shot is as wide as it is long. The reason to look at a timeline rather than
// a list is to see the shape of the film — where it lingers, where it hurries.
const BASE_WIDTH = 30;

// Pixels per second, and the zoom steps around it. A six minute clip at 15px/s is
// five thousand pixels of lane, so a timeline that only shows two second shots
// well is not a timeline.
export const PER_SECOND = 15;
const ZOOMS = [1.5, 3, 6, 15, 40, 90];
const LANE = 58;
const JOIN = 24;
const GUTTER = 16;
const SCREEN_WIDTH = Dimensions.get('window').width;

/** m:ss, which is how anyone reads a running time. */
const stamp = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export const widthFor = (seconds, scale = PER_SECOND) =>
  BASE_WIDTH + Math.max(0, Number(seconds) || 0) * scale;

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
  onTrimHead,
  onResizeEnd,
  onReorder,
  onAdd,
  onOpenMusic,
}) {
  const scroller = useRef(null);
  const head = useRef(new Animated.Value(0)).current;
  const [zoom, setZoom] = useState(PER_SECOND);
  // Fit the whole edit on screen the first time it is seen. Opening on a scale
  // that only shows the first few seconds of a six minute cut is not a view of
  // the film.
  const fitted = useRef(false);

  // Where each shot begins, in pixels. Recomputed whenever a length changes so
  // the playhead and the auto-scroll never drift from what is drawn.
  const offsets = useMemo(() => {
    const out = [];
    let x = GUTTER;
    clips.forEach((clip, index) => {
      out.push(x);
      x += widthFor(clip.seconds, zoom) + (index < clips.length - 1 ? JOIN : 0);
    });
    return out;
  }, [clips, zoom]);

  const total =
    (offsets[clips.length - 1] ?? GUTTER) + widthFor(clips[clips.length - 1]?.seconds, zoom);

  // Fit once, as soon as there is something to fit.
  useEffect(() => {
    if (fitted.current || !clips.length) return;
    const span = clips.reduce((sum, c) => sum + (Number(c.seconds) || 0), 0);
    if (!span) return;
    fitted.current = true;
    const room = SCREEN_WIDTH - GUTTER * 2 - clips.length * (BASE_WIDTH + JOIN);
    setZoom(Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], room / span)));
  }, [clips]);

  // The film's own clock, and how often to write a number on it — chosen so the
  // marks stay about eighty pixels apart at any zoom rather than crowding.
  const runtime = clips.reduce((sum, c) => sum + (Number(c.seconds) || 0), 0);
  const tickEvery =
    [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((n) => n * zoom >= 80) ?? 600;

  // The playhead crosses the selected shot over its own duration, then the next
  // one takes over — the same handoff the stage makes.
  useEffect(() => {
    const start = offsets[selected];
    if (start == null) return undefined;

    const clip = clips[selected];
    const width = widthFor(clip?.seconds, zoom);
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
  }, [playing, selected, clips, offsets, head, zoom]);

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

  // Pinch to zoom, tracked by hand. Two touches, the distance between them, and
  // the scale it was at when they landed — which is all a pinch is.
  const pinch = useRef({ from: 0, at: PER_SECOND });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const gaps = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onPanResponderGrant: (event) => {
        const [a, b] = event.nativeEvent.touches;
        if (!a || !b) return;
        pinch.current = { from: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY), at: zoomRef.current };
      },
      onPanResponderMove: (event) => {
        const [a, b] = event.nativeEvent.touches;
        if (!a || !b || !pinch.current.from) return;
        const now = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        const next = pinch.current.at * (now / pinch.current.from);
        setZoom(Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], next)));
      },
    })
  ).current;

  const onFit = () => {
    const span = clips.reduce((sum, c) => sum + (Number(c.seconds) || 0), 0) || 1;
    const room = SCREEN_WIDTH - GUTTER * 2 - clips.length * (BASE_WIDTH + JOIN);
    Haptics.selectionAsync().catch(() => {});
    setZoom(Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], room / span)));
  };

  const step = (by) => {
    const at = ZOOMS.indexOf(zoom);
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (at < 0 ? 3 : at) + by))];
    if (next !== zoom) {
      Haptics.selectionAsync().catch(() => {});
      setZoom(next);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.ruler}>
        <Text style={styles.rulerText}>
          {clips.length} {clips.length === 1 ? 'shot' : 'shots'} · {stamp(runtime)}
        </Text>
        <View style={styles.tools}>
          <Pressable onPress={onFit} hitSlop={8} style={styles.tool}>
            <Feather name="minimize-2" size={13} color={colors.textSoft} />
            <Text style={styles.toolText}>Fit</Text>
          </Pressable>
        </View>

        <View style={styles.zoom}>
          <Pressable onPress={() => step(-1)} hitSlop={8} style={styles.zoomBtn}>
            <Feather name="minus" size={14} color={colors.textSoft} />
          </Pressable>
          <Text style={styles.zoomText}>{zoom < 10 ? 'wide' : zoom > 30 ? 'close' : 'fit'}</Text>
          <Pressable onPress={() => step(1)} hitSlop={8} style={styles.zoomBtn}>
            <Feather name="plus" size={14} color={colors.textSoft} />
          </Pressable>
        </View>
      </View>

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
        <View {...gaps.panHandlers}>
          {/* ------------------------------------------- seconds, honestly */}
          <View style={[styles.ticks, { width: Math.max(total, 160) }]}>
            {Array.from({ length: Math.ceil(runtime / tickEvery) + 1 }).map((_, i) => {
              const at = i * tickEvery;
              return (
                <View key={at} style={[styles.tick, { left: GUTTER + at * zoom }]}>
                  <View style={styles.tickMark} />
                  <Text style={styles.tickText}>{stamp(at)}</Text>
                </View>
              );
            })}
          </View>

          {/* ------------------------------------------------ the picture */}
          <View style={styles.lane}>
            {clips.map((clip, index) => (
              <Shot
                key={`${clip.memory_id}-${index}`}
                clip={clip}
                memory={byId[clip.memory_id]}
                selected={index === selected}
                last={index === clips.length - 1}
                zoom={zoom}
                onSelect={() => onSelect(index)}
                onSelectJoin={() => onSelectJoin(index)}
                onResize={(seconds) => onResize(index, seconds)}
                onTrimHead={(startAt, seconds) => onTrimHead(index, startAt, seconds)}
                onResizeEnd={onResizeEnd}
                onDrag={(dx) => {
                  // One step per shot-width dragged, so a long shot does not need
                  // a longer drag to move one place.
                  const step = Math.round(dx / (widthFor(clip.seconds, zoom) + JOIN));
                  if (step) onReorder(index, index + step);
                }}
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
function Shot({
  clip, memory, selected, last, zoom,
  onSelect, onSelectJoin, onResize, onResizeEnd, onDrag, onTrimHead,
}) {
  // While a handle is held this shot draws itself from its own state, and the
  // plan is only told on release. Calling up on every move re-rendered the stage,
  // the inspector and every other shot for each pixel of a drag, which is what
  // made trimming feel like wading.
  const [live, setLive] = useState(null);
  const seconds = live?.seconds ?? Number(clip.seconds);
  const startAt = live?.start_at ?? Number(clip.start_at) ?? 0;
  const width = widthFor(seconds, zoom);

  const ceiling =
    memory?.kind === 'video'
      ? Math.max(MIN_SECONDS, Number(memory.duration_seconds) || MAX_VIDEO_SECONDS)
      : MAX_SECONDS;

  // The responder is built once, so anything it reads has to come from a ref.
  // Closing over the props directly meant the second drag measured from the
  // length the shot had on first render — which is why stretching twice snapped
  // back to where the first stretch began.
  const now = useRef({});
  now.current = {
    seconds: clip.seconds,
    start_at: clip.start_at,
    zoom,
    ceiling,
    onResize,
    onResizeEnd,
    onSelect,
    onDrag,
    onTrimHead,
    setLive,
    // The last value the drag produced, read once on release.
    livePeek: live,
  };
  const start = useRef(1);
  const began = useRef(0);

  // Hold, then slide, to move a shot. A plain drag would fight the lane's own
  // scrolling; the hold is what says this gesture is about one shot.
  const held = useRef(false);
  const holdTimer = useRef(null);
  const [holding, setHolding] = useState(false);

  const move = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => held.current,
      onPanResponderTerminationRequest: () => !held.current,
      onPanResponderGrant: () => {
        holdTimer.current = setTimeout(() => {
          held.current = true;
          setHolding(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          now.current.onSelect();
        }, 260);
      },
      onPanResponderMove: (_event, gesture) => {
        if (!held.current && Math.abs(gesture.dx) > 6) {
          clearTimeout(holdTimer.current);
        }
      },
      onPanResponderRelease: (_event, gesture) => {
        clearTimeout(holdTimer.current);
        if (held.current) now.current.onDrag?.(gesture.dx);
        else if (Math.abs(gesture.dx) < 6) now.current.onSelect();
        held.current = false;
        setHolding(false);
      },
      onPanResponderTerminate: () => {
        clearTimeout(holdTimer.current);
        held.current = false;
        setHolding(false);
      },
    })
  ).current;

  const canTrimHead = memory?.kind === 'video';

  const head = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        Haptics.selectionAsync().catch(() => {});
        start.current = Number(now.current.seconds) || 1;
        began.current = Number(now.current.start_at) || 0;
        now.current.onSelect();
      },
      onPanResponderMove: (_event, gesture) => {
        const by = gesture.dx / now.current.zoom;
        // The out-point stays put, so what the head gives up the length loses.
        const at = Math.max(0, began.current + by);
        const length = start.current - (at - began.current);
        if (length < MIN_SECONDS) return;
        now.current.setLive({
          seconds: Math.round(length * 100) / 100,
          start_at: Math.round(at * 100) / 100,
        });
      },
      onPanResponderRelease: () => {
        const held = now.current;
        const value = held.livePeek;
        held.setLive(null);
        if (value?.start_at != null) held.onTrimHead(value.start_at, value.seconds);
        held.onResizeEnd?.();
      },
      onPanResponderTerminate: () => {
        now.current.setLive(null);
        now.current.onResizeEnd?.();
      },
    })
  ).current;

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
        const next = start.current + gesture.dx / now.current.zoom;
        const clamped = Math.min(
          now.current.ceiling,
          Math.max(MIN_SECONDS, Math.round(next * 10) / 10)
        );
        now.current.setLive({ seconds: clamped });
      },
      onPanResponderRelease: () => {
        const held = now.current;
        const value = held.livePeek?.seconds;
        held.setLive(null);
        if (value != null) held.onResize(value);
        held.onResizeEnd?.();
      },
      onPanResponderTerminate: () => {
        now.current.setLive(null);
        now.current.onResizeEnd?.();
      },
    })
  ).current;

  return (
    <View style={styles.unit}>
      <View
        {...move.panHandlers}
        style={[styles.shot, { width }, selected && styles.shotOn, holding && styles.shotHeld]}
      >
        {memory?.thumbnail_url ? (
          <Image
          cachePolicy="memory-disk"
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
          <Text style={styles.stampText}>{stamp(seconds)}</Text>
        </View>

        {memory?.kind === 'video' ? (
          <View style={styles.kind}>
            <Feather name="video" size={9} color="#fff" />
          </View>
        ) : null}

        {/* One handle per edge, on the selected shot only — a handle on every
            shot turns the lane into a minefield of accidental trims.

            The left one moves the in-point and holds the out-point still, which
            is what trimming the head of a shot means and the only workable way
            to trim a six minute clip. The right one changes the length. */}
        {live ? (
          <View style={styles.readout} pointerEvents="none">
            <Text style={styles.readoutText}>
              {canTrimHead
                ? `${stamp(startAt)} → ${stamp(startAt + seconds)}`
                : `${seconds.toFixed(1)}s`}
            </Text>
          </View>
        ) : null}

        {selected ? (
          <>
            {canTrimHead ? (
              <View style={[styles.handle, styles.handleLeft]} {...head.panHandlers}>
                <View style={styles.handleGrip} />
              </View>
            ) : null}
            <View style={styles.handle} {...drag.panHandlers}>
              <View style={styles.handleGrip} />
            </View>
          </>
        ) : null}
      </View>

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
  wrap: { backgroundColor: colors.surfaceAlt, paddingBottom: spacing.sm },
  ruler: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: 4,
  },
  rulerText: { ...type.tiny, fontSize: 10, color: colors.textMuted },
  ticks: { height: 18, marginBottom: 2 },
  tick: { position: 'absolute', alignItems: 'flex-start' },
  tickMark: { width: 1, height: 5, backgroundColor: colors.borderStrong },
  tickText: { ...type.tiny, fontSize: 9, color: colors.textMuted, marginTop: 1 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, justifyContent: 'center' },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolText: { ...type.tiny, fontSize: 10, color: colors.textSoft },
  zoom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  zoomBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  zoomText: { ...type.tiny, fontSize: 10, color: colors.textMuted, width: 34, textAlign: 'center' },
  canvas: { paddingHorizontal: GUTTER, paddingRight: 80 },
  lane: { flexDirection: 'row', alignItems: 'center', paddingTop: 20 },
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
  shotHeld: { opacity: 0.7, borderColor: colors.accent },
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

  // Wide enough to hit without magnifying the shot, and unmistakably a grip
  // rather than an edge that happens to be draggable.
  handle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderTopRightRadius: radius.sm - 2,
    borderBottomRightRadius: radius.sm - 2,
  },
  handleLeft: {
    left: 0,
    right: undefined,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radius.sm - 2,
    borderBottomLeftRadius: radius.sm - 2,
  },
  handleGrip: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  readout: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  readoutText: { ...type.tiny, fontSize: 10, color: '#fff', fontVariant: ['tabular-nums'] },

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
    width: 46,
    marginLeft: -22,
    alignItems: 'center',
  },
  headGrab: { width: 46, height: 28, alignItems: 'center', justifyContent: 'center' },
  headLine: { flex: 1, width: 2, backgroundColor: colors.accent },
  headKnob: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
