import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
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
 * Four answers, and only one of them involves us deciding anything. The film has
 * never been able to run silent by choice before — silence was only ever what a
 * failed generation left behind — so "No music" is a real option here.
 */
export default function AudioPanel({ visible, onClose, replayId, music, onChange }) {
  const mode = music?.mode ?? 'ai';
  const [prompt, setPrompt] = useState(music?.prompt ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setBusy(true);

      const permission = await api.audioUploadUrl(replayId, {
        filename: file.name ?? 'track.mp3',
        content_type: file.mimeType ?? 'audio/mpeg',
        bytes: file.size ?? null,
      });
      // Straight to storage, the same as memories — an audio file is the one
      // thing in this API big enough to be worth not proxying.
      await uploadToSignedUrl(permission.upload_url, file.uri, file.mimeType ?? 'audio/mpeg');

      onChange({ mode: 'track', path: permission.storage_path, name: file.name });
    } catch (problem) {
      setError(problem.message ?? 'That file would not upload.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Music</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {MUSIC_MODES.map((option) => {
              const on = option.value === mode;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => {
                    if (option.value === 'track') return pick();
                    if (option.value === 'prompt') {
                      return onChange({ mode: 'prompt', prompt });
                    }
                    onChange({ mode: option.value });
                  }}
                >
                  <View style={[styles.icon, on && { backgroundColor: colors.primary }]}>
                    <Feather
                      name={option.icon}
                      size={15}
                      color={on ? '#fff' : colors.textSoft}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, on && { color: colors.primary }]}>
                      {option.label}
                    </Text>
                    <Text style={styles.hint}>
                      {option.value === 'track' && music?.name && on
                        ? music.name
                        : option.hint}
                    </Text>
                  </View>
                  {busy && option.value === 'track' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : on ? (
                    <Feather name="check" size={17} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}

            {mode === 'prompt' ? (
              <View style={styles.promptBox}>
                <TextInput
                  style={styles.input}
                  value={prompt}
                  onChangeText={setPrompt}
                  onEndEditing={() => onChange({ mode: 'prompt', prompt })}
                  placeholder="Describe the music: instruments, tempo, mood."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={400}
                />
                <Text style={styles.ideasTitle}>Or start from one of these</Text>
                {IDEAS.map((idea) => (
                  <Pressable
                    key={idea}
                    style={styles.idea}
                    onPress={() => {
                      setPrompt(idea);
                      onChange({ mode: 'prompt', prompt: idea });
                    }}
                  >
                    <Text style={styles.ideaText}>{idea}</Text>
                  </Pressable>
                ))}
                <Text style={styles.footnote}>
                  Composing takes a minute or two, and runs when you render.
                </Text>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
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
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.primarySoft },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.bodyStrong, color: colors.text },
  hint: { ...type.caption, color: colors.textMuted },

  promptBox: { gap: spacing.sm, paddingTop: spacing.sm },
  input: {
    minHeight: 92,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...type.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  ideasTitle: {
    ...type.slate,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  idea: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ideaText: { ...type.caption, color: colors.textSoft },
  footnote: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },
  error: { ...type.caption, color: colors.danger, paddingHorizontal: spacing.md },
});
