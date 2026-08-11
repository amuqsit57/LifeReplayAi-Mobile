import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
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
import { Empty } from '../../src/ui';
import { IconButton, Segmented } from '../../src/ui/brand';
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

  const [tab, setTab] = useState('gallery');
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
  const albumList = albums.data ?? [];
  const eventFilms = (replays.data ?? []).filter((r) => !r.album_id);
  const selecting = selected.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const peopleById = useMemo(
    () => new Map((people.data ?? []).map((person) => [person.user_id, person])),
    [people.data]
  );

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

  const info = event.data;
  const cover = list.find((m) => m.thumbnail_url)?.thumbnail_url ?? null;

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
        {/* ----------------------------------------------------------- header */}
        <View style={styles.hero}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.heroImage} contentFit="cover" blurRadius={28} />
          ) : null}
          <View style={styles.heroVeil} />

          <View style={styles.heroBar}>
            <IconButton name="chevron-left" label="Back" onPress={() => router.back()} />
            <IconButton
              name="user-plus"
              label="Invite"
              onPress={() => {
                if (!info?.invite_code) return;
                Clipboard.setStringAsync(info.invite_code);
                Share.share({
                  message: `Join "${info.title}" on Life Replay with code ${info.invite_code}`,
                }).catch(() => {});
              }}
            />
          </View>

          <View style={styles.heroText}>
            <Text style={styles.title} numberOfLines={2}>
              {info?.title ?? 'Event'}
            </Text>
            <View style={styles.heroMeta}>
              <AvatarRow people={people.data ?? []} />
              <Text style={styles.metaText}>
                {(people.data ?? []).length} {(people.data ?? []).length === 1 ? 'person' : 'people'}
                {info?.location ? ` · ${info.location}` : ''}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.addBar}
          onPress={addMemories}
          disabled={Boolean(progress)}
        >
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={styles.addBarText}>
            {progress ? `Adding ${progress.index + 1} of ${progress.total}…` : 'Add photos & videos'}
          </Text>
        </Pressable>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'gallery', label: 'Gallery', icon: 'image', count: list.length },
            { value: 'films', label: 'Films', icon: 'film', count: eventFilms.length || null },
            { value: 'albums', label: 'Albums', icon: 'folder', count: albumList.length || null },
          ]}
        />

        {/* ---------------------------------------------------------- gallery */}
        {tab === 'gallery' ? (
          list.length === 0 && !memories.isLoading ? (
            <Empty icon="📸" title="Nothing here yet" body="Add photos and videos — no need to sort them first." />
          ) : (
            <>
              <Text style={styles.hint}>
                {selecting ? `${selected.length} selected` : 'Tap to open · hold to select'}
              </Text>
              <View style={styles.grid}>
                {list.map((memory) => (
                  <MediaTile
                    key={memory.id}
                    uri={memory.thumbnail_url ?? memory.url}
                    kind={memory.kind}
                    selected={selectedSet.has(memory.id)}
                    badge={STATUS_LABEL[memory.status] ?? memory.status}
                    uploader={people.data?.length > 1 ? peopleById.get(memory.uploaded_by) : null}
                    style={{ width: '31.5%' }}
                    onPress={() => (selecting ? toggle(memory.id) : setViewing(memory.id))}
                    onLongPress={() => toggle(memory.id)}
                  />
                ))}
              </View>
            </>
          )
        ) : null}

        {/* ------------------------------------------------------------ films */}
        {tab === 'films' ? (
          <View style={styles.styleGrid}>
            {Object.entries(STYLE_META).map(([style, meta]) => {
              const existing = eventFilms.find((r) => r.style === style);
              const busy = existing?.status === 'queued' || existing?.status === 'running';
              const done = existing?.status === 'succeeded';
              return (
                <Pressable
                  key={style}
                  style={styles.filmCard}
                  onPress={() =>
                    done ? router.push(`/replay/${existing.id}`) : generate.mutate(style)
                  }
                >
                  <View style={[styles.filmDot, { backgroundColor: meta.tint }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filmLabel}>{meta.label}</Text>
                    <Text style={styles.filmState}>
                      {busy ? 'making…' : done ? 'ready to watch' : 'not made yet'}
                    </Text>
                  </View>
                  <Feather
                    name={busy ? 'loader' : done ? 'play-circle' : 'zap'}
                    size={19}
                    color={done ? meta.tint : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* ----------------------------------------------------------- albums */}
        {tab === 'albums' ? (
          albumList.length === 0 ? (
            <Empty
              icon="❏"
              title="No albums yet"
              body="Select photos in the gallery and choose Make album. Each album gets its own films."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {albumList.map((album) => (
                <Pressable
                  key={album.id}
                  style={styles.albumRow}
                  onPress={() => router.push(`/album/${album.id}`)}
                >
                  <View style={styles.albumIcon}>
                    <Feather name="folder" size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.albumTitle} numberOfLines={1}>
                      {album.title}
                    </Text>
                    <Text style={styles.hint}>
                      {album.album_memories?.[0]?.count ?? 0} items
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {selecting ? (
        <View style={styles.selectBar}>
          <Pressable onPress={() => setSelected([])} hitSlop={8}>
            <Feather name="x" size={19} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.selectCount}>{selected.length}</Text>
          <Pressable onPress={() => setSelected(list.map((m) => m.id))} hitSlop={8}>
            <Text style={styles.selectAll}>All</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.selectAction} onPress={() => setAlbumSheet(true)}>
            <Feather name="folder-plus" size={17} color={colors.primary} />
            <Text style={styles.selectActionText}>Album</Text>
          </Pressable>
          <Pressable
            style={styles.selectAction}
            disabled={remove.isPending}
            onPress={() =>
              Alert.alert(
                `Delete ${selected.length}?`,
                'Removed for everyone in this event. This cannot be undone.',
                [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(selected) },
                ]
              )
            }
          >
            <Feather name="trash-2" size={17} color={colors.danger} />
            <Text style={[styles.selectActionText, { color: colors.danger }]}>Delete</Text>
          </Pressable>
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
            <Text style={styles.sheetHint}>
              {selected.length} {selected.length === 1 ? 'item' : 'items'} go in it. An album can have
              its own films.
            </Text>
            <TextInput
              value={albumTitle}
              onChangeText={setAlbumTitle}
              placeholder="The ceremony"
              placeholderTextColor={colors.textMuted}
              style={styles.sheetInput}
              autoFocus
            />
            <Pressable
              onPress={() => makeAlbum.mutate()}
              disabled={!albumTitle.trim() || makeAlbum.isPending}
              style={[styles.cta, (!albumTitle.trim() || makeAlbum.isPending) && styles.ctaOff]}
            >
              <Text style={styles.ctaText}>
                {makeAlbum.isPending ? 'Making…' : 'Make album'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120, gap: spacing.lg },

  // The cover, blurred, behind the title — the event's own photograph carrying
  // its header rather than a flat coloured band.
  hero: { paddingTop: 52, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.lg },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.82)' },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { gap: spacing.sm },
  title: { ...type.display, color: colors.text },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { ...type.caption, color: colors.textSoft },

  addBar: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  addBarText: { ...type.bodyStrong, color: '#fff' },

  hint: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },

  styleGrid: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  filmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  filmDot: { width: 8, height: 8, borderRadius: 4 },
  filmLabel: { ...type.bodyStrong, color: colors.text },
  filmState: { ...type.caption, color: colors.textMuted },

  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  albumIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumTitle: { ...type.bodyStrong, color: colors.text },

  selectBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.raised,
  },
  selectCount: { ...type.bodyStrong, color: colors.text },
  selectAll: { ...type.label, color: colors.primary },
  selectAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectActionText: { ...type.label, color: colors.primary },

  sheetBack: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { ...type.title, color: colors.text },
  // The gallery hint is inset to the screen gutter; inside a sheet that padding
  // would double up on the sheet's own.
  sheetHint: { ...type.caption, color: colors.textMuted },
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
  cta: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaOff: { backgroundColor: colors.borderStrong },
  ctaText: { ...type.bodyStrong, color: '#fff' },
});
