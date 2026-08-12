/** The wordmark, and the small controls that sit around it. */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, type } from '../theme';

/**
 * The lockup: a mark, then the name set tight.
 *
 * The mark is two offset rounded rectangles — frames stacked the way a reel of
 * them would be — rather than a play triangle, which every video app already
 * owns. Drawn in views instead of an image so it stays crisp at any size and
 * carries the accent colour with it.
 */
export function Wordmark({ size = 'lg' }) {
  const big = size === 'lg';
  const unit = big ? 15 : 12;

  return (
    <View style={styles.lockup}>
      {/* Two frames offset, the way a reel of them stacks. One colour at two
          weights rather than two colours — a mark in a single hue reads as a
          mark, one in two reads as decoration. */}
      <View style={{ width: unit * 1.5, height: unit * 1.5 }}>
        <View
          style={[
            styles.frame,
            {
              width: unit,
              height: unit,
              borderRadius: unit * 0.3,
              backgroundColor: colors.primary,
              opacity: 0.32,
              left: 0,
              top: unit * 0.5,
            },
          ]}
        />
        <View
          style={[
            styles.frame,
            {
              width: unit,
              height: unit,
              borderRadius: unit * 0.3,
              backgroundColor: colors.primary,
              left: unit * 0.5,
              top: 0,
            },
          ]}
        />
      </View>

      <Text style={big ? styles.nameLg : styles.nameSm}>Life Replay</Text>
    </View>
  );
}

/** A row of choices that behaves like one control rather than several buttons. */
export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentOn]}
          >
            <Feather
              name={option.icon}
              size={14}
              color={active ? colors.text : colors.textMuted}
            />
            <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
              {option.label}
            </Text>
            {option.count != null ? (
              <Text style={[styles.segmentCount, active && styles.segmentCountOn]}>
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  frame: { position: 'absolute' },
  nameLg: { ...type.display, color: colors.text, fontSize: 22, lineHeight: 26 },
  nameSm: { ...type.heading, color: colors.text },

  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunk,
    gap: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  // The active segment is a raised white surface rather than a coloured fill —
  // colour here would compete with the photographs, which are the point.
  segmentOn: { backgroundColor: colors.surface, ...shadow.card },
  segmentText: { ...type.label, color: colors.textMuted },
  segmentTextOn: { color: colors.text },
  segmentCount: { ...type.tiny, color: colors.textMuted },
  segmentCountOn: { color: colors.primary },
});
