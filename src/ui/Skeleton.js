import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

/**
 * A shape where content is about to be.
 *
 * A spinner in the middle of an empty screen says "something is happening
 * somewhere"; a skeleton says "a list of cards is coming, and this is how many".
 * The pulse is opacity only — animating layout would cost a frame budget these
 * screens do not have while they are also decoding images.
 */
export function Shimmer({ style }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.block, style, { opacity: pulse }]} />;
}

/** Placeholder posts for the feed. */
export function FeedSkeleton({ count = 2 }) {
  return (
    <View style={{ gap: spacing.xl }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.post}>
          <View style={styles.postHead}>
            <Shimmer style={styles.avatar} />
            <View style={{ gap: 6, flex: 1 }}>
              <Shimmer style={{ height: 12, width: '45%' }} />
              <Shimmer style={{ height: 10, width: '65%' }} />
            </View>
          </View>
          <Shimmer style={styles.poster} />
          <View style={styles.postFoot}>
            <Shimmer style={{ height: 12, width: 46 }} />
            <Shimmer style={{ height: 12, width: 46 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder rows for events and albums. */
export function RowSkeleton({ count = 4 }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Shimmer style={styles.rowCover} />
          <View style={{ gap: 7, flex: 1 }}>
            <Shimmer style={{ height: 13, width: '55%' }} />
            <Shimmer style={{ height: 10, width: '35%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder tiles for a gallery. */
export function GridSkeleton({ count = 9 }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <Shimmer key={index} style={styles.tile} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceSunk, borderRadius: radius.sm },

  post: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  poster: { width: '100%', aspectRatio: 4 / 5, borderRadius: 0 },
  postFoot: { flexDirection: 'row', gap: spacing.xl, padding: spacing.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowCover: { width: 60, height: 60, borderRadius: radius.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', aspectRatio: 1 },
});
