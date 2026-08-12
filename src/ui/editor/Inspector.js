import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  GRADES,
  MAX_SECONDS,
  MIN_SECONDS,
  MOTIONS,
  SOUNDS,
  SPEEDS,
  TEXTURES,
  TRANSITION_GROUPS,
  transitionLabel,
} from '../../lib/plan';
import { colors, radius, spacing, type } from '../../theme';
import { ChipRow, Group, GroupedSheet, Section, Slider, SwatchRow } from './controls';

const TABS = [
  { value: 'shot', label: 'Shot', icon: 'crop' },
  { value: 'look', label: 'Look', icon: 'droplet' },
  { value: 'sound', label: 'Sound', icon: 'volume-2' },
  { value: 'text', label: 'Text', icon: 'type' },
];

/**
 * Everything about one shot.
 *
 * Split into four because all of it at once is a wall — and because the four are
 * genuinely different decisions. How long it runs is an edit; how it is graded is
 * a look; whether you hear it is a mix. Editors have kept those apart for a
 * century and it was not an accident.
 */
export default function Inspector({
  clip,
  memory,
  index,
  total,
  onChange,
  onMove,
  onDelete,
  onDuplicate,
  onApplyAll,
}) {
  const [tab, setTab] = useState('shot');
  const [picking, setPicking] = useState(false);

  const isVideo = memory?.kind === 'video';
  const available = Number(memory?.duration_seconds) || 0;
  // A shot can never run past the end of what it was cut from.
  const ceiling = isVideo && available
    ? Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, available - (clip.start_at || 0)))
    : MAX_SECONDS;

  return (
    <View style={styles.panel}>
      <View style={styles.tabs}>
        {TABS.map((item) => {
          const on = item.value === tab;
          return (
            <Pressable
              key={item.value}
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => setTab(item.value)}
            >
              <Feather
                name={item.icon}
                size={14}
                color={on ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'shot' ? (
          <>
            <Section title="Timing" icon="clock" hint="How much screen time this shot gets." />
            <Group
              title="How long it holds"
              action={<Text style={styles.readout}>{Number(clip.seconds).toFixed(1)}s</Text>}
            >
              <Slider
                value={Number(clip.seconds)}
                min={MIN_SECONDS}
                max={ceiling}
                step={0.1}
                onChange={(seconds) => onChange({ seconds: Number(seconds.toFixed(1)) })}
              />
            </Group>

            {isVideo && available > MIN_SECONDS ? (
              <Group
                title="Where it starts"
                hint="Which part of the clip this shot is cut from."
                action={<Text style={styles.readout}>{Number(clip.start_at).toFixed(1)}s</Text>}
              >
                <Slider
                  value={Number(clip.start_at)}
                  min={0}
                  max={Math.max(0.1, available - MIN_SECONDS)}
                  step={0.1}
                  onChange={(start) => {
                    const start_at = Number(start.toFixed(1));
                    // Moving the in-point later shortens what is left; trimming
                    // here rather than at save time keeps the readouts honest.
                    const room = Math.max(MIN_SECONDS, available - start_at);
                    onChange({
                      start_at,
                      seconds: Math.min(Number(clip.seconds), Number(room.toFixed(1))),
                    });
                  }}
                />
              </Group>
            ) : null}

            {isVideo ? (
              <Group title="Speed">
                <ChipRow
                  options={SPEEDS}
                  value={clip.speed ?? 'normal'}
                  onChange={(speed) => onChange({ speed })}
                />
              </Group>
            ) : null}

            <Section
              title="Transition"
              icon="git-commit"
              hint="How this shot joins the next one. A straight cut is right more often than not."
            />
            <Group title="Transition">
              <Pressable style={styles.select} onPress={() => setPicking(true)}>
                <Text style={styles.selectText}>{transitionLabel(clip.transition)}</Text>
                <Feather name="chevron-right" size={17} color={colors.textMuted} />
              </Pressable>
            </Group>

            <Section title="Order" icon="move" hint="Where this shot sits in the film." />
            <Group title="Move it">
              <View style={styles.actions}>
                <Tool
                  icon="arrow-left"
                  label="Earlier"
                  disabled={index === 0}
                  onPress={() => onMove(-1)}
                />
                <Tool
                  icon="arrow-right"
                  label="Later"
                  disabled={index >= total - 1}
                  onPress={() => onMove(1)}
                />
                <Tool icon="copy" label="Duplicate" onPress={onDuplicate} />
                <Tool icon="trash-2" label="Remove" tone="danger" onPress={onDelete} />
              </View>
            </Group>
          </>
        ) : null}

        {tab === 'look' ? (
          <>
            <Section
              title="Effects"
              icon="droplet"
              hint="Colour, film texture and camera move — applied to this shot when it renders."
            />
            <Group
              title="Grade"
              action={
                <Pressable onPress={() => onApplyAll({ grade: clip.grade })}>
                  <Text style={styles.applyAll}>Apply to all</Text>
                </Pressable>
              }
            >
              <SwatchRow
                options={GRADES}
                value={clip.grade ?? 'natural'}
                onChange={(grade) => onChange({ grade })}
              />
            </Group>

            <Group
              title="Texture"
              hint="On every shot it stops reading as film and starts reading as a filter."
              action={
                <Pressable onPress={() => onApplyAll({ texture: clip.texture })}>
                  <Text style={styles.applyAll}>Apply to all</Text>
                </Pressable>
              }
            >
              <ChipRow
                options={TEXTURES}
                value={clip.texture ?? 'none'}
                onChange={(texture) => onChange({ texture })}
              />
            </Group>

            {!isVideo ? (
              <Group title="Movement" hint="A still that never moves reads as a slideshow.">
                <ChipRow
                  icons
                  options={MOTIONS}
                  value={clip.motion ?? 'push_in'}
                  onChange={(motion) => onChange({ motion })}
                />
              </Group>
            ) : (
              <Group title="Movement">
                <Text style={styles.note}>
                  This shot is video — it already moves on its own.
                </Text>
              </Group>
            )}
          </>
        ) : null}

        {tab === 'sound' ? (
          <>
          <Section title="Mix" icon="volume-2" hint="Music is set for the whole film — that lives under Music, below the timeline." />
          <Group
            title="This shot's own sound"
            hint={
              isVideo
                ? 'Keep it for anything said out loud. Duck it when it is only the room.'
                : 'A photograph has no sound of its own.'
            }
          >
            {isVideo ? (
              <ChipRow
                options={SOUNDS}
                value={clip.sound ?? 'keep'}
                onChange={(sound) => onChange({ sound })}
              />
            ) : null}
          </Group>
          </>
        ) : null}

        {tab === 'text' ? (
          <>
          <Section title="Titles" icon="type" hint="Words drawn over this shot." />
          <Group
            title="Label"
            hint="Set as a title over the shot. A few words — a place, a name, a year."
          >
            <TextInput
              style={styles.input}
              value={clip.caption ?? ''}
              onChangeText={(caption) => onChange({ caption })}
              placeholder="Nothing on this shot"
              placeholderTextColor={colors.textMuted}
              maxLength={90}
              returnKeyType="done"
            />
          </Group>
          </>
        ) : null}
      </ScrollView>

      <GroupedSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title="Join into the next shot"
        groups={TRANSITION_GROUPS}
        value={clip.transition}
        onChange={(transition) => onChange({ transition })}
      />
    </View>
  );
}

function Tool({ icon, label, onPress, disabled, tone }) {
  return (
    <Pressable
      style={[styles.tool, disabled && styles.toolOff]}
      onPress={onPress}
      disabled={disabled}
    >
      <Feather
        name={icon}
        size={16}
        color={
          disabled ? colors.borderStrong : tone === 'danger' ? colors.danger : colors.textSoft
        }
      />
      <Text
        style={[
          styles.toolText,
          disabled && { color: colors.borderStrong },
          tone === 'danger' && !disabled && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabOn: { backgroundColor: colors.primarySoft },
  tabText: { ...type.label, color: colors.textMuted },
  tabTextOn: { color: colors.primary },

  body: { flex: 1 },
  readout: { ...type.label, color: colors.primary },
  applyAll: { ...type.label, color: colors.primary },
  note: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },

  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  selectText: { ...type.bodyStrong, color: colors.text },

  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  tool: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolOff: { opacity: 0.55 },
  toolText: { ...type.tiny, fontSize: 10, color: colors.textSoft },

  input: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...type.body,
    color: colors.text,
  },
});
