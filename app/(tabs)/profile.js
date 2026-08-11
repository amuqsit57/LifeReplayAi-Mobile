import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { feed, myProfile, signOut } from '../../src/lib/data';
import { colors, radius, spacing, type } from '../../src/theme';
import { Button } from '../../src/ui';
import { Avatar, MediaTile } from '../../src/ui/social';
import { api } from '../../src/lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useQuery({ queryKey: ['myProfile'], queryFn: myProfile });
  const posts = useQuery({ queryKey: ['feed'], queryFn: feed });

  const me = profile.data;
  const mine = (posts.data ?? []).filter((post) => post.requested_by === me?.id);

  // One call for every poster, not one per tile.
  const ids = mine.map((post) => post.id);
  const media = useQuery({
    queryKey: ['feedMedia', ids.join(',')],
    queryFn: () => api.replayMedia(ids),
    enabled: ids.length > 0,
    staleTime: 45 * 60 * 1000,
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={profile.isFetching}
          onRefresh={() => {
            profile.refetch();
            posts.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.head}>
        <Avatar url={me?.avatar_url} name={me?.full_name} size="lg" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{me?.full_name ?? 'You'}</Text>
          <Text style={styles.email}>{me?.email ?? ''}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={mine.length} label="Films" />
        <Stat value={(posts.data ?? []).length} label="Visible to you" />
      </View>

      <Text style={styles.section}>Films you made</Text>
      <View style={styles.grid}>
        {mine.map((post) => (
          <MediaTile
            key={post.id}
            uri={media.data?.[post.id]?.thumbnail_url ?? null}
            kind="video"
            badge={post.events?.title}
            style={{ width: '31.5%' }}
            onPress={() => router.push(`/replay/${post.id}`)}
          />
        ))}
        {mine.length === 0 ? (
          <Text style={styles.none}>Nothing yet. Generate a film from an event or an album.</Text>
        ) : null}
      </View>

      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </ScrollView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  name: { ...type.title, color: colors.text },
  email: { ...type.caption, color: colors.textMuted },

  stats: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  statValue: { ...type.title, color: colors.text },
  statLabel: { ...type.caption, color: colors.textMuted },

  section: { ...type.heading, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  none: { ...type.caption, color: colors.textMuted },
});
