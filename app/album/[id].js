import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useWarmImages } from '../../src/lib/warm';
import {
  addToAlbum,
  albumMemoryIds,
  deleteAlbum,
  getAlbum,
  removeFromAlbum,
} from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Segmented } from '../../src/ui/press';
import FilmCard from '../../src/ui/FilmCard';
import { RoundButton } from '../../src/ui/Header';
import { GridSkeleton } from '../../src/ui/Skeleton';
import { MediaTile } from '../../src/ui/social';
import Viewer from '../../src/ui/Viewer';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState('contents');
  const [staged, setStaged] = useState([]);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);

  const album = useQuery({ queryKey: ['album', id], queryFn: () => getAlbum(id) });
  const memberIds = useQuery({ queryKey: ['albumIds', id], queryFn: () => albumMemoryIds(id) });

  const eventId = album.data?.event_id;
  const everything = useQuery({
    queryKey: ['memories', eventId],
    queryFn: () => api.memories(eventId),
    enabled: Boolean(eventId),
  });

  const replays = useQuery({
    queryKey: ['replays', eventId],
    queryFn: () => api.eventReplays(eventId),
    enabled: Boolean(eventId),
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((r) => r.status === 'queued' || r.status === 'running') ? 1800 : false;
    },
  });

  const inAlbum = useMemo(() => new Set(memberIds.data ?? []), [memberIds.data]);
  const all = everything.data ?? [];
  const contents = all.filter((m) => inAlbum.has(m.id));
  const available = all.filter((m) => !inAlbum.has(m.id));
  const generated = (replays.data ?? []).filter((r) => r.album_id === id && !r.is_edit);
  const albumEdits = (replays.data ?? []).filter((r) => r.album_id === id && r.is_edit);
  const albumReplays = (replays.data ?? []).filter((r) => r.album_id === id);
  const cover = contents.find((m) => m.thumbnail_url)?.thumbnail_url ?? null;

  // The tiles you can see, decoded before the grid is drawn; the rest warm behind
  // them. Not settled until the memories have actually arrived — an empty list
  // before then means "not yet", not "nothing to load".
  const warm = useWarmImages(
    contents.map((m) => m.thumbnail_url ?? m.url),
    12,
    everything.isFetched && memberIds.isFetched
  );

  // A blank edit scoped to this album, so its shots come from here.
  const startEdit = useMutation({
    mutationFn: () =>
      api.draft({
        event_id: album.data?.event_id,
        album_id: id,
        title: `${album.data?.title ?? 'Album'} — my edit`,
      }),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: ['replays', album.data?.event_id] });
      router.push(`/editor/${draft.id}`);
    },
    onError: (error) => Alert.alert('Could not open the editor', error.message),
  });

  const add = useMutation({
    mutationFn: () => addToAlbum(id, staged),
    onSuccess: () => {
      setStaged([]);
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ['albumIds', id] });
      queryClient.invalidateQueries({ queryKey: ['albums', eventId] });
      queryClient.invalidateQueries({ queryKey: ['allAlbums'] });
    },
    onError: (error) => Alert.alert('Could not add', error.message),
  });

  const takeOut = useMutation({
    mutationFn: (memoryId) => removeFromAlbum(id, [memoryId]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albumIds', id] }),
  });

  const generate = useMutation({
    mutationFn: (style) => api.requestReplay(eventId, style, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['replays', eventId] }),
    onError: (error) => Alert.alert('Could not start', error.message),
  });

  const scrap = useMutation({
    mutationFn: () => deleteAlbum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums', eventId] });
      queryClient.invalidateQueries({ queryKey: ['allAlbums'] });
      router.back();
    },
  });

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={memberIds.isFetching}
            onRefresh={() => {
              memberIds.refetch();
              everything.refetch();
              replays.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          {cover && warm ? (
            <Image
          cachePolicy="memory-disk" source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, styles.veil]} />

          <View style={styles.heroBar}>
            <RoundButton name="chevron-left" label="Back" onPress={() => router.back()} />
            <RoundButton
              name="more-horizontal"
              label="Album options"
              onPress={() =>
                Alert.alert('Delete this album?', 'The photos and videos stay in the event.', [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => scrap.mutate() },
                ])
              }
            />
          </View>

          <View style={styles.heroText}>
            <View style={styles.crumb}>
              <Feather name="folder" size={12} color={colors.primary} />
              <Text style={styles.crumbText} numberOfLines={1}>
                Album in {album.data?.event_id ? 'this event' : 'an event'}
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {album.data?.title ?? 'Album'}
            </Text>
            <Text style={styles.meta}>
              {contents.length} {contents.length === 1 ? 'item' : 'items'}
              {albumReplays.length ? ` · ${albumReplays.length} films` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.gutter}>
          <Pressable style={styles.addBar} onPress={() => setAdding(true)}>
            <View style={styles.addIcon}>
              <Feather name="plus" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addTitle}>Add from the event</Text>
              <Text style={styles.meta}>
                {available.length} {available.length === 1 ? 'item' : 'items'} not in this album yet
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.gutter}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'contents', label: 'Contents', icon: 'image', count: contents.length },
              { value: 'films', label: 'Films', icon: 'film', count: albumReplays.length || null },
            ]}
          />
        </View>

        {tab === 'contents' ? (
          !warm ? (
            <View style={styles.gutter}>
              <GridSkeleton count={9} />
            </View>
          ) : contents.length === 0 ? (
            <View style={styles.blank}>
              <View style={styles.blankIcon}>
                <Feather name="image" size={22} color={colors.primary} />
              </View>
              <Text style={styles.blankTitle}>Nothing in here yet</Text>
              <Text style={styles.blankBody}>
                Add photos and videos from the event above, then generate a film from just these.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Tap to open · hold to take out</Text>
              <View style={styles.grid}>
                {contents.map((memory) => (
                  <MediaTile
                    key={memory.id}
                    uri={memory.thumbnail_url ?? memory.url}
                    kind={memory.kind}
                    style={{ width: '31.5%' }}
                    onPress={() => setViewing(memory.id)}
                    onLongPress={() =>
                      Alert.alert('Take out of album?', 'The photo stays in the event.', [
                        { text: 'Keep', style: 'cancel' },
                        { text: 'Take out', onPress: () => takeOut.mutate(memory.id) },
                      ])
                    }
                  />
                ))}
              </View>
            </>
          )
        ) : (
          <View style={styles.films}>
            <View style={styles.explain}>
              <Feather name="info" size={14} color={colors.textSoft} />
              <Text style={styles.explainText}>
                These films are cut from this album only — separate from the event's own.
              </Text>
            </View>
            {contents.length === 0 ? (
              <View style={styles.explainWarn}>
                <Feather name="image" size={14} color={colors.warning} />
                <Text style={styles.explainText}>Put something in the album first.</Text>
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>AI generated films</Text>

            {Object.keys(STYLE_META).map((style) => {
              const existing = generated.find((r) => r.style === style);
              return (
                <FilmCard
                  key={style}
                  style={style}
                  replay={existing}
                  onGenerate={() => contents.length && generate.mutate(style)}
                  onOpen={() => router.push(`/replay/${existing.id}`)}
                />
              );
            })}

            <Text style={styles.sectionTitle}>Custom films</Text>

            {albumEdits.map((edit) => (
              <Pressable
                key={edit.id}
                style={styles.editRow}
                onPress={() =>
                  router.push(
                    edit.status === 'succeeded' ? `/replay/${edit.id}` : `/editor/${edit.id}`
                  )
                }
              >
                <View style={styles.editIcon}>
                  <Feather
                    name={edit.status === 'succeeded' ? 'play' : 'edit-3'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editTitle} numberOfLines={1}>
                    {edit.title || 'Untitled edit'}
                  </Text>
                  <Text style={styles.explainText} numberOfLines={1}>
                    {edit.shot_count} {edit.shot_count === 1 ? 'shot' : 'shots'} ·{' '}
                    {edit.status === 'succeeded' ? 'ready' : 'not rendered'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            <Pressable
              style={[styles.startEdit, !contents.length && { opacity: 0.5 }]}
              onPress={() => contents.length && startEdit.mutate()}
              disabled={!contents.length || startEdit.isPending}
            >
              {startEdit.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="scissors" size={16} color={colors.primary} />
              )}
              <Text style={styles.startEditText}>Cut one yourself</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Picking from the event, as a sheet rather than inline — choosing from a
          hundred photos while the album's own grid scrolls underneath was hard
          to follow. */}
      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={[styles.screen, { paddingTop: insets.top }]}>
          <View style={styles.pickerBar}>
            <Pressable onPress={() => { setAdding(false); setStaged([]); }} hitSlop={10}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>
              {staged.length ? `${staged.length} chosen` : 'Choose items'}
            </Text>
            <Pressable
              onPress={() => staged.length && add.mutate()}
              disabled={!staged.length || add.isPending}
              hitSlop={10}
            >
              <Text style={[styles.pickerDone, !staged.length && { color: colors.textMuted }]}>
                {add.isPending ? 'Adding…' : 'Add'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.pickerGrid}>
            {available.map((memory) => (
              <MediaTile
                key={memory.id}
                uri={memory.thumbnail_url ?? memory.url}
                kind={memory.kind}
                selected={staged.includes(memory.id)}
                style={{ width: '31.5%' }}
                onPress={() =>
                  setStaged((current) =>
                    current.includes(memory.id)
                      ? current.filter((value) => value !== memory.id)
                      : [...current, memory.id]
                  )
                }
              />
            ))}
            {available.length === 0 ? (
              <Text style={styles.hint}>Everything in this event is already in the album.</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Viewer
        memories={contents}
        startId={viewing}
        visible={Boolean(viewing)}
        onClose={() => setViewing(null)}
        onDelete={(memoryId) => {
          setViewing(null);
          takeOut.mutate(memoryId);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  gutter: { paddingHorizontal: spacing.lg },

  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  veil: { backgroundColor: 'rgba(255,255,255,0.85)' },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { gap: spacing.xs },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  crumbText: { ...type.tiny, color: colors.primary },
  title: { ...type.display, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },

  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + '2E',
    ...shadow.card,
  },
  addIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: { ...type.bodyStrong, color: colors.text },

  hint: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },

  films: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  sectionTitle: { ...type.heading, color: colors.text, paddingTop: spacing.md },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  editIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTitle: { ...type.bodyStrong, color: colors.text },
  startEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  startEditText: { ...type.label, color: colors.primary },
  explain: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  explainWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  explainText: { ...type.caption, color: colors.textSoft, flex: 1 },

  blank: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  blankIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankTitle: { ...type.heading, color: colors.text },
  blankBody: { ...type.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 290 },

  pickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerTitle: { ...type.bodyStrong, color: colors.text },
  pickerCancel: { ...type.label, color: colors.textMuted },
  pickerDone: { ...type.label, color: colors.primary },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
  },
});
