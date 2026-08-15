import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { updatePassword } from '../../src/lib/data';
import { useAuth } from '../../src/store';
import { colors, radius, spacing, type } from '../../src/theme';
import AuthField from '../../src/ui/auth/AuthField';
import AuthShell, { AuthAlert, AuthButton } from '../../src/ui/auth/AuthShell';
import { MIN_PASSWORD, humanise, passwordProblem, strength } from '../../src/ui/auth/messages';

function Strength({ password }) {
  const rating = strength(password);
  if (!rating) return null;

  return (
    <View style={styles.strength}>
      <View style={styles.bars}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={[
              styles.bar,
              { backgroundColor: step <= rating.score ? rating.tint : colors.surfaceSunk },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthWord, { color: rating.tint }]}>{rating.label}</Text>
    </View>
  );
}

/**
 * Set a new password.
 *
 * Reached two ways, and both arrive already signed in: from the code on the
 * Forgot screen, which is what recovery means to Supabase, or from the account
 * settings of somebody who simply wants to change it. So there is no link to
 * parse and no tokens to unpack — the session is the precondition, and the only
 * interesting case left is arriving without one.
 */
export default function Reset() {
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const againRef = useRef(null);

  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [touched, setTouched] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const problems = {
    password: passwordProblem(password, { forSignUp: true }),
    again: !again ? 'Type it a second time' : again !== password ? 'Those two do not match' : null,
  };
  const shown = {
    password: touched.password ? problems.password : null,
    again: touched.again ? problems.again : null,
  };

  async function submit() {
    setTouched({ password: true, again: true });
    if (problems.password || problems.again) return;

    setBusy(true);
    setFailure(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      console.log('[auth] password update failed:', err?.status, err?.message);
      setFailure(humanise(err));
    } finally {
      setBusy(false);
    }
  }

  // Opened after the recovery session lapsed, or reached directly. Nothing to
  // act on, so it says so and points at the one thing that would help rather
  // than showing a form that cannot save.
  if (!session) {
    return (
      <AuthShell
        title="Start again"
        subtitle="This screen needs a code from a recent email, and codes only last a few minutes."
      >
        <View style={styles.note}>
          <Feather name="clock" size={15} color={colors.warning} />
          <Text style={styles.noteText}>
            Ask for a new code and you will be back here in under a minute.
          </Text>
        </View>

        <AuthButton label="Send me a code" onPress={() => router.replace('/auth/forgot')} />
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title="Password changed"
        subtitle="You are signed in on this phone. Nothing else to do."
      >
        <View style={[styles.note, { backgroundColor: colors.successSoft }]}>
          <Feather name="check-circle" size={15} color={colors.success} />
          <Text style={styles.noteText}>
            Use the new one next time you sign in on another device.
          </Text>
        </View>

        <AuthButton label="Go to your feed" onPress={() => router.replace('/(tabs)/feed')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Pick something you have not used here before.">
      <AuthAlert message={failure} />

      <View>
        <AuthField
          icon="lock"
          label="New password"
          secure
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setFailure(null);
          }}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={shown.password}
          hint={password ? undefined : `At least ${MIN_PASSWORD} characters.`}
          placeholder="Something only you would pick"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => againRef.current?.focus()}
          submitBehavior="submit"
        />
        <Strength password={password} />
      </View>

      <AuthField
        ref={againRef}
        icon="check"
        label="Again, to be sure"
        secure
        value={again}
        onChangeText={(value) => {
          setAgain(value);
          setFailure(null);
        }}
        onBlur={() => setTouched((t) => ({ ...t, again: true }))}
        error={shown.again}
        placeholder="The same one"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <AuthButton label="Save password" loading={busy} onPress={submit} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  strength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bars: { flexDirection: 'row', gap: 4, flex: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  strengthWord: { ...type.tiny, width: 46, textAlign: 'right' },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  noteText: { ...type.caption, color: colors.textSoft, flex: 1 },
});
