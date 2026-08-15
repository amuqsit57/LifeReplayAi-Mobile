import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, type } from '../theme';

const SEEN_KEY = 'lifereplay.tour.seen.v1';
const { width } = Dimensions.get('window');

/**
 * What this app is, said once.
 *
 * Three cards, swiped, dismissible at any point and never shown again. It lives
 * inside the feed rather than over it: a modal on first launch is something to
 * get past before you can look, and the thing people actually want on opening an
 * app for the first time is to look. This sits where the films will be, so
 * dismissing it reveals the empty feed it was explaining.
 */
const STEPS = [
  {
    icon: 'users',
    title: 'One event, everyone’s camera',
    body:
      'Share the code. Everyone adds what they took.',
    tint: colors.primary,
  },
  {
    icon: 'eye',
    title: 'It watches everything',
    body:
      'Every photo and clip is read for what happens in it. Duplicates are dropped.',
    tint: colors.accent,
  },
  {
    icon: 'film',
    title: 'Then it cuts a film',
    body:
      'Pick a style. It chooses the shots, paces, grades and scores them.',
    tint: colors.success,
  },
];

export function useTour() {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => setShow(!seen))
      // A storage read that fails should not mean the tour runs forever; better
      // to skip it than to show it on every launch.
      .catch(() => setShow(false))
      .finally(() => setReady(true));
  }, []);

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(SEEN_KEY, String(Date.now())).catch(() => {});
  };

  return { show: ready && show, dismiss };
}

export default function Tour({ onDismiss, onStart }) {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const pager = useRef(null);
  // Measured rather than derived from the window, so the page width matches the
  // card whatever padding it ends up with.
  const [pageWidth, setPageWidth] = useState(width - spacing.lg * 2);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [fade]);

  // Next only moved the state; the pager stayed where it was, so the words never
  // changed. Moving the scroller is what actually advances it.
  const goTo = (next) => {
    setIndex(next);
    pager.current?.scrollTo({ x: next * pageWidth, animated: true });
  };

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]}>
      <LinearGradient
        colors={[colors.primarySoft, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.card}
      >
        <View style={styles.top}>
          <Text style={styles.eyebrow}>NEW HERE</Text>
          <Pressable onPress={onDismiss} hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth))
          }
          style={{ marginHorizontal: -spacing.lg }}
        >
          {STEPS.map((entry) => (
            <View key={entry.title} style={[styles.page, { width: pageWidth }]}>
              <View style={[styles.badge, { backgroundColor: entry.tint + '1A' }]}>
                <Feather name={entry.icon} size={19} color={entry.tint} />
              </View>
              <Text style={styles.title}>{entry.title}</Text>
              <Text style={styles.body}>{entry.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.foot}>
          <View style={styles.dots}>
            {STEPS.map((entry, position) => (
              <View
                key={entry.title}
                style={[
                  styles.dot,
                  position === index && { backgroundColor: step.tint, width: 18 },
                ]}
              />
            ))}
          </View>

          <Pressable
            style={[styles.cta, { backgroundColor: last ? colors.primary : colors.surfaceAlt }]}
            onPress={() => (last ? onStart?.() : goTo(Math.min(index + 1, STEPS.length - 1)))}
          >
            <Text style={[styles.ctaText, { color: last ? '#fff' : colors.text }]}>
              {last ? 'Make my first event' : 'Next'}
            </Text>
            <Feather
              name="arrow-right"
              size={15}
              color={last ? '#fff' : colors.text}
            />
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '26',
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...type.tiny, color: colors.primary, letterSpacing: 1.2 },
  skip: { ...type.label, color: colors.textMuted },

  page: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, color: colors.text },
  body: { ...type.caption, color: colors.textSoft, lineHeight: 19 },

  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  ctaText: { ...type.label },
});
