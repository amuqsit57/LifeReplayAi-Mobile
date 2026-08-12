import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { colors, radius, shadow, spacing, type } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Anything you can press, pressing back.
 *
 * A card that dips under the thumb and springs out feels like a physical thing;
 * one that only changes opacity feels like a picture of a thing. The scale is
 * deliberately small — enough to register in the hand, not enough to notice as
 * an animation.
 */
export function Tappable({ children, onPress, onLongPress, scaleTo = 0.97, haptic, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => spring(scaleTo)}
      onPressOut={() => spring(1)}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      onLongPress={onLongPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * The app's button.
 *
 * One component so a primary action looks the same everywhere, rather than each
 * screen inventing its own padding and weight.
 */
export function Action({ label, icon, onPress, tone = 'primary', size = 'md', disabled, style }) {
  const tones = {
    primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
    quiet: { bg: colors.surfaceAlt, fg: colors.text, border: 'transparent' },
    outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
    onDark: { bg: 'rgba(255,255,255,0.16)', fg: '#fff', border: 'rgba(255,255,255,0.34)' },
  };
  const palette = tones[tone] ?? tones.primary;
  const tall = size === 'lg';

  return (
    <Tappable onPress={onPress} disabled={disabled} haptic style={style}>
      <View
        style={[
          styles.action,
          {
            backgroundColor: disabled ? colors.surfaceSunk : palette.bg,
            borderColor: disabled ? 'transparent' : palette.border,
            paddingVertical: tall ? spacing.lg : spacing.md,
          },
          tone === 'primary' && !disabled && shadow.card,
        ]}
      >
        {icon ? (
          <Feather name={icon} size={tall ? 18 : 16} color={disabled ? colors.textMuted : palette.fg} />
        ) : null}
        <Text
          style={[
            tall ? type.bodyStrong : type.label,
            { color: disabled ? colors.textMuted : palette.fg },
          ]}
        >
          {label}
        </Text>
      </View>
    </Tappable>
  );
}

/**
 * A segmented control whose indicator slides.
 *
 * The indicator moving between positions is what makes it read as one control
 * with a state, rather than several buttons where a different one happens to be
 * highlighted.
 */
export function Segmented({ options, value, onChange }) {
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const each = width ? width / options.length : 0;

  const move = (to) => {
    Animated.spring(slide, {
      toValue: to,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  return (
    <View
      style={styles.segmented}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width - 6;
        setWidth(next);
        slide.setValue((next / options.length) * index);
      }}
    >
      {each ? (
        <Animated.View
          style={[
            styles.indicator,
            { width: each, transform: [{ translateX: slide }] },
          ]}
        />
      ) : null}

      {options.map((option, position) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            onPress={() => {
              move(each * position);
              Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
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
              <View style={[styles.pip, active && { backgroundColor: colors.primary }]}>
                <Text style={[styles.pipText, active && { color: '#fff' }]}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },

  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  segmentText: { ...type.label, color: colors.textMuted },
  segmentTextOn: { color: colors.text },
  pip: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunk,
    alignItems: 'center',
  },
  pipText: { ...type.tiny, color: colors.textMuted, fontSize: 10 },
});
