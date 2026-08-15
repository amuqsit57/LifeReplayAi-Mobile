import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Shimmer } from './Skeleton';

/**
 * A picture that is never shown half-arrived.
 *
 * Prefetching the first screenful gets the page open quickly, but it can only
 * ever cover the first screenful — and it gives up after a few seconds so a slow
 * image does not hold the whole page hostage. Everything it does not cover used
 * to land on screen as a grey box that turned into a photograph a moment later,
 * which is the placeholder-then-image flicker.
 *
 * So the wait belongs on each picture as well as on the page. The frame shimmers
 * until this particular image has actually loaded, then the shimmer goes and the
 * finished photograph is there in one step. Nothing in between.
 *
 * `settled` holds the URL that has finished rather than a plain boolean: when a
 * recycled tile is handed a new picture the old one must not count as this one,
 * and comparing URLs is the only way to tell them apart without a render in the
 * middle where the wrong image is called ready.
 */
export default function Photo({
  uri,
  style,
  contentFit = 'cover',
  transition = 0,
  recyclingKey,
  blurRadius,
  children,
  ...rest
}) {
  const [settled, setSettled] = useState(null);
  const ready = Boolean(uri) && settled === uri;

  // Never a reason to shimmer forever: an image that is unreachable and does not
  // trouble to say so should cost the polish, not the tile.
  useEffect(() => {
    if (!uri || ready) return undefined;
    const timer = setTimeout(() => setSettled(uri), 8000);
    return () => clearTimeout(timer);
  }, [uri, ready]);

  if (!uri) return <View style={[styles.frame, style]}>{children}</View>;

  return (
    <View style={[styles.frame, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        // No fade. The shimmer above is already the transition, and a second one
        // underneath it reads as the image arriving twice.
        transition={transition}
        recyclingKey={recyclingKey}
        blurRadius={blurRadius}
        onLoad={() => setSettled(uri)}
        onError={() => setSettled(uri)}
        {...rest}
      />
      {ready ? null : <Shimmer style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

// The caller's style carries the shape; this only makes sure the shimmer and the
// image are clipped to it rather than squaring off its corners.
const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
