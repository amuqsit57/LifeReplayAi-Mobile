import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { feed, myLikes, setLike } from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import { Wordmark } from '../../src/ui/brand';
import CreateEventSheet from '../../src/ui/CreateEventSheet';
import { RoundButton, ScreenHeader, SearchBar } from '../../src/ui/Header';
import { FeedSkeleton } from '../../src/ui/Skeleton';
import { ActionCount, Avatar } from '../../src/ui/social';

function when(iso) {
  if (!iso) return '';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function runtime(seconds) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function Post({ post, media, liked, onToggleLike }) {
  const router = useRouter();
  const style = STYLE_META[post.style] ?? {};
  const author = post.profiles ?? {};
  const event = post.events ?? {};

  const likes = post.replay_likes?.[0]?.count ?? 0;
  const comments = post.replay_comments?.[0]?.count ?? 0;
  const length = runtime(post.duration_seconds);

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <Avatar url={author.avatar_url} name={author.full_name} size="md" />
        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/event/${event.id}`)}>
          <Text style={styles.author} numberOfLines={1}>
            {author.full_name ?? 'Someone'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {event.title ?? 'An event'}
            {post.albums?.title ? ` · ${post.albums.title}` : ''}
          </Text>
        </Pressable>
        <Text style={styles.time}>{when(post.completed_at ?? post.created_at)}</Text>
      </View>

      <Pressable onPress={() => router.push(`/replay/${post.id}`)} style={styles.stage}>
        {media?.thumbnail_url ? (
          <Image
            source={{ uri: media.thumbnail_url }}
            style={styles.poster}
            contentFit="cover"
            transition={140}
            recyclingKey={post.id}
          />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Feather name="film" size={26} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.play}>
          <Feather name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
        </View>

        <View style={styles.overlayTop}>
          <View style={[styles.styleChip, { backgroundColor: (style.tint ?? colors.primary) }]}>
            <Text style={styles.styleChipText}>{style.label ?? post.style}</Text>
          </View>
        </View>

        {length ? (
          <View style={styles.length}>
            <Text style={styles.lengthText}>{length}</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <ActionCount
          icon="heart"
          count={likes}
          label="Like"
          active={liked}
          tint={colors.accent}
          onPress={() => onToggleLike(post.id, !liked)}
        />
        <ActionCount
          icon="message-circle"
          count={comments}
          label="Comments"
          onPress={() => router.push(`/replay/${post.id}`)}
        />
        <ActionCount
          icon="share-2"
          label="Share"
          onPress={() =>
            Share.share({
              message: `${author.full_name ?? 'Someone'} made a film from ${
                event.title ?? 'an event'
              } on Life Replay.`,
            }).catch(() => {})
          }
        />
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [optimistic, setOptimistic] = useState({});
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  const posts = useQuery({ queryKey: ['feed'], queryFn: feed });
  const all = posts.data ?? [];

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((post) =>
      [post.events?.title, post.albums?.title, post.profiles?.full_name, STYLE_META[post.style]?.label]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    );
  }, [all, query]);

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

  const likedSet = useMemo(() => new Set(liked.data ?? []), [liked.data]);

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
    ({ item }) => (
      <Post
        post={item}
        media={media.data?.[item.id]}
        liked={optimistic[item.id] ?? likedSet.has(item.id)}
        onToggleLike={(id, next) => toggle.mutate({ id, next })}
      />
    ),
    [media.data, optimistic, likedSet, toggle]
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
      </ScreenHeader>

      <FlatList
        contentContainerStyle={styles.content}
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        ListEmptyComponent={
          posts.isLoading ? (
            <FeedSkeleton count={2} />
          ) : query ? (
            <Empty icon="🔍" title="Nothing matches" body={`No films for “${query}”.`} />
          ) : (
            <Empty
              icon="🎬"
              title="No films yet"
              body="Make an event, add photos and videos, then generate a film. It shows up here for everyone you invited."
            />
          )
        }
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={posts.isFetching}
            onRefresh={posts.refetch}
            tintColor={colors.primary}
          />
        }
      />

      <CreateEventSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  headActions: { flexDirection: 'row', gap: spacing.sm },

  post: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    // Clips the poster to the card's corners, so the rounding reads as one
    // shape rather than a rounded frame around a square picture.
    overflow: 'hidden',
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  author: { ...type.bodyStrong, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted },
  time: { ...type.caption, color: colors.textMuted },

  stage: { backgroundColor: colors.mediaPlaceholder },
  poster: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.mediaPlaceholder },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },

  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '43%',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(16,12,26,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },

  overlayTop: { position: 'absolute', top: spacing.md, left: spacing.md },
  styleChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  styleChipText: { ...type.tiny, color: '#fff' },

  length: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16,12,26,0.65)',
  },
  lengthText: { ...type.tiny, color: '#fff' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
