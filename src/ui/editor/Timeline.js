import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { transitionLabel } from '../../lib/plan';
import { colors, radius, spacing, type } from '../../theme';

// A shot's width says how long it runs. A fixed grid of squares is easier to
// build and tells you nothing — the whole reason to look at a timeline instead of
// a list is to see the shape of the film, where it lingers and where it hurries.
const BASE_WIDTH = 34;
const PER_SECOND = 13;
const HEIGHT = 62;

const widthFor = (seconds) => BASE_WIDTH + Math.max(0, Number(seconds) || 0) * PER_SECOND;

/**
 * The filmstrip.
 *
 * Between every pair of shots sits the join — tappable, because a transition
 * belongs to the gap and not to either shot, and putting it in a menu is how
 * every phone editor makes transitions feel like an afterthought.
 */
export default function Timeline({
  clips,
  byId,
  selected,
  onSelect,
  onSelectJoin,
  onAdd,
}) {
  const scroller = useRef(null);
  const offsets = useRef([]);

  // Keep the selected shot on screen when selection moves from somewhere else —
  // reordering, or stepping through with the arrows.
  useEffect(() => {
    const x = offsets.current[selected];
    if (x != null && scroller.current) {
      scroller.current.scrollTo({ x: Math.max(0, x - 90), animated: true });
    }
  }, [selected]);

  let running = 0;

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {clips.map((clip, index) => {
          const memory = byId[clip.memory_id];
          const isOn = index === selected;
          const width = widthFor(clip.seconds);
          offsets.current[index] = running;
          running += width + (index < clips.length - 1 ? 26 : 0);

          return (
            <View key={`${clip.memory_id}-${index}`} style={styles.unit}>
              <Pressable
                onPress={() => onSelect(index)}
                style={[styles.shot, { width }, isOn && styles.shotOn]}
              >
                {memory?.thumbnail_url ? (
                  <Image
                    source={{ uri: memory.thumbnail_url }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={120}
                    recyclingKey={clip.memory_id}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Feather name="image" size={13} color={colors.textMuted} />
                  </View>
                )}

                <View style={styles.foot}>
                  <Text style={styles.footText} numberOfLines={1}>
                    {Number(clip.seconds).toFixed(1)}s
                  </Text>
                </View>

                {memory?.kind === 'video' ? (
                  <View style={styles.kind}>
                    <Feather name="video" size={9} color="#fff" />
                  </View>
                ) : null}
              </Pressable>

              {index < clips.length - 1 ? (
                <Pressable
                  style={styles.join}
                  onPress={() => onSelectJoin(index)}
                  hitSlop={6}
                  accessibilityLabel={`Transition after shot ${index + 1}: ${transitionLabel(
                    clip.transition
                  )}`}
                >
                  <View
                    style={[
                      styles.joinPip,
                      clip.transition === 'cut' && styles.joinCut,
                    ]}
                  >
                    <Feather
                      name={clip.transition === 'cut' ? 'minus' : 'more-horizontal'}
                      size={11}
                      color={clip.transition === 'cut' ? colors.textMuted : colors.primary}
                    />
                  </View>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <Pressable style={styles.add} onPress={onAdd}>
          <Feather name="plus" size={19} color={colors.primary} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceAlt, paddingVertical: spacing.md },
  strip: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  unit: { flexDirection: 'row', alignItems: 'center' },

  shot: {
    height: HEIGHT,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.mediaPlaceholder,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shotOn: { borderColor: colors.primary },
  thumb: { ...StyleSheet.absoluteFillObject },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },

  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: 'rgba(12,9,20,0.62)',
  },
  // On a photograph, never a theme token.
  footText: { ...type.tiny, fontSize: 9.5, color: '#fff', textAlign: 'center' },
  kind: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(12,9,20,0.62)',
    borderRadius: radius.pill,
    padding: 3,
  },

  join: { width: 26, alignItems: 'center', justifyContent: 'center' },
  joinPip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  joinCut: { backgroundColor: colors.surfaceSunk },

  add: {
    height: HEIGHT,
    width: 62,
    marginLeft: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addText: { ...type.tiny, color: colors.primary },
});
