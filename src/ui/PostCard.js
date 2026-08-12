import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { STYLE_META, colors, radius, shadow, spacing, type } from '../theme';
import { ActionCount, Avatar } from './social';

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

/**
 * A film in the feed.
 *
 * Shaped like the film itself rather than like a social post with a picture in
 * it: a tall poster carrying its own title and credits, with the chrome sitting
 * on the image instead of in bands above and below it. The style's colour is the
 * only colour on the card, which is what makes four cinematic cuts and four
 * highlight reels distinguishable at a glance while scrolling.
 */
export default function PostCard({ post, media, liked, onToggleLike, onOpen, onOpenEvent }) {
  const meta = STYLE_META[post.style] ?? {};
  const author = post.profiles ?? {};
  const event = post.events ?? {};
  const likes = post.replay_likes?.[0]?.count ?? 0;
  const comments = post.replay_comments?.[0]?.count ?? 0;
  const length = runtime(post.duration_seconds);
  const shots = post.editing_plan?.clips?.length ?? 0;

  const heart = useRef(new Animated.Value(1)).current;
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!liked) return;
    // A small kick on the way in. Springs rather than a timing curve, because a
    // like should feel like a press rather than an animation playing.
    Animated.sequence([
      Animated.spring(heart, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 14 }),
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();
  }, [liked, heart]);

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.stage}>
        {media?.thumbnail_url ? (
          <Image
            source={{ uri: media.thumbnail_url }}
            style={styles.poster}
            contentFit="cover"
            transition={180}
            recyclingKey={post.id}
          />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Feather name={meta.icon ?? 'film'} size={28} color={colors.textMuted} />
          </View>
        )}

        <LinearGradient colors={colors.posterScrim} style={styles.scrim} pointerEvents="none" />

        <View style={styles.topRow}>
          <View style={[styles.styleChip, { backgroundColor: meta.tint ?? colors.primary }]}>
            <Feather name={meta.icon ?? 'film'} size={11} color="#fff" />
            <Text style={styles.styleChipText}>{meta.label ?? post.style}</Text>
          </View>
          {length ? (
            <View style={styles.runtime}>
              <Text style={styles.runtimeText}>{length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.play}>
          <Feather name="play" size={20} color="#fff" style={{ marginLeft: 3 }} />
        </View>

        {/* Title and credits sit on the picture, the way they would on a poster. */}
        <View style={styles.credits}>
          <Text style={styles.filmTitle} numberOfLines={2}>
            {post.editing_plan?.title || event.title || 'A film'}
          </Text>
          <Text style={styles.creditsLine} numberOfLines={1}>
            {event.title}
            {post.albums?.title ? ` · ${post.albums.title}` : ''}
            {shots ? ` · ${shots} shots` : ''}
          </Text>
        </View>
      </Pressable>

      <View style={styles.foot}>
        <Pressable style={styles.by} onPress={onOpenEvent}>
          <Avatar url={author.avatar_url} name={author.full_name} size="sm" />
          <Text style={styles.byText} numberOfLines={1}>
            {author.full_name ?? 'Someone'}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.byTime}>{when(post.completed_at ?? post.created_at)}</Text>
        </Pressable>

        <View style={styles.actions}>
          <Animated.View style={{ transform: [{ scale: heart }] }}>
            <ActionCount
              icon={liked ? 'heart' : 'heart'}
              count={likes}
              label="Like"
              active={liked}
              tint={colors.accent}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onToggleLike(post.id, !liked);
              }}
            />
          </Animated.View>
          <ActionCount icon="message-circle" count={comments} label="Comments" onPress={onOpen} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  stage: { backgroundColor: colors.mediaPlaceholder },
  // Nearer the shape of the films themselves without taking a whole screen.
  poster: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.mediaPlaceholder },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%' },

  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  styleChipText: { ...type.tiny, color: '#fff' },
  runtime: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10,7,18,0.5)',
  },
  runtimeText: { ...type.tiny, color: '#fff' },

  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(10,7,18,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },

  credits: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  filmTitle: { ...type.title, color: '#fff' },
  creditsLine: { ...type.caption, color: 'rgba(255,255,255,0.78)' },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  by: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  byText: { ...type.label, color: colors.text, flexShrink: 1 },
  dot: { ...type.caption, color: colors.borderStrong },
  byTime: { ...type.caption, color: colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
