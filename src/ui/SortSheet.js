import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type } from '../theme';

/** Ways to order a list. Newest first everywhere by default. */
export const SORTS = {
  films: [
    { value: 'recent', label: 'Newest first', icon: 'arrow-down', hint: 'Most recently finished' },
    { value: 'oldest', label: 'Oldest first', icon: 'arrow-up', hint: 'In the order they were made' },
    { value: 'liked', label: 'Most liked', icon: 'heart', hint: 'What people came back to' },
    { value: 'longest', label: 'Longest', icon: 'clock', hint: 'The fuller cuts first' },
  ],
  events: [
    { value: 'recent', label: 'Newest first', icon: 'arrow-down', hint: 'Most recently created' },
    { value: 'oldest', label: 'Oldest first', icon: 'arrow-up', hint: 'How the year happened' },
    { value: 'largest', label: 'Most memories', icon: 'layers', hint: 'Fullest events first' },
    { value: 'name', label: 'By name', icon: 'type', hint: 'A to Z' },
  ],
  albums: [
    { value: 'recent', label: 'Newest first', icon: 'arrow-down', hint: 'Most recently made' },
    { value: 'oldest', label: 'Oldest first', icon: 'arrow-up', hint: 'In the order made' },
    { value: 'largest', label: 'Most items', icon: 'layers', hint: 'Fullest albums first' },
    { value: 'name', label: 'By name', icon: 'type', hint: 'A to Z' },
  ],
};

/** Apply one of the above. Counts come from the embedded aggregate. */
export function applySort(rows, sort, kind) {
  const count = (row) =>
    kind === 'albums'
      ? row.album_memories?.[0]?.count ?? 0
      : row.memories?.[0]?.count ?? 0;
  // A film's date is when it finished, not when it was asked for — a render
  // queued yesterday and finished today belongs at the top.
  const made = (row) =>
    new Date((kind === 'films' ? row.completed_at : null) ?? row.created_at ?? 0).getTime();

  const sorted = [...rows];
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => made(a) - made(b));
    case 'largest':
      return sorted.sort((a, b) => count(b) - count(a));
    case 'liked':
      return sorted.sort(
        (a, b) => (b.replay_likes?.[0]?.count ?? 0) - (a.replay_likes?.[0]?.count ?? 0)
      );
    case 'longest':
      return sorted.sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0));
    case 'name':
      return sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    default:
      return sorted.sort((a, b) => made(b) - made(a));
  }
}

export default function SortSheet({ visible, onClose, options, value, onChange }) {
  // The last row otherwise sits under the home indicator, where the gesture
  // area swallows the tap.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>Sort by</Text>

          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={[styles.row, active && styles.rowOn]}
                onPress={() => {
                  onChange(option.value);
                  onClose();
                }}
              >
                <View style={[styles.icon, active && { backgroundColor: colors.primary }]}>
                  <Feather
                    name={option.icon}
                    size={15}
                    color={active ? '#fff' : colors.textSoft}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, active && { color: colors.primary }]}>
                    {option.label}
                  </Text>
                  <Text style={styles.hint}>{option.hint}</Text>
                </View>
                {active ? <Feather name="check" size={17} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
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
    gap: spacing.xs,
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
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.primarySoft },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.bodyStrong, color: colors.text },
  hint: { ...type.caption, color: colors.textMuted },
});
