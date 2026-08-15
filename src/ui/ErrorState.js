import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../theme';

/**
 * A request that failed, said as such.
 *
 * Every screen in the app handled loading and emptiness and nothing else, so a
 * dropped connection rendered as "No films yet" — the app telling you that you
 * have nothing when what happened is that it could not ask. The two are opposite
 * facts and they looked identical, and the empty state is the more damaging of
 * the misreadings: it invites you to make something you already made.
 *
 * So this is deliberately not an empty state with different words. It says the
 * fetch failed, gives back whatever the server actually said, and offers the
 * only useful action — try it again — because most of these are a tunnel or a
 * lift rather than anything wrong with the account.
 */
export default function ErrorState({
  title = 'Could not load this',
  body,
  error,
  onRetry,
  retrying,
}) {
  // Supabase and fetch failures both arrive as Error, but a network drop reads
  // as "Network request failed", which is jargon. Anything unrecognised is shown
  // as it came: a real message beats a reassuring guess.
  const raw = error?.message ?? '';
  const offline = /network request failed|failed to fetch|timeout|networkerror/i.test(raw);
  const said = offline
    ? 'No connection to the server. Check your signal and try again.'
    : body ?? raw ?? 'Something went wrong.';

  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Feather name={offline ? 'wifi-off' : 'alert-circle'} size={22} color={colors.danger} />
      </View>

      <Text style={styles.title}>{offline ? 'You are offline' : title}</Text>
      <Text style={styles.body}>{said}</Text>

      {onRetry ? (
        <Pressable
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [styles.retry, (pressed || retrying) && { opacity: 0.7 }]}
        >
          <Feather name="rotate-cw" size={15} color="#fff" />
          <Text style={styles.retryText}>{retrying ? 'Trying…' : 'Try again'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...type.heading, color: colors.text, textAlign: 'center' },
  body: { ...type.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  retryText: { ...type.label, color: '#fff' },
});
