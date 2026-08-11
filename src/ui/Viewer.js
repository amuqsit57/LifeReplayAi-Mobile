import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing, type } from '../theme';

const { width } = Dimensions.get('window');

/**
 * Full screen media, swiped through horizontally.
 *
 * Shows the original rather than the thumbnail — this is the one place where
 * paying for the full file is the point, and it is one at a time rather than a
 * gridful.
 */
export default function Viewer({ memories = [], startId, visible, onClose, onDelete }) {
  const startIndex = Math.max(0, memories.findIndex((m) => m.id === startId));
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (visible) setIndex(Math.max(0, memories.findIndex((m) => m.id === startId)));
  }, [visible, startId, memories]);

  const current = memories[index];

  // A single player, pointed at whichever video is on screen.
  //
  // There is deliberately no player per page: hooks cannot be called from inside
  // the map, and a dozen players held open at once would keep a dozen videos
  // decoding for the one being watched. Pages that are not current show their
  // still instead.
  const player = useVideoPlayer(
    current?.kind === 'video' ? current.url : null,
    (instance) => {
      instance.loop = true;
    }
  );

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: startIndex * width, y: 0 }}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        >
          {memories.map((memory, position) => (
            <View key={memory.id} style={styles.page}>
              {memory.kind === 'video' && position === index ? (
                <VideoView
                  player={player}
                  style={styles.media}
                  contentFit="contain"
                  nativeControls
                />
              ) : (
                <Image
                  // A photo shows its original — full screen is the one place
                  // worth paying for it. A video that is not the current page
                  // shows its poster, since an Image cannot render an mp4.
                  source={{
                    uri:
                      memory.kind === 'video'
                        ? memory.thumbnail_url
                        : memory.url ?? memory.thumbnail_url,
                  }}
                  style={styles.media}
                  contentFit="contain"
                  transition={140}
                />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.counter}>
            {memories.length ? `${index + 1} of ${memories.length}` : ''}
          </Text>
          <Pressable
            hitSlop={12}
            onPress={() =>
              Alert.alert('Delete this?', 'It is removed for everyone in the event.', [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => onDelete?.(current?.id),
                },
              ])
            }
          >
            <Text style={styles.close}>🗑</Text>
          </Pressable>
        </View>

        {current?.description ? (
          <View style={styles.caption}>
            <Text style={styles.captionText} numberOfLines={3}>
              {current.description}
            </Text>
            {current.tags?.length ? (
              <Text style={styles.tags} numberOfLines={1}>
                {current.tags.slice(0, 5).join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  page: { width, flex: 1, alignItems: 'center', justifyContent: 'center' },
  media: { width, flex: 1 },

  top: {
    position: 'absolute',
    top: 52,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: { color: '#fff', fontSize: 20 },
  counter: { ...type.label, color: '#fff' },

  caption: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 44,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 4,
  },
  captionText: { ...type.body, color: '#fff' },
  tags: { ...type.caption, color: 'rgba(255,255,255,0.7)' },
});
