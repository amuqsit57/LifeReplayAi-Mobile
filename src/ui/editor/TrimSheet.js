import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_SECONDS, MAX_VIDEO_SECONDS, MIN_SECONDS } from '../../lib/plan';
import { colors, radius, shadow, spacing, type } from '../../theme';
import { Slider } from './controls';

const stamp = (seconds) => {
  const whole = Math.max(0, seconds);
  const m = Math.floor(whole / 60);
  const s = (whole % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
};

/**
 * Where a shot starts and how long it runs.
 *
 * The timeline has handles for both, which is the quick way. This is the exact
 * way: a tenth of a second per tap, and the in and out points written out, for
 * the times when dragging a six minute clip to the right frame is hopeless.
 */
export default function TrimSheet({ visible, onClose, clip, memory, onChange }) {
  if (!clip) return null;

  const isVideo = memory?.kind === 'video';
  const available = Number(memory?.duration_seconds) || 0;
  const startAt = Number(clip.start_at) || 0;
  const seconds = Number(clip.seconds) || 0;

  const maxLength = isVideo
    ? Math.max(MIN_SECONDS, Math.min(MAX_VIDEO_SECONDS, (available || MAX_VIDEO_SECONDS) - startAt))
    : MAX_SECONDS;

  const setStart = (value) => {
    const at = Math.max(0, Math.min(available - MIN_SECONDS, value));
    // The out-point stays where it is, so moving the head changes the length.
    const room = Math.max(MIN_SECONDS, available - at);
    onChange({
      start_at: Number(at.toFixed(2)),
      seconds: Number(Math.min(seconds, room).toFixed(2)),
    });
  };

  const setLength = (value) =>
    onChange({ seconds: Number(Math.max(MIN_SECONDS, Math.min(maxLength, value)).toFixed(2)) });

  const nudge = (fn, by) => () => {
    Haptics.selectionAsync().catch(() => {});
    fn(by);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            {memory?.thumbnail_url ? (
              <Image source={{ uri: memory.thumbnail_url }} style={styles.thumb} contentFit="cover" />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Trim</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {isVideo ? `${stamp(available)} clip` : 'Still'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          {isVideo && available > MIN_SECONDS ? (
            <Row
              label="Starts at"
              value={stamp(startAt)}
              onMinus={nudge(() => setStart(startAt - 0.1))}
              onPlus={nudge(() => setStart(startAt + 0.1))}
            >
              <Slider
                value={startAt}
                min={0}
                max={Math.max(0.1, available - MIN_SECONDS)}
                step={0.1}
                onChange={setStart}
              />
            </Row>
          ) : null}

          <Row
            label="Runs for"
            value={stamp(seconds)}
            onMinus={nudge(() => setLength(seconds - 0.1))}
            onPlus={nudge(() => setLength(seconds + 0.1))}
          >
            <Slider value={seconds} min={MIN_SECONDS} max={maxLength} step={0.1} onChange={setLength} />
          </Row>

          {isVideo ? (
            <Text style={styles.out}>Ends at {stamp(startAt + seconds)}</Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value, children, onMinus, onPlus }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.nudge}>
          <Pressable onPress={onMinus} hitSlop={8} style={styles.step}>
            <Feather name="minus" size={14} color={colors.textSoft} />
          </Pressable>
          <Text style={styles.value}>{value}</Text>
          <Pressable onPress={onPlus} hitSlop={8} style={styles.step}>
            <Feather name="plus" size={14} color={colors.textSoft} />
          </Pressable>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  thumb: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.mediaPlaceholder },
  title: { ...type.title, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted },
  done: { ...type.label, color: colors.primary },

  row: { paddingTop: spacing.md, gap: spacing.xs },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  label: { ...type.label, color: colors.textSoft },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  value: {
    ...type.bodyStrong,
    color: colors.text,
    width: 62,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  out: {
    ...type.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
