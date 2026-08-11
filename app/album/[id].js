import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import {
  addToAlbum,
  albumMemoryIds,
  deleteAlbum,
  getAlbum,
  removeFromAlbum,
} from '../../src/lib/data';
import { STYLE_META, colors, radius, shadow, spacing, type } from '../../src/theme';
import { Button, Empty } from '../../src/ui';
import { MediaTile } from '../../src/ui/social';
import Viewer from '../../src/ui/Viewer';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [picking, setPicking] = useState(false);
  const [staged, setStaged] = useState([]);
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
      return rows.some((r) => r.status === 'queued' || r.status === 'running') ? 5000 : false;
    },
  });

  const inAlbum = useMemo(() => new Set(memberIds.data ?? []), [memberIds.data]);
  const all = everything.data ?? [];
  const contents = all.filter((m) => inAlbum.has(m.id));

  const add = useMutation({
    mutationFn: () => addToAlbum(id, staged),
    onSuccess: () => {
      setStaged([]);
      setPicking(false);
      queryClient.invalidateQueries({ queryKey: ['albumIds', id] });
      queryClient.invalidateQueries({ queryKey: ['albums', eventId] });
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

  const albumReplays = (replays.data ?? []).filter((r) => r.album_id === id);

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
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>{album.data?.title ?? 'Album'}</Text>
        <Text style={styles.meta}>
          {contents.length} {contents.length === 1 ? 'item' : 'items'}
        </Text>

        <View style={styles.rowButtons}>
          <Button
            label={picking ? 'Done choosing' : 'Add from event'}
            variant={picking ? 'secondary' : 'primary'}
            onPress={() => {
              if (picking && staged.length) add.mutate();
              else setPicking(!picking);
            }}
          />
        </View>

        {picking ? (
          <>
            <Text style={styles.section}>
              Tap to add {staged.length ? `· ${staged.length} chosen` : ''}
            </Text>
            <View style={styles.grid}>
              {all
                .filter((m) => !inAlbum.has(m.id))
                .map((memory) => (
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
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Films from this album</Text>
        <View style={styles.styleGrid}>
          {Object.entries(STYLE_META).map(([style, meta]) => {
            const existing = albumReplays.find((r) => r.style === style);
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

        <Text style={styles.section}>In this album</Text>
        {contents.length === 0 ? (
          <Empty icon="❏" title="Empty for now" body="Add photos and videos from the event above." />
        ) : (
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
        )}

        <Button
          label="Delete album"
          variant="ghost"
          onPress={() =>
            Alert.alert('Delete this album?', 'The photos and videos stay in the event.', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => scrap.mutate() },
            ])
          }
        />
      </ScrollView>

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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  back: { ...type.label, color: colors.primary },
  title: { ...type.display, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },
  rowButtons: { gap: spacing.sm },
  section: { ...type.heading, color: colors.text, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
});
