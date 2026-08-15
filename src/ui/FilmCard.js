import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { STYLE_META, colors, radius, shadow, spacing, type } from '../theme';

/**
 * How long is left, measured rather than assumed.
 *
 * The first version multiplied a guessed seconds-per-shot, and divided total
 * elapsed by progress — both wrong. The constant was invented, and elapsed
 * counted from when the card appeared, so opening an event halfway through a
 * render made it think the whole thing had taken four seconds.
 *
 * This watches how fast progress actually moves while being looked at, which
 * needs no constant and is right whenever you arrive.
 */
function useRemaining(replay) {
  const first = useRef(null);
  const [, tick] = useState(0);
  const busy = replay?.status === 'queued' || replay?.status === 'running';
  const progress = replay?.progress ?? 0;

  useEffect(() => {
    if (!busy) {
      first.current = null;
      return undefined;
    }
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [busy, replay?.id]);

  if (!busy) return null;

  const now = Date.now();
  if (!first.current || first.current.id !== replay?.id) {
    first.current = { id: replay?.id, at: now, progress };
    return null;
  }

  const movedBy = progress - first.current.progress;
  const overSeconds = (now - first.current.at) / 1000;

  // Needs a real change to divide by; before that, saying nothing beats guessing.
  if (movedBy <= 0.01 || overSeconds < 4) return null;

  const rate = movedBy / overSeconds;
  return Math.max(0, Math.round((1 - progress) / rate));
}

function clock(seconds) {
  if (seconds == null) return null;
  if (seconds < 45) return 'nearly there';
  if (seconds < 90) return 'about a minute left';
  return `about ${Math.round(seconds / 60)} min left`;
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
  // An edit is called what its author called it. Showing the style name made a
  // custom cut announce itself as "Highlights", which is not what they made.
  const name = replay?.is_edit ? replay.title || 'My edit' : meta.label;
  const status = replay?.status;
  const busy = status === 'queued' || status === 'running';
  const done = status === 'succeeded';
  const failed = status === 'failed';

  const width = useRef(new Animated.Value(0)).current;
  const left = clock(useRemaining(replay));
  const progress = replay?.progress ?? 0;

  useEffect(() => {
    Animated.timing(width, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, width]);

  if (busy) {
    return (
      <View style={[styles.card, styles.cardBusy]}>
        <View style={styles.row}>
          <ActivityIndicator size="small" color={meta.tint ?? colors.primary} />
          {/* The title takes what is left and truncates. A spacer between them
              let a long name — and a custom edit's name is a sentence — push the
              percentage off the edge of the card. */}
          <Text style={[styles.label, styles.grow]} numberOfLines={1}>
            {name}
          </Text>
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
          <Text style={[styles.stage, styles.grow]} numberOfLines={1}>
            {replay?.stage ?? (status === 'queued' ? 'Waiting to start' : 'Working')}
          </Text>
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
            <Text style={styles.label} numberOfLines={1}>{name}</Text>
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
          <Text style={styles.label} numberOfLines={1}>{name}</Text>
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
  stage: { ...type.caption, color: colors.textSoft },
  grow: { flex: 1, minWidth: 0 },
  left: { ...type.caption, color: colors.textMuted },
});
