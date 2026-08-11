import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createEvent } from '../../src/lib/data';
import { colors, radius, spacing, type } from '../../src/theme';
import { Button, Field } from '../../src/ui';

export default function CreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => createEvent({ title, description, location }),
    onSuccess: (event) => {
      setTitle('');
      setLocation('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['events'] });
      router.push(`/event/${event.id}`);
    },
    onError: (error) => Alert.alert('Could not create', error.message),
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New event</Text>
      <Text style={styles.blurb}>
        Everyone you invite can add their photos and videos, and anyone can turn them into a film.
      </Text>

      <View style={styles.form}>
        <Field
          label="What was it?"
          placeholder="Sarah and Tom's wedding"
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
        <Field
          label="Where (optional)"
          placeholder="Brighton"
          value={location}
          onChangeText={setLocation}
        />
        <Field
          label="Anything to add (optional)"
          placeholder="A summer wedding, ceremony indoors then dancing until late."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Button
          label={create.isPending ? 'Creating…' : 'Create event'}
          onPress={() => create.mutate()}
          disabled={!title.trim() || create.isPending}
        />

        <View style={styles.note}>
          <Text style={styles.noteText}>
            You will get an invite code to share. Anyone with the code joins the event — they never
            need an account with your family, or anything set up first.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  title: { ...type.display, color: colors.text },
  blurb: { ...type.body, color: colors.textSoft },
  form: { gap: spacing.lg, marginTop: spacing.md },
  note: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  noteText: { ...type.caption, color: colors.textSoft },
});
