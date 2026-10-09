import { RenderMode, ServerRoute } from '@angular/ssr';

// Every page is rendered on the server for each request (the data comes from the API, so no prerendering).
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'analytics', renderMode: RenderMode.Server },
  // Unknown URLs show the not-found page and send HTTP status 404.
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
