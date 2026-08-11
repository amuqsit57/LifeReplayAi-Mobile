import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { listEvents } from '../../src/lib/data';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';
import CreateEventSheet from '../../src/ui/CreateEventSheet';
import { RoundButton, ScreenHeader, SearchBar } from '../../src/ui/Header';
import { RowSkeleton } from '../../src/ui/Skeleton';

function EventCard({ event, onPress }) {
  const count = event.memories?.[0]?.count ?? 0;

  // A cover is worth one small request per card; without it every event looks
  // the same and the list stops being scannable.
  const cover = useQuery({
    queryKey: ['cover', event.id],
    queryFn: async () => {
      const rows = await api.memories(event.id);
      const first = rows.find((m) => m.thumbnail_url) ?? null;
      return first?.thumbnail_url ?? null;
    },
    enabled: count > 0,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.coverWrap}>
        {cover.data ? (
          <Image source={{ uri: cover.data }} style={styles.cover} contentFit="cover" transition={140} />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <Feather name="image" size={20} color={colors.textMuted} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="layers" size={12} color={colors.textMuted} />
          <Text style={styles.meta}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>
          {event.location ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Feather name="map-pin" size={12} color={colors.textMuted} />
              <Text style={styles.meta} numberOfLines={1}>
                {event.location}
              </Text>
            </>
          ) : null}
        </View>

        {event.invite_code ? (
          <View style={styles.code}>
            <Feather name="hash" size={11} color={colors.primary} />
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
  const [query, setQuery] = useState('');
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents });
  const all = events.data ?? [];

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((event) =>
      [event.title, event.location, event.invite_code]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    );
  }, [all, query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Events"
        subtitle={`${all.length} ${all.length === 1 ? 'event' : 'events'} you can add to`}
        right={
          <RoundButton name="plus" tone="filled" label="New event" onPress={() => setCreating(true)} />
        }
      >
        {all.length > 3 ? (
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search events or codes"
          />
        ) : null}
      </ScreenHeader>

      <FlatList
        contentContainerStyle={styles.content}
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          events.isLoading ? (
            <RowSkeleton count={5} />
          ) : (
            <Empty
              icon="▦"
              title="No events yet"
              body="Create one for a wedding, a trip, a birthday — then share the code with everyone who was there."
            />
          )
        }
        initialNumToRender={6}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={events.isFetching}
            onRefresh={events.refetch}
            tintColor={colors.primary}
          />
        }
      />
      <CreateEventSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  coverWrap: { borderRadius: radius.md, overflow: 'hidden' },
  cover: { width: 62, height: 62, backgroundColor: colors.mediaPlaceholder },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1, gap: 4 },
  title: { ...type.heading, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...type.caption, color: colors.textMuted, flexShrink: 1 },
  dot: { ...type.caption, color: colors.borderStrong, marginHorizontal: 2 },

  code: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  codeText: { ...type.tiny, color: colors.primary, letterSpacing: 1 },
});
