import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Have the whole edit on the phone before the editor opens.
 *
 * Fetching a clip when the playhead reaches it cannot work. The shots are two or
 * three seconds and the files are five megabytes typically, sixty at the top end;
 * no amount of careful waiting turns that into playback. Every version of this
 * that loaded on demand stalled on the first pass, and dressing the stall up as a
 * spinner did not make it less of a stall.
 *
 * So nothing opens until everything is down. The editor gets a preparing screen
 * with real progress, and after it every clip plays from local disk, instantly,
 * for the rest of the session — and for every later session, because the files
 * stay cached under the memory id and a memory's bytes never change.
 */
const DIR = `${FileSystem.cacheDirectory}clips/`;

// Enough to use the connection properly without so many that the first file
// finishes last. Phones do badly with a dozen concurrent downloads.
const LANES = 3;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/**
 * The extension matters: Android picks its demuxer from the file name, and
 * without one it probes the container instead — slower, and not always right.
 */
const pathFor = (id) => `${DIR}${id}.mp4`;

/**
 * @param {Array<{id: string, url: string}>} videos every clip the edit uses
 * @param {Array<string>} stills thumbnails to warm at the same time
 */
export function useClipCache(videos, stills = []) {
  const [local, setLocal] = useState({});
  const [failed, setFailed] = useState({});
  const [done, setDone] = useState(0);
  const [bytes, setBytes] = useState({ written: 0, total: 0 });
  const [ready, setReady] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const cancelled = useRef(false);
  const meter = useRef({});

  // Standing in for the list itself: comparing the array would restart the queue
  // on every render.
  const key = videos.map((v) => v.id).join(',');
  const stillKey = stills.join(',');

  const skip = useCallback(() => setSkipped(true), []);

  useEffect(() => {
    cancelled.current = false;
    meter.current = {};
    setDone(0);
    setBytes({ written: 0, total: 0 });
    setReady(false);
    setSkipped(false);

    if (!videos.length) {
      setReady(true);
      return undefined;
    }

    const tick = () => {
      if (cancelled.current) return;
      const all = Object.values(meter.current);
      setBytes({
        written: all.reduce((sum, f) => sum + (f.written || 0), 0),
        total: all.reduce((sum, f) => sum + (f.total || 0), 0),
      });
    };

    const fetchOne = async (video) => {
      const target = pathFor(video.id);
      try {
        const info = await FileSystem.getInfoAsync(target);
        if (info.exists && info.size > 0) {
          meter.current[video.id] = { written: info.size, total: info.size };
          setLocal((current) => ({ ...current, [video.id]: info.uri }));
          return;
        }

        const job = FileSystem.createDownloadResumable(
          video.url,
          target,
          {},
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            meter.current[video.id] = {
              written: totalBytesWritten,
              total: totalBytesExpectedToWrite,
            };
            tick();
          }
        );

        const result = await job.downloadAsync();
        if (cancelled.current) return;

        if (result && result.status >= 200 && result.status < 300) {
          setLocal((current) => ({ ...current, [video.id]: result.uri }));
        } else {
          // Marked rather than hidden: a clip that cannot be cached has to fall
          // back to streaming, or it would simply never play.
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
      } finally {
        if (!cancelled.current) setDone((n) => n + 1);
        tick();
      }
    };

    (async () => {
      try {
        await ensureDir();
      } catch {
        // Without a cache directory everything streams. Worse, but not broken,
        // and nothing here may stop an edit from opening.
        setReady(true);
        return;
      }

      // The stills are small and wanted immediately; they warm alongside rather
      // than holding anything up.
      Image.prefetch(stills).catch(() => {});

      const queue = [...videos];
      const lanes = Array.from({ length: Math.min(LANES, queue.length) }, async () => {
        while (queue.length && !cancelled.current) {
          await fetchOne(queue.shift());
        }
      });

      await Promise.all(lanes);
      if (!cancelled.current) setReady(true);
    })();

    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stillKey]);

  return {
    local,
    failed,
    done,
    total: videos.length,
    bytes,
    // `skipped` lets someone past a slow connection rather than trapping them
    // behind it; anything not yet down then streams as it used to.
    ready: ready || skipped,
    skip,
  };
}
