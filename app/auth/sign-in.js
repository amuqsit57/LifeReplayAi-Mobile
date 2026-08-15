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
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checked, setChecked] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  const problems = {
    email: emailProblem(email),
    password: passwordProblem(password),
  };

  /**
   * When a field is allowed to complain.
   *
   * Leaving a field you never typed in is not a mistake — you were on your way
   * to the next one. Marking it red for that is the form telling you off for
   * looking at it, which is what made tapping between the two boxes light the
   * whole screen up. So blurring only reports a field that has something in it
   * to be wrong about; empty ones are the button's business, on submit.
   */
  const leave = (field, value) => () => {
    if (value.trim()) setChecked((c) => ({ ...c, [field]: true }));
  };

  const shown = {
    email: checked.email ? problems.email : null,
    password: checked.password ? problems.password : null,
  };

  async function submit() {
    setChecked({ email: true, password: true });

    if (problems.email || problems.password) {
      // Put the cursor where the work is. Reached from the button only — the
      // return key never lands here, so this cannot fire while somebody is still
      // filling the form in.
      (problems.email ? emailRef : passwordRef).current?.focus();
      return;
    }

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
        // No auto-advance and no submit from the keyboard, anywhere on this
        // screen. Moving focus for somebody is a courtesy; it is not worth one
        // chance in a hundred of the courtesy firing unprompted and marching the
        // cursor through the form while they are trying to type in it. The
        // button is six millimetres away and never surprises anyone.
        returnKeyType="done"
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
          onBlur={leave('password', password)}
          error={shown.password}
          placeholder="Your password"
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
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
