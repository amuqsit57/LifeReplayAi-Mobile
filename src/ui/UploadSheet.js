import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, type } from '../theme';

const PHASE_WORD = {
  preparing: 'Getting them ready',
  requesting: 'Making room',
  uploading: 'Sending',
  finishing: 'Finishing',
};

/**
 * What an upload is doing, and what to do when it lands.
 *
 * Uploading a batch used to change one word on a button while the app looked
 * frozen for a minute, and afterwards nothing suggested that a film was
 * something you now make. This covers both: a real bar while it runs, and the
 * offer at the end, where the intention actually is.
 */
export default function UploadSheet({ progress, done, onClose, onGenerate }) {
  const width = useRef(new Animated.Value(0)).current;

  const total = progress?.total ?? done?.total ?? 0;
  const index = progress?.index ?? 0;
  const fraction = total ? Math.min(1, (index + 1) / total) : 0;

  useEffect(() => {
    Animated.timing(width, {
      toValue: done ? 1 : fraction,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [fraction, done, width]);

  const visible = Boolean(progress || done);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {done ? (
            <>
              <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
                <Feather name="check" size={22} color={colors.success} />
              </View>
              <Text style={styles.title}>
                {done.added} {done.added === 1 ? 'memory' : 'memories'} added
              </Text>
              <Text style={styles.blurb}>
                {done.failed
                  ? `${done.failed} could not be added. `
                  : ''}
                They are being read now — descriptions and the best moments come through in a
                moment. You can make a film whenever you like.
              </Text>

              <Pressable style={styles.cta} onPress={onGenerate}>
                <Feather name="zap" size={17} color="#fff" />
                <Text style={styles.ctaText}>Generate a film from these</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={onClose}>
                <Text style={styles.ghostText}>Not now</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Feather name="upload-cloud" size={22} color={colors.primary} />
              </View>
              <Text style={styles.title}>
                Adding {total ? `${Math.min(index + 1, total)} of ${total}` : '…'}
              </Text>
              <Text style={styles.blurb}>
                {PHASE_WORD[progress?.phase] ?? 'Working'} — keep the app open until this finishes.
              </Text>

              <View style={styles.track}>
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: width.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['4%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.percent}>{Math.round(fraction * 100)}%</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  blurb: { ...type.caption, color: colors.textMuted, textAlign: 'center' },

  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSunk,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  percent: { ...type.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  ctaText: { ...type.bodyStrong, color: '#fff' },
  ghost: { paddingVertical: spacing.sm },
  ghostText: { ...type.label, color: colors.textMuted },
});
