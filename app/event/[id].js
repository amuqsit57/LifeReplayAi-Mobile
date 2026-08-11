import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '../../src/lib/api';
import { createAlbum, eventPeople, getEvent, listAlbums } from '../../src/lib/data';
import { pickMemories, uploadAll } from '../../src/lib/upload';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Button, Empty } from '../../src/ui';
import { AvatarRow, MediaTile } from '../../src/ui/social';
import Viewer from '../../src/ui/Viewer';

const STATUS_LABEL = {
  uploading: 'uploading',
  uploaded: 'queued',
  analyzing: 'reading',
  ready: null,
  failed: 'failed',
};

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [progress, setProgress] = useState(null);
  const [selected, setSelected] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [albumSheet, setAlbumSheet] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');

  const event = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(id) });
  const people = useQuery({ queryKey: ['people', id], queryFn: () => eventPeople(id) });
  const albums = useQuery({ queryKey: ['albums', id], queryFn: () => listAlbums(id) });

  const memories = useQuery({
    queryKey: ['memories', id],
    queryFn: () => api.memories(id),
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

  const list = memories.data ?? [];
  const selecting = selected.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);

  const remove = useMutation({
    mutationFn: (ids) => api.deleteMemories(ids),
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['memories', id] });
    },
    onError: (error) => Alert.alert('Could not delete', error.message),
  });

  const makeAlbum = useMutation({
    mutationFn: () => createAlbum({ eventId: id, title: albumTitle, memoryIds: selected }),
    onSuccess: (album) => {
      setAlbumSheet(false);
      setAlbumTitle('');
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['albums', id] });
      router.push(`/album/${album.id}`);
    },
    onError: (error) => Alert.alert('Could not make the album', error.message),
  });

  const generate = useMutation({
    mutationFn: (style) => api.requestReplay(id, style),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['replays', id] }),
    onError: (error) => Alert.alert('Could not start', error.message),
  });

  function toggle(memoryId) {
    setSelected((current) =>
      current.includes(memoryId)
        ? current.filter((value) => value !== memoryId)
        : [...current, memoryId]
    );
  }

  async function addMemories() {
    const assets = await pickMemories();
    if (!assets.length) return;

    setProgress({ index: 0, total: assets.length, phase: 'preparing' });
    const results = await uploadAll(id, assets, setProgress);
    setProgress(null);

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      Alert.alert(
        `${failed.length} could not be added`,
        failed.slice(0, 3).map((f) => `${f.file}: ${f.error}`).join('\n\n')
      );
    }
    api.analyseBatch(id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['memories', id] });
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${selected.length}?`,
      'They are removed for everyone in this event. This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(selected) },
      ]
    );
  }

  const info = event.data;
  const finished = (replays.data ?? []).filter((r) => r.status === 'succeeded');

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={memories.isFetching}
            onRefresh={() => {
              memories.refetch();
              replays.refetch();
              albums.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>{info?.title ?? 'Event'}</Text>
        <View style={styles.metaRow}>
          <AvatarRow people={people.data ?? []} />
          <Text style={styles.meta}>
            {(people.data ?? []).length} {(people.data ?? []).length === 1 ? 'person' : 'people'} ·{' '}
            {list.length} {list.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {info?.invite_code ? (
          <Pressable
            style={styles.invite}
            onPress={() => {
              Clipboard.setStringAsync(info.invite_code);
              Share.share({
                message: `Join "${info.title}" on Life Replay with code ${info.invite_code}`,
              });
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{info.invite_code}</Text>
            </View>
            <Text style={styles.inviteAction}>Share ↗</Text>
          </Pressable>
        ) : null}

        <View style={styles.rowButtons}>
          <Button
            label={progress ? `Adding ${progress.index + 1}/${progress.total}…` : 'Add photos & videos'}
            onPress={addMemories}
            disabled={Boolean(progress)}
          />
        </View>

        {/* ---------------------------------------------------------- albums */}
        <View style={styles.sectionHead}>
          <Text style={styles.section}>Albums</Text>
          <Text style={styles.hint}>Select items below to make one</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRow}>
          {(albums.data ?? []).map((album) => (
            <Pressable
              key={album.id}
              style={styles.albumCard}
              onPress={() => router.push(`/album/${album.id}`)}
            >
              <Text style={styles.albumTitle} numberOfLines={2}>
                {album.title}
              </Text>
              <Text style={styles.albumCount}>
                {album.album_memories?.[0]?.count ?? 0} items
              </Text>
            </Pressable>
          ))}
          {(albums.data ?? []).length === 0 ? (
            <Text style={styles.hint}>No albums yet.</Text>
          ) : null}
        </ScrollView>

        {/* ---------------------------------------------------------- films */}
        <Text style={styles.section}>Films</Text>
        <View style={styles.styleGrid}>
          {Object.entries(STYLE_META).map(([style, meta]) => {
            const existing = (replays.data ?? []).find((r) => r.style === style && !r.album_id);
            const busy = existing?.status === 'queued' || existing?.status === 'running';
            return (
              <Pressable
                key={style}
                style={[styles.styleCard, { borderColor: meta.tint + '55' }]}
                onPress={() =>
                  existing?.status === 'succeeded'
                    ? router.push(`/replay/${existing.id}`)
                    : generate.mutate(style)
                }
              >
                <Text style={styles.styleEmoji}>{meta.emoji}</Text>
                <Text style={styles.styleLabel}>{meta.label}</Text>
                <Text style={[styles.styleState, { color: meta.tint }]}>
                  {busy ? 'making…' : existing?.status === 'succeeded' ? 'watch' : 'generate'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ---------------------------------------------------------- gallery */}
        <View style={styles.sectionHead}>
          <Text style={styles.section}>Everything added</Text>
          {selecting ? (
            <Pressable onPress={() => setSelected(list.map((m) => m.id))}>
              <Text style={styles.hintAction}>Select all</Text>
            </Pressable>
          ) : (
            <Text style={styles.hint}>Hold to select</Text>
          )}
        </View>

        {list.length === 0 && !memories.isLoading ? (
          <Empty icon="📸" title="Nothing here yet" body="Add photos and videos — no need to sort them first." />
        ) : (
          <View style={styles.grid}>
            {list.map((memory) => (
              <MediaTile
                key={memory.id}
                uri={memory.thumbnail_url ?? memory.url}
                kind={memory.kind}
                selected={selectedSet.has(memory.id)}
                badge={STATUS_LABEL[memory.status] ?? memory.status}
                style={{ width: '31.5%' }}
                onPress={() => (selecting ? toggle(memory.id) : setViewing(memory.id))}
                onLongPress={() => toggle(memory.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Selection bar, over the content so the grid does not jump when it appears. */}
      {selecting ? (
        <View style={styles.selectBar}>
          <Pressable onPress={() => setSelected([])} hitSlop={8}>
            <Text style={styles.selectCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.selectCount}>{selected.length} selected</Text>
          <View style={{ flex: 1 }} />
          <Button label="Make album" variant="secondary" onPress={() => setAlbumSheet(true)} />
          <Button
            label={remove.isPending ? '…' : 'Delete'}
            variant="danger"
            onPress={confirmDelete}
            disabled={remove.isPending}
          />
        </View>
      ) : null}

      <Viewer
        memories={list}
        startId={viewing}
        visible={Boolean(viewing)}
        onClose={() => setViewing(null)}
        onDelete={(memoryId) => {
          setViewing(null);
          remove.mutate([memoryId]);
        }}
      />

      <Modal visible={albumSheet} transparent animationType="fade" onRequestClose={() => setAlbumSheet(false)}>
        <Pressable style={styles.sheetBack} onPress={() => setAlbumSheet(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Name the album</Text>
            <Text style={styles.sheetBlurb}>
              {selected.length} {selected.length === 1 ? 'item' : 'items'} will go in it. You can
              generate a separate film from an album.
            </Text>
            <TextInput
              value={albumTitle}
              onChangeText={setAlbumTitle}
              placeholder="The ceremony"
              placeholderTextColor={colors.textMuted}
              style={styles.sheetInput}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Cancel" variant="ghost" onPress={() => setAlbumSheet(false)} />
              <View style={{ flex: 1 }}>
                <Button
                  label={makeAlbum.isPending ? 'Making…' : 'Make album'}
                  onPress={() => makeAlbum.mutate()}
                  disabled={!albumTitle.trim() || makeAlbum.isPending}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  back: { ...type.label, color: colors.primary },
  title: { ...type.display, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { ...type.caption, color: colors.textMuted },

  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  inviteLabel: { ...type.tiny, color: colors.textSoft },
  inviteCode: { ...type.title, color: colors.primary, letterSpacing: 2 },
  inviteAction: { ...type.label, color: colors.primary },

  rowButtons: { gap: spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  section: { ...type.heading, color: colors.text },
  hint: { ...type.caption, color: colors.textMuted },
  hintAction: { ...type.caption, color: colors.primary },

  albumRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  albumCard: {
    width: 132,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 4,
  },
  albumTitle: { ...type.bodyStrong, color: colors.text },
  albumCount: { ...type.caption, color: colors.textMuted },

  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  styleCard: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    gap: 2,
    ...shadow.card,
  },
  styleEmoji: { fontSize: 20 },
  styleLabel: { ...type.bodyStrong, color: colors.text },
  styleState: { ...type.tiny },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  selectBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.raised,
  },
  selectCancel: { ...type.label, color: colors.textMuted },
  selectCount: { ...type.label, color: colors.text },

  sheetBack: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { ...type.title, color: colors.text },
  sheetBlurb: { ...type.caption, color: colors.textMuted },
  sheetInput: {
    ...type.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
});
