import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../theme';
import { Tappable } from './press';

/**
 * The events you can add to, along the top of the feed.
 *
 * Adding a photo is the thing that makes everything else possible, and it was
 * two taps and a tab away. Putting the events themselves at the head of the feed
 * borrows the one piece of story-rail grammar worth borrowing — but pointing at
 * places you contribute to rather than at things to consume.
 */
export default function EventRail({ events = [], covers = {}, onOpen, onCreate }) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Tappable onPress={onCreate} haptic>
          <View style={styles.new}>
            <View style={styles.newRing}>
              <Feather name="plus" size={20} color={colors.primary} />
            </View>
            <Text style={styles.newLabel}>New</Text>
          </View>
        </Tappable>

        {events.map((event) => {
          const count = event.memories?.[0]?.count ?? 0;
          return (
            <Tappable key={event.id} onPress={() => onOpen(event.id)} haptic>
              <View style={styles.item}>
                <View style={styles.ring}>
                  {covers[event.id] ? (
                    <Image
                      source={{ uri: covers[event.id] }}
                      style={styles.cover}
                      contentFit="cover"
                      transition={140}
                      recyclingKey={event.id}
                    />
                  ) : (
                    <View style={[styles.cover, styles.coverEmpty]}>
                      <Feather name="image" size={16} color={colors.textMuted} />
                    </View>
                  )}
                  {count ? (
                    <View style={styles.count}>
                      <Text style={styles.countText}>{count}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {event.title}
                </Text>
              </View>
            </Tappable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
  },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg },

  item: { width: 68, alignItems: 'center', gap: 6 },
  // A ring in the accent, the way an unwatched story is marked — here it means
  // "somewhere you can put photographs".
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cover: { flex: 1, borderRadius: 28, backgroundColor: colors.mediaPlaceholder },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.background,
  },
  countText: { ...type.tiny, color: colors.background, fontSize: 9.5 },
  label: { ...type.tiny, color: colors.textSoft, maxWidth: 68, textAlign: 'center' },

  new: { width: 68, alignItems: 'center', gap: 6 },
  newRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLabel: { ...type.tiny, color: colors.textMuted },
});
