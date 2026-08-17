import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView } from 'react-native';

import { colors, radius, spacing, type } from '../theme';
import { Avatar } from './social';

/**
 * Whose photographs these are.
 *
 * A shared event is not one pile of pictures, it is several people's side by
 * side — and which of them took a shot is usually the fastest way to find it
 * again. Every gallery in the app therefore offers the same two things: the
 * grid banded by contributor, and a row of chips to narrow to one of them.
 *
 * Kept here rather than written per screen so the event, the album and the
 * album's picker cannot drift into three slightly different answers to the same
 * question.
 */

/** People by id, for turning an `uploaded_by` into a name and a face. */
export function indexPeople(people = []) {
  return new Map(people.map((person) => [person.user_id, person]));
}

/**
 * Split memories into bands, biggest contributor first.
 *
 * Whoever brought the most goes first: it is the closest thing to a meaningful
 * order, and it puts the band somebody is most likely looking for at the top
 * rather than making them scroll to it.
 */
export function groupByPerson(memories = [], peopleById) {
  const bucket = new Map();
  for (const memory of memories) {
    const who = memory.uploaded_by ?? 'unknown';
    if (!bucket.has(who)) bucket.set(who, []);
    bucket.get(who).push(memory);
  }

  return [...bucket.entries()]
    .map(([id, items]) => ({ id, items, person: peopleById.get(id) }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** How many each person contributed to this particular list. */
export function countsByPerson(memories = []) {
  const counts = new Map();
  for (const memory of memories) {
    const who = memory.uploaded_by ?? 'unknown';
    counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  return counts;
}

/**
 * The header above one person's band.
 *
 * Tappable, because having just read somebody's name the next thing you want is
 * only their pictures.
 */
export function PersonBand({ person, count, onPress }) {
  return (
    <Pressable style={styles.band} onPress={onPress}>
      <Avatar url={person?.avatar_url} name={person?.full_name} size="sm" />
      <Text style={styles.bandName} numberOfLines={1}>
        {person?.full_name ?? 'Someone'}
      </Text>
      <Text style={styles.bandCount}>{count}</Text>
      {onPress ? <Feather name="chevron-right" size={15} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

/**
 * Filter chips: everyone banded, everyone together, then one per contributor.
 *
 * Only people who actually added something appear. A chip for somebody who has
 * contributed nothing is a filter guaranteed to empty the screen.
 */
export function PersonChips({ people = [], counts, grouped, by, onGrouped, onPerson }) {
  const contributors = people.filter((person) => (counts.get(person.user_id) ?? 0) > 0);
  if (contributors.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      <Pressable onPress={() => onGrouped(true)} style={[styles.chip, grouped && styles.chipOn]}>
        <Feather name="users" size={11} color={grouped ? '#fff' : colors.textSoft} />
        <Text style={[styles.chipText, grouped && styles.chipTextOn]}>By person</Text>
      </Pressable>

      <Pressable
        onPress={() => onGrouped(false)}
        style={[styles.chip, !grouped && !by && styles.chipOn]}
      >
        <Feather name="grid" size={11} color={!grouped && !by ? '#fff' : colors.textSoft} />
        <Text style={[styles.chipText, !grouped && !by && styles.chipTextOn]}>All together</Text>
      </Pressable>

      {contributors.map((person) => {
        const active = by === person.user_id;
        return (
          <Pressable
            key={person.user_id}
            onPress={() => onPerson(active ? null : person.user_id)}
            style={[styles.chip, active && styles.chipOn]}
          >
            <Avatar url={person.avatar_url} name={person.full_name} size="xs" />
            <Text style={[styles.chipText, active && styles.chipTextOn]}>
              {person.full_name?.split(' ')[0] ?? 'Someone'}
            </Text>
            <Text style={[styles.chipCount, active && styles.chipTextOn]}>
              {counts.get(person.user_id)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  bandName: { ...type.label, color: colors.text, flex: 1 },
  bandCount: { ...type.tiny, color: colors.textMuted },

  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { ...type.label, fontSize: 11.5, lineHeight: 15, color: colors.textSoft },
  chipTextOn: { color: '#fff' },
  chipCount: { ...type.tiny, fontSize: 9.5, color: colors.textMuted },
});
