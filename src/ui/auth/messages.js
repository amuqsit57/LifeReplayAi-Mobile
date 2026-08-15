import { colors } from '../../theme';

/**
 * What the form checks before it bothers the server, and what it says when the
 * server objects anyway.
 *
 * Shared between signing in and signing up so the two cannot drift into
 * disagreeing about what a valid email is, or into phrasing the same failure two
 * different ways.
 */

// Deliberately loose. The only address worth rejecting here is one that is
// obviously a typo — anything stricter starts refusing real addresses, and the
// authoritative test is whether the mail arrives.
const LOOKS_LIKE_EMAIL = /^\S+@\S+\.\S+$/;

export const MIN_PASSWORD = 6;

export function emailProblem(email) {
  const value = email.trim();
  if (!value) return 'Put in your email address';
  if (!LOOKS_LIKE_EMAIL.test(value)) return 'That does not look like an email address';
  return null;
}

export function passwordProblem(password, { forSignUp = false } = {}) {
  if (!password) return 'Put in your password';
  if (forSignUp && password.length < MIN_PASSWORD) {
    return `At least ${MIN_PASSWORD} characters`;
  }
  return null;
}

/**
 * Supabase's wording, in words people use.
 *
 * "Invalid login credentials" is accurate and tells you nothing about what to do
 * next; worse, it reads as though the account is the problem when the usual
 * cause is a mistyped password. Anything unrecognised is passed through as it
 * came, because inventing a friendly message for a failure nobody anticipated is
 * how real problems get hidden.
 */
export function humanise(error) {
  const said = error?.message ?? '';
  const status = error?.status;

  if (status === 504 || status === 502 || /timeout|deadline/i.test(said)) {
    return 'The server took too long to answer. Try again in a moment.';
  }
  if (/network request failed|failed to fetch/i.test(said)) {
    return 'No connection to the server. Check your signal and try again.';
  }
  if (/invalid login credentials/i.test(said)) {
    return 'That email and password do not match. Check both, or reset your password.';
  }
  if (/email not confirmed/i.test(said)) {
    return 'This account has not been confirmed yet. Check your email for the link.';
  }
  if (/user already registered|already registered/i.test(said)) {
    return 'There is already an account with that email. Sign in instead.';
  }
  if (/rate limit|too many/i.test(said)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (/password should be at least/i.test(said)) {
    return `Your password needs at least ${MIN_PASSWORD} characters.`;
  }
  return said || 'Something went wrong. Try again.';
}

/**
 * How good a new password is, in three steps.
 *
 * Length does most of the work — it is the only property that reliably makes a
 * password harder to guess — with a nod to variety so that six of the same
 * character does not read as acceptable. Shown while typing rather than
 * enforced, because a meter that blocks you is a rule, and rules beyond the
 * server's own only get worked around.
 */
export function strength(password) {
  if (!password) return null;

  let score = 0;
  if (password.length >= MIN_PASSWORD) score += 1;
  if (password.length >= 10) score += 1;
  if (/[^a-zA-Z]/.test(password) && /[a-zA-Z]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak', tint: colors.danger };
  if (score === 2) return { score: 2, label: 'Good', tint: colors.warning };
  return { score: 3, label: 'Strong', tint: colors.success };
}
