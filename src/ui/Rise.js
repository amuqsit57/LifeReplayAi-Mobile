import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Content arriving rather than appearing.
 *
 * A short lift and fade, staggered by position, so a list assembles itself
 * instead of snapping into place all at once. Deliberately brief — anything
 * longer than a couple of hundred milliseconds stops reading as polish and
 * starts reading as lag, especially on a screen that is also decoding images.
 *
 * The stagger is capped: on the twentieth card a per-index delay would be a
 * second and a half of nothing.
 */
export default function Rise({ children, index = 0, distance = 14 }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }, Math.min(index, 6) * 45);

    return () => clearTimeout(timer);
  }, [progress, index]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [distance, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
