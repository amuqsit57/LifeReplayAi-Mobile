import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { listEvents } from '../../src/lib/data';
import { useWarmImages } from '../../src/lib/warm';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import CreateCard from '../../src/ui/CreateCard';
import CreateEventSheet from '../../src/ui/CreateEventSheet';
import ErrorState from '../../src/ui/ErrorState';
import { RoundButton, ScreenHeader, SearchBar } from '../../src/ui/Header';
import Photo from '../../src/ui/Photo';
import { Tappable } from '../../src/ui/press';
import { CardsSkeleton } from '../../src/ui/Skeleton';
import SortSheet, { SORTS, applySort } from '../../src/ui/SortSheet';

function ago(iso) {
  if (!iso) return '';
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${Math.floor(days)}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/**
 * An event, led by its own photograph.
 *
 * The list used to be a row of small thumbnails beside text, which made
 * twenty-seven events look like twenty-seven identical rows. A wide cover with
 * the title over it makes them tell each other apart at a glance — which is the
 * only job a list of events has.
 */
function EventCard({ event, cover, onPress }) {
  const count = event.memories?.[0]?.count ?? 0;
  // How many people are contributing is what makes a shared event read as shared.
  const members = event.event_members?.[0]?.count ?? 0;

  return (
    <Tappable onPress={onPress} haptic scaleTo={0.985} style={styles.card}>
      <View style={styles.coverWrap}>
        {cover ? (
          <Photo uri={cover} style={styles.cover} recyclingKey={event.id} />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <Feather name="image" size={22} color={colors.textMuted} />
          </View>
        )}

        <LinearGradient colors={colors.posterScrim} style={styles.scrim} pointerEvents="none" />

        {event.invite_code ? (
          <View style={styles.code}>
            <Feather name="hash" size={10} color="#fff" />
            <Text style={styles.codeText}>{event.invite_code}</Text>
          </View>
        ) : null}

        <View style={styles.overlay}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="layers" size={11} color="rgba(255,255,255,0.85)" />
            <Text style={styles.meta}>
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
            {members > 1 ? (
              <>
                <Text style={styles.sep}>·</Text>
                <Feather name="users" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.meta}>{members}</Text>
              </>
            ) : null}
            <Text style={styles.sep}>·</Text>
            <Text style={styles.meta}>{ago(event.created_at)}</Text>
            {event.location ? (
              <>
                <Text style={styles.sep}>·</Text>
                <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.meta} numberOfLines={1}>
                  {event.location}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Tappable>
  );
}

/** The same event at half the width, for everything below the first. */
function EventTile({ event, cover, onPress }) {
  const count = event.memories?.[0]?.count ?? 0;
  const members = event.event_members?.[0]?.count ?? 0;

  return (
    <Tappable onPress={onPress} haptic scaleTo={0.97} fill style={styles.tile}>
      <View style={styles.tileCoverWrap}>
        {cover ? (
          <Photo uri={cover} style={styles.tileCover} recyclingKey={event.id} />
        ) : (
          <View style={[styles.tileCover, styles.coverEmpty]}>
            <Feather name="image" size={18} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.tileBadge}>
          <Feather name="layers" size={9} color="#fff" />
          <Text style={styles.tileBadgeText}>{count}</Text>
        </View>
      </View>

      <Text style={styles.tileTitle} numberOfLines={1}>
        {event.title}
      </Text>
      <Text style={styles.tileMeta} numberOfLines={1}>
        {members > 1 ? `${members} people · ` : ''}
        {ago(event.created_at)}
        {event.location ? ` · ${event.location}` : ''}
      </Text>
    </Tappable>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');

  const events = useQuery({ queryKey: ['events'], queryFn: listEvents });
  const all = events.data ?? [];

  const ids = useMemo(() => all.map((e) => e.id), [all]);
  const covers = useQuery({
    queryKey: ['eventCovers', ids.join(',')],
    queryFn: () => api.eventCovers(ids),
    enabled: ids.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  // The covers you can see, fetched before the grid appears.
  const warm = useWarmImages(
    (events.data ?? []).map((e) => covers.data?.[e.id]),
    5,
    events.isFetched && (!(events.data ?? []).length || covers.isFetched)
  );

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((event) =>
          [event.title, event.location, event.invite_code]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(needle))
        )
      : all;
    return applySort(filtered, sort, 'events');
  }, [all, query, sort]);

  // The newest event runs full width; everything after it goes two abreast. One
  // large card gives the list a place to start, and twenty identical rows do not.
  const featured = list[0] ?? null;

  // An odd tail leaves one tile alone on the last row, and a flexed child on its
  // own fills the whole width — so it is balanced with an invisible partner.
  const rest = useMemo(() => {
    const tail = list.slice(1);
    return tail.length % 2 ? [...tail, { id: '__spacer__', spacer: true }] : tail;
  }, [list]);

  const renderItem = useCallback(
    ({ item }) =>
      item.spacer ? (
        <View style={styles.tile} />
      ) : (
        <EventTile
          event={item}
          cover={covers.data?.[item.id]}
          onPress={() => router.push(`/event/${item.id}`)}
        />
      ),
    [covers.data, router]
  );

  const sortLabel = SORTS.events.find((s) => s.value === sort)?.label ?? 'Newest first';
  const total = all.reduce((sum, event) => sum + (event.memories?.[0]?.count ?? 0), 0);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Events"
        subtitle={
          all.length
            ? `${all.length} ${all.length === 1 ? 'event' : 'events'} · ${total} memories`
            : 'Nothing yet'
        }
        right={
          <RoundButton name="plus" tone="filled" label="New event" onPress={() => setCreating(true)} />
        }
      >
        {all.length > 2 ? (
          <>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search events or codes"
            />
            <Pressable style={styles.sortBar} onPress={() => setSorting(true)}>
              <Feather name="sliders" size={13} color={colors.textSoft} />
              <Text style={styles.sortText}>{sortLabel}</Text>
              <Feather name="chevron-down" size={13} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}
      </ScreenHeader>

      <FlatList
        contentContainerStyle={styles.content}
        data={warm ? rest : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View>
            {!query ? (
              <View style={styles.lead}>
                <CreateCard onPress={() => setCreating(true)} />
              </View>
            ) : null}
            {featured && warm ? (
              <View style={styles.lead}>
                <EventCard
                  event={featured}
                  cover={covers.data?.[featured.id]}
                  onPress={() => router.push(`/event/${featured.id}`)}
                />
              </View>
            ) : null}
            {rest.filter((item) => !item.spacer).length ? (
              <Text style={styles.section}>Earlier</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          events.isError ? (
            <ErrorState
              title="Could not load your events"
              error={events.error}
              onRetry={events.refetch}
              retrying={events.isFetching}
            />
          ) : events.isLoading || !warm ? (
            <CardsSkeleton pairs={3} />
          ) : query ? (
            <Text style={styles.none}>No events match “{query}”.</Text>
          ) : null
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={11}
        refreshControl={
          <RefreshControl
            refreshing={events.isFetching}
            onRefresh={events.refetch}
            tintColor={colors.primary}
          />
        }
      />

      <CreateEventSheet visible={creating} onClose={() => setCreating(false)} />
      <SortSheet
        visible={sorting}
        onClose={() => setSorting(false)}
        options={SORTS.events}
        value={sort}
        onChange={setSort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  lead: { marginBottom: spacing.xl },
  row: { gap: spacing.md, marginBottom: spacing.lg },
  section: { ...type.heading, color: colors.text, marginBottom: spacing.md },

  tile: { flex: 1, gap: 6 },
  tileCoverWrap: { borderRadius: radius.md, overflow: 'hidden' },
  tileCover: { width: '100%', aspectRatio: 1, backgroundColor: colors.mediaPlaceholder },
  tileBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16,12,26,0.62)',
  },
  tileBadgeText: { ...type.tiny, color: '#fff', fontSize: 10 },
  tileTitle: { ...type.bodyStrong, color: colors.text },
  tileMeta: { ...type.caption, color: colors.textMuted },

  sortBar: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  sortText: { ...type.caption, color: colors.textSoft },
  none: { ...type.caption, color: colors.textMuted },

  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.mediaPlaceholder },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%' },

  code: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16,12,26,0.55)',
  },
  codeText: { ...type.tiny, color: '#fff', letterSpacing: 1 },

  overlay: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, gap: 3 },
  title: { ...type.title, color: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...type.caption, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  sep: { ...type.caption, color: 'rgba(255,255,255,0.5)' },
});
