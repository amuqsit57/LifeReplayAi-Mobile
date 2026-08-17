import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { FREE_FILMS_PER_EVENT, allowance, filmsUsed } from '../../src/lib/limits';
import { showPaywall } from '../../src/lib/paywall';
import { useWarmImages } from '../../src/lib/warm';
import { usePro } from '../../src/store';
import { createAlbum, eventPeople, getEvent, listAlbums, myProfile } from '../../src/lib/data';
import { pickMemories, uploadAll } from '../../src/lib/upload';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import { Segmented } from '../../src/ui/press';
import ErrorState from '../../src/ui/ErrorState';
import FilmCard from '../../src/ui/FilmCard';
import Photo from '../../src/ui/Photo';
import { DetailSkeleton } from '../../src/ui/Skeleton';
import UploadSheet from '../../src/ui/UploadSheet';
import { RoundButton, SearchBar } from '../../src/ui/Header';
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

/** How long ago, in the shortest form that still says it. */
function ago(iso) {
  if (!iso) return '';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

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
  const [query, setQuery] = useState('');
  const [by, setBy] = useState(null);
  const [filmQuery, setFilmQuery] = useState('');
  const [filmSort, setFilmSort] = useState('recent');
  const [gallerySort, setGallerySort] = useState('newest');
  // On by default: a shared event is several people's photographs, and saying
  // whose is the first thing the page should answer.
  const [byPerson, setByPerson] = useState(true);

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

  // Two films per event on the house, any of the four styles, so the app gets to
  // prove itself on your own photographs before it asks for anything. Counted
  // from the films that exist rather than from a tally kept here.
  const isPro = usePro((s) => s.isPro);
  const films = allowance(filmsUsed(replays.data ?? []), FREE_FILMS_PER_EVENT, isPro);

  const peopleById = useMemo(
    () => new Map((people.data ?? []).map((person) => [person.user_id, person])),
    [people.data]
  );

  // The gallery's own thumbnails: wait on the first rows, warm the rest behind
  // them, so scrolling never starts a download.
  // The same expression the tile draws. Prefetching only the thumbnail meant any
  // memory without one fell back to its full-size URL, which had never been
  // warmed — so those arrived late however long the gate waited.
  const warm = useWarmImages(
    list.map((memory) => memory.thumbnail_url ?? memory.url),
    12,
    memories.isFetched
  );

  const shown = useMemo(() => {
    const option = FILTERS.find((f) => f.value === filter) ?? FILTERS[0];
    const needle = query.trim().toLowerCase();
    const rows = list.filter((memory) => {
      if (!option.match(memory, me.data?.id)) return false;
      if (by && memory.uploaded_by !== by) return false;
      if (!needle) return true;
      // What is in it, what it was tagged, and who added it.
      const who = peopleById.get(memory.uploaded_by)?.full_name ?? '';
      return [memory.description, who, ...(memory.tags ?? [])]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });

    // When it was taken, not when it reached us — a wedding shot by four guests
    // belongs in the order the day happened.
    const when = (m) => new Date(m.captured_at ?? m.created_at ?? 0).getTime();
    const RANK = { essential: 3, strong: 2, ordinary: 1, weak: 0 };

    return [...rows].sort((a, b) => {
      if (gallerySort === 'oldest') return when(a) - when(b);
      if (gallerySort === 'best') {
        return (RANK[b.significance] ?? 0) - (RANK[a.significance] ?? 0) || when(b) - when(a);
      }
      return when(b) - when(a);
    });
  }, [list, filter, me.data?.id, query, by, peopleById, gallerySort]);

  // Grouping only means anything with more than one contributor, and only when
  // nobody has been singled out already.
  const grouped = byPerson && !by && (people.data ?? []).length > 1;

  const groups = useMemo(() => {
    if (!grouped) return [];
    const bucket = new Map();
    for (const memory of shown) {
      const who = memory.uploaded_by ?? 'unknown';
      if (!bucket.has(who)) bucket.set(who, []);
      bucket.get(who).push(memory);
    }
    // Whoever brought the most goes first; it is the closest thing to an order
    // that means something.
    return [...bucket.entries()]
      .map(([id, items]) => ({ id, items, person: peopleById.get(id) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [grouped, shown, peopleById]);

  const albumList = albums.data ?? [];
  // One generated film per style; as many hand-cut edits as anybody makes. The
  // two are listed separately because they behave differently — asking for the
  // cinematic cut again replaces it, and an edit never replaces anything.
  const eventFilms = (replays.data ?? []).filter((r) => !r.album_id && !r.is_edit);

  // The hand-cut ones are a real list, so they get a real list's controls.
  const edits = useMemo(() => {
    const needle = filmQuery.trim().toLowerCase();
    const rows = (replays.data ?? []).filter((r) => {
      if (!r.is_edit) return false;
      if (!needle) return true;
      return (r.title ?? '').toLowerCase().includes(needle);
    });

    const made = (r) => new Date(r.edited_at ?? r.created_at ?? 0).getTime();
    return [...rows].sort((a, b) => {
      if (filmSort === 'oldest') return made(a) - made(b);
      if (filmSort === 'longest') return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
      if (filmSort === 'name') return (a.title ?? '').localeCompare(b.title ?? '');
      return made(b) - made(a);
    });
  }, [replays.data, filmQuery, filmSort]);
  const selecting = selected.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

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

  /**
   * Ask for a film, buying the right to first if necessary.
   *
   * The generate happens either way — if they subscribe on the paywall, the
   * thing they were trying to do carries on rather than dropping them back at
   * the locked card they just paid to unlock, which reads as the payment having
   * failed.
   */
  async function requestFilm(style) {
    if (!list.length) return;
    if (films.exhausted && !(await showPaywall())) return;
    generate.mutate(style);
  }

  async function requestEdit() {
    if (!list.length) return;
    if (!isPro && !(await showPaywall())) return;
    startEdit.mutate();
  }

  // A blank edit. Nothing renders until they say so — the draft exists purely to
  // give the plan somewhere to live while it is being written.
  const startEdit = useMutation({
    mutationFn: () => api.draft({ event_id: id, title: `${event.data?.title ?? 'Untitled'} — my edit` }),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: ['replays', id] });
      router.push(`/editor/${draft.id}`);
    },
    onError: (error) => Alert.alert('Could not open the editor', error.message),
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

  // The whole page arrives at once or not at all, the way the feed does. Drawing
  // the hero and the buttons first and gating only the grid meant the page put
  // itself together in three visible steps, over an empty header.
  //
  // Only the first visit: `warm` never goes back to false once it has shown, so
  // pulling to refresh does not blank the page you are already reading.
  // `people` is in here because the hero states a count: without it the header
  // reads "0 people" for a beat and then corrects itself, which is the same
  // half-drawn page in miniature. `isFetched` turns true on a failed fetch too,
  // so a query that errors cannot hold the page shut.
  const ready = event.isFetched && memories.isFetched && people.isFetched && warm;

  // Before the ready gate, not after it. `isFetched` turns true on a failed
  // fetch as well as a successful one, so a dead connection would otherwise sail
  // through and draw the page with no photographs in it — "Nothing here yet",
  // about an event that is full.
  const failed = event.error ?? memories.error ?? null;
  if (failed) {
    return (
      <View style={styles.screen}>
        <View style={[styles.loadingBar, { top: insets.top + spacing.md }]}>
          <RoundButton name="chevron-left" label="Back" onPress={() => router.back()} />
        </View>
        <View style={styles.centre}>
          <ErrorState
            title="Could not open this event"
            error={failed}
            onRetry={() => {
              event.refetch();
              memories.refetch();
              people.refetch();
              albums.refetch();
            }}
            retrying={event.isFetching || memories.isFetching}
          />
        </View>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.screen}>
        <DetailSkeleton topInset={insets.top} heroHeight={215} actions={3} />
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
              <Photo uri={cover} style={styles.heroImage} />
              <LinearGradient
                colors={colors.heroScrim}
                style={styles.heroImage}
                pointerEvents="none"
              />
            </>
          ) : (
            // An event with nothing in it yet still has a title, and everything
            // in this header is white because it is normally sitting on a
            // photograph. Against the pale surface that stood in for one, the
            // title was white on near-white and effectively invisible. The brand
            // gradient gives the words something to sit on, and reads as a
            // deliberate cover rather than a missing one.
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroImage}
              pointerEvents="none"
            />
          )}

          <View style={styles.heroBar}>
            <RoundButton name="chevron-left" tone="onDark" label="Back" onPress={() => router.back()} />
            <View style={styles.heroActions}>
              <RoundButton
                name="users"
                tone="onDark"
                label="Members"
                onPress={() => setShowingPeople(true)}
              />
              <RoundButton
                name="user-plus"
                tone="onDark"
                label="Invite"
                onPress={() => setInviting(true)}
              />
            </View>
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

        </View>

        {/* Outside the hero on purpose. The hero clips, because its corners are
            rounded, and anything straddling its bottom edge was being cut in
            half by that same clip. */}
        {/* A row, on the same gutter as everything below it.

            These were two circles half-overlapping the picture's bottom edge,
            which looked like an afterthought and — because the rows underneath
            covered their lower halves — swallowed roughly half the taps aimed at
            them. Laid out normally, they are aligned and every pixel is live. */}
        {/* One action leading, two supporting it underneath.

            Three buttons abreast could not fit: each needs an icon and a real
            label, and on a narrow phone the first one was clipped mid-word —
            which is the worst outcome, because the clipped one was the thing the
            page exists to do. Stacking gives the main action the full width it
            deserves and lets the other two be honestly labelled instead of
            squeezed into one word each.

            Which action leads changes with the event: an empty one cannot
            generate anything, so offering that first pointed at the one button
            guaranteed not to work. */}
        <View style={styles.actions}>
          {list.length ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setTab('films');
              }}
              style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
            >
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.leadText}>Generate a film</Text>
              <Feather name="arrow-right" size={17} color="rgba(255,255,255,0.85)" />
            </Pressable>
          ) : (
            <Pressable
              onPress={addMemories}
              disabled={Boolean(progress)}
              style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
            >
              <Feather name="upload-cloud" size={18} color="#fff" />
              <Text style={styles.leadText}>
                {progress ? 'Uploading…' : 'Upload photos and video'}
              </Text>
              {progress ? null : (
                <Feather name="arrow-right" size={17} color="rgba(255,255,255,0.85)" />
              )}
            </Pressable>
          )}

          <View style={styles.secondaries}>
            {list.length ? (
              <Pressable
                onPress={addMemories}
                disabled={Boolean(progress)}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Feather name="upload-cloud" size={16} color={colors.primary} />
                <Text style={styles.secondaryText} numberOfLines={1}>
                  {progress ? 'Uploading' : 'Upload more'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setTab('films');
                requestEdit();
              }}
              disabled={!list.length || startEdit.isPending}
              style={({ pressed }) => [
                styles.secondary,
                !list.length && styles.secondaryOff,
                pressed && styles.pressed,
              ]}
            >
              <Feather
                name="scissors"
                size={16}
                color={list.length ? colors.primary : colors.textMuted}
              />
              <Text
                style={[styles.secondaryText, !list.length && { color: colors.textMuted }]}
                numberOfLines={1}
              >
                Cut your own
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setInviting(true)}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Feather name="user-plus" size={16} color={colors.primary} />
              <Text style={styles.secondaryText} numberOfLines={1}>
                Invite
              </Text>
            </Pressable>
          </View>
        </View>

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
        {/* No skeleton of its own any more — by the time the page is drawn the
            first screenful of tiles is already decoded, and each tile holds its
            own shimmer for whatever is below the fold. */}
        {tab === 'gallery' ? (
          list.length === 0 ? (
            <Empty icon="📸" title="Nothing here yet" body="Add photos and videos — no need to sort them first." />
          ) : (
            <>
              {/* Filters appear only once there is enough to warrant sorting
                  through. Below that they are three controls over nine photos. */}
              {list.length > 2 ? (
                <View style={styles.gutter}>
                  <SearchBar
                    value={query}
                    onChangeText={setQuery}
                    onClear={() => setQuery('')}
                    placeholder="Search what is in them, or who added them"
                  />
                </View>
              ) : null}

              {list.length > 2 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {[
                    { value: 'newest', label: 'Newest', icon: 'arrow-down' },
                    { value: 'oldest', label: 'Oldest', icon: 'arrow-up' },
                    { value: 'best', label: 'Best first', icon: 'star' },
                  ].map((option) => {
                    const on = gallerySort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setGallerySort(option.value)}
                        style={[styles.filterChip, on && styles.filterChipOn]}
                      >
                        <Feather
                          name={option.icon}
                          size={11}
                          color={on ? '#fff' : colors.textSoft}
                        />
                        <Text style={[styles.filterText, on && styles.filterTextOn]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {/* Who added what. One chip per person who actually contributed,
                  which is the question people ask of a shared event. */}
              {(people.data ?? []).length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  <Pressable
                    onPress={() => {
                      setBy(null);
                      setByPerson(true);
                    }}
                    style={[styles.filterChip, grouped && styles.filterChipOn]}
                  >
                    <Feather name="users" size={11} color={grouped ? '#fff' : colors.textSoft} />
                    <Text style={[styles.filterText, grouped && styles.filterTextOn]}>
                      By person
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setBy(null);
                      setByPerson(false);
                    }}
                    style={[styles.filterChip, !grouped && !by && styles.filterChipOn]}
                  >
                    <Feather
                      name="grid"
                      size={11}
                      color={!grouped && !by ? '#fff' : colors.textSoft}
                    />
                    <Text style={[styles.filterText, !grouped && !by && styles.filterTextOn]}>
                      All together
                    </Text>
                  </Pressable>

                  {(people.data ?? []).map((person) => {
                    const mine = list.filter((m) => m.uploaded_by === person.user_id).length;
                    if (!mine) return null;
                    const active = by === person.user_id;
                    return (
                      <Pressable
                        key={person.user_id}
                        onPress={() => {
                          setBy(active ? null : person.user_id);
                          if (!active) setByPerson(false);
                        }}
                        style={[styles.filterChip, active && styles.filterChipOn]}
                      >
                        <Avatar url={person.avatar_url} name={person.full_name} size="xs" />
                        <Text style={[styles.filterText, active && styles.filterTextOn]}>
                          {person.full_name?.split(' ')[0] ?? 'Someone'}
                        </Text>
                        <Text style={[styles.filterCount, active && styles.filterTextOn]}>
                          {mine}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {list.length > 2 ? (
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
                          size={11}
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
                {shown.length === 0
                  ? 'Nothing here matches that.'
                  : selecting
                    ? `${selected.length} selected`
                    : 'Tap to open · hold to select'}
              </Text>
              {/* Grouped by whoever added it, which is the shape of a shared
                  event: not one pile of photographs but several people's, side
                  by side. Flattens when a single person is chosen, or when only
                  one of them has contributed anything. */}
              {grouped ? (
                groups.map((group) => (
                  <View key={group.id} style={styles.group}>
                    <Pressable
                      style={styles.groupHead}
                      onPress={() => setBy(group.id)}
                    >
                      <Avatar url={group.person?.avatar_url} name={group.person?.full_name} size="sm" />
                      <Text style={styles.groupName} numberOfLines={1}>
                        {group.person?.full_name ?? 'Someone'}
                      </Text>
                      <Text style={styles.groupCount}>{group.items.length}</Text>
                      <Feather name="chevron-right" size={15} color={colors.textMuted} />
                    </Pressable>

                    <View style={styles.grid}>
                      {group.items.map((memory) => (
                        <MediaTile
                          key={memory.id}
                          uri={memory.thumbnail_url ?? memory.url}
                          kind={memory.kind}
                          selected={selectedSet.has(memory.id)}
                          badge={memory.status === 'ready' ? null : STATUS_LABEL[memory.status]}
                          style={{ width: '31.5%' }}
                          onPress={() => (selecting ? toggle(memory.id) : setViewing(memory.id))}
                          onLongPress={() => toggle(memory.id)}
                        />
                      ))}
                    </View>
                  </View>
                ))
              ) : (
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
              )}
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

            <View style={styles.editsHead}>
              <Text style={styles.editsTitle}>AI generated films</Text>
              <Text style={styles.hint}>
                One per style. Asking again replaces it.
              </Text>
            </View>

            {/* Said before anything is tapped. Finding out you have run out at
                the moment you ask is the version of this that feels like a trap;
                a count that has been visible all along is just the deal. */}
            {films.unlimited ? null : (
              <Pressable
                style={[styles.meter, films.exhausted && styles.meterOut]}
                onPress={showPaywall}
              >
                <Feather
                  name={films.exhausted ? 'lock' : 'film'}
                  size={14}
                  color={films.exhausted ? colors.primary : colors.textSoft}
                />
                <Text style={styles.meterText}>
                  {films.exhausted
                    ? 'Both free films used for this event'
                    : `${films.left} of ${films.cap} free films left in this event`}
                </Text>
                <Text style={styles.meterCta}>{films.exhausted ? 'Go Pro' : 'Pro'}</Text>
              </Pressable>
            )}

            {Object.keys(STYLE_META).map((style) => {
              const existing = eventFilms.find((r) => r.style === style);
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

            {/* -------------------------------------------------- by hand */}
            <View style={styles.editsHead}>
              <Text style={styles.editsTitle}>Custom films</Text>
              <Text style={styles.hint}>
                Cut them yourself. Open a film above to start from its cut.
              </Text>
            </View>

            {(replays.data ?? []).filter((r) => r.is_edit).length > 2 ? (
              <>
                <SearchBar
                  value={filmQuery}
                  onChangeText={setFilmQuery}
                  onClear={() => setFilmQuery('')}
                  placeholder="Search your edits"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sortRow}
                >
                  {[
                    { value: 'recent', label: 'Newest' },
                    { value: 'oldest', label: 'Oldest' },
                    { value: 'longest', label: 'Longest' },
                    { value: 'name', label: 'A–Z' },
                  ].map((option) => {
                    const on = filmSort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setFilmSort(option.value)}
                        style={[styles.filterChip, on && styles.filterChipOn]}
                      >
                        <Text style={[styles.filterText, on && styles.filterTextOn]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {edits.map((edit) => (
              <Pressable
                key={edit.id}
                style={styles.editRow}
                onPress={() =>
                  router.push(edit.status === 'succeeded' ? `/replay/${edit.id}` : `/editor/${edit.id}`)
                }
              >
                <View
                  style={[
                    styles.editIcon,
                    edit.status === 'succeeded' && { backgroundColor: colors.successSoft },
                    edit.status === 'failed' && { backgroundColor: colors.dangerSoft },
                  ]}
                >
                  <Feather
                    name={
                      edit.status === 'succeeded'
                        ? 'play'
                        : edit.status === 'failed'
                          ? 'alert-circle'
                          : edit.status === 'draft'
                            ? 'edit-3'
                            : 'loader'
                    }
                    size={16}
                    color={
                      edit.status === 'succeeded'
                        ? colors.success
                        : edit.status === 'failed'
                          ? colors.danger
                          : colors.primary
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editTitle} numberOfLines={1}>
                    {edit.title || 'Untitled edit'}
                  </Text>
                  <Text style={styles.hint} numberOfLines={1}>
                    {edit.shot_count} {edit.shot_count === 1 ? 'shot' : 'shots'}
                    {edit.duration_seconds
                      ? ` · ${Math.floor(edit.duration_seconds / 60)}:${String(
                          Math.round(edit.duration_seconds % 60)
                        ).padStart(2, '0')}`
                      : ''}
                    {' · '}
                    {edit.status === 'draft'
                      ? 'not rendered'
                      : edit.status === 'succeeded'
                        ? 'ready'
                        : edit.status === 'failed'
                          ? 'failed'
                          : 'rendering'}
                    {edit.edited_at || edit.created_at
                      ? ` · edited ${ago(edit.edited_at ?? edit.created_at)}`
                      : ''}
                  </Text>
                </View>
                {edit.status === 'succeeded' ? (
                  <Pressable
                    hitSlop={10}
                    onPress={() => router.push(`/editor/${edit.id}`)}
                    style={styles.editAgain}
                  >
                    <Feather name="edit-3" size={16} color={colors.textSoft} />
                  </Pressable>
                ) : null}
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            <Pressable
              style={[styles.startEdit, !list.length && styles.startEditOff]}
              onPress={requestEdit}
              disabled={!list.length || startEdit.isPending}
            >
              {startEdit.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name={isPro ? 'plus' : 'lock'} size={17} color={colors.primary} />
              )}
              <Text style={styles.startEditText}>
                {isPro ? 'Start an edit' : 'Start an edit · Pro'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ----------------------------------------------------------- albums */}
        {tab === 'albums' ? (
          albumList.length === 0 ? (
            <Empty
              icon="❏"
              title="No albums yet"
              body="Select photos in the gallery and choose Make album."
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
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
            onPress={(e) => e.stopPropagation()}
          >
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
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
            onPress={(e) => e.stopPropagation()}
          >
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
  heroSpacer: { height: spacing.sm },
  heroImage: { ...StyleSheet.absoluteFillObject },
  // Over the skeleton's hero, on the same gutter as the real one.
  loadingBar: { position: 'absolute', left: spacing.lg, zIndex: 1 },
  centre: { flex: 1, justifyContent: 'center' },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { gap: spacing.sm },
  title: { ...type.title, color: '#fff' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { ...type.caption, color: 'rgba(255,255,255,0.82)' },

  // One gutter value, applied by wrapping sections rather than repeated on each
  // child — that repetition is how the padding drifted between them before.
  gutter: { paddingHorizontal: spacing.lg },

  heroActions: { flexDirection: 'row', gap: spacing.sm },
  actions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },

  // The one thing this page is for, at full width, with an arrow saying it goes
  // somewhere. Tall enough to be the obvious target for a thumb.
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  // `flex: 1` on the label rather than the row, so the arrow stays pinned right
  // however long the label gets in another language.
  leadText: { ...type.bodyStrong, fontSize: 15, color: '#fff', flex: 1 },

  // Equal thirds. Each one owns its share of the width instead of being sized by
  // its text, so no label can push a neighbour off the screen.
  secondaries: { flexDirection: 'row', gap: spacing.sm },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '2E',
  },
  secondaryText: { ...type.label, fontSize: 12, color: colors.primary, flexShrink: 1 },
  // Visibly unavailable rather than merely inert. A button that looks live and
  // does nothing reads as the app being broken.
  secondaryOff: { backgroundColor: colors.surfaceAlt, borderColor: 'transparent' },
  pressed: { opacity: 0.85 },
  round: {
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
  // The two are told apart by colour. `roundAlt` went missing in an earlier
  // edit, so generate fell back to the same purple as add — with a purple icon
  // on it, which is why the icon was not there.

  filterRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  // Already inside a padded parent, so this only needs the rhythm.
  sortRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { ...type.label, fontSize: 11.5, lineHeight: 15, color: colors.textSoft },
  filterTextOn: { color: '#fff' },
  filterCount: { ...type.tiny, fontSize: 9.5, color: colors.textMuted },

  hint: { ...type.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },
  group: { paddingTop: spacing.md },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  groupName: { ...type.label, color: colors.text, flex: 1 },
  groupCount: { ...type.tiny, color: colors.textMuted },
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

  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  // Once it is spent the row stops being information and becomes the offer.
  meterOut: { backgroundColor: colors.primarySoft },
  meterText: { ...type.caption, color: colors.textSoft, flex: 1 },
  meterCta: { ...type.tiny, color: colors.primary },

  editsHead: { gap: 4, paddingTop: spacing.lg },
  editsTitle: { ...type.heading, fontSize: 15, lineHeight: 21, color: colors.text },
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
  editAgain: { padding: 6 },
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
  startEditOff: { opacity: 0.5 },
  startEditText: { ...type.label, color: colors.primary },
  albumIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumTitle: { ...type.label, color: colors.text },

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
  selectCount: { ...type.label, color: colors.text },
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
  sheetTitle: { ...type.heading, color: colors.text },
  // The gallery hint is inset to the screen gutter; inside a sheet that padding
  // would double up on the sheet's own.
  sheetHint: { ...type.caption, color: colors.textMuted },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  personName: { ...type.label, color: colors.text },
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
  ctaText: { ...type.label, color: '#fff' },
});
