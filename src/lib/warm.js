import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';

/**
 * Have the pictures before the page.
 *
 * A grid that paints its titles first and fills the images in over the next
 * second reads as broken: the text lands, the layout settles, then everything
 * twitches as each picture arrives.
 *
 * Two parts, and both matter. The first screenful is *waited for* — nothing is
 * drawn until those images are in the cache, so what appears is finished. The
 * rest are fetched immediately afterwards in the background, without holding
 * anything up, so scrolling finds them already there rather than starting a
 * download when a row comes into view. That is the difference between lazy
 * loading and loading late.
 *
 * @param {Array<string>} urls thumbnails, in the order they are drawn
 * @param {number} visible how many are on screen at once
 */
export function useWarmImages(urls, visible = 6) {
  const [ready, setReady] = useState(false);
  const clean = urls.filter(Boolean);
  const key = clean.join(',');
  const timer = useRef(null);

  useEffect(() => {
    if (!clean.length) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setReady(false);

    const first = clean.slice(0, visible);
    const rest = clean.slice(visible);

    // Never a reason to sit on an empty screen: a slow or unreachable image
    // should cost the polish, not the page.
    timer.current = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2500);

    Image.prefetch(first, 'memory-disk')
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setReady(true);
        // Everything below the fold, warmed while it is being looked at.
        if (rest.length) Image.prefetch(rest, 'memory-disk').catch(() => {});
      });

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible]);

  return ready;
}
