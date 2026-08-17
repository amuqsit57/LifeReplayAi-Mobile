import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { feed, listEvents, myProfile, signOut } from '../../src/lib/data';
import { showCustomerCenter, showPaywall } from '../../src/lib/paywall';
import { restore } from '../../src/lib/purchases';
import { usePro } from '../../src/store';
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

/**
 * What Pro is, or what it would be.
 *
 * One card doing both jobs rather than an upsell that disappears once you pay
 * and a settings row that appears in its place. Somebody who subscribed wants to
 * find the same thing in the same spot — to check it renewed, or to cancel — and
 * hiding that is how a subscription becomes a chargeback.
 */
function ProCard({ isPro, onUpgrade, onManage }) {
  return (
    <Pressable
      onPress={isPro ? onManage : onUpgrade}
      style={({ pressed }) => [styles.pro, isPro && styles.proOn, pressed && { opacity: 0.9 }]}
    >
      <View style={[styles.proIcon, isPro && { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
        <Feather name={isPro ? 'star' : 'zap'} size={18} color={isPro ? '#fff' : colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.proTitle, isPro && { color: '#fff' }]}>
          {isPro ? 'Life Replay Pro' : 'Upgrade to Pro'}
        </Text>
        <Text style={[styles.proBody, isPro && { color: 'rgba(255,255,255,0.82)' }]}>
          {isPro
            ? 'Every style, and cut your own. Tap to manage.'
            : 'Unlock every film style and the editor.'}
        </Text>
      </View>

      <Feather
        name="chevron-right"
        size={18}
        color={isPro ? 'rgba(255,255,255,0.8)' : colors.textMuted}
      />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('films');
  const isPro = usePro((s) => s.isPro);

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

        <ProCard
          isPro={isPro}
          onUpgrade={showPaywall}
          onManage={showCustomerCenter}
        />

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
              icon={isPro ? 'credit-card' : 'star'}
              label={isPro ? 'Manage subscription' : 'Life Replay Pro'}
              value={isPro ? 'Active' : 'Not subscribed'}
              onPress={isPro ? showCustomerCenter : showPaywall}
            />
            {/* Required by App Store review, and the only way somebody who
                reinstalled gets back a subscription bought anonymously. */}
            <Row
              icon="refresh-cw"
              label="Restore purchases"
              onPress={async () => {
                try {
                  const info = await restore();
                  Alert.alert(
                    Object.keys(info?.entitlements?.active ?? {}).length
                      ? 'Restored'
                      : 'Nothing to restore',
                    Object.keys(info?.entitlements?.active ?? {}).length
                      ? 'Your subscription is back on this phone.'
                      : 'No previous purchase was found for this account.'
                  );
                } catch (problem) {
                  Alert.alert('Could not restore', problem?.message ?? 'Try again in a moment.');
                }
              }}
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

  pro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '2E',
  },
  // Solid brand purple once it is bought, so the card reads as a thing you own
  // rather than an offer that never goes away.
  proOn: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.card },
  proIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTitle: { ...type.bodyStrong, color: colors.text },
  proBody: { ...type.caption, color: colors.textSoft },

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
