import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { feed, myLikes, setLike } from '../../src/lib/data';
import { useWarmImages } from '../../src/lib/warm';
import { STYLE_META, colors, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import { Wordmark } from '../../src/ui/brand';
import CreateEventSheet from '../../src/ui/CreateEventSheet';
import { RoundButton, ScreenHeader, SearchBar } from '../../src/ui/Header';
import PostCard from '../../src/ui/PostCard';
import Rise from '../../src/ui/Rise';
import { FeedSkeleton } from '../../src/ui/Skeleton';
import SortSheet, { SORTS, applySort } from '../../src/ui/SortSheet';
import Tour, { useTour } from '../../src/ui/Tour';
export default function FeedScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [optimistic, setOptimistic] = useState({});
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState(false);
  const [sort, setSort] = useState('recent');
  const tour = useTour();

  const posts = useQuery({ queryKey: ['feed'], queryFn: feed });
  const all = posts.data ?? [];


  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((post) =>
          [
            post.events?.title,
            post.albums?.title,
            post.profiles?.full_name,
            STYLE_META[post.style]?.label,
          ]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(needle))
        )
      : all;
    return applySort(filtered, sort, 'films');
  }, [all, query, sort]);

  const ids = useMemo(() => all.map((p) => p.id), [all]);
  const idKey = ids.join(',');

  const media = useQuery({
    queryKey: ['feedMedia', idKey],
    queryFn: () => api.replayMedia(ids),
    enabled: ids.length > 0,
    staleTime: 45 * 60 * 1000,
  });

  const liked = useQuery({
    queryKey: ['myLikes', idKey],
    queryFn: () => myLikes(ids),
    enabled: ids.length > 0,
  });

  // The posters for the first couple of posts, before anything is drawn.
  // Not settled until the signing request has answered: the posters come from a
  // second call, so before it lands there is nothing to prefetch and an empty
  // list must not read as "nothing to load".
  const warm = useWarmImages(
    all.map((post) => media.data?.[post.id]?.thumbnail_url),
    2,
    posts.isFetched && (!all.length || media.isFetched)
  );

  const likedSet = useMemo(() => new Set(liked.data ?? []), [liked.data]);
  const sortLabel = SORTS.films.find((option) => option.value === sort)?.label ?? 'Newest first';

  // Anything finished in the last day counts as something you have not seen yet.
  const fresh = useMemo(
    () =>
      all.filter((post) => {
        const stamp = post.completed_at ?? post.created_at;
        return stamp && Date.now() - new Date(stamp).getTime() < 86_400_000;
      }).length,
    [all]
  );

  const toggle = useMutation({
    mutationFn: ({ id, next }) => setLike(id, next),
    onMutate: ({ id, next }) => setOptimistic((current) => ({ ...current, [id]: next })),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['myLikes'] });
    },
  });

  const renderItem = useCallback(
    ({ item, index }) => (
      <Rise index={index} style={styles.postWrap}>
        <PostCard
          post={item}
          media={media.data?.[item.id]}
          liked={optimistic[item.id] ?? likedSet.has(item.id)}
          onToggleLike={(id, next) => toggle.mutate({ id, next })}
          onOpen={() => router.push(`/replay/${item.id}`)}
          onOpenEvent={() => router.push(`/event/${item.events?.id}`)}
        />
      </Rise>
    ),
    [media.data, optimistic, likedSet, toggle, router]
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={<Wordmark />}
        right={
          <View style={styles.headActions}>
            <RoundButton
              name="bell"
              label="Recent"
              badge={fresh || null}
              onPress={() => router.push('/(tabs)/events')}
            />
            <RoundButton name="plus" tone="filled" label="New event" onPress={() => setCreating(true)} />
          </View>
        }
      >
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search films, events, people"
        />
        {all.length > 1 ? (
          <View style={styles.sortRow}>
            <Text style={styles.count}>
              {list.length} {list.length === 1 ? 'film' : 'films'}
            </Text>
            <Pressable style={styles.sortBtn} onPress={() => setSorting(true)} hitSlop={8}>
              <Feather name="sliders" size={13} color={colors.primary} />
              <Text style={styles.sortText}>{sortLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScreenHeader>

      <FlatList
        contentContainerStyle={styles.content}
        // Empty until the posters are decoded, so ListEmptyComponent shows the
        // skeleton. The gate used to sit only on that component, which renders
        // exclusively when the list *is* empty — so with posts present it never
        // ran, and the feed drew every card straight into its placeholders.
        data={warm ? list : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          !query ? (
            <View>
              {tour.show ? (
                <Tour
                  onDismiss={tour.dismiss}
                  onStart={() => {
                    tour.dismiss();
                    setCreating(true);
                  }}
                />
              ) : null}
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        ListEmptyComponent={
          posts.isLoading || !warm ? (
            <FeedSkeleton count={2} />
          ) : query ? (
            <Empty icon="🔍" title="Nothing matches" body={`No films for “${query}”.`} />
          ) : (
            <Empty
              icon="🎬"
              title="No films yet"
              body="Make an event, add photos, generate a film."
            />
          )
        }
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={9}
        refreshControl={
          <RefreshControl
            refreshing={posts.isFetching}
            onRefresh={posts.refetch}
            tintColor={colors.primary}
          />
        }
      />

      <CreateEventSheet visible={creating} onClose={() => setCreating(false)} />
      <SortSheet
        visible={sorting}
        onClose={() => setSorting(false)}
        options={SORTS.films}
        value={sort}
        onChange={setSort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // The rail runs edge to edge, so the gutter lives on the cards rather than the
  // list. Posts carry their own horizontal margin.
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  headActions: { flexDirection: 'row', gap: spacing.sm },
  postWrap: { paddingHorizontal: spacing.lg },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...type.caption, color: colors.textMuted },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { ...type.label, color: colors.primary },
});
