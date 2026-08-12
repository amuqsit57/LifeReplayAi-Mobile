import { Feather } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import { useVideoPlayer } from 'expo-video';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api, uploadToSignedUrl } from '../../lib/api';
import { MUSIC_MODES } from '../../lib/plan';
import { colors, radius, shadow, spacing, type } from '../../theme';

// Starting points, so nobody faces an empty box. Written as briefs to a composer
// rather than as tags, because that is what the model behind this responds to.
const IDEAS = [
  'Solo piano, slow and unhurried, one line at a time. Nothing else.',
  'Warm acoustic guitar with light brushed percussion, gentle and homely.',
  'Bright indie pop with claps and a simple hook, 120 BPM.',
  'Sweeping strings that build to a single held chord.',
  'Soft synth pads, no drums, quietly hopeful.',
];

/**
 * What the film is scored with.
 *
 * Four answers. The one that matters is the second: you write a brief, you press
 * compose, you wait, and then you *hear it* before deciding. Music you cannot
 * listen to is not a choice, and every version of this before now asked people
 * to pick a piece of music sight unseen and find out at render time.
 *
 * Anything composed is kept. A track is worth using again — on this edit, on the
 * next event — so the library is the family's, not this film's.
 */
export default function AudioPanel({
  visible,
  onClose,
  replayId,
  eventId,
  style,
  music,
  score,
  onChange,
}) {
  const queryClient = useQueryClient();
  const mode = music?.mode ?? 'ai';

  const [open, setOpen] = useState(mode);
  const [prompt, setPrompt] = useState(music?.prompt ?? '');
  const [made, setMade] = useState(null);
  const [working, setWorking] = useState(null);
  const [error, setError] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [playing, setPlaying] = useState(false);

  const library = useQuery({
    queryKey: ['musicLibrary'],
    queryFn: api.musicLibrary,
    enabled: visible,
    staleTime: 60_000,
  });

  // Which track the play button is pointed at. The URI goes into the hook rather
  // than being pushed into a player held at null: `useVideoPlayer` keys the
  // player on its source and rebuilds it when that changes, so replacing by hand
  // works against the hook instead of with it. Doing that is what left both this
  // and the editor's video silent and still.
  //
  // expo-video plays an audio-only file perfectly well, and no view is rendered
  // for it — this exists to make a sound, not a picture.
  const [cue, setCue] = useState(null);
  const wantPlay = useRef(false);

  const player = useVideoPlayer(cue?.uri ?? null, (instance) => {
    instance.loop = true;
    instance.muted = false;
    instance.volume = 1;
    // Mixes rather than interrupts: the editor's own players are alive on the
    // screen behind this sheet.
    instance.audioMixingMode = 'mixWithOthers';
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => setPlaying(isPlaying));

  // A fresh player starts paused, so it is told to start once it can.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && wantPlay.current) {
      try {
        player.play();
      } catch {
        // Torn down between the event and here.
      }
    }
  });

  useEffect(() => {
    if (!visible) {
      wantPlay.current = false;
      try {
        player.pause();
      } catch {
        // Nothing loaded.
      }
      setNowPlaying(null);
    }
  }, [visible, player]);

  const audition = (key, uri) => {
    if (!uri) return;

    if (nowPlaying === key) {
      // Same track: toggle it rather than reloading it.
      wantPlay.current = !playing;
      try {
        if (playing) player.pause();
        else player.play();
      } catch {
        // Not loaded yet; the ready event will start it.
      }
      return;
    }

    setError(null);
    setNowPlaying(key);
    wantPlay.current = true;
    setCue({ key, uri });
  };

  const isOn = (key) => nowPlaying === key && playing;

  // ---- composing to order ------------------------------------------------
  const compose = async () => {
    const brief = prompt.trim();
    if (brief.length < 3) return setError('Describe the music first.');

    setError(null);
    setWorking('compose');
    try {
      const track = await api.composeMusic(eventId, { prompt: brief, style });
      setMade(track);
      queryClient.invalidateQueries({ queryKey: ['musicLibrary'] });
      // Play it immediately. Waiting two minutes and then having to find the
      // play button is a poor reward.
      audition(`made:${track.id}`, track.url);
    } catch (problem) {
      setError(
        /timed out/i.test(problem.message)
          ? 'It is taking a while. The track is still being made — it will appear under Custom or from library.'
          : problem.message
      );
      queryClient.invalidateQueries({ queryKey: ['musicLibrary'] });
    } finally {
      setWorking(null);
    }
  };

  const use = (track) => {
    // The URL travels with the choice so the preview can play it at once,
    // rather than waiting for the edit to be refetched to learn about it.
    onChange(
      { mode: 'track', path: track.storage_path, name: track.name, prompt: track.prompt },
      track.url
    );
  };

  // ---- a file off the phone ----------------------------------------------
  const pick = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setWorking('upload');

      const permission = await api.audioUploadUrl(replayId, {
        filename: file.name ?? 'track.mp3',
        content_type: file.mimeType ?? 'audio/mpeg',
        bytes: file.size ?? null,
      });
      // Straight to storage, the same as memories — an audio file is the one
      // thing in this API big enough to be worth not proxying.
      await uploadToSignedUrl(permission.upload_url, file.uri, file.mimeType ?? 'audio/mpeg');

      onChange({ mode: 'track', path: permission.storage_path, name: file.name }, file.uri);
      // Play from the local copy — instant, and it does not wait on a signed URL
      // for a file that is already on this phone.
      audition('uploaded', file.uri);

      // Keep it. A file worth using on this film is worth offering on the next.
      try {
        await api.registerMusic({
          storage_path: permission.storage_path,
          name: file.name,
          event_id: eventId,
        });
        queryClient.invalidateQueries({ queryKey: ['musicLibrary'] });
      } catch {
        // The track is in use either way; it just will not appear in the library.
      }
    } catch (problem) {
      setError(problem.message ?? 'That file would not upload.');
    } finally {
      setWorking(null);
    }
  };

  const chosenPath = music?.mode === 'track' ? music.path : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>Music</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {MUSIC_MODES.map((option) => {
              // `make` is a way of arriving at a track, not a state the plan is
              // ever left in — composing sets the plan to that specific file.
              const selected =
                option.value === 'make'
                  ? mode === 'track' && !!music?.prompt
                  : option.value === mode;
              const expanded = open === option.value;

              return (
                <View key={option.value} style={[styles.block, expanded && styles.blockOpen]}>
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      setOpen(expanded ? null : option.value);
                      if (option.value === 'ai' || option.value === 'none') {
                        onChange(
                        { mode: option.value },
                        option.value === 'ai' ? score?.url ?? null : null
                      );
                      }
                    }}
                  >
                    <View style={[styles.icon, selected && { backgroundColor: colors.primary }]}>
                      <Feather
                        name={option.icon}
                        size={15}
                        color={selected ? '#fff' : colors.textSoft}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.label, selected && { color: colors.primary }]}>
                          {option.label}
                        </Text>
                        {option.recommended ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Recommended</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.hint} numberOfLines={2}>
                        {option.value === 'track' && selected && music?.name
                          ? music.name
                          : option.hint}
                      </Text>
                    </View>

                    {selected ? <Feather name="check" size={17} color={colors.primary} /> : null}
                    <Feather
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  {/* ---------------------------------------- already there */}
                  {expanded && option.value === 'ai' ? (
                    <View style={styles.body}>
                      {score?.url ? (
                        <TrackRow
                          name={score.name}
                          detail={score.prompt}
                          playing={isOn('score')}
                          onPlay={() => audition('score', score.url)}
                        />
                      ) : (
                        <Text style={styles.note}>
                          Nothing composed for this event yet — it is written from the occasion
                          and made while your film renders.
                        </Text>
                      )}
                    </View>
                  ) : null}

                  {/* ------------------------------------------ compose one */}
                  {expanded && option.value === 'make' ? (
                    <View style={styles.body}>
                      <TextInput
                        style={styles.input}
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder="Describe the music: instruments, tempo, mood."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={400}
                      />

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.ideas}
                      >
                        {IDEAS.map((idea) => (
                          <Pressable key={idea} style={styles.idea} onPress={() => setPrompt(idea)}>
                            <Text style={styles.ideaText} numberOfLines={2}>
                              {idea}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <Pressable
                        style={[styles.generate, working === 'compose' && styles.generateBusy]}
                        onPress={compose}
                        disabled={working === 'compose'}
                      >
                        {working === 'compose' ? (
                          <>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.generateText}>Composing — a minute or two</Text>
                          </>
                        ) : (
                          <>
                            <Feather name="zap" size={15} color="#fff" />
                            <Text style={styles.generateText}>Generate</Text>
                          </>
                        )}
                      </Pressable>

                      {made ? (
                        <TrackRow
                          name={made.name}
                          detail={made.prompt}
                          playing={isOn(`made:${made.id}`)}
                          onPlay={() => audition(`made:${made.id}`, made.url)}
                          chosen={chosenPath === made.storage_path}
                          onUse={() => use(made)}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  {/* ------------------------------- library, or off the phone */}
                  {expanded && option.value === 'track' ? (
                    <View style={styles.body}>
                      <Pressable style={styles.upload} onPress={pick} disabled={!!working}>
                        {working === 'upload' ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Feather name="upload" size={15} color={colors.primary} />
                        )}
                        <Text style={styles.uploadText}>Add a file from this phone</Text>
                      </Pressable>

                      {library.isLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : library.data?.length ? (
                        library.data.map((track) => (
                          <TrackRow
                            key={track.id}
                            name={track.name}
                            detail={track.prompt}
                            source={track.source}
                            playing={isOn(`lib:${track.id}`)}
                            onPlay={() => audition(`lib:${track.id}`, track.url)}
                            chosen={chosenPath === track.storage_path}
                            onUse={() => use(track)}
                          />
                        ))
                      ) : (
                        <Text style={styles.note}>
                          Nothing in your library yet. Anything you generate above is kept here
                          and can be used on any film.
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** One track: what it is, a way to hear it, and a way to choose it. */
function TrackRow({ name, detail, source, playing, onPlay, chosen, onUse }) {
  return (
    <View style={[styles.track, chosen && styles.trackOn]}>
      <Pressable style={styles.play} onPress={onPlay} hitSlop={6}>
        <Feather
          name={playing ? 'pause' : 'play'}
          size={14}
          color="#fff"
          style={playing ? null : { marginLeft: 2 }}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={styles.trackName} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text style={styles.trackDetail} numberOfLines={1}>
            {source === 'uploaded' ? 'Your file' : detail}
          </Text>
        ) : null}
      </View>

      {onUse ? (
        <Pressable style={[styles.use, chosen && styles.useOn]} onPress={onUse} hitSlop={6}>
          <Text style={[styles.useText, chosen && styles.useTextOn]}>
            {chosen ? 'In use' : 'Use'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...type.title, color: colors.text },

  block: {
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  blockOpen: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...type.bodyStrong, color: colors.text },
  hint: { ...type.caption, color: colors.textMuted },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  badgeText: { ...type.tiny, fontSize: 9.5, color: colors.success },

  body: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  note: { ...type.caption, color: colors.textMuted },

  input: {
    minHeight: 84,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...type.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  ideas: { gap: spacing.sm, paddingVertical: 2 },
  idea: {
    width: 176,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ideaText: { ...type.caption, fontSize: 11.5, color: colors.textSoft },

  generate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  generateBusy: { backgroundColor: colors.primaryPress },
  generateText: { ...type.label, color: '#fff' },

  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  uploadText: { ...type.label, color: colors.primary },

  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  trackOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackName: { ...type.label, color: colors.text },
  trackDetail: { ...type.caption, fontSize: 11, color: colors.textMuted },
  use: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  useOn: { backgroundColor: colors.primary },
  useText: { ...type.tiny, color: colors.textSoft },
  useTextOn: { color: '#fff' },

  error: { ...type.caption, color: colors.danger, padding: spacing.md },
});
