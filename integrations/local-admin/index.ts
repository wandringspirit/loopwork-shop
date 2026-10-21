import type { AstroIntegration } from 'astro';
import { createAdminApi } from './api';

/**
 * A local shop admin at /admin: products, stock, photos, categories, FAQ, policies and settings.
 * It only exists while `npm run dev` is running on this computer. It isn't part of the built site,
 * so nothing here is ever deployed.
 */
export default function localAdmin(): AstroIntegration {
  return {
    name: 'local-admin',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev') injectRoute({ pattern: '/admin', entrypoint: './src/admin/AdminPage.astro' });
      },
      'astro:server:setup': ({ server, logger }) => {
        server.middlewares.use('/admin/api', createAdminApi(server.config.root));
        logger.info('Shop admin: open /admin in your browser');
      },
    },
  };
}
