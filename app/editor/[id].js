import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useClipCache } from '../../src/lib/clips';
import { usePlayerPool } from '../../src/lib/players';
import {
  SPEED_RATE,
  addClips,
  applyToAll,
  duplicateClip,
  formatSeconds,
  moveClip,
  planSeconds,
  removeClip,
  setMusic,
  shotMillis,
  updateClip,
} from '../../src/lib/plan';
import { colors, radius, spacing, type } from '../../src/theme';
import AddShots from '../../src/ui/editor/AddShots';
import AudioPanel from '../../src/ui/editor/AudioPanel';
import Inspector from '../../src/ui/editor/Inspector';
import Stage from '../../src/ui/editor/Stage';
import Tracks from '../../src/ui/editor/Tracks';

// A third of the screen for the picture. An even split with the panel below left
// the effects two rows tall on a normal phone, which read as them not being there.
const STAGE_HEIGHT = Math.round(Dimensions.get('window').height * 0.32);

/**
 * The editor.
 *
 * The plan the renderer executes has always been an edit decision list — an
 * ordered set of shots, each with a source, an in-point, a length, a grade and a
 * join. This screen is a way to write one by hand. Nothing new happens at render
 * time; the film is cut exactly the way a generated one is, from a document
 * somebody arranged instead of a document the model wrote.
 *
 * The whole plan is held in memory and saved on demand. Saving per change would
 * mean a round trip for every drag of the duration slider, and undo would have to
 * become a server concept rather than an array.
 */
export default function EditorScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState(null);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [naming, setNaming] = useState(false);

  // Undo is a stack of whole plans. They are small — a hundred shots of nine
  // short fields — and keeping snapshots means every operation is undoable
  // without each one having to describe its own inverse. Held in state rather
  // than a ref so the button can actually go grey when there is nothing to undo.
  const [history, setHistory] = useState([]);

  const source = useQuery({
    queryKey: ['editable', id],
    queryFn: () => api.editable(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (source.data && !plan) {
      setPlan(source.data.replay.editing_plan ?? { clips: [] });
    }
  }, [source.data, plan]);

  const library = source.data?.library ?? [];
  const byId = useMemo(
    () => Object.fromEntries(library.map((memory) => [memory.id, memory])),
    [library]
  );

  const clips = plan?.clips ?? [];
  const clip = clips[selected];
  const memory = clip ? byId[clip.memory_id] : null;
  const seconds = planSeconds(plan);

  // ---- playing it back ---------------------------------------------------
  // The cut, running: the right shots in the right order, each held for as long
  // as it was given, video playing from its own in-point, with the grade, the
  // camera move and the shape of each transition drawn live. Grain is the only
  // thing missing, and the render is sharper than any of it.
  //
  // Muted on purpose. The finished film carries music and nothing else — the
  // renderer drops clip audio entirely — so playing it here would preview a
  // soundtrack that does not exist.
  const [playing, setPlaying] = useState(false);

  // ---- having the clips before they are needed ---------------------------
  // Every video the edit uses, in the order it uses them, fetched to disk as
  // soon as the edit opens. A two second shot cannot download a five megabyte
  // file inside its own two seconds, so waiting until its turn was always going
  // to stall — however gracefully the waiting was handled.
  const shots = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const shot of clips) {
      const source = byId[shot.memory_id];
      if (source?.kind === 'video' && source.url && !seen.has(source.id)) {
        seen.add(source.id);
        out.push({ id: source.id, url: source.url });
      }
    }
    return out;
  }, [clips, byId]);

  // Edit against proxies, render from the originals.
  //
  // One of these clips is 4096x2160 at 15 Mbps, and most Android decoders stop at
  // 3840 wide — so it fell to software and took several attempts to show a frame
  // while the 1080p one beside it was instant. That is not something waiting
  // fixes. Its proxy is 720x380 baseline H.264, half a megabyte against sixteen,
  // and decodes anywhere. Every offline suite has worked this way for decades.
  const proxies = useQuery({
    queryKey: ['proxies', id],
    queryFn: () => api.proxies(id),
    enabled: !!plan && shots.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const videos = useMemo(
    () => shots.map((shot) => ({ id: shot.id, url: proxies.data?.[shot.id] ?? shot.url })),
    [shots, proxies.data]
  );

  // The stills too, so a photograph shot never flashes empty either.
  const posters = useMemo(
    () =>
      clips
        .map((shot) => byId[shot.memory_id]?.thumbnail_url)
        .filter(Boolean)
        .slice(0, 60),
    [clips, byId]
  );

  // `enabled` is the fix for a hole in the gate: before the edit loads there are
  // no clips to see, the cache reported "nothing to fetch, ready", and the editor
  // then rendered on that stale answer the instant the plan arrived — opening
  // behind the download it was supposed to wait for. Which is exactly what "it is
  // still loading on demand" looked like.
  // Nothing is fetched until it is known *what* to fetch: starting on the
  // originals and swapping to proxies afterwards would download both.
  const proxiesSettled = !shots.length || proxies.isFetched || proxies.isError;
  const cache = useClipCache(videos, posters, !!plan && proxiesSettled);

  // ---- one player per clip, built once and kept ---------------------------
  //
  // The files were already on disk and it still paused at every video, because
  // the player itself was being rebuilt for each shot: `useVideoPlayer` keys on
  // its source, so changing shot meant constructing a decoder and opening a file
  // before anything could appear. That is the pause, and it is not something
  // caching can fix.
  //
  // So every clip in the edit gets its own player when the editor opens, all of
  // them already open on their file. Changing shot is then only a matter of
  // which one is on screen. This is what an editor does, and why one feels
  // instant while a video feed does not.
  // Built only once the files are down, and — the part the last version missed —
  // not counted as ready until each one has actually opened its file. Finishing
  // the progress screen on the download alone is why the first run through an
  // edit came up empty while the bar claimed to be done.
  const players = usePlayerPool(videos, cache.local, cache.ready);

  const player = memory?.kind === 'video' ? players.pool.get(memory.id) ?? null : null;

  // The player the view stays mounted on, which is not always the one the shot
  // needs. A run of photographs would otherwise unmount the VideoView and throw
  // its surface away, and the next video would have to build one again inside
  // its own two seconds — which is exactly why the first pass showed a still and
  // the second showed the picture.
  const [held, setHeld] = useState(null);
  useEffect(() => {
    if (player) setHeld(player);
  }, [player]);

  // Seeded the moment the pool opens, so the view is mounted and its surface up
  // from the first frame of the editor — not from the first video shot reached.
  // An edit that opens on a photograph would otherwise still pay for the mount
  // when it got to one.
  useEffect(() => {
    if (!players.ready || held) return;
    const first = players.pool.values().next().value;
    if (first) setHeld(first);
  }, [players.ready, players.pool, held]);

  // Park each clip on its own in-point once the pool is open, so the first frame
  // of every shot is decoded and waiting rather than fetched when it is reached.
  useEffect(() => {
    if (!players.ready) return;
    const firstUse = new Map();
    for (const shot of clips) {
      if (!firstUse.has(shot.memory_id)) firstUse.set(shot.memory_id, shot);
    }
    for (const [id, instance] of players.pool) {
      try {
        instance.currentTime = Number(firstUse.get(id)?.start_at) || 0;
      } catch {
        // Not open; the shot seeks again when it plays.
      }
    }
    // Once, when the pool becomes ready — not on every edit to the plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.ready]);

  // Read inside listeners and timers without making every edit restart playback.
  const live = useRef({});
  live.current = { clips, byId, selected, playing };

  // Only the shot on screen runs. The rest hold their position, ready to resume
  // the moment they are shown again.
  useEffect(() => {
    for (const [id, instance] of players.pool) {
      if (id === memory?.id) continue;
      try {
        instance.pause();
      } catch {
        // Already released.
      }
    }
  }, [memory?.id, players.pool, players.ready]);

  // ---- has this clip actually appeared? -----------------------------------
  // A player can be open, seeked, and reporting that it is playing while the view
  // has drawn nothing at all — which is what a short clip looked like: the shot
  // ran its course over a thumbnail and moved on.
  //
  // `onFirstFrameRender` is the only signal that means the picture is really on
  // screen. Once a clip has produced a frame it is remembered, because a view
  // that has already drawn it does not announce it again, and waiting a second
  // time for something that has already happened would be its own stall.
  const [drawn, setDrawn] = useState(() => new Set());

  const noteFrame = useCallback(() => {
    const id = live.current.byId[live.current.clips[live.current.selected]?.memory_id]?.id;
    if (!id) return;
    setDrawn((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);

  const needsVideo = memory?.kind === 'video' && !!memory?.url;
  const frameReady = !needsVideo || drawn.has(memory.id);
  const waiting = playing && needsVideo && (!player || !frameReady);

  // A paused player may never announce a frame — there is nothing to draw until
  // something asks it to. Rather than leave the still sitting over a clip that is
  // perfectly fine, give it a moment and then take the frame as read.
  useEffect(() => {
    if (!needsVideo || !player || frameReady) return undefined;
    const assume = setTimeout(() => noteFrame(), 1_200);
    return () => clearTimeout(assume);
  }, [needsVideo, player, frameReady, noteFrame]);

  useEffect(() => {
    if (!playing) {
      try {
        player?.pause();
      } catch {
        // Already released.
      }
      return undefined;
    }

    const current = live.current.clips[selected];
    if (!current) {
      setPlaying(false);
      return undefined;
    }

    // Held until the picture is genuinely on screen. The player is told to run
    // regardless, because a frame is what is being waited for and a paused
    // player will not produce one — it is the shot's clock that holds, not the
    // clip.
    if (waiting) {
      try {
        player?.play();
      } catch {
        // No player; the bail below moves on.
      }
      const bail = setTimeout(() => {
        if (selected + 1 < live.current.clips.length) setSelected(selected + 1);
        else setPlaying(false);
      }, 4_000);
      return () => clearTimeout(bail);
    }

    try {
      if (player) {
        player.currentTime = Number(current.start_at) || 0;
        player.playbackRate = SPEED_RATE[current.speed] ?? 1;
        player.play();
      }
    } catch {
      // Released underneath us; the next shot picks up.
    }

    const timer = setTimeout(() => {
      if (selected + 1 < live.current.clips.length) setSelected(selected + 1);
      else setPlaying(false);
    }, shotMillis(current));

    return () => clearTimeout(timer);
  }, [playing, selected, waiting, player]);

  // ---- the music, under the picture --------------------------------------
  // A cut is judged against its music or it is not really being judged. The
  // track will not line up frame for frame with the render — the film opens on
  // the first bar and this opens wherever you pressed play — but hearing the
  // shape of it against the shape of the edit is most of the value.
  //
  // Held locally as well as read from the server so a track chosen a second ago
  // is audible without waiting for the edit to be refetched.
  const [pickedMusic, setPickedMusic] = useState(null);
  const musicUri =
    plan?.music?.mode === 'none'
      ? null
      : pickedMusic ??
        (plan?.music?.mode === 'track' ? source.data?.music_url : source.data?.score?.url) ??
        null;

  const score = useVideoPlayer(musicUri, (instance) => {
    instance.loop = true;
    instance.muted = false;
    instance.volume = 1;
    instance.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    if (!musicUri) return;
    try {
      // Held while a clip loads, so the music does not run on over a picture
      // that has stopped.
      if (playing && !waiting) score.play();
      else score.pause();
    } catch {
      // Not loaded yet; the next toggle catches it.
    }
  }, [playing, waiting, musicUri, score]);

  // Back to the top of the track when the run-through restarts from the first
  // shot, so a second play does not resume halfway through the music.
  useEffect(() => {
    if (playing && selected === 0 && musicUri) {
      try {
        score.currentTime = 0;
      } catch {
        // Not loaded yet.
      }
    }
    // Deliberately only on the transition into playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Touching anything mid-playback stops it, rather than fighting the timer.
  const stop = useCallback(() => setPlaying(false), []);

  // Dragging a shot's out point is one continuous gesture, so it takes one undo
  // snapshot when it starts and none after. Without this a single stretch buries
  // the history under forty near-identical plans and undo becomes useless.
  const resizing = useRef(false);
  const resize = useCallback(
    (index, value) => {
      edit((p) => updateClip(p, index, { seconds: value }), { snapshot: !resizing.current });
      resizing.current = true;
    },
    [edit]
  );

  // A transition belongs to the join it leaves, so the shot arriving is shaped
  // by the one before it.
  const entrance = selected > 0 ? clips[selected - 1]?.transition : 'cut';

  const musicLabel =
    plan?.music?.mode === 'none'
      ? 'Silent'
      : plan?.music?.mode === 'track'
        ? plan.music.name ?? 'My track'
        : 'Music — generated for this event';

  /** Every change goes through here, so undo and the dirty flag cannot be forgotten. */
  const edit = useCallback((next, { snapshot = true } = {}) => {
    setPlan((current) => {
      // Thirty deep. Further back than anyone reaches, and it bounds the memory
      // a long session holds.
      if (snapshot && current) setHistory((stack) => [...stack.slice(-29), current]);
      return typeof next === 'function' ? next(current) : next;
    });
    setDirty(true);
  }, []);

  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHistory((stack) => stack.slice(0, -1));
    setPlan(previous);
    setSelected((index) => Math.max(0, Math.min(index, (previous.clips?.length ?? 1) - 1)));
    setDirty(true);
  };

  const save = async ({ render = false } = {}) => {
    if (!plan) return;
    setBusy(render ? 'render' : 'save');
    try {
      await api.savePlan(id, plan, render);
      setDirty(false);
      if (render) {
        // Straight to the film, where the existing progress screen takes over.
        router.replace(`/replay/${id}`);
      }
    } catch (problem) {
      Alert.alert(render ? 'Could not start the render' : 'Could not save', problem.message);
    } finally {
      setBusy(null);
    }
  };

  const leave = () => {
    if (!dirty) return router.back();
    Alert.alert('Leave this edit?', 'Your changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Save and leave', onPress: async () => { await save(); router.back(); } },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (source.isLoading || !plan) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Opening the edit</Text>
      </View>
    );
  }

  if (source.isError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>{source.error?.message ?? 'Could not open this edit.'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Nothing opens until every clip is on the phone *and* open in a player.
  //
  // Two phases, and the second is the one that was missing: a downloaded file
  // still has to be opened, and calling the wait finished after the download is
  // why the first run through an edit came up empty on a bar that said 100%.
  if (!proxiesSettled || !cache.ready || !players.ready) {
    // Three phases, and each one is a thing that has to be true before a shot can
    // appear on cue: something playable to fetch, the bytes on the phone, and a
    // decoder open on them.
    const phase = !proxiesSettled ? 'proxy' : !cache.ready ? 'download' : 'open';

    const pct =
      phase === 'proxy'
        ? null
        : phase === 'download'
          ? cache.bytes.total
            ? Math.min(100, Math.round((cache.bytes.written / cache.bytes.total) * 100))
            : 0
          : players.total
            ? Math.round((players.opened / players.total) * 100)
            : 100;

    return (
      <View style={styles.loading}>
        <Feather
          name={phase === 'proxy' ? 'scissors' : phase === 'download' ? 'download-cloud' : 'film'}
          size={26}
          color={colors.primary}
        />
        <Text style={styles.prepTitle}>
          {phase === 'proxy'
            ? 'Preparing the clips'
            : phase === 'download'
              ? 'Getting the clips'
              : 'Opening the clips'}
        </Text>
        <Text style={styles.loadingText}>
          {phase === 'proxy'
            ? 'Making editing copies · this happens once per event'
            : phase === 'download'
              ? `${cache.done} of ${cache.total} ${cache.total === 1 ? 'clip' : 'clips'}${
                  cache.bytes.total
                    ? ` · ${(cache.bytes.written / 1e6).toFixed(1)} of ${(
                        cache.bytes.total / 1e6
                      ).toFixed(1)} MB`
                    : ''
                }`
              : `${players.opened} of ${players.total} ready to play`}
        </Text>

        {pct === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.meter}>
            <View style={[styles.meterFill, { width: `${pct}%` }]} />
          </View>
        )}

        <Text style={styles.prepNote}>
          You edit against small copies and the film is still cut from the originals — so
          nothing stops to buffer while you work.
        </Text>

        <Pressable
          onPress={phase === 'download' ? cache.skip : undefined}
          hitSlop={10}
          style={styles.skip}
        >
          {phase === 'download' ? <Text style={styles.link}>Start editing now</Text> : null}
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={leave} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>

        <Pressable style={styles.titleWrap} onPress={() => setNaming(true)}>
          {naming ? (
            <TextInput
              style={styles.titleInput}
              value={plan.title ?? ''}
              onChangeText={(title) => edit((p) => ({ ...p, title }), { snapshot: false })}
              onBlur={() => setNaming(false)}
              autoFocus
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={() => setNaming(false)}
            />
          ) : (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {plan.title || 'My edit'}
              </Text>
              <Text style={styles.sub}>
                {clips.length} {clips.length === 1 ? 'shot' : 'shots'} · {formatSeconds(seconds)}
                {dirty ? ' · unsaved' : ''}
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.headActions}>
          <Pressable onPress={undo} hitSlop={8} disabled={!history.length}>
            <Feather
              name="rotate-ccw"
              size={19}
              color={history.length ? colors.textSoft : colors.borderStrong}
            />
          </Pressable>
          <Pressable onPress={() => save()} hitSlop={8} disabled={!dirty || !!busy}>
            {busy === 'save' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.save, (!dirty || busy) && styles.saveOff]}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* A fixed share of the screen rather than an even split with the panel —
          an inspector squeezed to two rows is why the effects looked absent. */}
      <Stage
        clip={clip}
        memory={memory}
        index={selected}
        total={clips.length}
        // The camera move and the transition run only once the shot is really
        // on screen, so neither plays out behind a clip that is still loading.
        playing={playing && !waiting}
        waiting={waiting}
        // `hasSource` is whether *this shot* is a playable video; `player` is
        // only what the view stays mounted on.
        hasSource={!!player}
        frameReady={frameReady}
        onFirstFrame={noteFrame}
        player={player ?? held}
        entrance={entrance}
        height={Math.max(190, STAGE_HEIGHT)}
        onTogglePlay={() => setPlaying((on) => !on)}
      />

      <Tracks
        clips={clips}
        byId={byId}
        selected={selected}
        // The playhead waits with everything else, rather than sliding across a
        // shot that has not started.
        playing={playing && !waiting}
        musicLabel={musicLabel}
        onSelect={(index) => {
          stop();
          setSelected(index);
        }}
        // Tapping a join selects the shot it belongs to — the transition lives on
        // the shot it leaves, which is what tapping a join is asking for.
        onSelectJoin={(index) => {
          stop();
          setSelected(index);
        }}
        onResize={resize}
        onResizeEnd={() => {
          resizing.current = false;
        }}
        onAdd={() => setAdding(true)}
        onOpenMusic={() => {
          stop();
          setScoring(true);
        }}
      />

      <View style={styles.bar}>
        <Pressable style={styles.barItem} onPress={() => setAdding(true)}>
          <Feather name="plus-square" size={16} color={colors.textSoft} />
          <Text style={styles.barText}>Add</Text>
        </Pressable>
        <Pressable
          style={styles.barItem}
          onPress={() => {
            stop();
            setScoring(true);
          }}
        >
          <Feather name="music" size={16} color={colors.textSoft} />
          <Text style={styles.barText}>
            {plan.music?.mode === 'none'
              ? 'Silent'
              : plan.music?.mode === 'track'
                ? 'My track'
                : 'Music'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.render, (!clips.length || !!busy) && styles.renderOff]}
          onPress={() => save({ render: true })}
          disabled={!clips.length || !!busy}
        >
          {busy === 'render' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="play" size={15} color="#fff" />
              <Text style={styles.renderText}>Render</Text>
            </>
          )}
        </Pressable>
      </View>

      {clip ? (
        <Inspector
          clip={clip}
          memory={memory}
          index={selected}
          total={clips.length}
          onChange={(patch) => edit((p) => updateClip(p, selected, patch))}
          onMove={(direction) => {
            const to = selected + direction;
            edit((p) => moveClip(p, selected, to));
            setSelected(Math.max(0, Math.min(clips.length - 1, to)));
          }}
          onDuplicate={() => edit((p) => duplicateClip(p, selected))}
          onDelete={() => {
            edit((p) => removeClip(p, selected));
            setSelected((index) => Math.max(0, Math.min(index, clips.length - 2)));
          }}
          onApplyAll={(patch) => edit((p) => applyToAll(p, patch))}
        />
      ) : (
        <View style={styles.blank}>
          <Text style={styles.blankTitle}>Nothing in this edit yet</Text>
          <Text style={styles.blankBody}>
            Add photos and video from the event, then set how long each one holds and how it
            joins the next.
          </Text>
          <Pressable style={styles.blankAction} onPress={() => setAdding(true)}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.blankActionText}>Add shots</Text>
          </Pressable>
        </View>
      )}

      <AddShots
        visible={adding}
        onClose={() => setAdding(false)}
        library={library}
        onInsert={(memories) => {
          if (!memories.length) return;
          const at = clips.length ? selected + 1 : 0;
          edit((p) => addClips(p, memories, at));
          setSelected(at);
        }}
      />

      <AudioPanel
        visible={scoring}
        onClose={() => setScoring(false)}
        replayId={id}
        eventId={source.data?.replay?.event_id}
        style={source.data?.replay?.style}
        music={plan.music}
        score={source.data?.score}
        // The panel knows the URL of whatever was just chosen; keeping it here
        // means the preview can play it without waiting for a refetch.
        onChange={(music, url) => {
          setPickedMusic(url ?? null);
          edit((p) => setMusic(p, music));
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: { ...type.caption, color: colors.textMuted },
  link: { ...type.label, color: colors.primary },

  prepTitle: { ...type.heading, color: colors.text },
  prepNote: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
  meter: {
    width: '62%',
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunk,
    overflow: 'hidden',
  },
  meterFill: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  skip: { paddingTop: spacing.sm },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  titleWrap: { flex: 1 },
  title: { ...type.heading, color: colors.text },
  titleInput: {
    ...type.heading,
    color: colors.text,
    padding: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  sub: { ...type.caption, color: colors.textMuted },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  save: { ...type.label, color: colors.primary },
  saveOff: { color: colors.borderStrong },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  barText: { ...type.label, color: colors.textSoft },
  render: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  renderOff: { backgroundColor: colors.borderStrong },
  renderText: { ...type.label, color: '#fff' },

  blank: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  blankTitle: { ...type.heading, color: colors.text },
  blankBody: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  blankAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  blankActionText: { ...type.label, color: '#fff' },
});
