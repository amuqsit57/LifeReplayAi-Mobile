import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { createFamily, joinFamily } from '../src/lib/data';
import { colors, radius, spacing, type } from '../src/theme';
import { Button, Card, Field, Screen } from '../src/ui';

export default function FamilySetup() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'create') await createFamily(name);
      else await joinFamily(code.trim().toUpperCase(), relationship);

      queryClient.invalidateQueries();
      router.replace('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = tab === 'create' ? name.trim().length > 1 : code.trim().length >= 4;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={{ gap: spacing.xl }}>
        <View style={styles.hero}>
          <Text style={styles.mark}>👨‍👩‍👧‍👦</Text>
          <Text style={[type.title, { color: colors.text }]}>Your family vault</Text>
          <Text style={styles.sub}>
            Everyone in your family shares one private space for memories.
          </Text>
        </View>

        <View style={styles.tabs}>
          <Tab label="Create a family" active={tab === 'create'} onPress={() => setTab('create')} />
          <Tab label="Join with a code" active={tab === 'join'} onPress={() => setTab('join')} />
        </View>

        <Card style={{ gap: spacing.lg }}>
          {tab === 'create' ? (
            <>
              <Text style={[type.body, { color: colors.textMuted }]}>
                You'll get a code to share with everyone else.
              </Text>
              <Field
                label="Family name"
                value={name}
                onChangeText={setName}
                placeholder="The Khan Family"
              />
            </>
          ) : (
            <>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Ask whoever set up Life Replay for the 6-character code.
              </Text>
              <Field
                label="Invite code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={styles.code}
              />
              <Field
                label="Your relationship (optional)"
                value={relationship}
                onChangeText={setRelationship}
                placeholder="Daughter, Dad, Grandma…"
              />
            </>
          )}

          {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

          <Button
            label={tab === 'create' ? 'Create family' : 'Join family'}
            loading={busy}
            disabled={!canSubmit}
            onPress={submit}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text
        style={[
          type.bodyStrong,
          { color: active ? colors.primary : colors.textMuted, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm },
  mark: { fontSize: 48 },
  sub: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  code: { fontSize: 26, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
});
