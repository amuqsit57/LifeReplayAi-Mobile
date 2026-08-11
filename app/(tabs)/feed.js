import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { feed, myLikes, setLike } from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import { ActionCount, Avatar } from '../../src/ui/social';

function when(iso) {
  if (!iso) return '';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function runtime(seconds) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/**
 * A post shows a poster, never a player.
 *
 * Every post used to open a real video player as soon as it mounted. With eighty
 * finished films averaging sixteen megabytes, a single pull of the feed asked the
 * phone to buffer close to a gigabyte at once — which is what made everything
 * crawl. A film plays when you tap it and not before.
 */
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
      <Pressable style={styles.head} onPress={() => router.push(`/event/${event.id}`)}>
        <Avatar url={author.avatar_url} name={author.full_name} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>
            {author.full_name ?? 'Someone'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {event.title ?? 'An event'}
            {post.albums?.title ? ` · ${post.albums.title}` : ''} ·{' '}
            {when(post.completed_at ?? post.created_at)}
          </Text>
        </View>
        <View style={[styles.styleChip, { backgroundColor: (style.tint ?? colors.primary) + '18' }]}>
          <Text style={[styles.styleChipText, { color: style.tint ?? colors.primary }]}>
            {style.emoji} {style.label ?? post.style}
          </Text>
        </View>
      </Pressable>

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
            <Text style={{ fontSize: 30 }}>{style.emoji ?? '🎬'}</Text>
          </View>
        )}

        <View style={styles.play}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
        {length ? (
          <View style={styles.length}>
            <Text style={styles.lengthText}>{length}</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <ActionCount
          icon={liked ? '♥' : '♡'}
          count={likes}
          label="Like"
          active={liked}
          tint={colors.accent}
          onPress={() => onToggleLike(post.id, !liked)}
        />
        <ActionCount
          icon="💬"
          count={comments}
          label="Comments"
          onPress={() => router.push(`/replay/${post.id}`)}
        />
        <ActionCount
          icon="↗"
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
  const [optimistic, setOptimistic] = useState({});

  const posts = useQuery({ queryKey: ['feed'], queryFn: feed });
  const list = posts.data ?? [];
  const ids = useMemo(() => list.map((p) => p.id), [list]);
  const idKey = ids.join(',');

  // One request for every poster in the feed, rather than one per post.
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

  const toggle = useMutation({
    mutationFn: ({ id, next }) => setLike(id, next),
    // The heart has to answer instantly; correcting it afterwards is fine,
    // waiting a round trip to fill it in is not.
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
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={<Text style={styles.masthead}>Life Replay</Text>}
      ListEmptyComponent={
        posts.isLoading ? null : (
          <Empty
            icon="🎬"
            title="No films yet"
            body="Make an event, add photos and videos, then generate a film. It will show up here for everyone you invited."
          />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.xl }} />}
      // Only what is on screen stays mounted. Without this every post in the feed
      // renders at once, which is fine for ten and not for eighty.
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  masthead: { ...type.display, color: colors.text, marginBottom: spacing.lg },

  post: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  author: { ...type.bodyStrong, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted },
  styleChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  styleChipText: { ...type.tiny },

  stage: { backgroundColor: colors.mediaPlaceholder },
  poster: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.mediaPlaceholder },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },

  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 20, marginLeft: 3 },

  length: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.scrim,
  },
  lengthText: { ...type.tiny, color: '#fff' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
