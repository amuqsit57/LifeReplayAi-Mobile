import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '../theme';

// How many pages either side of the current one are allowed to hold their media.
// Everything further away renders as an empty frame, so opening one photo in an
// event of three hundred does not try to decode three hundred images.
const NEIGHBOURS = 1;

const MAX_ZOOM = 4;
// Far enough that it cannot be a mistake, near enough that it is one flick.
const DISMISS_AT = 110;

const distance = (touches) => {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

/**
 * One photograph, which can be pinched.
 *
 * Built on PanResponder and RN's own Animated rather than a gesture library:
 * this project has react-native-gesture-handler but no Reanimated, and the half
 * of that pairing that makes gestures cheap is the half that is missing. Two
 * touches and a bit of trigonometry needs neither.
 *
 * The gesture has to share the screen with the pager underneath it, so it claims
 * a drag only when it is one this page should own — a second finger, or a drag
 * while zoomed in, or a downward pull to dismiss. Everything else falls through
 * and pages, which is why swiping between photographs still feels untouched.
 */
function Zoomable({ width, height, zoomed, onZoomChange, onDismiss, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(1)).current;

  // The numbers the gesture does arithmetic on. Animated.Value cannot be read
  // synchronously, and a gesture needs to know where it started from.
  const now = useRef({ scale: 1, x: 0, y: 0 });
  const from = useRef({ scale: 1, x: 0, y: 0, span: 0 });
  const lastTap = useRef(0);

  const settle = useCallback(
    (nextScale, nextX = 0, nextY = 0) => {
      now.current = { scale: nextScale, x: nextX, y: nextY };
      onZoomChange(nextScale > 1.01);
      Animated.parallel([
        Animated.spring(scale, { toValue: nextScale, useNativeDriver: true, speed: 20, bounciness: 4 }),
        Animated.spring(panX, { toValue: nextX, useNativeDriver: true, speed: 20, bounciness: 4 }),
        Animated.spring(panY, { toValue: nextY, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ]).start();
    },
    [onZoomChange, scale, panX, panY]
  );

  // A photograph is never left zoomed when you swipe away from it — coming back
  // to a page still magnified and offset is disorienting, and there is no way to
  // tell from the thumbnail that it will be.
  const reset = useCallback(() => {
    now.current = { scale: 1, x: 0, y: 0 };
    scale.setValue(1);
    panX.setValue(0);
    panY.setValue(0);
    backdrop.setValue(1);
  }, [scale, panX, panY, backdrop]);

  useEffect(() => {
    if (!zoomed) reset();
  }, [zoomed, reset]);

  // How far the picture may be dragged before it would show its own edge.
  const bounds = (atScale) => ({
    x: Math.max(0, (width * atScale - width) / 2),
    y: Math.max(0, (height * atScale - height) / 2),
  });

  const responder = useRef(
    PanResponder.create({
      // A second finger is always this page's business.
      onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (event, gesture) => {
        if (event.nativeEvent.touches.length === 2) return true;
        // Zoomed in, any drag moves the picture rather than the pager.
        if (now.current.scale > 1.01) return true;
        // Otherwise only a deliberate downward pull, which is the dismiss. The
        // horizontal test is what keeps a diagonal swipe paging.
        return gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.8;
      },
      onPanResponderGrant: (event) => {
        const { touches } = event.nativeEvent;
        from.current = {
          ...now.current,
          span: touches.length === 2 ? distance(touches) : 0,
        };
      },
      onPanResponderMove: (event, gesture) => {
        const { touches } = event.nativeEvent;

        if (touches.length === 2) {
          const span = distance(touches);
          if (!from.current.span) from.current.span = span;
          const next = Math.max(1, Math.min(MAX_ZOOM, from.current.scale * (span / from.current.span)));
          now.current.scale = next;
          scale.setValue(next);
          return;
        }

        if (now.current.scale > 1.01) {
          const limit = bounds(now.current.scale);
          const x = Math.max(-limit.x, Math.min(limit.x, from.current.x + gesture.dx));
          const y = Math.max(-limit.y, Math.min(limit.y, from.current.y + gesture.dy));
          now.current.x = x;
          now.current.y = y;
          panX.setValue(x);
          panY.setValue(y);
          return;
        }

        // Pulling down to leave. The picture follows the finger and the black
        // behind it thins out, so the gesture reads as lifting it off the screen
        // rather than scrolling something.
        panY.setValue(gesture.dy);
        backdrop.setValue(Math.max(0.3, 1 - Math.abs(gesture.dy) / (height * 0.6)));
      },
      onPanResponderRelease: (event, gesture) => {
        if (now.current.scale <= 1.01 && gesture.dy > DISMISS_AT) {
          onDismiss();
          // Put it back for next time — the modal keeps this page mounted.
          requestAnimationFrame(reset);
          return;
        }

        Animated.spring(backdrop, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

        if (now.current.scale <= 1.01) {
          settle(1);
          return;
        }

        // Snap back inside the frame if the pinch left it hanging over an edge.
        const limit = bounds(now.current.scale);
        settle(
          now.current.scale,
          Math.max(-limit.x, Math.min(limit.x, now.current.x)),
          Math.max(-limit.y, Math.min(limit.y, now.current.y))
        );
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // Double tap: in to 2.5x, or straight back out. Faster than pinching for the
  // thing people actually want, which is a closer look at one face.
  const tap = () => {
    const at = Date.now();
    if (at - lastTap.current < 260) {
      lastTap.current = 0;
      settle(now.current.scale > 1.01 ? 1 : 2.5);
    } else {
      lastTap.current = at;
    }
  };

  return (
    <Animated.View
      {...responder.panHandlers}
      onStartShouldSetResponder={() => true}
      onResponderRelease={tap}
      style={[
        { width, height },
        // Thinning out as it is pulled away reads as lifting the picture off the
        // screen. Done on the picture rather than on a backdrop behind it: the
        // modal is opaque, so there is nothing behind to reveal.
        { opacity: backdrop },
        { transform: [{ translateX: panX }, { translateY: panY }, { scale }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Page({ memory, active, near, width, height, zoomed, onZoomChange, onDismiss }) {
  const [loaded, setLoaded] = useState(false);
  const size = { width, height };

  if (!near) return <View style={[styles.page, size]} />;

  const media = (
    <>
      {memory.kind === 'video' ? (
        // The poster carries the page; the player is mounted over it only when
        // this is the page being looked at.
        <Image
          cachePolicy="memory-disk"
          source={{ uri: memory.thumbnail_url }}
          style={size}
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
          style={size}
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
    </>
  );

  // Video keeps its own controls and its own gestures; wrapping a player in a
  // pinch would fight the scrubber for every drag.
  if (memory.kind === 'video') return <View style={[styles.page, size]}>{media}</View>;

  return (
    <View style={[styles.page, size]}>
      <Zoomable
        width={width}
        height={height}
        zoomed={active && zoomed}
        onZoomChange={(on) => active && onZoomChange(on)}
        onDismiss={onDismiss}
      >
        {media}
      </Zoomable>
    </View>
  );
}

/** Full screen media, swiped through horizontally. */
export default function Viewer({ memories = [], startId, visible, onClose, onDelete }) {
  // Read live rather than captured when the module loaded: the page width is
  // what the paging maths divides by, so a rotation used to leave every swipe
  // landing between two photographs.
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const startIndex = Math.max(0, memories.findIndex((m) => m.id === startId));
  const [index, setIndex] = useState(startIndex);

  // A magnified photograph owns every drag on it, so the pager has to stand
  // down — otherwise panning across a zoomed image flicks to the next one.
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (visible) setIndex(Math.max(0, memories.findIndex((m) => m.id === startId)));
  }, [visible, startId, memories]);

  // Leaving a page, or the viewer, drops the zoom with it.
  useEffect(() => setZoomed(false), [index, visible]);

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
          scrollEnabled={!zoomed}
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
              width={width}
              height={height}
              zoomed={zoomed}
              onZoomChange={setZoomed}
              onDismiss={onClose}
            />
          ))}
        </ScrollView>

        {isVideo && player ? (
          <View style={styles.playerLayer} pointerEvents="box-none">
            <VideoView
              player={player}
              style={{ width, height }}
              contentFit="contain"
              nativeControls
            />
          </View>
        ) : null}

        {/* Held clear of the notch rather than 52pt down from the top, which is
            under the clock on some phones and adrift on others.

            Gone while zoomed in: the controls sit over the corners of the
            picture, which is exactly the part somebody has just magnified in
            order to see. */}
        <View
          style={[styles.top, { top: insets.top + spacing.sm }, zoomed && styles.hidden]}
          pointerEvents={zoomed ? 'none' : 'auto'}
        >
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

        {current?.description && !zoomed ? (
          <View style={[styles.caption, { bottom: insets.bottom + spacing.xl }]}>
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
  // Width and height come from the component, where the window is known.
  page: { alignItems: 'center', justifyContent: 'center' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // Sits over the paging scroller rather than inside it, so exactly one player
  // exists no matter how many pages there are.
  playerLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  top: {
    position: 'absolute',
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
  hidden: { opacity: 0 },

  caption: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 4,
  },
  captionText: { ...type.body, color: '#fff' },
  tags: { ...type.caption, color: 'rgba(255,255,255,0.7)' },
});
