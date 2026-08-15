import { createVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';

/**
 * A player per clip, opened before the editor is shown.
 *
 * Having the files on disk was not enough. `useVideoPlayer` keys on its source
 * and rebuilds when that changes, so every change of shot was constructing a
 * decoder and opening a file before anything could appear — a pause no amount of
 * caching removes, because the file was already local and still had to be opened
 * again each time.
 *
 * So each clip gets its own player, built once and kept. And the wait is not over
 * when the download is: a freshly built player still has to open its file, which
 * is why the first run through an edit came up empty while the progress screen
 * claimed to be finished. This waits for `readyToPlay` on every one of them.
 */
const log = (...parts) => console.log('[players]', ...parts);

// A player is a decoder and a buffer. An edit with forty clips would not survive
// forty of them, so past this the rest are opened when they are reached.
export const MAX_PLAYERS = 8;

// Opening a local file is fast; something that has not managed it in this long is
// not going to, and should not hold the editor shut.
const OPEN_TIMEOUT = 12_000;

export function usePlayerPool(videos, local, enabled) {
  const pool = useRef(new Map());
  const subs = useRef([]);
  const [ready, setReady] = useState(false);
  const [opened, setOpened] = useState(0);

  const wanted = videos.slice(0, MAX_PLAYERS);
  // Sorted for the same reason as the clip cache: which clips, not which order.
  const key = wanted
    .map((v) => `${v.id}:${local[v.id] ? 'disk' : 'net'}`)
    .sort()
    .join(',');

  useEffect(() => {
    if (!enabled) return undefined;

    if (!wanted.length) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    let done = 0;
    const pending = new Set(wanted.map((v) => v.id));

    const finish = (id, why) => {
      if (cancelled || !pending.has(id)) return;
      pending.delete(id);
      done += 1;
      setOpened(done);
      log(`${why} ${id.slice(0, 8)} (${done}/${wanted.length})`);
      if (!pending.size) {
        log('all clips open');
        setReady(true);
      }
    };

    for (const video of wanted) {
      if (pool.current.has(video.id)) {
        finish(video.id, 'kept');
        continue;
      }

      const uri = local[video.id] ?? video.url;
      try {
        const instance = createVideoPlayer({
          uri,
          // Only worth caching what has to be fetched; these are local files.
          useCaching: !uri.startsWith('file://'),
        });
        instance.loop = false;
        // The finished film carries music and nothing else — the renderer drops
        // clip audio — so sound here would preview a soundtrack that does not
        // exist. Silent also means no claim on the audio session, which the
        // music under the preview needs.
        instance.muted = true;
        instance.audioMixingMode = 'mixWithOthers';
        pool.current.set(video.id, instance);

        // It may already be open by the time a listener is attached, so the
        // current status is checked as well as watched.
        if (instance.status === 'readyToPlay') {
          finish(video.id, `open  ${uri.startsWith('file://') ? 'DISK' : 'NET '}`);
        } else {
          const sub = instance.addListener('statusChange', ({ status }) => {
            if (status === 'readyToPlay') {
              finish(video.id, `open  ${uri.startsWith('file://') ? 'DISK' : 'NET '}`);
            } else if (status === 'error') {
              finish(video.id, 'ERROR');
            }
          });
          subs.current.push(sub);
        }
      } catch (problem) {
        log(`could not build ${video.id.slice(0, 8)}: ${problem?.message ?? problem}`);
        finish(video.id, 'FAILED');
      }
    }

    // Nothing may hold the editor shut indefinitely.
    const bail = setTimeout(() => {
      if (cancelled || !pending.size) return;
      log(`giving up on ${pending.size} clip(s) after ${OPEN_TIMEOUT / 1000}s`);
      setReady(true);
    }, OPEN_TIMEOUT);

    return () => {
      cancelled = true;
      clearTimeout(bail);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Built by hand, so released by hand — these do not clean themselves up the
  // way the hook's players do.
  useEffect(
    () => () => {
      for (const sub of subs.current) {
        try {
          sub.remove();
        } catch {
          // Already gone.
        }
      }
      subs.current = [];
      for (const instance of pool.current.values()) {
        try {
          instance.release();
        } catch {
          // Already released.
        }
      }
      pool.current.clear();
    },
    []
  );

  return { pool: pool.current, ready, opened, total: wanted.length };
}
