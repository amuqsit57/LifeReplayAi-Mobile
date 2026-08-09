import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { signIn } from '../../src/lib/data';
import { colors, spacing, type } from '../../src/theme';
import { Button, Card, Field, Screen } from '../../src/ui';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password });
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.mark}>🎞️</Text>
          <Text style={styles.wordmark}>Life Replay</Text>
          <Text style={styles.tagline}>Your family captures the moments. AI makes the movie.</Text>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
          />

          {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

          <Button
            label="Sign in"
            loading={busy}
            disabled={!email.trim() || !password}
            onPress={submit}
          />
        </Card>

        <Pressable onPress={() => router.push('/auth/sign-up')} hitSlop={10} style={styles.link}>
          <Text style={[type.body, { color: colors.textMuted }]}>
            New here? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Text>
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, justifyContent: 'center', flexGrow: 1 },
  hero: { alignItems: 'center', gap: spacing.xs },
  mark: { fontSize: 56 },
  wordmark: { ...type.display, color: colors.text },
  tagline: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: spacing.xs,
  },
  link: { alignSelf: 'center', paddingVertical: spacing.md },
});
