import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, shadow, spacing, type } from '../../theme';

/** A labelled group inside a control panel. */
export function Group({ title, hint, children, action }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{title}</Text>
        {action}
      </View>
      {hint ? <Text style={styles.groupHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** A horizontal run of choices. Scrolls rather than wraps, so the panel keeps a
 *  predictable height as the option lists differ in length. */
export function ChipRow({ options, value, onChange, icons = false }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
          >
            {icons && option.icon ? (
              <Feather
                name={option.icon}
                size={12}
                color={on ? colors.textOnAccent : colors.textSoft}
              />
            ) : null}
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Grades, shown as the colour rather than the word. */
export function SwatchRow({ options, value, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.swatchWrap}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
          >
            <View style={[styles.swatch, { backgroundColor: option.swatch }, on && styles.swatchOn]}>
              {on ? <Feather name="check" size={16} color="#fff" /> : null}
            </View>
            <Text style={[styles.swatchText, on && { color: colors.primary }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * A slider, written here rather than pulled in.
 *
 * The one thing it does that an off-the-shelf one does not is report while
 * dragging *and* commit on release, so the preview can follow the finger without
 * pushing forty entries onto the undo stack for one gesture.
 */
export function Slider({ value, min, max, step = 0.1, onChange, onCommit }) {
  const [width, setWidth] = useState(0);
  const box = useRef(0);
  const track = useRef(null);
  // Where the track sits on screen, measured on layout — see the move handler.
  const offset = useRef(0);
  const latest = useRef(value);
  latest.current = value;

  const fraction = max > min ? (value - min) / (max - min) : 0;

  const positionToValue = (x) => {
    const w = box.current || 1;
    const ratio = Math.min(1, Math.max(0, x / w));
    const raw = min + ratio * (max - min);
    return Math.round(raw / step) * step;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The track owns the gesture once it starts, or the scroll view under it
      // steals the drag the moment a finger moves more vertically than across.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        Haptics.selectionAsync().catch(() => {});
        onChange(positionToValue(event.nativeEvent.locationX));
      },
      onPanResponderMove: (event, gesture) => {
        // locationX is relative to whichever view the touch is over, which stops
        // being the track as soon as the finger passes the handle. moveX is
        // screen space, so the offset measured on layout is what makes it usable.
        onChange(positionToValue(gesture.moveX - offset.current));
      },
      onPanResponderRelease: () => onCommit?.(latest.current),
    })
  ).current;

  return (
    <View
      ref={track}
      style={styles.track}
      onLayout={(event) => {
        const w = event.nativeEvent.layout.width;
        box.current = w;
        setWidth(w);
        track.current?.measureInWindow?.((x) => {
          offset.current = x;
        });
      }}
      {...pan.panHandlers}
    >
      <View style={styles.trackBed} />
      <View style={[styles.trackFill, { width: Math.max(0, fraction * width) }]} />
      <View style={[styles.handle, { left: Math.max(0, fraction * width - 13) }]} />
    </View>
  );
}

/** A full-height picker for a list too long to sit in a row — transitions. */
export function GroupedSheet({ visible, onClose, title, groups, value, onChange }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.title} style={styles.sheetGroup}>
                <Text style={styles.sheetGroupTitle}>{group.title}</Text>
                <View style={styles.sheetWrap}>
                  {group.items.map((item) => {
                    const on = item.value === value;
                    return (
                      <Pressable
                        key={item.value}
                        style={[styles.tile, on && styles.tileOn]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          onChange(item.value);
                          onClose();
                        }}
                      >
                        <Text style={[styles.tileText, on && styles.tileTextOn]}>
                          {item.label}
                        </Text>
                        {item.hint ? <Text style={styles.tileHint}>{item.hint}</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm, paddingVertical: spacing.sm },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  groupTitle: { ...type.slate, color: colors.textMuted, textTransform: 'uppercase' },
  groupHint: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },

  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, color: colors.textSoft },
  chipTextOn: { color: colors.textOnAccent },

  swatchWrap: { alignItems: 'center', gap: 5, width: 62 },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: colors.primary },
  swatchText: { ...type.tiny, fontSize: 10, color: colors.textMuted, textAlign: 'center' },

  track: { height: 40, justifyContent: 'center', marginHorizontal: spacing.lg },
  trackBed: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunk,
  },
  trackFill: {
    position: 'absolute',
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  handle: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadow.card,
  },

  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  sheetTitle: { ...type.title, color: colors.text, marginBottom: spacing.md },
  sheetGroup: { marginBottom: spacing.lg, gap: spacing.sm },
  sheetGroupTitle: { ...type.slate, color: colors.textMuted, textTransform: 'uppercase' },
  sheetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minWidth: 96,
  },
  tileOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tileText: { ...type.label, color: colors.text },
  tileTextOn: { color: colors.primary },
  tileHint: { ...type.caption, fontSize: 11, color: colors.textMuted },
});
