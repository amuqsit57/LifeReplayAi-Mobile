import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { listEvents } from '../../src/lib/data';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import CreateEventSheet from '../../src/ui/CreateEventSheet';
import { RoundButton, ScreenHeader, SearchBar } from '../../src/ui/Header';
import { RowSkeleton } from '../../src/ui/Skeleton';
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

function EventCard({ event, cover, onPress }) {
  const count = event.memories?.[0]?.count ?? 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={140} recyclingKey={event.id} />
      ) : (
        <View style={[styles.cover, styles.coverEmpty]}>
          <Feather name="image" size={18} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {count} {count === 1 ? 'item' : 'items'} · {ago(event.created_at)}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
        {event.invite_code ? (
          <View style={styles.code}>
            <Feather name="hash" size={10} color={colors.primary} />
            <Text style={styles.codeText}>{event.invite_code}</Text>
          </View>
        ) : null}
      </View>

      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
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

  // One call for every cover, rather than a full memory listing per card.
  const ids = useMemo(() => all.map((e) => e.id), [all]);
  const covers = useQuery({
    queryKey: ['eventCovers', ids.join(',')],
    queryFn: () => api.eventCovers(ids),
    enabled: ids.length > 0,
    staleTime: 30 * 60 * 1000,
  });

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

  const renderItem = useCallback(
    ({ item }) => (
      <EventCard
        event={item}
        cover={covers.data?.[item.id]}
        onPress={() => router.push(`/event/${item.id}`)}
      />
    ),
    [covers.data, router]
  );

  const sortLabel = SORTS.events.find((s) => s.value === sort)?.label ?? 'Newest first';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Events"
        subtitle={`${all.length} ${all.length === 1 ? 'event' : 'events'} you can add to`}
        right={
          <RoundButton name="plus" tone="filled" label="New event" onPress={() => setCreating(true)} />
        }
      >
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
      </ScreenHeader>

      <FlatList
        contentContainerStyle={styles.content}
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          events.isLoading ? (
            <RowSkeleton count={5} />
          ) : (
            <Empty
              icon="▦"
              title={query ? 'Nothing matches' : 'No events yet'}
              body={
                query
                  ? `No events for “${query}”.`
                  : 'Create one for a wedding, a trip, a birthday — then share the code with everyone who was there.'
              }
            />
          )
        }
        // Only what is near the fold stays mounted, so a long list of events
        // never has more than a handful of covers decoding at once.
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
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

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.mediaPlaceholder,
  },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1, gap: 4 },
  title: { ...type.heading, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },

  code: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  codeText: { ...type.tiny, color: colors.primary, letterSpacing: 1 },
});
