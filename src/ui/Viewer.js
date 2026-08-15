import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

const { width, height } = Dimensions.get('window');

// How many pages either side of the current one are allowed to hold their media.
// Everything further away renders as an empty frame, so opening one photo in an
// event of three hundred does not try to decode three hundred images.
const NEIGHBOURS = 1;

function Page({ memory, active, near }) {
  const [loaded, setLoaded] = useState(false);

  if (!near) return <View style={styles.page} />;

  return (
    <View style={styles.page}>
      {memory.kind === 'video' ? (
        // The poster carries the page; the player is mounted over it only when
        // this is the page being looked at.
        <Image
          cachePolicy="memory-disk"
          source={{ uri: memory.thumbnail_url }}
          style={styles.media}
          contentFit="contain"
          onLoadEnd={() => setLoaded(true)}
        />
      ) : (
        <Image
          cachePolicy="memory-disk"
          // Full screen is the one place worth paying for the original, but the
          // thumbnail is already cached from the grid — showing it first means
          // something appears instantly and sharpens a moment later.
          source={{ uri: memory.url ?? memory.thumbnail_url }}
          placeholder={{ uri: memory.thumbnail_url }}
          style={styles.media}
          contentFit="contain"
          transition={160}
          onLoadEnd={() => setLoaded(true)}
        />
      )}

      {!loaded ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

/** Full screen media, swiped through horizontally. */
export default function Viewer({ memories = [], startId, visible, onClose, onDelete }) {
  const startIndex = Math.max(0, memories.findIndex((m) => m.id === startId));
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (visible) setIndex(Math.max(0, memories.findIndex((m) => m.id === startId)));
  }, [visible, startId, memories]);

  const current = memories[index];
  const isVideo = current?.kind === 'video' && Boolean(current?.url);

  // A single player for whichever video is on screen. The hook has to run every
  // render, so it is always called — but it is only given a source when there is
  // a video to play, and the view is only mounted when a player came back.
  // Passing a null player is what "cannot set prop player on view" was.
  const player = useVideoPlayer(isVideo ? current.url : null, (instance) => {
    if (instance) instance.loop = true;
  });

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
            <Page
              key={memory.id}
              memory={memory}
              active={position === index}
              near={Math.abs(position - index) <= NEIGHBOURS}
            />
          ))}
        </ScrollView>

        {isVideo && player ? (
          <View style={styles.playerLayer} pointerEvents="box-none">
            <VideoView
              player={player}
              style={styles.media}
              contentFit="contain"
              nativeControls
            />
          </View>
        ) : null}

        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.control}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>

          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {memories.length ? `${index + 1} / ${memories.length}` : ''}
            </Text>
          </View>

          <Pressable
            hitSlop={12}
            style={styles.control}
            onPress={() =>
              Alert.alert('Remove this?', 'It is removed for everyone in the event.', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDelete?.(current?.id) },
              ])
            }
          >
            <Feather name="trash-2" size={18} color="#fff" />
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
  page: { width, height, alignItems: 'center', justifyContent: 'center' },
  media: { width, height },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // Sits over the paging scroller rather than inside it, so exactly one player
  // exists no matter how many pages there are.
  playerLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  top: {
    position: 'absolute',
    top: 52,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  control: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counterText: { ...type.label, color: '#fff' },

  caption: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 48,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 4,
  },
  captionText: { ...type.body, color: '#fff' },
  tags: { ...type.caption, color: 'rgba(255,255,255,0.7)' },
});
