import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listEvents } from '../../src/lib/data';
import { colors, radius, shadow, spacing, type } from '../../src/theme';
import { Button, Empty } from '../../src/ui';

export default function EventsScreen() {
  const router = useRouter();
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents });
  const list = events.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={events.isFetching}
          onRefresh={events.refetch}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.head}>
        <Text style={styles.title}>Events</Text>
        <Button label="Join with code" variant="ghost" onPress={() => router.push('/join')} />
      </View>

      {list.length === 0 && !events.isLoading ? (
        <Empty
          icon="▦"
          title="No events yet"
          body="Create one for a wedding, a trip, a birthday — then invite the people who were there."
        />
      ) : (
        list.map((event) => {
          const count = event.memories?.[0]?.count ?? 0;
          return (
            <Pressable
              key={event.id}
              style={styles.card}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {count} {count === 1 ? 'memory' : 'memories'}
                  {event.event_date ? ` · ${new Date(event.event_date).toLocaleDateString()}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </View>
              {event.invite_code ? (
                <View style={styles.code}>
                  <Text style={styles.codeText}>{event.invite_code}</Text>
                </View>
              ) : null}
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  eventTitle: { ...type.heading, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  code: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  codeText: { ...type.tiny, color: colors.primary, letterSpacing: 1 },
});
