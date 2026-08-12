import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
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
import {
  SPEED_RATE,
  addClips,
  applyToAll,
  duplicateClip,
  formatSeconds,
  gradeLabel,
  motionLabel,
  moveClip,
  planSeconds,
  removeClip,
  setMusic,
  shotMillis,
  textureLabel,
  transitionLabel,
  updateClip,
} from '../../src/lib/plan';
import { colors, radius, spacing, type } from '../../src/theme';
import AddShots from '../../src/ui/editor/AddShots';
import AudioPanel from '../../src/ui/editor/AudioPanel';
import Inspector from '../../src/ui/editor/Inspector';
import Timeline from '../../src/ui/editor/Timeline';

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
  // Not the finished film — transitions, grades and textures are FFmpeg's work
  // and happen at render. This runs the cut: the right shots, in the right
  // order, each held for as long as it was given, video playing from its own
  // in-point. That is the part you cannot judge from a row of thumbnails.
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  // Read inside the timer without making every edit restart playback.
  const live = useRef({ clips, byId });
  live.current = { clips, byId };

  useEffect(() => {
    if (!playing) {
      player.pause();
      return undefined;
    }

    const { clips: reel, byId: shelf } = live.current;
    const current = reel[selected];
    if (!current) {
      setPlaying(false);
      return undefined;
    }

    const source = shelf[current.memory_id];
    if (source?.kind === 'video' && source.url) {
      try {
        player.replace({ uri: source.url });
        player.currentTime = Number(current.start_at) || 0;
        player.playbackRate = SPEED_RATE[current.speed] ?? 1;
        player.play();
      } catch {
        // A shot that will not load should not stop the run-through.
      }
    } else {
      player.pause();
    }

    const timer = setTimeout(() => {
      if (selected + 1 < reel.length) setSelected(selected + 1);
      else setPlaying(false);
    }, shotMillis(current));

    return () => clearTimeout(timer);
  }, [playing, selected, player]);

  // Touching anything mid-playback stops it, rather than fighting the timer.
  const stop = useCallback(() => setPlaying(false), []);

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

      {/* The shot under the cursor. A fixed share of the screen rather than an
          even split, so the controls below always have room to be seen — an
          inspector squeezed to two rows is why the effects looked absent. */}
      <View style={[styles.stage, { height: Math.max(190, STAGE_HEIGHT) }]}>
        {playing && memory?.kind === 'video' && memory?.url ? (
          <VideoView player={player} style={styles.preview} contentFit="contain" />
        ) : memory?.thumbnail_url ? (
          <Image
            source={{ uri: memory.thumbnail_url }}
            style={styles.preview}
            contentFit="contain"
            transition={140}
            recyclingKey={memory.id}
          />
        ) : (
          <View style={styles.previewEmpty}>
            <Feather name="film" size={30} color={colors.textMuted} />
            <Text style={styles.previewText}>
              {clips.length ? 'No preview for this shot' : 'Add your first shot below'}
            </Text>
          </View>
        )}

        {clips.length ? (
          <Pressable
            style={styles.playBtn}
            onPress={() => setPlaying((on) => !on)}
            hitSlop={10}
            accessibilityLabel={playing ? 'Stop' : 'Play the edit from here'}
          >
            <Feather
              name={playing ? 'pause' : 'play'}
              size={20}
              color={colors.text}
              style={playing ? null : { marginLeft: 2 }}
            />
          </Pressable>
        ) : null}

        {clip ? (
          <View style={styles.stageBar}>
            <Text style={styles.stageText} numberOfLines={1}>
              Shot {selected + 1} of {clips.length} · {Number(clip.seconds).toFixed(1)}s ·{' '}
              {gradeLabel(clip.grade)}
              {clip.texture && clip.texture !== 'none' ? ` · ${textureLabel(clip.texture)}` : ''}
              {memory?.kind === 'photo' ? ` · ${motionLabel(clip.motion)}` : ''} ·{' '}
              {transitionLabel(clip.transition)} out
            </Text>
            {/* Grades and textures are applied by FFmpeg when the film is cut, so
                there is nothing to see here until then. Saying so is better than
                letting the picture look like the setting did not take. */}
            <Text style={styles.stageNote}>
              Effects are applied when you render — this is the cut, not the look.
            </Text>
          </View>
        ) : null}
      </View>

      <Timeline
        clips={clips}
        byId={byId}
        selected={selected}
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
        onAdd={() => setAdding(true)}
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
        onChange={(music) => edit((p) => setMusic(p, music))}
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

  // Dark behind the preview: it is the one place in the app showing a frame
  // rather than a page, and a white surround changes how a grade reads.
  stage: { backgroundColor: '#100C1A', justifyContent: 'center' },
  preview: { width: '100%', height: '100%' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, flex: 1 },
  previewText: { ...type.caption, color: colors.textMuted },
  playBtn: {
    position: 'absolute',
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(12,9,20,0.6)',
  },
  // On a photograph, so fixed white rather than a theme token.
  stageText: { ...type.caption, color: 'rgba(255,255,255,0.9)' },
  stageNote: { ...type.caption, fontSize: 11, color: 'rgba(255,255,255,0.62)' },

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
