import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEventListener } from 'expo';
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
  const videos = useMemo(() => {
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

  const cache = useClipCache(videos);

  // The file this shot plays from.
  //
  // It has to change when the shot changes — including mid-playback, which the
  // previous version got wrong: it skipped the whole update while playing, so a
  // run-through kept whichever source the first shot had and every video after
  // it came up black.
  //
  // What must *not* change is the source of a shot already on screen. A local
  // copy landing mid-shot would rebuild the player underneath it and restart the
  // clip, so a newly downloaded file is only adopted the next time that shot
  // comes round.
  const [sourceUri, setSourceUri] = useState(null);
  const pinnedTo = useRef(null);

  useEffect(() => {
    if (memory?.kind !== 'video' || !memory.url) {
      pinnedTo.current = null;
      setSourceUri(null);
      return;
    }
    // A different shot always re-picks. The same shot only re-picks when idle.
    if (pinnedTo.current !== memory.id || !playing) {
      pinnedTo.current = memory.id;
      setSourceUri(cache.local[memory.id] ?? memory.url);
    }
  }, [memory?.id, memory?.kind, memory?.url, cache.local, playing]);

  // The player's own cache is for things it has to fetch. Asking it to cache a
  // file that is already on this phone is work for nothing, and on a file:// URI
  // it is work the player has no reason to handle well.
  const asVideo = (uri) =>
    uri ? { uri, useCaching: !uri.startsWith('file://') } : null;

  // The source goes into the hook rather than being pushed in afterwards.
  //
  // `useVideoPlayer` keys the player on the source and rebuilds it when that
  // changes, so holding it at null and calling replaceAsync by hand was working
  // against the hook rather than with it — which is why a video shot sat on its
  // thumbnail and never played. This is the same shape the replay screen uses,
  // and that one has always worked.
  const player = useVideoPlayer(asVideo(sourceUri), (instance) => {
    instance.loop = false;
    // The finished film carries music and nothing else — the renderer drops clip
    // audio — so hearing it here would preview a soundtrack that does not exist.
    instance.muted = true;
    // Silent, so it has no business claiming the audio session from the music.
    instance.audioMixingMode = 'mixWithOthers';
  });

  // There was a second player here warming the next clip. It is gone: the disk
  // cache above already has the files before they are needed, and two decoders
  // running at once is a good way to make the one being watched stutter.

  // Read inside listeners and timers without making every edit restart playback.
  const live = useRef({});
  live.current = { clips, byId, selected, playing };

  // Seek and play, once it is actually ready to do either. The status is also
  // kept so the stage can say "loading" or "would not load" — without it a clip
  // that fails to decode looks exactly like one that is simply paused, which is
  // how this went unexplained for as long as it did.
  const [videoStatus, setVideoStatus] = useState('idle');

  useEventListener(player, 'statusChange', ({ status }) => {
    setVideoStatus(status);
    if (status !== 'readyToPlay') return;
    const { clips: reel, selected: at, playing: running } = live.current;
    const current = reel[at];
    if (!current) return;
    try {
      player.currentTime = Number(current.start_at) || 0;
      player.playbackRate = SPEED_RATE[current.speed] ?? 1;
      if (running) player.play();
    } catch {
      // Seeking a source that went away mid-change.
    }
  });

  // A new source starts unknown rather than inheriting the last clip's verdict —
  // otherwise the shot after a loaded one starts its clock immediately on a
  // stale "ready".
  useEffect(() => {
    setVideoStatus(sourceUri ? 'loading' : 'idle');
  }, [sourceUri]);

  // Whether the shot on screen is a video that has not arrived yet. While that is
  // true the film is not really running, so nothing should advance.
  const waiting = playing && !!sourceUri && videoStatus !== 'readyToPlay';

  useEffect(() => {
    if (!playing) {
      try {
        player.pause();
      } catch {
        // Nothing loaded to stop.
      }
      return undefined;
    }

    const current = live.current.clips[selected];
    if (!current) {
      setPlaying(false);
      return undefined;
    }

    // Hold the clock until the picture can actually be shown. Starting it
    // regardless is what marched the playhead past every video shot: two seconds
    // is not long enough to fetch a clip, so it was always still loading when its
    // turn ended.
    if (waiting) {
      // Unless it never arrives. A clip that will not decode should cost a
      // moment, not the whole run-through.
      const bail = setTimeout(() => {
        if (selected + 1 < live.current.clips.length) setSelected(selected + 1);
        else setPlaying(false);
      }, 10_000);
      return () => clearTimeout(bail);
    }

    try {
      player.currentTime = Number(current.start_at) || 0;
      player.playbackRate = SPEED_RATE[current.speed] ?? 1;
      player.play();
    } catch {
      // Nothing loaded — a still, or a clip that failed.
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
        player={player}
        videoStatus={videoStatus}
        entrance={entrance}
        height={Math.max(190, STAGE_HEIGHT)}
        onTogglePlay={() => setPlaying((on) => !on)}
      />

      {/* Quiet, and only while it is true. The edit is usable throughout — this
          says why the first pass over a video may still pause. */}
      {cache.busy && cache.total ? (
        <View style={styles.prep}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.prepText}>
            Getting {cache.total === 1 ? 'the clip' : `${cache.total} clips`} ready ·{' '}
            {cache.done}/{cache.total}
          </Text>
        </View>
      ) : null}

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

  prep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    backgroundColor: colors.primarySoft,
  },
  prepText: { ...type.caption, color: colors.primary },

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
