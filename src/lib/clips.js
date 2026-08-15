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
 * Named by the memory *and* the object it came from.
 *
 * Naming by memory id alone meant a clip already cached as its 16MB original
 * satisfied the lookup for its half-megabyte proxy — the proxies were built,
 * stored, and then never used, because the cache said it already had that clip.
 * A cache key has to describe what is in the file, not only what it is of.
 *
 * The extension is kept because Android picks its demuxer from the file name;
 * without one it probes the container instead, which is slower and not always
 * right.
 */
const stampFor = (url) => {
  // The signature changes on every read, so only the object path identifies it.
  const path = String(url).split('?')[0];
  const name = path.slice(path.lastIndexOf('/') + 1) || 'clip.mp4';
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-56);
};

const pathFor = (id, url) => `${DIR}${id}-${stampFor(url)}`;

/**
 * @param {Array<{id: string, url: string}>} videos every clip the edit uses
 * @param {Array<string>} stills thumbnails to warm at the same time
 */
/**
 * Says what the cache is actually doing, in the Metro log.
 *
 * This existed as guesswork three times over — "it must be the layout", "it must
 * be the hook", "it must be the ordering" — and each guess cost a round trip. A
 * cache either has the file or it does not, and it can simply say which.
 */
const log = (...parts) => console.log('[clips]', ...parts);

export function useClipCache(videos, stills = [], enabled = true) {
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
  // Sorted, so this describes *which* clips are needed and not what order they
  // sit in. Reordering the timeline used to change the key, restart the queue and
  // put the preparing screen back over the editor mid-drag.
  const key = videos
    .map((v) => `${v.id}|${stampFor(v.url)}`)
    .sort()
    .join(',');
  // Deduped as well as sorted. Splitting a shot adds a second reference to the
  // same thumbnail, which lengthened the list, changed the key, and threw the
  // preparing screen back up over an editor that needed nothing new.
  const stillKey = [...new Set(stills)].sort().join(',');

  const skip = useCallback(() => setSkipped(true), []);

  useEffect(() => {
    cancelled.current = false;
    meter.current = {};
    setDone(0);
    setBytes({ written: 0, total: 0 });
    setReady(false);
    setSkipped(false);

    // Nothing is ready before the edit itself has loaded — otherwise the first
    // render, with no clips known yet, reports "all done" and the editor opens
    // behind the download it was supposed to wait for.
    if (!enabled) {
      log('holding: the edit has not loaded yet');
      return undefined;
    }

    if (!videos.length) {
      log('no video in this edit; nothing to fetch');
      setReady(true);
      return undefined;
    }

    log(`starting: ${videos.length} clip(s), cacheDirectory=${FileSystem.cacheDirectory}`);

    const tick = () => {
      if (cancelled.current) return;
      const all = Object.values(meter.current);
      setBytes({
        written: all.reduce((sum, f) => sum + (f.written || 0), 0),
        total: all.reduce((sum, f) => sum + (f.total || 0), 0),
      });
    };

    const fetchOne = async (video) => {
      const target = pathFor(video.id, video.url);
      try {
        const info = await FileSystem.getInfoAsync(target);
        if (info.exists && info.size > 0) {
          log(`hit  ${video.id.slice(0, 8)} ${(info.size / 1e6).toFixed(1)}MB already here`);
          meter.current[video.id] = { written: info.size, total: info.size };
          setLocal((current) => ({ ...current, [video.id]: info.uri }));
          return;
        }

        log(`get  ${video.id.slice(0, 8)} ${video.url.slice(0, 72)}`);

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
          log(`done ${video.id.slice(0, 8)} -> ${result.uri}`);
          setLocal((current) => ({ ...current, [video.id]: result.uri }));
        } else {
          log(`FAIL ${video.id.slice(0, 8)} http ${result && result.status}`);
          // Marked rather than hidden: a clip that cannot be cached has to fall
          // back to streaming, or it would simply never play.
          setFailed((current) => ({ ...current, [video.id]: true }));
          await FileSystem.deleteAsync(target, { idempotent: true });
        }
      } catch (problem) {
        log(`FAIL ${video.id.slice(0, 8)} ${problem?.message ?? problem}`);
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
      } catch (problem) {
        // Without a cache directory everything streams. Worse, but not broken,
        // and nothing here may stop an edit from opening.
        log('FAIL no cache directory:', problem?.message ?? problem);
        setReady(true);
        return;
      }

      // Drop earlier versions of these same clips — the originals left behind
      // when an edit moves to proxies are sixteen megabytes each and will never
      // be read again.
      try {
        const keep = new Set(videos.map((v) => pathFor(v.id, v.url).split('/').pop()));
        const mine = new Set(videos.map((v) => v.id));
        for (const name of await FileSystem.readDirectoryAsync(DIR)) {
          const owner = name.slice(0, name.indexOf('-'));
          if (mine.has(owner) && !keep.has(name)) {
            await FileSystem.deleteAsync(`${DIR}${name}`, { idempotent: true });
            log(`swept ${name}`);
          }
        }
      } catch {
        // Housekeeping only; nothing here is worth failing over.
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
      if (!cancelled.current) {
        log('ready');
        setReady(true);
      }
    })();

    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stillKey, enabled]);

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
