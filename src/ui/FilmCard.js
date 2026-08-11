import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { STYLE_META, colors, radius, shadow, spacing, type } from '../theme';

/** Roughly a second and a half of rendering per shot, measured on real films. */
const SECONDS_PER_SHOT = 1.6;

function remaining(replay, elapsed) {
  const shots = replay?.shot_count || 0;
  const progress = replay?.progress || 0;

  // Once there is real progress, the machine in front of us is a better guide
  // than any average — a slow phone-video-heavy event is nothing like a
  // photo-only one.
  if (progress > 0.05 && elapsed > 5) {
    const total = elapsed / progress;
    return Math.max(0, Math.round(total - elapsed));
  }
  if (shots) return Math.round(shots * SECONDS_PER_SHOT);
  return null;
}

function clock(seconds) {
  if (seconds == null) return null;
  if (seconds < 60) return `about ${Math.max(5, Math.round(seconds / 5) * 5)}s left`;
  return `about ${Math.ceil(seconds / 60)} min left`;
}

/**
 * One film style: not made, being made, or ready.
 *
 * The three states are deliberately different shapes rather than the same card
 * with different words. A film you have not made yet should look like an
 * invitation; one that is rendering should look like work in progress and say
 * what it is doing, because it takes minutes and a spinner for that long is
 * indistinguishable from something having hung.
 */
export default function FilmCard({ style, replay, onGenerate, onOpen }) {
  const meta = STYLE_META[style] ?? {};
  const status = replay?.status;
  const busy = status === 'queued' || status === 'running';
  const done = status === 'succeeded';
  const failed = status === 'failed';

  const [elapsed, setElapsed] = useState(0);
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => clearInterval(timer);
  }, [busy, replay?.id]);

  const progress = replay?.progress ?? 0;

  useEffect(() => {
    Animated.timing(width, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, width]);

  if (busy) {
    const left = clock(remaining(replay, elapsed));
    return (
      <View style={[styles.card, styles.cardBusy]}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: meta.tint }]} />
          <Text style={styles.label}>{meta.label}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.percent}>
            {progress > 0 ? `${Math.round(progress * 100)}%` : 'starting'}
          </Text>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: meta.tint ?? colors.primary,
                width: width.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['3%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.stage} numberOfLines={1}>
            {replay?.stage ?? (status === 'queued' ? 'Waiting to start' : 'Working')}
          </Text>
          <View style={{ flex: 1 }} />
          {left ? <Text style={styles.left}>{left}</Text> : null}
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.row}>
          <View style={[styles.iconRound, { backgroundColor: (meta.tint ?? colors.primary) + '1A' }]}>
            <Feather name="play" size={16} color={meta.tint ?? colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{meta.label}</Text>
            <Text style={styles.sub}>Ready to watch</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onGenerate}
      style={({ pressed }) => [styles.card, styles.cardIdle, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={[styles.iconRound, { backgroundColor: (meta.tint ?? colors.primary) + '1A' }]}>
          <Feather name="zap" size={16} color={meta.tint ?? colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{meta.label}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {failed ? 'Failed — tap to try again' : meta.blurb ?? 'Tap to make this film'}
          </Text>
        </View>
        <View style={[styles.makeChip, { backgroundColor: meta.tint ?? colors.primary }]}>
          <Text style={styles.makeChipText}>Make</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardIdle: { borderStyle: 'dashed', borderColor: colors.borderStrong },
  cardBusy: { borderColor: colors.primary + '44' },
  pressed: { opacity: 0.9 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconRound: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.bodyStrong, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted },

  makeChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  makeChipText: { ...type.tiny, color: '#fff' },

  percent: { ...type.label, color: colors.text, fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunk,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  stage: { ...type.caption, color: colors.textSoft, flexShrink: 1 },
  left: { ...type.caption, color: colors.textMuted },
});
