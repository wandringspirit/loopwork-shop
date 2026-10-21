#!/usr/bin/env node
// Makes a clean copy of the shop to build a client's site from:
//   npm run starter -- "C:\Clients\priya-crafts"
// (default: release/loopwork-starter). The copy leaves out the demo banner and the /for-sellers
// sales page, swaps every sample (Unsplash) photo for a plain placeholder of the same size, and
// resets the contact details, so nothing in it belongs to Unsplash or to you.

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const force = args.includes('--force');
const out = resolve(root, args.find((arg) => !arg.startsWith('--')) ?? 'release/loopwork-starter');

/** Paths (relative to the project) that never go into a client's copy. */
const SKIP = new Set([
  '.git',
  '.astro',
  '.claude',
  '.trash',
  '.wrangler',
  'dist',
  'docs',
  'node_modules',
  'release',
  // secrets: a Cloudflare API token here must never reach a client
  '.env',
  '.dev.vars',
  'src/pages/for-sellers',
  'worker',
  'src/data/offers',
  'src/components/DemoBanner.astro',
  'src/components/SellerOffer.astro',
  'scripts',
]);

const PHOTO = /\.(jpe?g|png|webp)$/i;
const SOFT_COLOURS = ['#fad6e6', '#fcdac9', '#fbe7ae', '#cdeedb', '#c8eae8', '#e3d8f6'];
const DEEP_COLOURS = ['#7c2149', '#a23c1f', '#855400', '#2a6b4b', '#1b666c', '#6346a3'];

const escapeXml = (text) => text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Overwrites a photo with a flat placeholder of the same size and format. */
async function placeholder(file, label, index) {
  const { width = 1200, height = 1500, format } = await sharp(file).metadata();
  const size = Math.round(Math.min(width, height) / 14);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${SOFT_COLOURS[index % 6]}"/>
    <text x="50%" y="50%" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif"
      font-size="${size}" font-weight="700" fill="${DEEP_COLOURS[index % 6]}">
      <tspan x="50%" dy="-0.3em">${escapeXml(label)}</tspan>
      <tspan x="50%" dy="1.4em" font-weight="400" font-size="${Math.round(size * 0.7)}">Add your photo</tspan>
    </text>
  </svg>`;
  const image = sharp(Buffer.from(svg));
  const buffer = await (format === 'png' ? image.png() : format === 'webp' ? image.webp() : image.jpeg({ quality: 80 })).toBuffer();
  await writeFile(file, buffer);
}

if (out === root || (out.startsWith(root + sep) && !relative(root, out).startsWith('release'))) {
  console.error('Make the copy outside this project (or inside release/).');
  process.exit(1);
}
if (existsSync(out) && (await readdir(out)).length > 0) {
  if (!force) {
    console.error(`${out} already has files in it. Pick an empty folder, or add --force to replace it.`);
    process.exit(1);
  }
  await rm(out, { recursive: true, force: true });
}

await mkdir(out, { recursive: true });
/** Secret files anywhere in the tree (.env, .env.production, .dev.vars…), but not *.example templates. */
const SECRET = /^\.(env|dev\.vars)(\..+)?$/;
const keep = (source) => {
  const name = basename(source);
  if (SECRET.test(name) && !name.endsWith('.example')) return false;
  return !SKIP.has(relative(root, source).split(sep).join('/'));
};
// Copied one top-level entry at a time: Node won't copy a folder into its own release/ subfolder.
for (const entry of await readdir(root)) {
  const source = join(root, entry);
  if (keep(source)) await cp(source, join(out, entry), { recursive: true, filter: keep });
}

// Sample product photos → placeholders. `sample: true` stays, so a production build still
// refuses until the client's own photos are in.
const productsDir = join(out, 'src/content/products');
let swapped = 0;
const folders = (await readdir(productsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
for (const [index, folder] of folders.entries()) {
  const dir = join(productsDir, folder.name);
  const markdown = await readFile(join(dir, 'index.md'), 'utf8').catch(() => '');
  if (!/^sample:\s*true\s*$/m.test(markdown)) continue;
  const name = markdown.match(/^name:\s*(.+)$/m)?.[1].trim() ?? folder.name;
  for (const file of await readdir(dir)) {
    if (!PHOTO.test(file)) continue;
    await placeholder(join(dir, file), name, index);
    swapped++;
  }
}

// Settings: no demo section, contact details back to the samples the launch checks look for.
const settingsFile = join(out, 'src/data/settings.json');
const settings = JSON.parse(await readFile(settingsFile, 'utf8'));
Object.assign(settings, {
  url: 'https://yourshop.example',
  whatsappNumber: '910000000000',
  email: 'hello@example.com',
  instagramUrl: 'https://www.instagram.com/',
});
delete settings.demo;

// Sample page photos (hero, About, Custom orders) → placeholders.
const sitePhotosDir = join(out, 'src/assets/site');
for (const [index, [key, photo]] of Object.entries(settings.sitePhotos ?? {}).entries()) {
  if (!photo.sample) continue;
  for (const file of await readdir(sitePhotosDir)) {
    if (PHOTO.test(file) && basename(file).split('.')[0] === key) {
      await placeholder(join(sitePhotosDir, file), `${key[0].toUpperCase()}${key.slice(1)} photo`, index);
      swapped++;
    }
  }
}
await writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);

// Layout: the demo banner is gone, so only the preview banner remains.
const layoutFile = join(out, 'src/layouts/BaseLayout.astro');
const layout = (await readFile(layoutFile, 'utf8'))
  .replace(/^import DemoBanner .*\r?\n/m, '')
  .replace('{site.demo?.enabled ? <DemoBanner /> : previewMode && <PreviewBanner />}', '{previewMode && <PreviewBanner />}');
if (layout.includes('DemoBanner')) throw new Error('Couldn’t remove the demo banner from BaseLayout.astro; update make-starter.mjs.');
await writeFile(layoutFile, layout);

// README: drop the lines that point at this demo and at files the copy doesn't include.
const readmeFile = join(out, 'README.md');
const readme = (await readFile(readmeFile, 'utf8'))
  .replace(/^\*\*Live:\*\*.*\n\n/m, '')
  .replace(/^The plan, the page list.*\n\n/m, '')
  .replace(
    /^> \*\*Preview content\.\*\*.*$/m,
    '> **Starter content.** The WhatsApp number, email, Instagram link and the 15 products are samples, and every photo is a placeholder. Replace them with the shop’s own before launch.',
  )
  .replace(/^## Sell this as a done-for-you shop[\s\S]*?(?=^## )/m, '');
await writeFile(readmeFile, readme);

// Wrangler: the demo's Worker name, Cloudflare account and domain belong to you, not the client.
const wranglerFile = join(out, 'wrangler.jsonc');
const wrangler = (await readFile(wranglerFile, 'utf8'))
  .replace(/"name": "[^"]*"/, '"name": "crochet-shop"')
  .replace(/^.*"account_id".*\r?\n/m, '')
  .replace(/^.*"routes".*\r?\n/m, '')
  .replace(/^\s*\/\/ (The demo shop|the Cloudflare account|Only \/for-sellers).*\r?\n/gm, '')
  // The /for-sellers/ Worker is only for the demo; a client's shop is static assets only.
  .replace(/^.*"(main|binding|run_worker_first)".*\r?\n/gm, '');
if (/account_id|leadspilot|run_worker_first|"main"/.test(wrangler)) throw new Error('Couldn’t reset wrangler.jsonc; update make-starter.mjs.');
await writeFile(wranglerFile, wrangler);

const pkgFile = join(out, 'package.json');
const pkg = JSON.parse(await readFile(pkgFile, 'utf8'));
delete pkg.scripts.starter;
await writeFile(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

const files = (await readdir(out, { recursive: true })).length;
console.log(`Starter copy ready: ${out}`);
console.log(`${files} files, ${swapped} sample photos replaced with placeholders.`);
console.log('Next: npm install, then npm run dev and open /admin to set the shop up.');
