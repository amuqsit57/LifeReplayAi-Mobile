/** Pieces the feed and the gallery share: people, counts, and media tiles. */

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../theme';

const SIZES = { sm: 28, md: 38, lg: 56 };

/** Someone's face, or their initials when they have not set one. */
export function Avatar({ url, name, size = 'md' }) {
  const px = SIZES[size] ?? SIZES.md;
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: px, height: px, borderRadius: px / 2, backgroundColor: colors.surfaceAlt }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.initials,
        { width: px, height: px, borderRadius: px / 2 },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize: px * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

/** A stack of faces, for "who is in this event". */
export function AvatarRow({ people = [], max = 4, size = 'sm' }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const px = SIZES[size] ?? SIZES.sm;

  return (
    <View style={styles.row}>
      {shown.map((person, index) => (
        <View
          key={person.user_id ?? person.id ?? index}
          // Overlapped rather than spaced: a row of faces should read as a group,
          // and at four or more the spacing version runs off the card.
          style={{ marginLeft: index === 0 ? 0 : -px * 0.32 }}
        >
          <Avatar url={person.avatar_url} name={person.full_name} size={size} />
        </View>
      ))}
      {rest > 0 ? (
        <View style={[styles.more, { height: px, marginLeft: -px * 0.2 }]}>
          <Text style={styles.moreText}>+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** A tappable count with a drawn icon — likes, comments, shares. */
export function ActionCount({ icon, count, label, active, onPress, tint }) {
  const colour = active ? tint ?? colors.accent : colors.textSoft;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.55 }]}
    >
      <Feather name={icon} size={19} color={colour} />
      {count > 0 ? (
        <Text style={[styles.actionCount, active && { color: colour }]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

/** A media thumbnail with the selection and kind marks a gallery needs. */
export function MediaTile({
  uri,
  kind = 'photo',
  selected,
  dimmed,
  badge,
  uploader,
  onPress,
  onLongPress,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={220}
      style={[styles.tile, style]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.tileImage, selected && styles.tileSelected, dimmed && { opacity: 0.4 }]}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View style={[styles.tileImage, styles.tileEmpty]}>
          <Text style={{ fontSize: 22 }}>{kind === 'video' ? '🎬' : '🖼'}</Text>
        </View>
      )}

      {kind === 'video' ? (
        <View style={styles.kindMark}>
          <Feather name="play" size={9} color="#fff" />
        </View>
      ) : null}

      {/* Only ever a problem or a wait — a tile that is fine says nothing, which
          is why "ready" no longer sits under every photo in the grid. */}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}

      {/* Whose photo this is. Hidden while selecting, where the tick owns the corner. */}
      {uploader && !selected ? (
        <View style={styles.uploader}>
          <Avatar url={uploader.avatar_url} name={uploader.full_name} size="sm" />
        </View>
      ) : null}

      {selected ? (
        <View style={styles.tick}>
          <Text style={styles.tickText}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  initials: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  initialsText: { color: colors.primary, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center' },
  more: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  moreText: { ...type.tiny, color: colors.textSoft },

  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 19, color: colors.textSoft },
  actionCount: { ...type.label, color: colors.textSoft },

  tile: { position: 'relative' },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.mediaPlaceholder,
  },
  tileSelected: { borderWidth: 3, borderColor: colors.primary },
  tileEmpty: { alignItems: 'center', justifyContent: 'center' },

  kindMark: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindMarkText: { color: '#fff', fontSize: 9, marginLeft: 1 },

  badge: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.scrim,
  },
  badgeText: { ...type.tiny, color: '#fff' },

  uploader: {
    position: 'absolute',
    right: 4,
    top: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tick: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});

export const gridGap = spacing.sm;
