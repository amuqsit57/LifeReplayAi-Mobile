import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

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

function Post({ post, liked, onToggleLike }) {
  const router = useRouter();
  const style = STYLE_META[post.style] ?? {};
  const author = post.profiles ?? {};
  const event = post.events ?? {};

  // Only the finished film is shared — never the originals. Signed on demand so a
  // link cannot be passed on to anyone outside the event.
  const media = useQuery({
    queryKey: ['replayMedia', post.id],
    queryFn: () => api.replay(post.id),
    staleTime: 45 * 60 * 1000,
  });

  const url = media.data?.url ?? null;

  // One player per post, which is safe because each post is its own component —
  // the hook could not be called from inside a map.
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  const likes = post.replay_likes?.[0]?.count ?? 0;
  const comments = post.replay_comments?.[0]?.count ?? 0;

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
            {post.albums?.title ? ` · ${post.albums.title}` : ''} · {when(post.completed_at ?? post.created_at)}
          </Text>
        </View>
        <View style={[styles.styleChip, { backgroundColor: (style.tint ?? colors.primary) + '18' }]}>
          <Text style={[styles.styleChipText, { color: style.tint ?? colors.primary }]}>
            {style.emoji} {style.label ?? post.style}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={() => router.push(`/replay/${post.id}`)} style={styles.stage}>
        {url ? (
          // Muted and looping in the feed, the way a social video behaves. Sound
          // and controls belong on the full screen, not four posts at once.
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={[styles.video, styles.stageEmpty]}>
            {media.data?.thumbnail_url ? (
              <Image
                source={{ uri: media.data.thumbnail_url }}
                style={styles.video}
                contentFit="cover"
              />
            ) : (
              <Text style={{ fontSize: 30 }}>{style.emoji ?? '🎬'}</Text>
            )}
          </View>
        )}
        <View style={styles.playHint}>
          <Text style={styles.playHintText}>▶ Tap to watch</Text>
        </View>
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
              message: `${author.full_name ?? 'Someone'} made a film from ${event.title ?? 'an event'} on Life Replay.`,
            })
          }
        />
        <View style={{ flex: 1 }} />
        {post.duration_seconds ? (
          <Text style={styles.duration}>
            {Math.floor(post.duration_seconds / 60)}:
            {String(Math.round(post.duration_seconds % 60)).padStart(2, '0')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState({});

  const posts = useQuery({ queryKey: ['feed'], queryFn: feed });
  const ids = useMemo(() => (posts.data ?? []).map((p) => p.id), [posts.data]);

  const liked = useQuery({
    queryKey: ['myLikes', ids.length],
    queryFn: () => myLikes(ids),
    enabled: ids.length > 0,
  });

  const likedSet = useMemo(() => new Set(liked.data ?? []), [liked.data]);

  const toggle = useMutation({
    mutationFn: ({ id, next }) => setLike(id, next),
    // The heart has to answer instantly; correcting it afterwards is fine, waiting
    // a round trip to fill it in is not.
    onMutate: ({ id, next }) => setOptimistic((current) => ({ ...current, [id]: next })),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['myLikes'] });
    },
  });

  const list = posts.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={posts.isFetching}
          onRefresh={posts.refetch}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.masthead}>Life Replay</Text>

      {list.length === 0 && !posts.isLoading ? (
        <Empty
          icon="🎬"
          title="No films yet"
          body="Make an event, add photos and videos, then generate a film. It will show up here for everyone you invited."
        />
      ) : (
        list.map((post) => (
          <Post
            key={post.id}
            post={post}
            liked={optimistic[post.id] ?? likedSet.has(post.id)}
            onToggleLike={(id, next) => toggle.mutate({ id, next })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  masthead: { ...type.display, color: colors.text },

  post: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  author: { ...type.bodyStrong, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted },
  styleChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  styleChipText: { ...type.tiny },

  stage: { backgroundColor: colors.mediaPlaceholder },
  // Portrait films, shown tall enough to feel like the phone footage they are
  // without taking a whole screen each.
  video: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.mediaPlaceholder },
  stageEmpty: { alignItems: 'center', justifyContent: 'center' },
  playHint: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  playHintText: { ...type.tiny, color: '#fff' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  duration: { ...type.caption, color: colors.textMuted },
});
