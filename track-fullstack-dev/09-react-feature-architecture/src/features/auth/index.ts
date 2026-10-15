// Public surface of the auth feature. Other layers import ONLY from here
// (heavy pages are reached through ./routes so they can be lazy-loaded).
export { requireAuth, signOut } from './auth';
