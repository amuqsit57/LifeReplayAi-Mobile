import { create } from 'zustand';

/**
 * Session state. `ready` gates navigation so the router does not bounce a
 * signed-in user to sign-in before the persisted session has been restored.
 */
export const useAuth = create((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session, ready: true }),
}));

/**
 * What this person has paid for.
 *
 * In memory only, and rebuilt from RevenueCat on every launch. Persisting it
 * would mean a subscription that lapsed, was refunded, or was cancelled on
 * another device still reading as active until something happened to refresh it
 * — and a stale yes is the one answer a paywall must never give. Being wrong
 * for the second it takes to ask is fine; being wrong for a week is not.
 *
 * `ready` is separate from `isPro` so screens can tell "not subscribed" apart
 * from "not asked yet" and avoid flashing a locked state at a paying customer.
 */
export const usePro = create((set) => ({
  ready: false,
  isPro: false,
  customerInfo: null,
  setCustomerInfo: (customerInfo, isPro) =>
    set({ customerInfo, isPro: Boolean(isPro), ready: true }),
  setUnavailable: () => set({ ready: true, isPro: false, customerInfo: null }),
}));
