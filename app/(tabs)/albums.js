import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { useWarmImages } from '../../src/lib/warm';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import { ScreenHeader, SearchBar } from '../../src/ui/Header';
import { Tappable } from '../../src/ui/press';
import { CardsSkeleton } from '../../src/ui/Skeleton';
import SortSheet, { SORTS, applySort } from '../../src/ui/SortSheet';

/** Every album you can reach, across every event. Row level security scopes it. */
async function allAlbums() {
  const { data, error } = await supabase
    .from('albums')
    .select('*, events!albums_event_id_fkey(id, title), album_memories(count)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function modified(iso) {
  if (!iso) return '';
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return 'Last modified today';
  if (days < 2) return 'Last modified yesterday';
  if (days < 7) return `Last modified ${Math.floor(days)}d ago`;
  if (days < 60) return `Last modified ${Math.floor(days / 7)}w ago`;
  return `Last modified ${Math.floor(days / 30)}mo ago`;
}

function AlbumTile({ album, cover, onPress }) {
  const count = album.album_memories?.[0]?.count ?? 0;

  return (
    <Tappable onPress={onPress} haptic fill style={styles.tile}>
      <View style={styles.coverWrap}>
        {cover ? (
          <Image
          cachePolicy="memory-disk"
            source={{ uri: cover }}
            style={styles.cover}
            contentFit="cover"
          transition={0}
            recyclingKey={album.id}
          />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <Feather name="folder" size={22} color={colors.textMuted} />
          </View>
        )}

        {/* Count sits on the cover, the way a stack shows its depth. */}
        <View style={styles.badge}>
          <Feather name="layers" size={10} color="#fff" />
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      </View>

      <Text style={styles.tileTitle} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={styles.tileMeta} numberOfLines={1}>
        {modified(album.created_at)}
      </Text>
    </Tappable>
  );
}

/** The newest album, full width, so the grid has a place to start. */
function FeaturedAlbum({ album, cover, onPress }) {
  const count = album.album_memories?.[0]?.count ?? 0;

  return (
    <Tappable onPress={onPress} haptic scaleTo={0.985} style={styles.feature}>
      {cover ? (
        <Image
          cachePolicy="memory-disk" source={{ uri: cover }} style={styles.featureCover} contentFit="cover" transition={160} />
      ) : (
        <View style={[styles.featureCover, styles.coverEmpty]}>
          <Feather name="folder" size={26} color={colors.textMuted} />
        </View>
      )}
      <LinearGradient colors={colors.posterScrim} style={styles.featureScrim} pointerEvents="none" />

      <View style={styles.featureText}>
        <Text style={styles.featureTitle} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={styles.featureMeta} numberOfLines={1}>
          {album.events?.title ?? 'An event'} · {count} {count === 1 ? 'item' : 'items'} ·{' '}
          {modified(album.created_at).replace('Last modified ', '')}
        </Text>
      </View>
    </Tappable>
  );
}

function NewAlbumTile({ onPress }) {
  return (
    <Tappable onPress={onPress} haptic fill style={styles.tile}>
      <View style={[styles.cover, styles.newTile]}>
        <View style={styles.newIcon}>
          <Feather name="folder-plus" size={19} color={colors.primary} />
        </View>
        <Text style={styles.newLabel}>New album</Text>
      </View>
    </Tappable>
  );
}

export default function AlbumsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState(false);
  const [sort, setSort] = useState('recent');

  const albums = useQuery({ queryKey: ['allAlbums'], queryFn: allAlbums });
  const all = albums.data ?? [];

  const eventIds = useMemo(
    () => [...new Set(all.map((a) => a.event_id).filter(Boolean))],
    [all]
  );
  const covers = useQuery({
    queryKey: ['eventCovers', eventIds.join(',')],
    queryFn: () => api.eventCovers(eventIds),
    enabled: eventIds.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  // The covers you can see, fetched before the grid appears.
  const warm = useWarmImages(
    all.map((album) => covers.data?.[album.event_id]),
    5,
    albums.isFetched && (!all.length || covers.isFetched)
  );

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((album) =>
          [album.title, album.events?.title]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(needle))
        )
      : all;
    return applySort(filtered, sort, 'albums');
  }, [all, query, sort]);

  // The newest runs full width; the rest go two abreast, with the "new" tile
  // riding at the end of the grid so the affordance is where the albums are.
  const featured = list[0] ?? null;
  const cells = useMemo(() => {
    const tail = [...list.slice(1), { id: '__new__', isNew: true }];
    // An odd tail leaves one tile alone on the last row, and a flexed child on
    // its own fills the whole width — balanced with an invisible partner.
    return tail.length % 2 ? [...tail, { id: '__spacer__', spacer: true }] : tail;
  }, [list]);
  const sortLabel = SORTS.albums.find((s) => s.value === sort)?.label ?? 'Newest first';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Albums"
        subtitle={`${all.length} across your events`}
        right={
          <Pressable style={styles.sortBtn} onPress={() => setSorting(true)} hitSlop={8}>
            <Feather name="sliders" size={13} color={colors.primary} />
            <Text style={styles.sortText}>Sort</Text>
          </Pressable>
        }
      >
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search albums or events"
        />
      </ScreenHeader>

      {albums.isLoading || !warm ? (
        <CardsSkeleton pairs={3} />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={cells}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) =>
            item.spacer ? (
              <View style={styles.tile} />
            ) : item.isNew ? (
              <NewAlbumTile onPress={() => router.push('/(tabs)/events')} />
            ) : (
              <AlbumTile
                album={item}
                cover={covers.data?.[item.event_id]}
                onPress={() => router.push(`/album/${item.id}`)}
              />
            )
          }
          ListHeaderComponent={
            <View>
              {list.length === 0 && !query ? (
                <Text style={styles.hint}>
                  Open an event, hold a photo to start selecting, then choose Album. Each one gets
                  its own films.
                </Text>
              ) : null}
              {featured ? (
                <View style={{ marginBottom: spacing.xl }}>
                  <FeaturedAlbum
                    album={featured}
                    cover={covers.data?.[featured.event_id]}
                    onPress={() => router.push(`/album/${featured.id}`)}
                  />
                </View>
              ) : null}
            </View>
          }
          initialNumToRender={8}
          windowSize={11}
          refreshControl={
            <RefreshControl
              refreshing={albums.isFetching}
              onRefresh={albums.refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <SortSheet
        visible={sorting}
        onClose={() => setSorting(false)}
        options={SORTS.albums}
        value={sort}
        onChange={setSort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  loading: { padding: spacing.lg },
  row: { gap: spacing.md, marginBottom: spacing.lg },

  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { ...type.label, color: colors.primary },

  hint: { ...type.caption, color: colors.textMuted, marginBottom: spacing.lg },

  feature: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  featureCover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.mediaPlaceholder },
  featureScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  featureText: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, gap: 2 },
  featureTitle: { ...type.title, color: '#fff' },
  featureMeta: { ...type.caption, color: 'rgba(255,255,255,0.85)' },

  tile: { flex: 1, gap: 6 },
  coverWrap: { borderRadius: radius.md, overflow: 'hidden' },
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.mediaPlaceholder,
  },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16,12,26,0.62)',
  },
  badgeText: { ...type.tiny, color: '#fff' },

  tileTitle: { ...type.bodyStrong, color: colors.text },
  tileMeta: { ...type.caption, color: colors.textMuted },

  newTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary + '55',
  },
  newIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  newLabel: { ...type.label, color: colors.primary },
});
