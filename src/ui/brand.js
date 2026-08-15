/** The wordmark, and the small controls that sit around it. */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, markType, radius, shadow, spacing, type } from '../theme';

/**
 * The lockup: a mark, then the name set tight.
 *
 * The mark is two offset rounded rectangles — frames stacked the way a reel of
 * them would be — rather than a play triangle, which every video app already
 * owns. Drawn in views instead of an image so it stays crisp at any size and
 * carries the accent colour with it.
 */
// The mark's side length per size. The name's own metrics live in `markType`,
// so the two scale together rather than one being nudged to match the other.
const UNIT = { sm: 12, lg: 15, xl: 21 };

export function Wordmark({ size = 'lg' }) {
  const unit = UNIT[size] ?? UNIT.lg;

  return (
    <View style={[styles.lockup, size === 'xl' && { gap: spacing.md }]}>
      <View style={{ width: unit * 1.5, height: unit * 1.5 }}>
        <View
          style={[
            styles.frame,
            {
              width: unit,
              height: unit,
              borderRadius: unit * 0.32,
              backgroundColor: colors.primary,
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
              borderRadius: unit * 0.32,
              backgroundColor: colors.accent,
              left: unit * 0.5,
              top: 0,
              opacity: 0.9,
            },
          ]}
        />
      </View>

      <Text style={[styles.name, markType[size] ?? markType.lg]}>
        Life<Text style={{ color: colors.primary }}>Replay</Text>
      </Text>
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
  // markType, not type: the logo keeps the system face it was drawn in while the
  // rest of the app moves to Fraunces and Manrope. The size comes from the
  // caller, so one style carries the colour and nothing else.
  name: { color: colors.text },

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
