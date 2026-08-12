import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
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
 * A film in the feed, and the frames it was cut from.
 *
 * The strip along the bottom is the point of this card. A photo app shows you a
 * picture; this shows you a film and, underneath it, the actual moments several
 * different people separately happened to capture that went into making it.
 * Nothing else in a feed can show that, because nothing else is assembled out of
 * a shared pool — and it says what the product does far better than any wording.
 *
 * Frames are taken evenly across the running order, so the strip reads as the
 * shape of the whole film rather than its opening seconds.
 */
export default function PostCard({ post, media, strip = [], liked, onToggleLike, onOpen, onOpenEvent }) {
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
      <Pressable onPress={onOpen} style={styles.stage}>
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
            <Feather name={meta.icon ?? 'film'} size={28} color={colors.textMuted} />
          </View>
        )}

        <LinearGradient colors={colors.posterScrim} style={styles.scrim} pointerEvents="none" />

        {/* A slate, the way a shot is marked before it is filmed. */}
        <View style={styles.slate}>
          <View style={[styles.slateBar, { backgroundColor: meta.tint ?? colors.primary }]} />
          <Text style={styles.slateText}>{(meta.label ?? post.style).toUpperCase()}</Text>
          {length ? <Text style={styles.slateDim}>{length}</Text> : null}
        </View>

        <View style={styles.play}>
          <Feather name="play" size={19} color={colors.text} style={{ marginLeft: 3 }} />
        </View>

        <View style={styles.credits}>
          <Text style={styles.filmTitle} numberOfLines={2}>
            {post.editing_plan?.title || event.title || 'A film'}
          </Text>
          <Text style={styles.creditsLine} numberOfLines={1}>
            {event.title}
            {post.albums?.title ? ` · ${post.albums.title}` : ''}
          </Text>
        </View>
      </Pressable>

      {strip.length ? (
        <Pressable onPress={onOpen} style={styles.strip}>
          <View style={styles.stripHead}>
            <Feather name="scissors" size={11} color={colors.textMuted} />
            <Text style={styles.stripLabel}>
              CUT FROM {shots ? `${shots} SHOTS` : 'YOUR MEMORIES'}
            </Text>
          </View>
          <View style={styles.frames}>
            {strip.slice(0, 5).map((uri, index) => (
              <Image
                key={`${post.id}-${index}`}
                source={{ uri }}
                style={styles.frame}
                contentFit="cover"
                transition={160}
              />
            ))}
          </View>
        </Pressable>
      ) : null}

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
              tint={colors.primary}
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
  poster: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.mediaPlaceholder },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },

  slate: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 5,
    paddingLeft: 0,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(8,6,5,0.62)',
    overflow: 'hidden',
  },
  slateBar: { width: 4, alignSelf: 'stretch', marginRight: 4 },
  slateText: { ...type.slate, color: colors.text },
  slateDim: { ...type.slate, color: colors.textSoft },

  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(246,240,232,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246,240,232,0.4)',
  },

  credits: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  filmTitle: { ...type.title, color: colors.text },
  creditsLine: { ...type.caption, color: colors.textSoft },

  // The contact sheet. Sunk below the card surface so it reads as material the
  // film was made from rather than as more of the film.
  strip: {
    backgroundColor: colors.surfaceSunk,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stripLabel: { ...type.slate, color: colors.textMuted, fontSize: 9.5 },
  frames: { flexDirection: 'row', gap: 4 },
  frame: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: colors.mediaPlaceholder,
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
