import { defineConfig } from 'astro/config';
import { site } from './src/site.config';
import launchGuard from './integrations/launch-guard';
import localAdmin from './integrations/local-admin/index';

export default defineConfig({
  site: site.url,
  // Astro 7 strips whitespace JSX-style by default; keep normal HTML spacing between inline elements.
  compressHTML: true,
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // localAdmin only adds /admin while `npm run dev` runs; it's never part of the built site.
  integrations: [launchGuard(), localAdmin()],
});
