import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { feed, listEvents, myProfile, signOut } from '../../src/lib/data';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import ErrorState from '../../src/ui/ErrorState';
import { RoundButton, ScreenHeader } from '../../src/ui/Header';
import { GridSkeleton } from '../../src/ui/Skeleton';
import { Avatar, MediaTile } from '../../src/ui/social';

function Row({ icon, label, value, onPress, danger, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Feather name={icon} size={16} color={danger ? colors.danger : colors.textSoft} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={17} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('films');

  const profile = useQuery({ queryKey: ['myProfile'], queryFn: myProfile });
  const posts = useQuery({ queryKey: ['feed'], queryFn: feed });
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents });

  const me = profile.data;
  const mine = (posts.data ?? []).filter((post) => post.requested_by === me?.id);
  const ids = mine.map((post) => post.id);

  const media = useQuery({
    queryKey: ['feedMedia', ids.join(',')],
    queryFn: () => api.replayMedia(ids),
    enabled: ids.length > 0,
    staleTime: 45 * 60 * 1000,
  });

  const liked = (posts.data ?? []).reduce(
    (sum, post) => sum + (post.replay_likes?.[0]?.count ?? 0),
    0
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="You"
        right={<RoundButton name="settings" label="Settings" onPress={() => setTab('settings')} />}
      />

      <ScrollView
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
        {/* Centred rather than a row: a profile is about the person, and the
            stats read as one block underneath instead of competing beside them. */}
        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <Avatar url={me?.avatar_url} name={me?.full_name} size="lg" />
          </View>
          <Text style={styles.name}>{me?.full_name ?? 'You'}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {me?.email ?? ''}
          </Text>
        </View>

        <View style={styles.stats}>
          <Stat value={mine.length} label="Films" />
          <View style={styles.statDivider} />
          <Stat value={(events.data ?? []).length} label="Events" />
          <View style={styles.statDivider} />
          <Stat value={liked} label="Likes" />
        </View>

        <View style={styles.switcher}>
          {[
            { key: 'films', label: 'Your films', icon: 'film' },
            { key: 'settings', label: 'Settings', icon: 'settings' },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setTab(option.key)}
              style={[styles.switch, tab === option.key && styles.switchOn]}
            >
              <Feather
                name={option.icon}
                size={14}
                color={tab === option.key ? colors.text : colors.textMuted}
              />
              <Text style={[styles.switchText, tab === option.key && styles.switchTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'films' ? (
          // An empty list and a list that has not arrived are not the same thing.
          // Without this the tab opened on "No films yet" and then filled in,
          // telling everyone with films that they had none.
          posts.isError ? (
            <ErrorState
              title="Could not load your films"
              error={posts.error}
              onRetry={posts.refetch}
              retrying={posts.isFetching}
            />
          ) : posts.isLoading || (ids.length > 0 && !media.isFetched) ? (
            <GridSkeleton count={6} />
          ) : mine.length === 0 ? (
            <View style={styles.blank}>
              <Feather name="film" size={26} color={colors.textMuted} />
              <Text style={styles.blankTitle}>No films yet</Text>
              <Text style={styles.blankBody}>
                Open an event or an album and generate one — it will appear here and in everyone's
                feed.
              </Text>
            </View>
          ) : (
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
            </View>
          )
        ) : (
          <View style={styles.card}>
            <Row icon="user" label="Name" value={me?.full_name ?? '—'} />
            <Row icon="mail" label="Email" value={me?.email ?? '—'} />
            <Row
              icon="hash"
              label="Join an event"
              onPress={() => router.push('/join')}
            />
            {/* The same screen the emailed link opens. Signed in, it skips
                straight to the form. */}
            <Row
              icon="lock"
              label="Change password"
              onPress={() => router.push('/auth/reset')}
            />
            <Row
              icon="bell"
              label="Notifications"
              value="On"
              onPress={() =>
                Alert.alert('Notifications', 'Push notifications are not set up yet.')
              }
            />
            <Row
              icon="shield"
              label="Who can see my films"
              value="Event members"
              onPress={() =>
                Alert.alert(
                  'Who can see my films',
                  'Only people you invited to an event can see its films.'
                )
              }
            />
            <Row
              icon="log-out"
              label="Sign out"
              danger
              last
              onPress={() =>
                Alert.alert('Sign out?', '', [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: signOut },
                ])
              }
            />
          </View>
        )}
      </ScrollView>
    </View>
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
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },

  identity: { alignItems: 'center', gap: 2, paddingTop: spacing.sm },
  avatarRing: {
    padding: 4,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  name: { ...type.title, color: colors.text },
  email: { ...type.caption, color: colors.textMuted },

  // One block with hairline dividers rather than three separate tiles — the
  // numbers belong together, and three cards read as three unrelated facts.
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.borderStrong },
  statValue: { ...type.title, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: colors.textMuted },

  switcher: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunk,
    gap: 2,
  },
  switch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  switchOn: { backgroundColor: colors.surface, ...shadow.card },
  switchText: { ...type.label, color: colors.textMuted },
  switchTextOn: { color: colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...type.body, color: colors.text },
  rowValue: { ...type.caption, color: colors.textMuted, maxWidth: 150 },

  blank: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  blankTitle: { ...type.heading, color: colors.text },
  blankBody: { ...type.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },
});
