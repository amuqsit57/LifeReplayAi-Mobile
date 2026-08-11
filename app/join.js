import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { joinEvent } from '../src/lib/data';
import { colors, spacing, type } from '../src/theme';
import { Button, Field, Screen } from '../src/ui';

export default function JoinScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');

  const join = useMutation({
    mutationFn: () => joinEvent(code),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      router.replace(`/event/${event.id}`);
    },
    onError: (error) => Alert.alert('Could not join', error.message),
  });

  return (
    <Screen contentStyle={styles.content}>
      <Text style={styles.title}>Join an event</Text>
      <Text style={styles.blurb}>
        Ask whoever set it up for the code. Once you are in you can add your photos and videos, and
        watch the films anyone makes from them.
      </Text>

      <Field
        label="Invite code"
        placeholder="ABCD12"
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase().trim())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
      />

      <View style={{ gap: spacing.sm }}>
        <Button
          label={join.isPending ? 'Joining…' : 'Join'}
          onPress={() => join.mutate()}
          disabled={code.length < 4 || join.isPending}
        />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg },
  title: { ...type.display, color: colors.text },
  blurb: { ...type.body, color: colors.textSoft },
});
