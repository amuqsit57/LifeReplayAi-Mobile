import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { getEvent } from '../../src/lib/data';
import { pickMemories, uploadAll } from '../../src/lib/upload';
import { STYLE_META, colors, radius, spacing, type } from '../../src/theme';
import { Button, Card, Empty, Pill, Screen, SectionHeader } from '../../src/ui';

const STATUS_TONE = {
  uploading: 'warning',
  uploaded: 'warning',
  analyzing: 'primary',
  ready: 'success',
  failed: 'danger',
};

const STATUS_LABEL = {
  uploading: 'uploading',
  uploaded: 'queued',
  analyzing: 'understanding',
  ready: 'ready',
  failed: 'failed',
};

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(null);
  // Which memories are picked for deletion. Empty means normal browsing; the grid
  // only becomes a selection grid once something is held down.
  const [selected, setSelected] = useState([]);

  const event = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(id) });

  const memories = useQuery({
    queryKey: ['memories', id],
    queryFn: () => api.memories(id),
    // While anything is still being analysed the list is stale almost immediately,
    // so poll until everything settles rather than making the user pull to refresh.
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((m) => m.status !== 'ready' && m.status !== 'failed') ? 4000 : false;
    },
  });

  const replays = useQuery({
    queryKey: ['replays', id],
    queryFn: () => api.eventReplays(id),
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((r) => r.status === 'queued' || r.status === 'running') ? 5000 : false;
    },
  });

  const removeMemories = useMutation({
    mutationFn: (ids) => api.deleteMemories(ids),
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['memories', id] });
    },
    onError: (error) => Alert.alert('Could not delete', error.message),
  });

  const summarise = useMutation({
    mutationFn: () => api.summarise(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });

  const generate = useMutation({
    mutationFn: (style) => api.requestReplay(id, style),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['replays', id] }),
  });

  async function addMemories() {
    try {
      const assets = await pickMemories();
      if (!assets.length) return;

      setProgress({ index: 0, total: assets.length, phase: 'starting' });
      const results = await uploadAll(id, assets, setProgress);
      setProgress(null);

      // Each upload analyses itself as it lands. This only sweeps up anything
      // whose background task died, so a memory never sits unanalysed forever.
      api.analyseBatch(id).catch(() => {});

      const failures = results.filter((r) => !r.ok);
      if (failures.length) {
        // The reason matters far more than the count — "5 failed" is impossible to
        // act on, while the first actual error usually names the problem.
        setProgress({
          error: `${failures.length} of ${assets.length} failed.\n${failures[0].file ?? ''}: ${failures[0].error}`,
        });
        setTimeout(() => setProgress(null), 12000);
      }
      queryClient.invalidateQueries({ queryKey: ['memories', id] });
    } catch (err) {
      setProgress({ error: err.message });
      setTimeout(() => setProgress(null), 4000);
    }
  }

  const list = memories.data ?? [];
  const ready = list.filter((m) => m.status === 'ready').length;
  const processing = list.filter((m) => m.status !== 'ready' && m.status !== 'failed').length;

  const selecting = selected.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = list.length > 0 && selected.length === list.length;

  function toggle(memoryId) {
    setSelected((current) =>
      current.includes(memoryId)
        ? current.filter((value) => value !== memoryId)
        : [...current, memoryId]
    );
  }

  function confirmDelete() {
    const count = selected.length;
    Alert.alert(
      `Delete ${count} ${count === 1 ? 'memory' : 'memories'}?`,
      'The photos and videos are removed for everyone in the family. This cannot be undone.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeMemories.mutate(selected),
        },
      ]
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={memories.isFetching}
          onRefresh={() => {
            memories.refetch();
            replays.refetch();
          }}
          tintColor={colors.primary}
        />
      }
      contentStyle={{ gap: spacing.xl }}
    >
      <View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={[type.label, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[type.display, { color: colors.text, marginTop: spacing.sm }]}>
          {event.data?.title ?? 'Event'}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {event.data?.event_date ?? 'No date'}
          {event.data?.location ? ` · ${event.data.location}` : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Pill label={`${list.length} memories`} tone="primary" />
        <Pill label={`${ready} understood`} tone="success" icon="✨" />
        {processing ? <Pill label={`${processing} processing`} tone="warning" icon="⏳" /> : null}
      </View>

      <Button label="Add photos & videos" icon="＋" onPress={addMemories} />

      {progress ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Text
            selectable
            style={[type.body, { color: progress.error ? colors.danger : colors.text }]}
          >
            {progress.error
              ? progress.error
              : `Uploading ${progress.index + 1} of ${progress.total} — ${progress.phase}…`}
          </Text>
        </Card>
      ) : null}

      {event.data?.summary ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <Text style={[type.label, { color: colors.accent }]}>✨ WHAT AI SEES</Text>
          <Text style={[type.body, { color: colors.text, marginTop: spacing.sm, lineHeight: 23 }]}>
            {event.data.summary}
          </Text>
          {(event.data.key_moments ?? []).length ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
              {event.data.key_moments.map((moment, index) => (
                <Text key={index} style={[type.caption, { color: colors.textMuted }]}>
                  {index + 1}. {moment.title} ({moment.memory_ids?.length ?? 0})
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {ready > 0 ? (
        <View>
          <SectionHeader
            title="Make a Replay"
            subtitle="AI picks the moments and cuts the film"
            action={summarise.isPending ? 'Working…' : 'Analyse event'}
            onAction={() => summarise.mutate()}
          />

          <View style={styles.styleGrid}>
            {Object.entries(STYLE_META).map(([style, meta]) => {
              const existing = (replays.data ?? []).find((r) => r.style === style);
              const busy =
                existing?.status === 'queued' ||
                existing?.status === 'running' ||
                (generate.isPending && generate.variables === style);

              return (
                <Pressable
                  key={style}
                  onPress={() =>
                    existing?.status === 'succeeded'
                      ? router.push(`/replay/${existing.id}`)
                      : generate.mutate(style)
                  }
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.styleCard,
                    { borderColor: existing?.status === 'succeeded' ? meta.tint : colors.border },
                    pressed && { opacity: 0.85 },
                    busy && { opacity: 0.6 },
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{meta.label}</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>
                    {busy
                      ? 'Rendering…'
                      : existing?.status === 'succeeded'
                        ? `Watch · ${Math.round(existing.duration_seconds ?? 0)}s`
                        : existing?.status === 'failed'
                          ? 'Failed — tap to retry'
                          : 'Generate'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {generate.isError ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: spacing.sm }]}>
              {generate.error.message}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View>
        <SectionHeader
          title="Memories"
          subtitle={
            selecting
              ? `${selected.length} selected`
              : 'Everything the family added — hold one to select'
          }
        />

        {selecting ? (
          <View style={styles.selectBar}>
            <Button
              label={allSelected ? 'Select none' : 'Select all'}
              variant="ghost"
              onPress={() => setSelected(allSelected ? [] : list.map((m) => m.id))}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setSelected([])} />
            <Button
              label={removeMemories.isPending ? 'Deleting…' : `Delete ${selected.length}`}
              variant="danger"
              disabled={removeMemories.isPending}
              onPress={confirmDelete}
            />
          </View>
        ) : null}

        {list.length === 0 && !memories.isLoading ? (
          <Empty
            icon="📸"
            title="Nothing here yet"
            body="Add photos and videos — no need to sort them first."
          />
        ) : (
          <View style={styles.grid}>
            {list.map((memory) => {
              const picked = selectedSet.has(memory.id);
              // Never the original: those run to megabytes each and a screenful
              // of them stalls long enough to look like nothing loaded at all.
              const preview = memory.thumbnail_url ?? memory.url;

              return (
                <Pressable
                  key={memory.id}
                  style={styles.tile}
                  onLongPress={() => toggle(memory.id)}
                  onPress={() => (selecting ? toggle(memory.id) : null)}
                >
                  {preview ? (
                    <Image
                      source={{ uri: preview }}
                      style={[styles.thumb, picked && styles.thumbPicked]}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Text style={{ fontSize: 26 }}>
                        {memory.kind === 'video' ? '🎥' : memory.kind === 'voice' ? '🎙️' : '🖼️'}
                      </Text>
                    </View>
                  )}

                  {memory.kind === 'video' ? (
                    <Text style={styles.videoMark}>🎥</Text>
                  ) : null}
                  {picked ? <Text style={styles.tick}>✓</Text> : null}

                  <View style={styles.tileFoot}>
                    <Pill
                      label={STATUS_LABEL[memory.status] ?? memory.status}
                      tone={STATUS_TONE[memory.status] ?? 'neutral'}
                    />
                  </View>
                  {memory.tags?.length ? (
                    <Text numberOfLines={1} style={styles.tags}>
                      {memory.tags.slice(0, 3).join(' · ')}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  styleCard: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', gap: 4 },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  thumbPicked: { opacity: 0.55, borderWidth: 3, borderColor: colors.primary },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  tileFoot: { alignItems: 'flex-start' },
  tags: { ...type.caption, color: colors.textMuted },
  // Sits over the top-left of the tile so a clip is identifiable at a glance.
  videoMark: { position: 'absolute', top: 6, left: 6, fontSize: 14 },
  tick: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 20,
    color: colors.primary,
    fontWeight: '800',
  },
  selectBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
