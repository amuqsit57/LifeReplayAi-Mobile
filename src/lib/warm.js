import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';

/**
 * Have the pictures before the page.
 *
 * Two parts. The first screenful is waited for — nothing is drawn until those
 * images are decoded and in memory, so what appears is finished. The rest are
 * fetched immediately behind them without holding anything up, so scrolling
 * arrives at pictures that are already there.
 *
 * `settled` is the part that was missing and the reason this appeared to do
 * nothing. Thumbnails arrive from a second request, so on the first render there
 * are no URLs at all — and an empty list read as "nothing to load, go ahead".
 * The gate opened, the rows drew their placeholders, and the images turned up
 * afterwards. An empty list means *not yet* until the caller says otherwise.
 *
 * @param {Array<string>} urls thumbnails, in the order they are drawn
 * @param {number} visible how many are on screen at once
 * @param {boolean} settled whether those URLs are final, or still being fetched
 */
const log = (...parts) => console.log('[warm]', ...parts);

export function useWarmImages(urls, visible = 6, settled = true) {
  const [ready, setReady] = useState(false);
  const clean = urls.filter(Boolean);
  const key = `${settled ? 1 : 0}|${clean.join(',')}`;
  const timer = useRef(null);

  useEffect(() => {
    // Still waiting to be told what the pictures are.
    if (!settled) {
      log('holding: urls not final yet');
      setReady(false);
      return undefined;
    }

    if (!clean.length) {
      log('nothing to warm');
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setReady(false);

    const first = clean.slice(0, visible);
    // A few screenfuls ahead, not the whole list. The memory cache is bounded,
    // and pushing sixty posters through it would evict the ones being looked at
    // — which would be this bug again, caused by the fix for it.
    const rest = clean.slice(visible, visible * 5);

    // Never a reason to sit on an empty screen: a slow or unreachable image
    // should cost the polish, not the page.
    timer.current = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000);

    const began = Date.now();
    log(`prefetching ${first.length} of ${clean.length}`);

    Image.prefetch(first, 'memory-disk')
      .then((ok) => log(`prefetch ${ok ? 'hit' : 'FAILED'} in ${Date.now() - began}ms`))
      .catch((e) => log('prefetch threw:', e?.message))
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
