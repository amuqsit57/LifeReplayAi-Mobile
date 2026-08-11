import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import { Empty } from '../../src/ui';

/** Every album you can reach, across every event. Row level security scopes it. */
async function allAlbums() {
  const { data, error } = await supabase
    .from('albums')
    .select('*, events!albums_event_id_fkey(id, title), album_memories(count)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default function AlbumsScreen() {
  const router = useRouter();
  const albums = useQuery({ queryKey: ['allAlbums'], queryFn: allAlbums });
  const list = albums.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={albums.isFetching}
          onRefresh={albums.refetch}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Albums</Text>

      {list.length === 0 && !albums.isLoading ? (
        <Empty
          icon="❏"
          title="No albums yet"
          body="Open an event, select some photos and choose Make album. Each album can have its own film."
        />
      ) : (
        list.map((album) => {
          const count = album.album_memories?.[0]?.count ?? 0;
          return (
            <Pressable
              key={album.id}
              style={styles.card}
              onPress={() => router.push(`/album/${album.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.albumTitle} numberOfLines={1}>
                  {album.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {album.events?.title ?? 'An event'} · {count} {count === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  title: { ...type.display, color: colors.text },
  card: {
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
  albumTitle: { ...type.heading, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  chevron: { ...type.title, color: colors.textMuted },
});
