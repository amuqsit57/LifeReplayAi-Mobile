import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { readExtra } from './config';

/**
 * Subscriptions, through RevenueCat.
 *
 * The store is behind one module so the rest of the app never imports the SDK.
 * Screens ask "is this person Pro" and "show them the paywall"; nothing else
 * needs to know that Apple, Google and a test harness all answer differently.
 */

/**
 * The entitlement the whole app is gated on.
 *
 * This string has to match the entitlement identifier in the RevenueCat
 * dashboard exactly — it is not the display name, and a mismatch fails silently
 * by making everybody free forever, which is the worst way for it to fail.
 */
export const ENTITLEMENT = 'Life Replay Pro';

// What the free tier actually allows lives in ./limits — it is a question about
// product, not about billing, and keeping it here would mean two files claiming
// to own the answer.

const log = (...parts) => console.log('[iap]', ...parts);

/**
 * Which key, and therefore which store.
 *
 * A platform key wins whenever one is configured, so the day the store listings
 * exist this starts using them without a code change. The test key is only ever
 * reached in development: RevenueCat crashes a release build configured with
 * one, deliberately, to stop test purchases granting real entitlements — so
 * rather than let that happen, a release build with no platform key configures
 * nothing at all and everyone is simply not Pro.
 */
function resolveKey() {
  const platformKey = Platform.select({
    ios: readExtra('revenueCatIos'),
    android: readExtra('revenueCatAndroid'),
    default: null,
  });
  if (platformKey) return { key: platformKey, store: Platform.OS };

  const testKey = readExtra('revenueCatTest');
  if (testKey && __DEV__) return { key: testKey, store: 'test' };

  return null;
}

let started = false;

/**
 * Called once, as early as the app has a UI.
 *
 * Safe to call again — RevenueCat tolerates it, but the guard keeps the log
 * honest about how many times this really happened.
 */
export async function startPurchases() {
  if (started) return true;

  const resolved = resolveKey();
  if (!resolved) {
    log('no usable API key; subscriptions are off for this build');
    return false;
  }

  try {
    // Verbose while building. The SDK's own log is the only place that explains
    // an empty offering, which is otherwise indistinguishable from a bug here.
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);
    await Purchases.configure({ apiKey: resolved.key });
    started = true;
    log(`configured against the ${resolved.store} store`);
    return true;
  } catch (problem) {
    // A store that will not start must not take the app down with it. Everything
    // that matters — the events, the photographs, the films — works signed out
    // of billing entirely.
    log('configure failed:', problem?.message);
    return false;
  }
}

/**
 * Tie purchases to the signed-in account rather than the handset.
 *
 * Without this a subscription belongs to a device: sign in on a new phone and it
 * is gone, and two people sharing a tablet share a subscription. Using the
 * Supabase user id as the RevenueCat app user id makes it follow the person.
 */
export async function identify(session) {
  if (!started) return null;

  try {
    if (session?.user?.id) {
      const { customerInfo } = await Purchases.logIn(session.user.id);
      return customerInfo;
    }
    // Signing out returns to an anonymous id, so the next person to use this
    // phone does not inherit the last one's entitlements.
    const { customerInfo } = await Purchases.logOut();
    return customerInfo;
  } catch (problem) {
    log('identify failed:', problem?.message);
    return null;
  }
}

/** Whether this customer info grants Pro. The single definition, used everywhere. */
export function hasPro(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT]);
}

export async function currentCustomerInfo() {
  if (!started) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (problem) {
    log('getCustomerInfo failed:', problem?.message);
    return null;
  }
}

/**
 * Every change to what somebody has paid for, as it happens.
 *
 * Entitlements are deliberately never cached to disk here. A subscription can
 * lapse, be refunded, or be granted on another device between two launches, and
 * a stale "yes" is the one answer a paywall must never give.
 */
export function onCustomerInfo(handler) {
  if (!started) return () => {};
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => Purchases.removeCustomerInfoUpdateListener(handler);
}

/** The offerings behind the paywall, for anything that wants to draw its own. */
export async function currentOffering() {
  if (!started) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (problem) {
    log('getOfferings failed:', problem?.message);
    return null;
  }
}

/**
 * Give somebody back what they already bought.
 *
 * Required by App Store review, and the only way a reinstall gets its
 * subscription back when the purchase was made anonymously.
 */
export async function restore() {
  if (!started) throw new Error('Purchases are not available in this build.');
  return Purchases.restorePurchases();
}
