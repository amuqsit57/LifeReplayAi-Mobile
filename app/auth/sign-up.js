import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { signUp } from '../../src/lib/data';
import { colors, radius, spacing, type } from '../../src/theme';
import AuthField from '../../src/ui/auth/AuthField';
import AuthShell, { AuthAlert, AuthButton, AuthSwitch } from '../../src/ui/auth/AuthShell';
import {
  MIN_PASSWORD,
  emailProblem,
  humanise,
  passwordProblem,
  strength,
} from '../../src/ui/auth/messages';

/** Three bars and a word. Shown while typing, never used to block. */
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

export default function SignUp() {
  const router = useRouter();
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checked, setChecked] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const problems = {
    fullName: fullName.trim() ? null : 'Put in your name',
    email: emailProblem(email),
    password: passwordProblem(password, { forSignUp: true }),
  };
  /**
   * When a field is allowed to complain.
   *
   * Leaving a field you never typed in is not a mistake — you were on your way
   * to the next one. So blurring only reports a field with something in it to be
   * wrong about; empty ones are the button's business, on submit.
   */
  const leave = (field, value) => () => {
    if (value.trim()) setChecked((c) => ({ ...c, [field]: true }));
  };

  const shown = {
    fullName: checked.fullName ? problems.fullName : null,
    email: checked.email ? problems.email : null,
    password: checked.password ? problems.password : null,
  };

  async function submit() {
    setChecked({ fullName: true, email: true, password: true });

    // Straight to the first thing that is wrong. Reached from the button only —
    // the return key never lands here, so this cannot fire while somebody is
    // still working down the form.
    const firstBad = problems.fullName
      ? nameRef
      : problems.email
        ? emailRef
        : problems.password
          ? passwordRef
          : null;
    if (firstBad) {
      firstBad.current?.focus();
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      const result = await signUp({ email, password, fullName });

      // With email confirmation off, signing up returns a session and the
      // account is usable immediately — which is the point of turning it off.
      // This branch is not dead code: it is what happens if confirmation is
      // still on in the project this build points at, and a signed-out user
      // dropped into the feed would see a screen that loads nothing and looks
      // broken. A state rather than an error, because being asked to confirm an
      // address is not a mistake anybody made.
      if (!result.session) {
        setPending(true);
        return;
      }

      // Straight into the feed. This used to send people to `/family-setup`, a
      // route that no longer exists, so a successful sign-up ended on
      // expo-router's "Unmatched Route" screen.
      router.replace('/(tabs)/feed');
    } catch (err) {
      console.log('[auth] sign up failed:', err?.status, err?.message);
      setFailure(humanise(err));
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <AuthShell
        title="Confirm your email"
        subtitle={`We sent a link to ${email.trim()}. Open it, then come back and sign in.`}
      >
        <View style={styles.pending}>
          <Feather name="mail" size={20} color={colors.primary} />
          <Text style={styles.pendingText}>
            Nothing arriving? Check your spam folder — the first one often lands there.
          </Text>
        </View>

        <AuthButton
          label="Back to sign in"
          icon="arrow-left"
          onPress={() => router.replace('/auth/sign-in')}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Make your account"
      subtitle="One place for everyone's photos, and the films made out of them."
      onBack={() => router.back()}
      footer={
        <AuthSwitch
          prompt="Already have an account?"
          action="Sign in"
          onPress={() => router.replace('/auth/sign-in')}
        />
      }
    >
      <AuthAlert message={failure} />

      <AuthField
        ref={nameRef}
        icon="user"
        label="Your name"
        value={fullName}
        onChangeText={(value) => {
          setFullName(value);
          setFailure(null);
        }}
        onBlur={leave('fullName', fullName)}
        error={shown.fullName}
        hint="What everyone in your events will see."
        placeholder="Sara Khan"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        // No auto-advance and no submit from the keyboard, anywhere on this
        // screen. Moving focus for somebody is a courtesy; it is not worth one
        // chance in a hundred of the courtesy firing unprompted and marching the
        // cursor through the form while they are trying to type in it.
      />

      <AuthField
        ref={emailRef}
        icon="mail"
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setFailure(null);
        }}
        onBlur={leave('email', email)}
        error={shown.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="done"
      />

      <View>
        <AuthField
          ref={passwordRef}
          icon="lock"
          label="Password"
          secure
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setFailure(null);
          }}
          onBlur={leave('password', password)}
          error={shown.password}
          hint={password ? undefined : `At least ${MIN_PASSWORD} characters.`}
          placeholder="Something only you would pick"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
        />
        <Strength password={password} />
      </View>

      <AuthButton label="Create account" loading={busy} onPress={submit} />

      {/* What they are agreeing to, in the place where they agree to it. The
          honest version of this app's promise is that it is closed by default,
          which is also the thing somebody handing over family photographs
          actually wants to know. */}
      <View style={styles.trust}>
        <Feather name="lock" size={13} color={colors.textMuted} />
        <Text style={styles.trustText}>
          Your photos stay private to the events you share them with. Nobody can see an event
          without its code.
        </Text>
      </View>
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

  trust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  trustText: { ...type.caption, color: colors.textMuted, flex: 1 },

  pending: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  pendingText: { ...type.caption, color: colors.textSoft, flex: 1 },
});
