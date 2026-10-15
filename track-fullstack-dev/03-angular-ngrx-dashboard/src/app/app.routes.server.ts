import { RenderMode, ServerRoute } from '@angular/ssr';

/** Public pages are prerendered (SSG); authenticated pages render on the client only. */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
