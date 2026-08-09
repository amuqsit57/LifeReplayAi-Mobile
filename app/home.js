import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';

import { createEvent, listEvents, myFamily, signOut } from '../src/lib/data';
import { colors, radius, spacing, type } from '../src/theme';
import { Button, Card, Empty, Field, Pill, Screen, SectionHeader } from '../src/ui';

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const family = useQuery({ queryKey: ['myFamily'], queryFn: myFamily });
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents });

  const list = events.data ?? [];

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={events.isFetching}
          onRefresh={events.refetch}
          tintColor={colors.primary}
        />
      }
      contentStyle={{ gap: spacing.xl }}
    >
      <View>
        <Text style={[type.label, { color: colors.accent }]}>LIFE REPLAY</Text>
        <Text style={[type.display, { color: colors.text, marginTop: 2 }]}>
          {family.data?.name ?? 'Your family'}
        </Text>
      </View>

      {family.data?.invite_code ? (
        <Card style={styles.invite}>
          <View style={{ flex: 1 }}>
            <Text style={[type.caption, { color: colors.textMuted }]}>INVITE CODE</Text>
            <Text style={styles.code} selectable>
              {family.data.invite_code}
            </Text>
          </View>
          <Button
            label="Share"
            icon="📤"
            variant="secondary"
            onPress={() =>
              Share.share({
                message: `Join our family on Life Replay with code ${family.data.invite_code}`,
              }).catch(() => {})
            }
          />
        </Card>
      ) : null}

      {creating ? (
        <NewEvent
          onCancel={() => setCreating(false)}
          onCreated={(event) => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ['events'] });
            router.push(`/event/${event.id}`);
          }}
        />
      ) : (
        <Button label="Create an event" icon="＋" onPress={() => setCreating(true)} />
      )}

      <View>
        <SectionHeader title="Events" subtitle={`${list.length} in your vault`} />

        {list.length === 0 && !events.isLoading ? (
          <Empty
            icon="🎬"
            title="No events yet"
            body="Create one, then everyone can drop their photos and videos into it."
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {list.map((event) => (
              <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}`)}>
                {({ pressed }) => (
                  <Card style={[styles.event, pressed && { opacity: 0.85 }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[type.bodyStrong, { color: colors.text }]}>{event.title}</Text>
                      <Text style={[type.caption, { color: colors.textMuted }]}>
                        {event.event_date ?? 'No date'}
                        {event.location ? ` · ${event.location}` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
                        <Pill
                          label={`${event.memories?.[0]?.count ?? 0} memories`}
                          tone="primary"
                        />
                        {event.summary ? <Pill label="AI ready" tone="success" icon="✨" /> : null}
                      </View>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
                  </Card>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Button
        label="Sign out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/auth/sign-in');
        }}
      />
    </Screen>
  );
}

function NewEvent({ onCancel, onCreated }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onCreated(await createEvent({ title, eventDate: date || null, location }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: spacing.lg }}>
      <Text style={[type.heading, { color: colors.text }]}>New event</Text>
      <Field label="What happened?" value={title} onChangeText={setTitle} placeholder="Dad's 60th Birthday" />
      <Field
        label="Date (YYYY-MM-DD, optional)"
        value={date}
        onChangeText={setDate}
        placeholder="2026-08-09"
        keyboardType="numbers-and-punctuation"
      />
      <Field label="Where (optional)" value={location} onChangeText={setLocation} placeholder="Home" />

      {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          label="Create"
          loading={busy}
          disabled={title.trim().length < 2}
          onPress={submit}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  invite: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 6, color: colors.accent },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
