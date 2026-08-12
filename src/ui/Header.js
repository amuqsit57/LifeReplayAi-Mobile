/** Screen headers that clear the status bar, and the controls that sit in them. */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type } from '../theme';

/**
 * Everything above the fold on a screen.
 *
 * Every screen was starting at y=0 and running under the phone's clock and
 * battery. Reading the inset rather than hardcoding a number is what makes this
 * right on a notched phone, a punch-hole and a device with neither.
 */
export function ScreenHeader({ title, subtitle, left, right, children, compact }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + (compact ? spacing.sm : spacing.md) }]}>
      <View style={styles.bar}>
        {left}
        <View style={{ flex: 1 }}>
          {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** A round control. `tone` decides whether it reads as the screen's main action. */
export function RoundButton({ name, onPress, tone = 'plain', size = 19, label, badge }) {
  const filled = tone === 'filled';
  // `onDark` is for controls sitting over a photograph, where the usual pale
  // chip disappears and dark ink on it is unreadable.
  const onDark = tone === 'onDark';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.round,
        filled && styles.roundFilled,
        onDark && styles.roundOnDark,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Feather name={name} size={size} color={filled || onDark ? '#fff' : colors.text} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The search field used on the feed and the events list. */
export function SearchBar({ value, onChangeText, placeholder, onClear }) {
  return (
    <View style={styles.search}>
      <Feather name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Feather name="x-circle" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    // Enough that a title never sits flush against whatever follows it — on the
    // replay screen the heading was touching the top of the video.
    paddingBottom: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 2 },

  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  roundFilled: { backgroundColor: colors.primary, ...shadow.card },
  roundOnDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { ...type.tiny, color: '#fff', fontSize: 9 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  searchInput: { ...type.body, flex: 1, color: colors.text, padding: 0 },
});
