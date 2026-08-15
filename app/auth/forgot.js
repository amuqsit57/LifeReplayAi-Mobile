import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { requestPasswordReset, verifyRecoveryCode } from '../../src/lib/data';
import { colors, radius, spacing, type } from '../../src/theme';
import AuthField from '../../src/ui/auth/AuthField';
import AuthShell, { AuthAlert, AuthButton } from '../../src/ui/auth/AuthShell';
import { emailProblem, humanise } from '../../src/ui/auth/messages';

// Supabase's email OTP length is a project setting — anywhere from six to ten
// digits, and this project sends eight. Pinning the screen to one number means
// it silently stops accepting perfectly valid codes the day somebody changes
// that setting, and the failure looks like a broken code rather than a stale
// constant. So the whole range is allowed and the server decides what is right.
const MIN_CODE = 6;
const MAX_CODE = 10;

/**
 * The way back in.
 *
 * There was none: a forgotten password meant a new account, and with it a new
 * feed and no way back to the events you had been invited to.
 *
 * Two steps rather than a link that leaves the app. Typing a code keeps the
 * whole thing in the foreground, which is both fewer moving parts and — because
 * the mail can be read on a laptop while the code is typed on the phone — the
 * only version that works when the account was set up on another device.
 *
 * The screen says the same thing whether the address is registered or not.
 * Confirming which emails have accounts turns a sign-in form into a way to
 * enumerate the app's users, and the honest-looking version of this — "no
 * account with that address" — is exactly that.
 */
export default function Forgot() {
  const router = useRouter();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState(null);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);

  const problem = emailProblem(email);

  async function send() {
    setTouched(true);
    if (problem) return;

    setBusy(true);
    setFailure(null);
    setSlow(false);
    try {
      await requestPasswordReset(email);
      setStep('code');
    } catch (err) {
      console.log('[auth] reset request failed:', err?.status, err?.message);

      // A timeout is not a refusal. The auth server gave up waiting for the mail
      // server, which says nothing about whether the mail went — and on a free
      // SMTP tier it often did, a second or two later. Sending somebody back to
      // the start would then be wrong twice over: it throws away a code that is
      // on its way, and asking again invalidates it. So the code step opens
      // anyway, with the doubt stated plainly rather than dressed up as success.
      if (err?.status === 504 || err?.status === 408 || err?.status === 502) {
        setSlow(true);
        setStep('code');
        return;
      }

      setFailure(humanise(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setFailure(null);
    try {
      await verifyRecoveryCode(email, code);
      // Signed in on the strength of the code. The reset screen picks it up from
      // there, and setting the password is all that is left.
      router.replace('/auth/reset');
    } catch (err) {
      console.log('[auth] code verify failed:', err?.status, err?.message);
      setFailure(
        /expired|invalid/i.test(err?.message ?? '')
          ? 'That code is wrong or has expired. Check the latest email, or send another.'
          : humanise(err)
      );
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If there is an account for ${email.trim()}, it has a code in it.`}
        onBack={() => {
          setStep('email');
          setCode('');
          setFailure(null);
          setSlow(false);
        }}
      >
        <AuthAlert message={failure} />

        {slow ? (
          <View style={styles.warn}>
            <Feather name="clock" size={15} color={colors.warning} />
            <Text style={styles.warnText}>
              The server was slow to answer, so the email may take a minute — or may not arrive at
              all. Give it a moment before sending another.
            </Text>
          </View>
        ) : null}

        <AuthField
          icon="hash"
          label="Your code"
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, MAX_CODE));
            setFailure(null);
          }}
          placeholder="••••••"
          keyboardType="number-pad"
          // The one field on the screen and nothing to do until it is filled, so
          // it opens the keyboard itself.
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={MAX_CODE}
          returnKeyType="go"
          onSubmitEditing={() => code.length >= MIN_CODE && verify()}
          style={styles.codeField}
        />

        <AuthButton
          label="Continue"
          loading={busy}
          disabled={code.length < MIN_CODE}
          onPress={verify}
        />

        <View style={styles.links}>
          <Pressable onPress={send} hitSlop={10} disabled={busy} style={styles.link}>
            <Text style={styles.linkText}>{busy ? 'Sending…' : 'Send another code'}</Text>
          </Pressable>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Put in the address you signed up with and we will email you a code to set a new one."
      onBack={() => router.back()}
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
        // Only once there is something in it to be wrong about; leaving an empty
        // field you never typed in is not a mistake worth reddening.
        onBlur={() => email.trim() && setTouched(true)}
        error={touched ? problem : null}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        autoFocus
        returnKeyType="go"
        // Sends when there is a usable address, and otherwise just closes the
        // keyboard rather than reddening a half-typed field.
        onSubmitEditing={() => (problem ? Keyboard.dismiss() : send())}
      />

      <AuthButton label="Email me a code" loading={busy} onPress={send} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  // Tracking sized for the longest code the setting allows: at ten digits a
  // wider gap runs off the edge of a narrow phone.
  codeField: { marginBottom: spacing.xs },

  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  warnText: { ...type.caption, color: colors.textSoft, flex: 1 },

  links: { alignItems: 'center' },
  link: { paddingVertical: spacing.sm },
  linkText: { ...type.label, color: colors.primary },
});
