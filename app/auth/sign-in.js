import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signIn } from '../../src/lib/data';
import { colors, spacing, type } from '../../src/theme';
import AuthField from '../../src/ui/auth/AuthField';
import AuthShell, { AuthAlert, AuthButton, AuthSwitch } from '../../src/ui/auth/AuthShell';
import { emailProblem, humanise, passwordProblem } from '../../src/ui/auth/messages';

export default function SignIn() {
  const router = useRouter();
  const passwordRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  // Checked always, shown only once you have left the field. Marking a box red
  // while somebody is still halfway through typing into it is the form telling
  // you that you are wrong before you have finished being right.
  const problems = {
    email: emailProblem(email),
    password: passwordProblem(password),
  };
  const shown = {
    email: touched.email ? problems.email : null,
    password: touched.password ? problems.password : null,
  };

  async function submit() {
    // Everything is touched on submit, so pressing the button on an empty form
    // marks what is missing rather than doing nothing.
    setTouched({ email: true, password: true });
    if (problems.email || problems.password) return;

    setBusy(true);
    setFailure(null);
    try {
      await signIn({ email, password });
      router.replace('/');
    } catch (err) {
      console.log('[auth] sign in failed:', err?.status, err?.message);
      setFailure(humanise(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where your films left off."
      footer={
        <AuthSwitch
          prompt="New here?"
          action="Create an account"
          onPress={() => router.push('/auth/sign-up')}
        />
      }
    >
      <AuthAlert message={failure} />

      <AuthField
        icon="mail"
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setFailure(null);
        }}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        error={shown.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        // Straight on to the password rather than dismissing the keyboard and
        // making them reach back up the screen.
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <View style={styles.passwordBlock}>
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
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={shown.password}
          placeholder="Your password"
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        {/* Under the field it is about, ranged right — where a thumb reaching
            past the password lands, and where every login form puts it. */}
        <Pressable
          onPress={() => router.push('/auth/forgot')}
          hitSlop={10}
          style={styles.forgot}
        >
          <Text style={styles.forgotText}>Forgot your password?</Text>
        </Pressable>
      </View>

      <AuthButton label="Sign in" loading={busy} onPress={submit} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  passwordBlock: { gap: spacing.sm },
  forgot: { alignSelf: 'flex-end' },
  forgotText: { ...type.label, color: colors.primary },
});
