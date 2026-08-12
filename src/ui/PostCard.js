import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { STYLE_META, colors, radius, shadow, spacing, type } from '../theme';
import { Tappable } from './press';
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
 * The picture carries everything: what kind of film it is at the top, what it is
 * called at the bottom, how long it runs and a control to play it. Chrome on the
 * image rather than in bands above and below means the poster gets the whole
 * card, which is the only thing on screen worth the space.
 *
 * Everything drawn on the picture is white on a gradient, and fixed white at
 * that — never a theme token, since those follow the page and this sits on a
 * photograph.
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
    Animated.sequence([
      Animated.spring(heart, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 14 }),
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();
  }, [liked, heart]);

  return (
    <View style={styles.card}>
      <Tappable onPress={onOpen} scaleTo={0.985} haptic>
        <View style={styles.stage}>
          {media?.thumbnail_url ? (
            <Image
              source={{ uri: media.thumbnail_url }}
              style={styles.poster}
              contentFit="cover"
              transition={200}
              recyclingKey={post.id}
            />
          ) : (
            <View style={[styles.poster, styles.posterEmpty]}>
              <Feather name={meta.icon ?? 'film'} size={30} color={colors.textMuted} />
            </View>
          )}

          <LinearGradient colors={colors.posterScrim} style={styles.scrim} pointerEvents="none" />

          {/* What kind of film, and what it was made from. */}
          <View style={styles.topRow}>
            <View style={styles.chip}>
              <View style={[styles.chipDot, { backgroundColor: meta.tint ?? colors.primary }]} />
              <Text style={styles.chipText}>{meta.label ?? post.style}</Text>
            </View>
            {shots ? (
              <View style={styles.chip}>
                <Feather name="scissors" size={10} color="#fff" />
                <Text style={styles.chipText}>{shots}</Text>
              </View>
            ) : null}
          </View>

          {/* Title left, runtime and the play control right, on one baseline. */}
          <View style={styles.bottomRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.eyebrow} numberOfLines={1}>
                {event.title ?? 'An event'}
                {post.albums?.title ? ` · ${post.albums.title}` : ''}
              </Text>
              <Text style={styles.filmTitle} numberOfLines={2}>
                {post.editing_plan?.title || event.title || 'A film'}
              </Text>
            </View>

            <View style={styles.playBlock}>
              {length ? <Text style={styles.runtime}>{length}</Text> : null}
              <View style={styles.play}>
                <Feather name="play" size={17} color={colors.text} style={{ marginLeft: 2 }} />
              </View>
            </View>
          </View>
        </View>
      </Tappable>

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
              icon="heart"
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
  poster: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.mediaPlaceholder },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },

  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16,12,26,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...type.tiny, color: '#fff' },

  bottomRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  eyebrow: { ...type.caption, color: 'rgba(255,255,255,0.78)' },
  filmTitle: { ...type.title, color: '#fff' },

  playBlock: { alignItems: 'center', gap: 6 },
  runtime: { ...type.tiny, color: 'rgba(255,255,255,0.9)' },
  // Solid rather than translucent, so it reads as a control on any picture.
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
