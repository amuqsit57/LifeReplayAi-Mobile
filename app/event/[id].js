import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { createAlbum, eventPeople, getEvent, listAlbums, myProfile } from '../../src/lib/data';
import { pickMemories, uploadAll } from '../../src/lib/upload';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import { Segmented } from '../../src/ui/brand';
import FilmCard from '../../src/ui/FilmCard';
import { GridSkeleton } from '../../src/ui/Skeleton';
import UploadSheet from '../../src/ui/UploadSheet';
import { RoundButton } from '../../src/ui/Header';
import InviteSheet from '../../src/ui/InviteSheet';
import { Avatar, AvatarRow, MediaTile } from '../../src/ui/social';
import Viewer from '../../src/ui/Viewer';

/**
 * Ways to narrow a large gallery.
 *
 * "Best" uses the grade the analyser gave each memory rather than a score, since
 * the grades are the thing that actually separates them — the numbers underneath
 * were nearly all identical.
 */
const FILTERS = [
  { value: 'all', label: 'All', icon: 'grid', match: () => true },
  {
    value: 'best',
    label: 'Best',
    icon: 'star',
    match: (m) => ['essential', 'strong'].includes(m.significance),
  },
  { value: 'photo', label: 'Photos', icon: 'image', match: (m) => m.kind === 'photo' },
  { value: 'video', label: 'Videos', icon: 'video', match: (m) => m.kind === 'video' },
  { value: 'mine', label: 'Mine', icon: 'user', match: (m, meId) => m.uploaded_by === meId },
];

// Only shown while something is still happening, or has gone wrong. A photo that
// is simply fine says nothing — "ready" under every tile was noise on a grid
// where being ready is the normal state.
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

  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('gallery');
  const [filter, setFilter] = useState('all');
  const [progress, setProgress] = useState(null);
  const [selected, setSelected] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [showingPeople, setShowingPeople] = useState(false);
  const [uploaded, setUploaded] = useState(null);
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
    // Faster while something is rendering, so the progress bar actually moves
    // rather than jumping in five-second steps.
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((r) => r.status === 'queued' || r.status === 'running') ? 1800 : false;
    },
  });

  const list = memories.data ?? [];
  const me = useQuery({ queryKey: ['myProfile'], queryFn: myProfile });

  const shown = useMemo(() => {
    const option = FILTERS.find((f) => f.value === filter) ?? FILTERS[0];
    return list.filter((memory) => option.match(memory, me.data?.id));
  }, [list, filter, me.data?.id]);

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
    api.analyseBatch(id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['memories', id] });

    // The moment after an upload is when making a film makes sense to somebody,
    // so the offer goes here rather than as a note on a tab they may never open.
    setUploaded({ added: results.length - failed.length, failed: failed.length });
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
        {/* The event's own photograph carries the header, at full strength with a
            gradient over it — the blurred white wash before this drained the one
            image on the screen of everything that made it worth looking at. */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          {cover ? (
            <>
              <Image source={{ uri: cover }} style={styles.heroImage} contentFit="cover" />
              <LinearGradient
                colors={colors.heroScrim}
                style={styles.heroImage}
                pointerEvents="none"
              />
            </>
          ) : (
            <View style={[styles.heroImage, { backgroundColor: colors.surfaceAlt }]} />
          )}

          <View style={styles.heroBar}>
            <RoundButton name="chevron-left" tone="onDark" label="Back" onPress={() => router.back()} />
            <RoundButton name="user-plus" tone="onDark" label="Invite" onPress={() => setInviting(true)} />
          </View>

          <View style={styles.heroText}>
            <Text style={styles.title} numberOfLines={2}>
              {info?.title ?? 'Event'}
            </Text>
            <Pressable style={styles.heroMeta} onPress={() => setShowingPeople(true)}>
              <AvatarRow people={people.data ?? []} />
              <Text style={styles.metaText}>
                {(people.data ?? []).length} {(people.data ?? []).length === 1 ? 'person' : 'people'}
                {info?.location ? ` · ${info.location}` : ''}
              </Text>
              <Feather name="chevron-right" size={14} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Anchored to the bottom corner of the title block and hanging over
              its edge, so adding reads as belonging to this event rather than to
              whichever tab happens to be open. */}
          <Pressable
            onPress={addMemories}
            disabled={Boolean(progress)}
            accessibilityLabel="Add photos and videos"
            style={({ pressed }) => [styles.addRound, pressed && { opacity: 0.85 }]}
          >
            <Feather name={progress ? 'upload-cloud' : 'plus'} size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.heroSpacer} />

        <View style={styles.gutter}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'gallery', label: 'Gallery', icon: 'image', count: list.length },
              { value: 'films', label: 'Films', icon: 'film', count: eventFilms.length || null },
              { value: 'albums', label: 'Albums', icon: 'folder', count: albumList.length || null },
            ]}
          />
        </View>

        {/* ---------------------------------------------------------- gallery */}
        {tab === 'gallery' ? (
          memories.isLoading ? (
            <View style={styles.gutter}>
              <GridSkeleton count={9} />
            </View>
          ) : list.length === 0 ? (
            <Empty icon="📸" title="Nothing here yet" body="Add photos and videos — no need to sort them first." />
          ) : (
            <>
              {/* Filters appear only once there is enough to warrant sorting
                  through. Below that they are three controls over nine photos. */}
              {list.length > 8 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {FILTERS.map((option) => {
                    const active = filter === option.value;
                    const count =
                      option.value === 'all'
                        ? list.length
                        : list.filter(option.match).length;
                    if (!count && option.value !== 'all') return null;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setFilter(option.value)}
                        style={[styles.filterChip, active && styles.filterChipOn]}
                      >
                        <Feather
                          name={option.icon}
                          size={12}
                          color={active ? '#fff' : colors.textSoft}
                        />
                        <Text style={[styles.filterText, active && styles.filterTextOn]}>
                          {option.label}
                        </Text>
                        <Text style={[styles.filterCount, active && styles.filterTextOn]}>
                          {count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <Text style={styles.hint}>
                {selecting ? `${selected.length} selected` : 'Tap to open · hold to select'}
              </Text>
              <View style={styles.grid}>
                {shown.map((memory) => (
                  <MediaTile
                    key={memory.id}
                    uri={memory.thumbnail_url ?? memory.url}
                    kind={memory.kind}
                    selected={selectedSet.has(memory.id)}
                    badge={memory.status === 'ready' ? null : STATUS_LABEL[memory.status]}
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
            {list.length === 0 ? (
              <View style={styles.explainWarn}>
                <Feather name="image" size={14} color={colors.warning} />
                <Text style={styles.explainText}>Add some photos or videos first.</Text>
              </View>
            ) : null}

            {Object.keys(STYLE_META).map((style) => {
              const existing = eventFilms.find((r) => r.style === style);
              return (
                <FilmCard
                  key={style}
                  style={style}
                  replay={existing}
                  onGenerate={() => list.length && generate.mutate(style)}
                  onOpen={() => router.push(`/replay/${existing.id}`)}
                />
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
            <Feather name="x-circle" size={17} color={colors.danger} />
            <Text style={[styles.selectActionText, { color: colors.danger }]}>Remove</Text>
          </Pressable>
        </View>
      ) : null}

      <UploadSheet
        progress={progress}
        done={uploaded}
        onClose={() => setUploaded(null)}
        onGenerate={() => {
          setUploaded(null);
          setTab('films');
        }}
      />

      <InviteSheet visible={inviting} onClose={() => setInviting(false)} event={info} />

      <Modal
        visible={showingPeople}
        transparent
        animationType="slide"
        onRequestClose={() => setShowingPeople(false)}
      >
        <Pressable style={styles.sheetBack} onPress={() => setShowingPeople(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>In this event</Text>
            <Text style={styles.sheetHint}>
              Everyone here can add photos and make films. Counts are what each person contributed.
            </Text>

            <ScrollView style={{ maxHeight: 340 }}>
              {(people.data ?? []).map((person) => {
                const added = list.filter((m) => m.uploaded_by === person.user_id).length;
                return (
                  <View key={person.user_id} style={styles.person}>
                    <Avatar url={person.avatar_url} name={person.full_name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{person.full_name ?? 'Someone'}</Text>
                      <Text style={styles.sheetHint}>
                        {added} {added === 1 ? 'item' : 'items'} added
                      </Text>
                    </View>
                    {person.role === 'owner' ? (
                      <View style={styles.ownerChip}>
                        <Text style={styles.ownerChipText}>Owner</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <Pressable
              style={styles.cta}
              onPress={() => {
                setShowingPeople(false);
                setInviting(true);
              }}
            >
              <Text style={styles.ctaText}>Invite someone</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  hero: {
    paddingTop: 52,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  // Room under the title block for the add button that hangs over its edge, so
  // it never collides with the tabs beneath.
  heroSpacer: { height: spacing.xl },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { gap: spacing.sm },
  title: { ...type.display, color: '#fff' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { ...type.caption, color: 'rgba(255,255,255,0.82)' },

  // One gutter value, applied by wrapping sections rather than repeated on each
  // child — that repetition is how the padding drifted between them before.
  gutter: { paddingHorizontal: spacing.lg },

  addRound: {
    position: 'absolute',
    right: spacing.lg,
    // Half outside the title block, which is what ties the two together rather
    // than leaving it floating in the space below.
    bottom: -24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
    ...shadow.raised,
  },

  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { ...type.label, color: colors.textSoft },
  filterTextOn: { color: '#fff' },
  filterCount: { ...type.tiny, color: colors.textMuted },

  hint: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },

  styleGrid: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  explain: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xs,
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
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  personName: { ...type.bodyStrong, color: colors.text },
  ownerChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  ownerChipText: { ...type.tiny, color: colors.primary },
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
