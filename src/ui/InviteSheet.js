import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type } from '../theme';

/**
 * The invite code, shown rather than immediately handed to the share sheet.
 *
 * Tapping invite used to open the OS share sheet straight away, which hides the
 * thing you actually wanted to see. Most of the time the code gets read aloud or
 * typed into a message by hand, so the code itself is the screen and sharing is
 * one of two ways to leave it.
 */
export default function InviteSheet({ visible, onClose, event }) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const code = event?.invite_code ?? '';

  async function copy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />

          <View style={styles.head}>
            <Text style={styles.title}>Invite to {event?.title ?? 'this event'}</Text>
            <Text style={styles.blurb}>
              Anyone with this code can add photos and watch every film.
            </Text>
          </View>

          <Pressable onPress={copy} style={styles.codeBox}>
            <Text style={styles.code} selectable>
              {code}
            </Text>
            <View style={styles.copyHint}>
              <Feather
                name={copied ? 'check' : 'copy'}
                size={14}
                color={copied ? colors.success : colors.primary}
              />
              <Text style={[styles.copyText, copied && { color: colors.success }]}>
                {copied ? 'Copied' : 'Tap to copy'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={[styles.action, styles.actionGhost]} onPress={copy}>
              <Feather name="copy" size={17} color={colors.text} />
              <Text style={styles.actionGhostText}>Copy code</Text>
            </Pressable>

            <Pressable
              style={[styles.action, styles.actionFilled]}
              onPress={() =>
                Share.share({
                  message: `Join "${event?.title}" on Life Replay — use code ${code}`,
                }).catch(() => {})
              }
            >
              <Feather name="share-2" size={17} color="#fff" />
              <Text style={styles.actionFilledText}>Share</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  head: { gap: spacing.xs },
  title: { ...type.title, color: colors.text },
  blurb: { ...type.caption, color: colors.textMuted },

  codeBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary + '33',
    borderStyle: 'dashed',
  },
  code: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: 8,
    color: colors.primary,
    // The trailing letter-space would otherwise push the code off centre.
    marginLeft: 8,
  },
  copyHint: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyText: { ...type.caption, color: colors.primary },

  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  actionGhost: { backgroundColor: colors.surfaceAlt },
  actionGhostText: { ...type.bodyStrong, color: colors.text },
  actionFilled: { backgroundColor: colors.primary },
  actionFilledText: { ...type.bodyStrong, color: '#fff' },

  done: { alignItems: 'center', paddingVertical: spacing.sm },
  doneText: { ...type.label, color: colors.textMuted },
});
