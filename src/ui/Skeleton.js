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

/**
 * The shape of a grid of cards: one full-width, then pairs.
 *
 * Matching the real layout is the whole point. A handful of small squares on a
 * tall screen is mostly white space, which reads as a page that failed to load
 * rather than one still loading.
 */
export function CardsSkeleton({ pairs = 3 }) {
  return (
    <View style={styles.cards}>
      <Shimmer style={styles.lead} />
      {Array.from({ length: pairs }).map((_, row) => (
        <View key={row} style={styles.pair}>
          <Shimmer style={styles.half} />
          <Shimmer style={styles.half} />
        </View>
      ))}
    </View>
  );
}

/**
 * A whole detail page: the header photograph, the row of actions, the tabs, and
 * the first screenful of tiles.
 *
 * The event and album pages used to draw their chrome the moment they opened and
 * gate only the grid, so the title appeared over an empty hero, the buttons
 * arrived under it, and the photographs turned up last — one page assembling
 * itself in three visible steps. The feed never did that: it holds the shape of
 * the whole thing until the whole thing is ready. This is that shape, for a page
 * led by a picture rather than a list.
 *
 * @param {number} topInset the safe area, since the hero runs under the notch
 * @param {number} actions how many buttons sit under the hero — three on an
 *   event, two on an album
 */
export function DetailSkeleton({ topInset = 0, heroHeight = 210, actions = 3, tiles = 9 }) {
  return (
    <View style={styles.detail}>
      <Shimmer style={[styles.detailHero, { height: heroHeight + topInset }]} />
      <View style={styles.detailBody}>
        <View style={styles.detailActions}>
          {Array.from({ length: actions }).map((_, index) => (
            // The first one leads and is wider, the way the real row reads.
            <Shimmer key={index} style={[styles.detailAction, index === 0 && { flex: 1.7 }]} />
          ))}
        </View>
        <Shimmer style={styles.detailTabs} />
        <GridSkeleton count={tiles} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceSunk, borderRadius: radius.sm },

  // Matches the real post exactly, so nothing shifts when content replaces it.
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

  cards: { padding: spacing.lg, gap: spacing.md },
  lead: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg },
  pair: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1, aspectRatio: 1, borderRadius: radius.lg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', aspectRatio: 1 },

  detail: { flex: 1 },
  // Square at the top so it runs off the screen edge, rounded at the bottom
  // where the real hero is.
  detailHero: {
    width: '100%',
    borderRadius: 0,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  detailBody: { padding: spacing.lg, gap: spacing.lg },
  detailActions: { flexDirection: 'row', gap: spacing.sm },
  detailAction: { flex: 1, height: 44, borderRadius: radius.md },
  detailTabs: { height: 44, borderRadius: radius.md },
});
