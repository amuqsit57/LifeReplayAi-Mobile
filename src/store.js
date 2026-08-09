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
