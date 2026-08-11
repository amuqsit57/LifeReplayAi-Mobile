import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import { ScreenHeader, SearchBar } from '../../src/ui/Header';

/** Every album you can reach, across every event. Row level security scopes it. */
async function allAlbums() {
  const { data, error } = await supabase
    .from('albums')
    .select('*, events!albums_event_id_fkey(id, title), album_memories(count)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function AlbumCard({ album, onPress }) {
  const count = album.album_memories?.[0]?.count ?? 0;

  const cover = useQuery({
    queryKey: ['albumCover', album.id],
    queryFn: async () => {
      if (!album.cover_memory_id || !album.event_id) return null;
      const rows = await api.memories(album.event_id);
      return rows.find((m) => m.id === album.cover_memory_id)?.thumbnail_url ?? null;
    },
    enabled: Boolean(album.cover_memory_id),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.coverWrap}>
        {cover.data ? (
          <Image source={{ uri: cover.data }} style={styles.cover} contentFit="cover" transition={140} />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <Feather name="folder" size={22} color={colors.primary} />
          </View>
        )}
        {/* A stacked edge, so an album reads as a set rather than one picture. */}
        <View style={styles.stackEdge} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {album.events?.title ?? 'An event'}
        </Text>
        <View style={styles.countPill}>
          <Feather name="image" size={11} color={colors.textSoft} />
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>

      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function AlbumsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const albums = useQuery({ queryKey: ['allAlbums'], queryFn: allAlbums });
  const all = albums.data ?? [];

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((album) =>
      [album.title, album.events?.title]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    );
  }, [all, query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Albums"
        subtitle={`${all.length} across your events`}
      >
        {all.length > 3 ? (
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search albums"
          />
        ) : null}
      </ScreenHeader>

      <FlatList
        contentContainerStyle={styles.content}
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlbumCard album={item} onPress={() => router.push(`/album/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          albums.isLoading ? null : (
            <View style={styles.blank}>
              <View style={styles.blankIcon}>
                <Feather name="folder-plus" size={24} color={colors.primary} />
              </View>
              <Text style={styles.blankTitle}>No albums yet</Text>
              <Text style={styles.blankBody}>
                Open an event, hold a photo to start selecting, then choose Album. Each one gets its
                own films — the ceremony cut separately from the party.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={albums.isFetching}
            onRefresh={albums.refetch}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  coverWrap: { width: 64, height: 64 },
  cover: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  stackEdge: {
    position: 'absolute',
    right: 0,
    top: 5,
    width: 60,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunk,
    zIndex: -1,
  },

  body: { flex: 1, gap: 3 },
  title: { ...type.heading, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },
  countPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  countText: { ...type.tiny, color: colors.textSoft },

  blank: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  blankIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  blankTitle: { ...type.heading, color: colors.text },
  blankBody: { ...type.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
});
