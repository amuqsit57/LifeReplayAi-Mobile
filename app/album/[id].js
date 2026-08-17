import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
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
import { FREE_FILMS_PER_EVENT, allowance, filmsUsed } from '../../src/lib/limits';
import { showPaywall } from '../../src/lib/paywall';
import { usePro } from '../../src/store';
import { pickMemories, uploadAll } from '../../src/lib/upload';
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
import ErrorState from '../../src/ui/ErrorState';
import FilmCard from '../../src/ui/FilmCard';
import { RoundButton, SearchBar } from '../../src/ui/Header';
import Photo from '../../src/ui/Photo';
import { DetailSkeleton } from '../../src/ui/Skeleton';
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
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('newest');

  const inside = all.filter((m) => inAlbum.has(m.id));

  const contents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = inside.filter((m) => {
      if (kind !== 'all' && m.kind !== kind) return false;
      if (!needle) return true;
      return [m.description, ...(m.tags ?? [])]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });

    // When it was taken, not when it arrived.
    const when = (m) => new Date(m.captured_at ?? m.created_at ?? 0).getTime();
    const RANK = { essential: 3, strong: 2, ordinary: 1, weak: 0 };
    return [...rows].sort((a, b) => {
      if (sort === 'oldest') return when(a) - when(b);
      if (sort === 'best') {
        return (RANK[b.significance] ?? 0) - (RANK[a.significance] ?? 0) || when(b) - when(a);
      }
      return when(b) - when(a);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, inAlbum, query, kind, sort]);
  const available = all.filter((m) => !inAlbum.has(m.id));
  const generated = (replays.data ?? []).filter((r) => r.album_id === id && !r.is_edit);
  const albumEdits = (replays.data ?? []).filter((r) => r.album_id === id && r.is_edit);
  const albumReplays = (replays.data ?? []).filter((r) => r.album_id === id);
  const cover = contents.find((m) => m.thumbnail_url)?.thumbnail_url ?? null;

  // The tiles you can see, decoded before the grid is drawn; the rest warm behind
  // them. Not settled until the memories have actually arrived — an empty list
  // before then means "not yet", not "nothing to load".
  const warm = useWarmImages(
    inside.map((m) => m.thumbnail_url ?? m.url),
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

  // Upload into the event, then put what landed straight into this album.
  const [progress, setProgress] = useState(null);

  async function addOwnMedia() {
    const assets = await pickMemories();
    if (!assets.length || !album.data?.event_id) return;

    setProgress({ index: 0, total: assets.length, phase: 'preparing' });
    const results = await uploadAll(album.data.event_id, assets, setProgress);
    setProgress(null);

    const ids = results.filter((r) => r.ok).map((r) => r.memory?.id).filter(Boolean);
    if (ids.length) {
      try {
        await addToAlbum(id, ids);
      } catch (error) {
        Alert.alert('Added to the event, but not the album', error.message);
      }
    }

    api.analyseBatch(album.data.event_id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['albumIds', id] });
    queryClient.invalidateQueries({ queryKey: ['memories', album.data.event_id] });
  }

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

  // The allowance belongs to the event, and it is the event's whole list of
  // replays that is counted — not just this album's. Otherwise every album
  // would hand out two more free films and the limit would mean nothing.
  const isPro = usePro((s) => s.isPro);
  const films = allowance(filmsUsed(replays.data ?? []), FREE_FILMS_PER_EVENT, isPro);

  async function requestFilm(style) {
    if (!contents.length) return;
    if (films.exhausted && !(await showPaywall())) return;
    generate.mutate(style);
  }

  async function requestEdit() {
    if (!contents.length) return;
    if (!isPro && !(await showPaywall())) return;
    startEdit.mutate();
  }

  const scrap = useMutation({
    mutationFn: () => deleteAlbum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums', eventId] });
      queryClient.invalidateQueries({ queryKey: ['allAlbums'] });
      router.back();
    },
  });

  // The whole page at once, the way the feed does it: the cover, the title, the
  // counts and the first screenful of tiles land together rather than the page
  // assembling itself around an empty header.
  //
  // First visit only — `warm` never returns to false once it has shown, so
  // pulling to refresh does not blank an album you are already looking at.
  const ready = album.isFetched && everything.isFetched && memberIds.isFetched && warm;

  // Before the ready gate: `isFetched` is true after a failure too, so without
  // this the page would draw itself empty and claim the album has nothing in it.
  const failed = album.error ?? memberIds.error ?? everything.error ?? null;
  if (failed) {
    return (
      <View style={styles.screen}>
        <View style={[styles.loadingBar, { top: insets.top + spacing.md }]}>
          <RoundButton name="chevron-left" label="Back" onPress={() => router.back()} />
        </View>
        <View style={styles.centre}>
          <ErrorState
            title="Could not open this album"
            error={failed}
            onRetry={() => {
              album.refetch();
              memberIds.refetch();
              everything.refetch();
            }}
            retrying={album.isFetching || memberIds.isFetching}
          />
        </View>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.screen}>
        <DetailSkeleton topInset={insets.top} heroHeight={165} actions={2} />
        {/* Live, not a shape: leaving is the one thing you should still be able
            to do while a page is loading. */}
        <View style={[styles.loadingBar, { top: insets.top + spacing.md }]}>
          <RoundButton name="chevron-left" label="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

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
          {cover ? (
            <>
              <Photo uri={cover} style={StyleSheet.absoluteFill} blurRadius={30} />
              <View style={[StyleSheet.absoluteFill, styles.veil]} />
            </>
          ) : (
            // A warm tint rather than the bare page. The album's title is dark
            // ink, so this stays light — the opposite choice to the event
            // header, which is white text and needs a saturated ground. An empty
            // album otherwise opened on a white rectangle with a heading floating
            // in it and nothing to say where the header ended.
            <LinearGradient
              colors={[colors.accentSoft, colors.primarySoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}

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

        <View style={[styles.gutter, styles.addRow]}>
          {/* Two ways in, and they look like two of the same thing: what is
              already in the event, and what is still on your phone. */}
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setAdding(true)}
          >
            <Feather name="grid" size={16} color={colors.primary} />
            <Text style={styles.addBtnText} numberOfLines={1}>
              Pick from event
            </Text>
            {available.length ? (
              <View style={styles.addPip}>
                <Text style={styles.addPipText}>{available.length}</Text>
              </View>
            ) : null}
          </Pressable>

          {/* "Upload media" rather than "Add media", because the one beside it
              also adds — the difference is where it comes from, and that is what
              the two labels should be saying. */}
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={addOwnMedia}
            disabled={Boolean(progress)}
          >
            <Feather name="upload-cloud" size={16} color={colors.primary} />
            <Text style={styles.addBtnText} numberOfLines={1}>
              {progress ? 'Uploading' : 'Upload media'}
            </Text>
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

        {/* No skeleton of its own any more — the page does not draw until the
            first screenful is decoded, and each tile holds its own shimmer for
            whatever is below the fold. */}
        {tab === 'contents' ? (
          inside.length === 0 ? (
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
              {inside.length > 2 ? (
                <>
                  <View style={styles.gutter}>
                    <SearchBar
                      value={query}
                      onChangeText={setQuery}
                      onClear={() => setQuery('')}
                      placeholder="Search what is in them"
                    />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                  >
                    {[
                      { value: 'all', label: 'All', icon: 'grid', group: 'kind' },
                      { value: 'photo', label: 'Photos', icon: 'image', group: 'kind' },
                      { value: 'video', label: 'Video', icon: 'video', group: 'kind' },
                    ].map((option) => {
                      const on = kind === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => setKind(option.value)}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Feather
                            name={option.icon}
                            size={11}
                            color={on ? '#fff' : colors.textSoft}
                          />
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}

                    {[
                      { value: 'newest', label: 'Newest', icon: 'arrow-down' },
                      { value: 'oldest', label: 'Oldest', icon: 'arrow-up' },
                      { value: 'best', label: 'Best', icon: 'star' },
                    ].map((option) => {
                      const on = sort === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => setSort(option.value)}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Feather
                            name={option.icon}
                            size={11}
                            color={on ? '#fff' : colors.textSoft}
                          />
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              {contents.length === 0 ? (
                <Text style={styles.nothing}>
                  Nothing in this album matches that.
                </Text>
              ) : (
                <Text style={styles.hint}>Tap to open · hold to take out</Text>
              )}
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
                  locked={!existing && films.exhausted}
                  onGenerate={() => requestFilm(style)}
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
              onPress={requestEdit}
              disabled={!contents.length || startEdit.isPending}
            >
              {startEdit.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name={isPro ? 'scissors' : 'lock'} size={16} color={colors.primary} />
              )}
              <Text style={styles.startEditText}>
                {isPro ? 'Cut one yourself' : 'Cut one yourself · Pro'}
              </Text>
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
  // Over the skeleton's hero, on the same gutter as the real one.
  loadingBar: { position: 'absolute', left: spacing.lg, zIndex: 1 },
  centre: { flex: 1, justifyContent: 'center' },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { gap: spacing.xs },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  crumbText: { ...type.tiny, color: colors.primary },
  title: { ...type.title, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },

  addRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '2E',
  },
  addBtnText: { ...type.label, color: colors.primary },
  addPip: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addPipText: { ...type.tiny, fontSize: 9.5, color: '#fff', textAlign: 'center' },
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
  addTitle: { ...type.label, color: colors.text },

  hint: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },

  nothing: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.label, fontSize: 11.5, lineHeight: 15, color: colors.textSoft },
  chipTextOn: { color: '#fff' },

  films: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  sectionTitle: { ...type.heading, fontSize: 15, lineHeight: 21, color: colors.text, paddingTop: spacing.md },
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
  editTitle: { ...type.label, color: colors.text },
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
