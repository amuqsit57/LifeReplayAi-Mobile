import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';

/**
 * Hold a list back until the pictures you can see have arrived.
 *
 * A grid that paints its titles first and fills in the images over the next
 * second reads as broken — the text lands, the layout settles, and then
 * everything twitches as each picture arrives. Waiting for the first screenful
 * costs a moment on a cold cache and nothing at all on a warm one, and what
 * appears is finished.
 *
 * Only the first screenful. Everything past it loads as it is scrolled to, which
 * is what lazy loading is for.
 *
 * @param {Array<string>} urls thumbnails, in the order they are drawn
 * @param {number} visible how many of them are on screen at once
 */
export function useWarmImages(urls, visible = 6) {
  const [ready, setReady] = useState(false);
  const key = urls.slice(0, visible).join(',');
  const timer = useRef(null);

  useEffect(() => {
    const first = urls.slice(0, visible).filter(Boolean);
    if (!first.length) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setReady(false);

    // Never a reason to sit on an empty screen: a slow or unreachable image
    // should cost the polish, not the page.
    timer.current = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2500);

    Image.prefetch(first)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible]);

  return ready;
}
