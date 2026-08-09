import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { signUp } from '../../src/lib/data';
import { colors, spacing, type } from '../../src/theme';
import { Button, Card, Field, Screen } from '../../src/ui';

export default function SignUp() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signUp({ email, password, fullName });
      // Email confirmation leaves no session; without this the user lands on a
      // screen that cannot load anything and looks broken.
      if (!result.session) {
        setError('Check your email to confirm your account, then sign in.');
        return;
      }
      router.replace('/family-setup');
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
          <Text style={[type.title, { color: colors.text }]}>Create your account</Text>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <Field
            label="Your name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Sara Khan"
            autoComplete="name"
          />
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
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
          />

          {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

          <Button
            label="Create account"
            loading={busy}
            disabled={!fullName.trim() || !email.trim() || !password}
            onPress={submit}
          />
        </Card>

        <Pressable onPress={() => router.replace('/auth/sign-in')} hitSlop={10} style={styles.link}>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, justifyContent: 'center', flexGrow: 1 },
  hero: { alignItems: 'center', gap: spacing.sm },
  mark: { fontSize: 48 },
  link: { alignSelf: 'center', paddingVertical: spacing.md },
});
