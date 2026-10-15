import type { Href } from 'expo-router';

/**
 * Typed route builders. Every navigation call goes through here so a renamed screen is a
 * single-file change (and `Href` keeps paths well-formed).
 */
export const routes = {
  login: '/login' as Href,
  campaigns: '/' as Href,
  settings: '/settings' as Href,
  campaign: (id: string): Href => ({ pathname: '/campaign/[id]', params: { id } }) as Href,
};
