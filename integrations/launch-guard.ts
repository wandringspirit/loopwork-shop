import type { AstroIntegration } from 'astro';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const frontmatterOf = async (file: string) =>
  (await readFile(file, 'utf8').catch(() => '')).split(/^---\s*$/m)[1] ?? '';

/**
 * Stops a production build (SHOP_ENV=production) while the site still has placeholder content:
 * listed products with sample photos, sample page photos, draft policies, or sample contact details.
 */
export default function launchGuard({
  productsDir = 'src/content/products',
  policiesDir = 'src/content/policies',
  settingsFile = 'src/data/settings.json',
} = {}): AstroIntegration {
  return {
    name: 'launch-guard',
    hooks: {
      'astro:build:start': async ({ logger }) => {
        if (process.env.SHOP_ENV !== 'production') return;

        const problems: string[] = [];
        for (const folder of await readdir(productsDir, { withFileTypes: true })) {
          if (!folder.isDirectory()) continue;
          const frontmatter = await frontmatterOf(join(productsDir, folder.name, 'index.md'));
          const hidden = /^status:\s*hidden\s*$/m.test(frontmatter);
          if (!hidden && /^sample:\s*true\s*$/m.test(frontmatter)) {
            problems.push(`product "${folder.name}" still uses sample photos (sample: true)`);
          }
        }
        for (const file of await readdir(policiesDir)) {
          if (!file.endsWith('.md')) continue;
          if (/^draft:\s*true\s*$/m.test(await frontmatterOf(join(policiesDir, file)))) {
            problems.push(`policy "${file}" is still marked draft: true`);
          }
        }

        const settings = JSON.parse(await readFile(settingsFile, 'utf8'));
        if (settings.whatsappNumber === '910000000000') problems.push('the WhatsApp number is still the sample number');
        if (/@example\.com$/i.test(settings.email)) problems.push('the email address is still the sample address');
        if (/\.example\/?$/i.test(settings.url)) problems.push('the website address is still the sample address');
        for (const [name, photo] of Object.entries(settings.sitePhotos ?? {}) as [string, { sample?: boolean }][]) {
          if (photo.sample) problems.push(`the ${name} page photo is still a sample photo`);
        }

        if (problems.length > 0) {
          throw new Error(
            `The live site isn't ready to publish (fix these in the shop admin at /admin):\n- ${problems.join('\n- ')}`,
          );
        }
        logger.info('Launch checks passed.');
      },
    },
  };
}
