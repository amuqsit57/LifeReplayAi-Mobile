import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';

/**
 * Keep an edit's video on the phone.
 *
 * Streaming a clip the moment its turn comes is the wrong shape for an editor.
 * The shots are short — two or three seconds — and the files are not: five
 * megabytes typically, sixty at the top end. Nothing downloads a sixty megabyte
 * file inside a two second shot, so every video stalled the first time it was
 * reached, however well the waiting was handled.
 *
 * So the clips are fetched to disk as soon as the edit opens, in the order they
 * appear in it, and played from there. The second pass through an edit touches
 * the network not at all.
 *
 * One at a time on purpose: several parallel downloads on a phone finish at the
 * same later moment rather than one after another, and the first shot is the one
 * that has to be ready first.
 */
const DIR = `${FileSystem.cacheDirectory}clips/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

/**
 * Named by memory id — a memory's bytes never change, so a hit is always valid.
 *
 * The extension matters. Android picks its demuxer from the file name, and a
 * path with no extension makes it probe the container instead, which is slower
 * and not always right.
 */
const pathFor = (id) => `${DIR}${id}.mp4`;

/**
 * @param {Array<{id: string, url: string}>} videos in the order the edit uses them
 * @returns {{ local, failed, done, total, busy }} `local` maps memory id to a
 *   file:// URI; `failed` marks the ones that will have to be streamed.
 */
export function useClipCache(videos) {
  const [local, setLocal] = useState({});
  const [failed, setFailed] = useState({});
  const [done, setDone] = useState(0);

  // What the effect below is working through. Compared by id so re-rendering with
  // an equivalent list does not restart the queue from the top.
  const key = videos.map((v) => v.id).join(',');
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!videos.length) {
      setDone(0);
      return undefined;
    }

    (async () => {
      try {
        await ensureDir();
      } catch {
        // No cache directory: everything falls back to streaming, which still
        // works. Nothing here is allowed to stop an edit opening.
        return;
      }

      let finished = 0;
      for (const video of videos) {
        if (cancelled.current) return;

        const target = pathFor(video.id);
        try {
          const info = await FileSystem.getInfoAsync(target);
          if (info.exists && info.size > 0) {
            if (!cancelled.current) {
              setLocal((current) => ({ ...current, [video.id]: info.uri }));
              setDone((n) => n + 1);
            }
            finished += 1;
            continue;
          }

          const result = await FileSystem.downloadAsync(video.url, target);
          if (cancelled.current) return;

          if (result.status >= 200 && result.status < 300) {
            setLocal((current) => ({ ...current, [video.id]: result.uri }));
          } else {
            // Marked failed, which is what lets the player fall back to
            // streaming it. Without that flag a clip that cannot be cached would
            // simply never play.
            setFailed((current) => ({ ...current, [video.id]: true }));
            await FileSystem.deleteAsync(target, { idempotent: true });
          }
        } catch {
          if (!cancelled.current) setFailed((current) => ({ ...current, [video.id]: true }));
          try {
            await FileSystem.deleteAsync(target, { idempotent: true });
          } catch {
            // Nothing to remove.
          }
        }

        finished += 1;
        if (!cancelled.current) setDone(finished);
      }
    })();

    return () => {
      cancelled.current = true;
    };
    // `key` stands in for the list; comparing the array itself would restart the
    // queue on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { local, failed, done, total: videos.length, busy: done < videos.length };
}
