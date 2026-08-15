import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, type } from '../../theme';
import { SearchBar } from '../Header';

const COLUMNS = 3;

/**
 * Pick what to cut in.
 *
 * Selection is ordered rather than a set: tapping four photographs and inserting
 * them puts them in the timeline in the order they were tapped, which is the
 * quickest way to lay down a sequence. The number on each tile is its position,
 * not a tick, so that ordering is visible while it is being made.
 */
export default function AddShots({ visible, onClose, library, onInsert }) {
  const [chosen, setChosen] = useState([]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return library.filter((memory) => {
      if (kind !== 'all' && memory.kind !== kind) return false;
      if (!needle) return true;
      return [memory.description, ...(memory.tags ?? [])]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [library, query, kind]);

  const toggle = (id) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const done = () => {
    const byId = Object.fromEntries(library.map((m) => [m.id, m]));
    onInsert(chosen.map((id) => byId[id]).filter(Boolean));
    setChosen([]);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Add shots</Text>
          <Pressable onPress={done} disabled={!chosen.length} hitSlop={10}>
            <Text style={[styles.done, !chosen.length && styles.doneOff]}>
              {chosen.length ? `Add ${chosen.length}` : 'Add'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search what is in them"
          />
          <View style={styles.kinds}>
            {[
              { value: 'all', label: 'Everything' },
              { value: 'photo', label: 'Photos' },
              { value: 'video', label: 'Video' },
            ].map((option) => {
              const on = option.value === kind;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.kind, on && styles.kindOn]}
                  onPress={() => setKind(option.value)}
                >
                  <Text style={[styles.kindText, on && styles.kindTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          initialNumToRender={24}
          windowSize={11}
          renderItem={({ item }) => {
            const position = chosen.indexOf(item.id);
            return (
              <Pressable style={styles.tile} onPress={() => toggle(item.id)}>
                <Image
          cachePolicy="memory-disk"
                  source={{ uri: item.thumbnail_url }}
                  style={styles.tileImage}
                  contentFit="cover"
                  transition={120}
                  recyclingKey={item.id}
                />
                {item.kind === 'video' ? (
                  <View style={styles.badge}>
                    <Feather name="video" size={10} color="#fff" />
                  </View>
                ) : null}
                {position >= 0 ? (
                  <View style={styles.picked}>
                    <View style={styles.pickedPip}>
                      <Text style={styles.pickedText}>{position + 1}</Text>
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query ? 'Nothing here matches that.' : 'Nothing has been uploaded to this event yet.'}
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xxl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { ...type.heading, color: colors.text },
  done: { ...type.label, color: colors.primary },
  doneOff: { color: colors.borderStrong },

  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  kinds: { flexDirection: 'row', gap: spacing.sm },
  kind: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  kindOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { ...type.label, color: colors.textSoft },
  kindTextOn: { color: colors.textOnAccent },

  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xs },
  column: { gap: spacing.xs },
  tile: {
    flex: 1 / COLUMNS,
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.mediaPlaceholder,
  },
  tileImage: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(12,9,20,0.6)',
    borderRadius: radius.pill,
    padding: 3,
  },
  picked: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(107,78,230,0.42)',
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'flex-end',
    padding: 5,
  },
  pickedPip: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pickedText: { ...type.tiny, color: '#fff' },
  empty: { ...type.caption, color: colors.textMuted, textAlign: 'center', padding: spacing.xxl },
});
