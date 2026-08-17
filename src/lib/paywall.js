import { Alert } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { ENTITLEMENT } from './purchases';

/**
 * The paywall, and the place people go to cancel.
 *
 * Both are RevenueCat's own screens rather than ones drawn here, which is the
 * whole point of using them: the offer, the prices, the wording and the layout
 * are edited in the dashboard and change without an app release. A paywall
 * hardcoded in this repo would need a store review to change a price.
 */

const log = (...parts) => console.log('[paywall]', ...parts);

/**
 * Show the paywall.
 *
 * Resolves true when the person now has Pro — bought or restored — so callers
 * can carry straight on with whatever they were trying to do. That continuation
 * matters: being sent back to a locked button after paying feels like the
 * payment did not work.
 */
export async function showPaywall({ offering } = {}) {
  try {
    const result = await RevenueCatUI.presentPaywall(offering ? { offering } : undefined);
    log('result', result);

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.ERROR:
        Alert.alert(
          'The store did not answer',
          'Nothing has been charged. Try again in a moment.'
        );
        return false;
      // NOT_PRESENTED means they already have it, and CANCELLED means they said
      // no. Neither is a failure and neither should interrupt anybody.
      default:
        return false;
    }
  } catch (problem) {
    log('presentPaywall threw:', problem?.message);
    Alert.alert('Could not open the store', problem?.message ?? 'Try again in a moment.');
    return false;
  }
}

/**
 * Show it only to somebody who does not already have Pro.
 *
 * RevenueCat checks the entitlement itself, which is one fewer place for this
 * app's idea of "subscribed" to drift from the truth.
 */
export async function showPaywallIfNeeded() {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT,
    });
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (problem) {
    log('presentPaywallIfNeeded threw:', problem?.message);
    return false;
  }
}

/**
 * Where a subscriber manages what they are paying for.
 *
 * Cancelling, restoring, asking for a refund and reporting that something is
 * broken all live here. Making people hunt through system settings to cancel is
 * both hostile and, in practice, a way of turning a cancellation into a refund
 * request and a one-star review.
 */
export async function showCustomerCenter() {
  try {
    await RevenueCatUI.presentCustomerCenter();
    return true;
  } catch (problem) {
    log('presentCustomerCenter threw:', problem?.message);
    Alert.alert(
      'Could not open subscription settings',
      problem?.message ?? 'Try again in a moment.'
    );
    return false;
  }
}
