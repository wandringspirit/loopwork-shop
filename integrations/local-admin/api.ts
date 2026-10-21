import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { parse, stringify } from 'yaml';

// Don't let sharp hold files open (Windows can't move or replace files that are open).
sharp.cache(false);

type Json = Record<string, any>;
type Context = { req: IncomingMessage; res: ServerResponse };
type Handler = (context: Context, ...params: string[]) => Promise<unknown>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const STATUSES = ['available', 'made-to-order', 'sold-out', 'hidden'];
const CARE_SYMBOLS = ['hand-wash', 'machine-wash-cold', 'no-bleach', 'dry-flat', 'no-tumble-dry', 'no-iron'];
const FAQ_GROUPS = ['Ordering', 'Payment', 'Shipping', 'Custom orders', 'Care', 'Returns'];
const YARN_COLOURS = ['berry', 'coral', 'marigold', 'mint', 'teal', 'lilac'];
const SITE_PHOTOS = ['hero', 'about', 'custom'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_FILE = /^[a-z0-9-]+\.(?:jpe?g|png|webp)$/;
const UPLOAD_LIMIT = 25 * 1024 * 1024;
const SAMPLE_WHATSAPP = '910000000000';
const PLACEHOLDER_PHOTO = 'placeholder.jpg';

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');

const wholeRupees = (value: unknown, message: string) => {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, message);
  return amount;
};

function isLocalHost(host: string | undefined) {
  if (!host) return false;
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

/** Only this computer may use the admin, and changes must come from the admin page itself. */
function guard(req: IncomingMessage) {
  if (!isLocalHost(req.headers.host)) throw new HttpError(403, 'The shop admin only works on this computer.');
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.origin;
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    originHost = undefined;
  }
  if (!isLocalHost(originHost)) throw new HttpError(403, 'Blocked a change that didn’t come from the admin page.');
}

async function readBody(req: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'That file is too big. Photos can be up to 25 MB.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<any> {
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
    throw new HttpError(415, 'Expected JSON.');
  }
  try {
    return JSON.parse((await readBody(req, 2_000_000)).toString('utf8'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'That request wasn’t valid JSON.');
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function splitFrontmatter(source: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new HttpError(500, 'A content file is missing its frontmatter.');
  return { data: (parse(match[1]) ?? {}) as Json, body: match[2].replace(/^\s*\n/, '') };
}

const joinFrontmatter = (data: Json, body: string) => `---\n${stringify(data, { lineWidth: 0 })}---\n\n${body.trim()}\n`;

const toJpeg = (bytes: Buffer, maxSize: number) =>
  sharp(bytes)
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer()
    .catch(() => {
      throw new HttpError(415, 'That file isn’t a photo the admin can read. Use JPG, PNG or WebP (convert iPhone HEIC photos first).');
    });

const PLACEHOLDER_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#e8eae2"/>' +
    '<g fill="none" stroke="#b7bbb0" stroke-width="24"><ellipse cx="520" cy="690" rx="170" ry="160" transform="rotate(-12 520 690)"/>' +
    '<ellipse cx="680" cy="690" rx="170" ry="160" transform="rotate(-12 680 690)"/></g>' +
    '<text x="600" y="1000" text-anchor="middle" font-family="Arial, sans-serif" font-size="60" fill="#646a79">Photo coming soon</text></svg>',
);

export function createAdminApi(root: string) {
  const dirs = {
    products: join(root, 'src/content/products'),
    policies: join(root, 'src/content/policies'),
    sitePhotos: join(root, 'src/assets/site'),
    trash: join(root, '.trash'),
  };
  const files = {
    categories: join(root, 'src/content/categories.yaml'),
    faq: join(root, 'src/content/faq.yaml'),
    settings: join(root, 'src/data/settings.json'),
  };

  // Write to a temporary file, then swap it in, so the dev server never reads a half-written file.
  async function writeAtomic(file: string, contents: string | Buffer) {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, contents);
    await rename(temp, file);
  }

  // Nothing is deleted outright: removed products and photos go to .trash/ in the project.
  async function moveToTrash(path: string, label: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = join(dirs.trash, `${stamp}_${label}`);
    await mkdir(dirs.trash, { recursive: true });
    try {
      await rename(path, target);
    } catch {
      await cp(path, target, { recursive: true });
      await rm(path, { recursive: true, force: true });
    }
  }

  // ---------- Products ----------
  const productDir = (id: string) => {
    if (!SLUG.test(id)) throw new HttpError(400, 'That product address isn’t valid.');
    return join(dirs.products, id);
  };

  async function readProduct(id: string): Promise<Json> {
    const file = join(productDir(id), 'index.md');
    if (!existsSync(file)) throw new HttpError(404, 'That product doesn’t exist.');
    const { data, body } = splitFrontmatter(await readFile(file, 'utf8'));
    return { id, ...data, body };
  }

  async function listProducts() {
    const entries = await readdir(dirs.products, { withFileTypes: true });
    const ids = entries
      .filter((entry) => entry.isDirectory() && SLUG.test(entry.name) && existsSync(join(dirs.products, entry.name, 'index.md')))
      .map((entry) => entry.name);
    const products = await Promise.all(ids.map(readProduct));
    return products.sort(
      (a, b) => (Number(a.sortOrder) || 100) - (Number(b.sortOrder) || 100) || String(a.name).localeCompare(String(b.name)),
    );
  }

  const writeProduct = (id: string, data: Json, body: string) =>
    writeAtomic(join(productDir(id), 'index.md'), joinFrontmatter(data, body));

  const withoutMeta = ({ id: _id, body, ...data }: Json) => ({ data, body: String(body ?? '') });

  function cleanProduct(input: Json, id: string, categoryIds: string[]) {
    const name = text(input.name);
    if (name.length < 2 || name.length > 60) throw new HttpError(400, 'The name should be 2 to 60 characters.');
    const summary = text(input.summary);
    if (summary.length < 10 || summary.length > 180) throw new HttpError(400, 'The short summary should be 10 to 180 characters.');
    const price = wholeRupees(input.price, 'Enter the price in whole rupees, like 899.');
    const category = text(input.category);
    if (!categoryIds.includes(category)) throw new HttpError(400, 'Choose a category.');
    const status = text(input.status);
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Choose a status.');
    const materials = text(input.materials);
    if (!materials) throw new HttpError(400, 'Add the yarn or materials.');
    const care = text(input.care);
    if (!care) throw new HttpError(400, 'Add care instructions.');

    const photos = (Array.isArray(input.photos) ? input.photos : []).map((photo: Json) => {
      const src = text(photo.src);
      const file = src.replace(/^\.\//, '');
      if (!PHOTO_FILE.test(file) || !existsSync(join(productDir(id), file))) {
        throw new HttpError(400, `The photo ${file || '(unnamed)'} is missing. Reload the page and try again.`);
      }
      const alt = text(photo.alt);
      if (alt.length < 5) throw new HttpError(400, 'Describe every photo in a few words (at least 5 characters).');
      const clean: Json = { src: `./${file}`, alt };
      const focus = text(photo.focus);
      if (/^\d{1,3}% \d{1,3}%$/.test(focus) && focus !== '50% 50%') clean.focus = focus;
      return clean;
    });
    if (photos.length === 0) throw new HttpError(400, 'Add at least one photo.');

    const options = (Array.isArray(input.options) ? input.options : [])
      .map((option: Json) => ({
        name: text(option.name),
        values: (Array.isArray(option.values) ? option.values : []).map(text).filter(Boolean),
      }))
      .filter((option: Json) => option.name && option.values.length > 0);
    const careSymbols = (Array.isArray(input.careSymbols) ? input.careSymbols : []).filter((symbol: string) =>
      CARE_SYMBOLS.includes(symbol),
    );
    const sortOrder = Number(input.sortOrder);

    const data: Json = { name, summary, price, category, status };
    if (text(input.leadTime)) data.leadTime = text(input.leadTime);
    if (options.length > 0) data.options = options;
    data.photos = photos;
    if (text(input.size)) data.size = text(input.size);
    data.materials = materials;
    data.care = care;
    if (careSymbols.length > 0) data.careSymbols = careSymbols;
    if (input.featured) data.featured = true;
    data.sortOrder = Number.isFinite(sortOrder) ? Math.round(sortOrder) : 100;
    if (input.sample) data.sample = true;
    return { data, body: typeof input.body === 'string' ? input.body : '' };
  }

  async function createProduct({ req }: Context) {
    const input = await readJson(req);
    const name = text(input.name);
    if (name.length < 2 || name.length > 60) throw new HttpError(400, 'Give the product a name (2 to 60 characters).');
    const price = wholeRupees(input.price, 'Enter the price in whole rupees, like 899.');
    const category = text(input.category);
    if (!(await readCategories()).some((entry) => entry.id === category)) throw new HttpError(400, 'Choose a category.');

    const base = slugify(name) || 'product';
    let id = base;
    for (let n = 2; existsSync(join(dirs.products, id)); n += 1) id = `${base}-${n}`;
    const products = await listProducts();

    await mkdir(productDir(id), { recursive: true });
    await writeAtomic(join(productDir(id), PLACEHOLDER_PHOTO), await sharp(PLACEHOLDER_SVG).jpeg({ quality: 80 }).toBuffer());
    // New products start hidden with a placeholder photo, so nothing half-finished shows in the shop.
    await writeProduct(
      id,
      {
        name,
        summary: `${name}, crocheted by hand.`,
        price,
        category,
        status: 'hidden',
        photos: [{ src: `./${PLACEHOLDER_PHOTO}`, alt: `Photo of ${name} coming soon` }],
        materials: 'Cotton yarn',
        care: 'Hand wash cold and dry flat.',
        careSymbols: ['hand-wash', 'dry-flat'],
        sortOrder: Math.max(0, ...products.map((product) => Number(product.sortOrder) || 0)) + 10,
        sample: true,
      },
      'Describe the piece here: what makes it special, the colours, and who it’s for.',
    );
    return readProduct(id);
  }

  async function saveProduct({ req }: Context, id: string) {
    await readProduct(id);
    const input = await readJson(req);
    const categoryIds = (await readCategories()).map((entry) => String(entry.id));
    const { data, body } = cleanProduct(input, id, categoryIds);
    await writeProduct(id, data, body);
    return readProduct(id);
  }

  async function patchProduct({ req }: Context, id: string) {
    const { data, body } = withoutMeta(await readProduct(id));
    const input = await readJson(req);
    if ('status' in input) {
      if (!STATUSES.includes(input.status)) throw new HttpError(400, 'Choose a status.');
      data.status = input.status;
    }
    if ('featured' in input) {
      if (input.featured) data.featured = true;
      else delete data.featured;
    }
    if ('price' in input) data.price = wholeRupees(input.price, 'Enter the price in whole rupees, like 899.');
    await writeProduct(id, data, body);
    return readProduct(id);
  }

  async function deleteProduct(_context: Context, id: string) {
    await readProduct(id);
    await moveToTrash(productDir(id), `product-${id}`);
    return { ok: true };
  }

  async function uploadPhoto({ req }: Context, id: string) {
    const { data, body } = withoutMeta(await readProduct(id));
    const bytes = await readBody(req, UPLOAD_LIMIT);
    if (bytes.length === 0) throw new HttpError(400, 'That file is empty.');
    const jpeg = await toJpeg(bytes, 2000);

    const existing = new Set(await readdir(productDir(id)));
    let n = 1;
    while (existing.has(`${id}-${n}.jpg`)) n += 1;
    const file = `${id}-${n}.jpg`;
    await writeAtomic(join(productDir(id), file), jpeg);

    const photos = [...((data.photos as Json[]) ?? []), { src: `./${file}`, alt: `Photo of ${data.name}` }];
    const hadPlaceholder = photos.some((photo) => photo.src === `./${PLACEHOLDER_PHOTO}`);
    data.photos = photos.filter((photo) => photo.src !== `./${PLACEHOLDER_PHOTO}`);
    if (hadPlaceholder) delete data.sample;
    await writeProduct(id, data, body);
    if (hadPlaceholder) await moveToTrash(join(productDir(id), PLACEHOLDER_PHOTO), `${id}-${PLACEHOLDER_PHOTO}`).catch(() => {});
    return readProduct(id);
  }

  async function deletePhoto(_context: Context, id: string, file: string) {
    const { data, body } = withoutMeta(await readProduct(id));
    const photos = (data.photos as Json[]) ?? [];
    const remaining = photos.filter((photo) => photo.src !== `./${file}`);
    if (remaining.length === photos.length) throw new HttpError(404, 'That photo isn’t on this product.');
    if (remaining.length === 0) throw new HttpError(400, 'A product needs at least one photo. Add another photo first.');
    data.photos = remaining;
    await writeProduct(id, data, body);
    await moveToTrash(join(productDir(id), file), `${id}-${file}`).catch(() => {});
    return readProduct(id);
  }

  async function sendImage({ req, res }: Context, path: string) {
    if (!existsSync(path)) throw new HttpError(404, 'Photo not found.');
    const width = Number(new URL(req.url ?? '/', 'http://localhost').searchParams.get('w')) || 0;
    const output =
      width > 0
        ? await sharp(path).rotate().resize({ width: Math.min(width, 1600), withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
        : await readFile(path);
    res.writeHead(200, { 'Content-Type': width > 0 ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'no-store' });
    res.end(output);
  }

  const servePhoto = (context: Context, id: string, file: string) => sendImage(context, join(productDir(id), file));

  // ---------- Categories and FAQ ----------
  const readCategories = async () => ((parse(await readFile(files.categories, 'utf8')) ?? []) as Json[]);
  const readFaq = async () => ((parse(await readFile(files.faq, 'utf8')) ?? []) as Json[]);

  async function saveCategories({ req }: Context) {
    const input = await readJson(req);
    if (!Array.isArray(input)) throw new HttpError(400, 'Expected a list of categories.');
    const products = await listProducts();
    const seen = new Set<string>();
    const categories = input.map((raw: Json, index: number) => {
      const name = text(raw.name);
      if (!name) throw new HttpError(400, 'Every category needs a name.');
      const id = text(raw.id) || slugify(name);
      if (!SLUG.test(id)) throw new HttpError(400, `Use letters or numbers in the name “${name}”.`);
      if (seen.has(id)) throw new HttpError(400, `There are two categories called “${name}”.`);
      seen.add(id);
      const category: Json = { id, name, description: text(raw.description) || name, order: index + 1 };
      const colour = text(raw.colour);
      if (colour && !YARN_COLOURS.includes(colour)) throw new HttpError(400, `Choose a colour for “${name}”.`);
      if (colour) category.colour = colour;
      const cover = text(raw.coverProduct);
      if (cover && products.some((product) => product.id === cover)) category.coverProduct = cover;
      return category;
    });
    const stranded = products.filter((product) => !seen.has(String(product.category)));
    if (stranded.length > 0) {
      throw new HttpError(400, `Move these products to another category first: ${stranded.map((product) => product.name).join(', ')}.`);
    }
    await writeAtomic(
      files.categories,
      `# Shop categories, in the order they appear. Products refer to these by id.\n# colour is one of: ${YARN_COLOURS.join(', ')}.\n${stringify(categories, { lineWidth: 0 })}`,
    );
    return readCategories();
  }

  async function saveFaq({ req }: Context) {
    const input = await readJson(req);
    if (!Array.isArray(input)) throw new HttpError(400, 'Expected a list of questions.');
    const seen = new Set<string>();
    const items = input.map((raw: Json) => {
      const question = text(raw.question);
      const answer = text(raw.answer);
      if (!question || !answer) throw new HttpError(400, 'Every FAQ needs a question and an answer.');
      if (!FAQ_GROUPS.includes(raw.group)) throw new HttpError(400, `Choose a topic for “${question}”.`);
      const base = text(raw.id) || slugify(question).slice(0, 40).replace(/-+$/, '') || 'question';
      let id = base;
      for (let n = 2; seen.has(id); n += 1) id = `${base}-${n}`;
      seen.add(id);
      const item: Json = { id, group: raw.group, question, answer };
      if (raw.onHome) item.onHome = true;
      return item;
    });
    await writeAtomic(files.faq, stringify(items, { lineWidth: 0 }));
    return readFaq();
  }

  // ---------- Policies ----------
  async function listPolicies() {
    const names = (await readdir(dirs.policies)).filter((name) => name.endsWith('.md'));
    return Promise.all(
      names.map(async (name) => {
        const { data, body } = splitFrontmatter(await readFile(join(dirs.policies, name), 'utf8'));
        return { id: name.replace(/\.md$/, ''), ...data, updated: String(data.updated ?? ''), body } as Json;
      }),
    );
  }

  async function savePolicy({ req }: Context, id: string) {
    if (!SLUG.test(id) || !existsSync(join(dirs.policies, `${id}.md`))) throw new HttpError(404, 'That policy doesn’t exist.');
    const input = await readJson(req);
    const title = text(input.title);
    const summary = text(input.summary);
    if (!title || !summary) throw new HttpError(400, 'Add a title and a short summary.');
    const data: Json = { title, summary, updated: new Date().toISOString().slice(0, 10) };
    if (input.draft) data.draft = true;
    await writeAtomic(join(dirs.policies, `${id}.md`), joinFrontmatter(data, String(input.body ?? '')));
    return (await listPolicies()).find((policy) => policy.id === id);
  }

  // ---------- Settings and site photos ----------
  const readSettings = async () => JSON.parse(await readFile(files.settings, 'utf8')) as Json;
  const writeSettings = (settings: Json) => writeAtomic(files.settings, `${JSON.stringify(settings, null, 2)}\n`);

  async function saveSettings({ req }: Context) {
    const current = await readSettings();
    const input = await readJson(req);
    const required = (value: unknown, label: string) => {
      const clean = text(value);
      if (!clean) throw new HttpError(400, `Add ${label}.`);
      return clean;
    };

    const url = required(input.url, 'your website address').replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(url)) throw new HttpError(400, 'The website address should look like https://yourshop.in');
    const whatsappNumber = text(input.whatsappNumber).replace(/\D/g, '');
    if (!/^\d{11,13}$/.test(whatsappNumber)) {
      throw new HttpError(400, 'Enter the WhatsApp number with its country code, digits only, like 919876543210.');
    }
    const email = required(input.email, 'an email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Check the email address.');
    const orderIdPrefix = text(input.orderIdPrefix).toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(orderIdPrefix)) throw new HttpError(400, 'The order number prefix should be 2 to 5 letters, like ORD.');
    const maxQtyPerItem = Number(input.maxQtyPerItem);
    if (!Number.isInteger(maxQtyPerItem) || maxQtyPerItem < 1 || maxQtyPerItem > 50) {
      throw new HttpError(400, 'The most of one piece per order should be between 1 and 50.');
    }

    const next: Json = {
      ...current,
      name: required(input.name, 'the shop name'),
      tagline: required(input.tagline, 'a tagline'),
      description: required(input.description, 'a short description'),
      url,
      whatsappNumber,
      email,
      instagramUrl: required(input.instagramUrl, 'your Instagram link'),
      instagramHandle: required(input.instagramHandle, 'your Instagram handle'),
      payment: required(input.payment, 'how customers pay'),
      replyTime: required(input.replyTime, 'how quickly you usually reply'),
      orderIdPrefix,
      maxQtyPerItem,
      shipping: {
        area: required(input.shipping?.area, 'where you ship'),
        dispatch: required(input.shipping?.dispatch, 'when orders are sent'),
        transit: required(input.shipping?.transit, 'how long delivery takes'),
        charges: required(input.shipping?.charges, 'how shipping is charged'),
      },
      pickup: { enabled: Boolean(input.pickup?.enabled), note: text(input.pickup?.note) || current.pickup.note },
      sitePhotos: Object.fromEntries(
        SITE_PHOTOS.map((key) => [
          key,
          { alt: text(input.sitePhotos?.[key]?.alt) || current.sitePhotos[key].alt, sample: Boolean(current.sitePhotos[key].sample) },
        ]),
      ),
    };
    await writeSettings(next);
    return next;
  }

  const sitePhotoPath = (name: string) => join(dirs.sitePhotos, `${name}.jpg`);
  const serveSitePhoto = (context: Context, name: string) => sendImage(context, sitePhotoPath(name));

  async function uploadSitePhoto({ req }: Context, name: string) {
    const jpeg = await toJpeg(await readBody(req, UPLOAD_LIMIT), 2400);
    const target = sitePhotoPath(name);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await mkdir(dirs.trash, { recursive: true });
    await copyFile(target, join(dirs.trash, `${stamp}_site-${name}.jpg`)).catch(() => {});
    await writeAtomic(target, jpeg);
    const settings = await readSettings();
    settings.sitePhotos[name].sample = false;
    await writeSettings(settings);
    return settings;
  }

  // ---------- Launch checklist ----------
  function launchChecks(settings: Json, products: Json[], policies: Json[]) {
    const listed = products.filter((product) => product.status !== 'hidden');
    const sampleProducts = listed.filter((product) => product.sample);
    const sampleSitePhotos = SITE_PHOTOS.filter((key) => settings.sitePhotos?.[key]?.sample);
    const draftPolicies = policies.filter((policy) => policy.draft);
    const host = (() => {
      try {
        return new URL(settings.url).hostname;
      } catch {
        return '';
      }
    })();
    const photoNames: Record<string, string> = { hero: 'Home', about: 'About', custom: 'Custom orders' };
    return [
      {
        id: 'product-photos',
        ok: sampleProducts.length === 0,
        label: 'Product photos are your own',
        detail: sampleProducts.length
          ? `Still using sample photos: ${sampleProducts.map((product) => product.name).join(', ')}.`
          : 'No sample product photos left in the shop.',
        target: 'products',
      },
      {
        id: 'site-photos',
        ok: sampleSitePhotos.length === 0,
        label: 'Page photos are your own',
        detail: sampleSitePhotos.length
          ? `Still sample photos on: ${sampleSitePhotos.map((key) => photoNames[key]).join(', ')}.`
          : 'Home, About and Custom orders use your photos.',
        target: 'site-photos',
      },
      {
        id: 'whatsapp',
        ok: settings.whatsappNumber !== SAMPLE_WHATSAPP && /^\d{11,13}$/.test(settings.whatsappNumber),
        label: 'Orders go to your WhatsApp number',
        detail: settings.whatsappNumber === SAMPLE_WHATSAPP ? 'Still the sample number, so orders would go nowhere.' : `Orders go to +${settings.whatsappNumber}.`,
        target: 'settings',
      },
      {
        id: 'contact',
        ok: !/@example\.com$/i.test(settings.email) && !/instagram\.com\/?$/i.test(settings.instagramUrl),
        label: 'Email and Instagram are yours',
        detail: 'Customers see these on the Contact page and in the footer.',
        target: 'settings',
      },
      {
        id: 'domain',
        ok: Boolean(host) && !host.endsWith('.example'),
        label: 'Website address is set',
        detail: host.endsWith('.example') ? 'Still the sample address. Link previews on WhatsApp need your real domain.' : `Set to ${settings.url}.`,
        target: 'settings',
      },
      {
        id: 'policies',
        ok: draftPolicies.length === 0,
        label: 'Policies are final',
        detail: draftPolicies.length ? `Still drafts: ${draftPolicies.map((policy) => policy.title).join(', ')}.` : 'All policies are final.',
        target: 'policies',
      },
    ];
  }

  async function overview() {
    const [settings, categories, products, faq, policies] = await Promise.all([
      readSettings(),
      readCategories(),
      listProducts(),
      readFaq(),
      listPolicies(),
    ]);
    return { settings, categories, products, faq, policies, checks: launchChecks(settings, products, policies) };
  }

  const routes: [string, RegExp, Handler][] = [
    ['GET', /^\/overview$/, overview],
    ['POST', /^\/products$/, createProduct],
    ['PUT', /^\/products\/([a-z0-9-]+)$/, saveProduct],
    ['PATCH', /^\/products\/([a-z0-9-]+)$/, patchProduct],
    ['DELETE', /^\/products\/([a-z0-9-]+)$/, deleteProduct],
    ['POST', /^\/products\/([a-z0-9-]+)\/photos$/, uploadPhoto],
    ['GET', /^\/products\/([a-z0-9-]+)\/photos\/([a-z0-9-]+\.(?:jpe?g|png|webp))$/, servePhoto],
    ['DELETE', /^\/products\/([a-z0-9-]+)\/photos\/([a-z0-9-]+\.(?:jpe?g|png|webp))$/, deletePhoto],
    ['PUT', /^\/categories$/, saveCategories],
    ['PUT', /^\/faq$/, saveFaq],
    ['PUT', /^\/policies\/([a-z0-9-]+)$/, savePolicy],
    ['PUT', /^\/settings$/, saveSettings],
    ['GET', /^\/site-photos\/(hero|about|custom)$/, serveSitePhoto],
    ['POST', /^\/site-photos\/(hero|about|custom)$/, uploadSitePhoto],
  ];

  return async function adminApi(req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const route = routes.find(([method, pattern]) => method === req.method && pattern.test(pathname));
    if (!route) {
      if (routes.some(([, pattern]) => pattern.test(pathname))) return sendJson(res, 405, { error: 'That action isn’t allowed here.' });
      return next();
    }
    try {
      guard(req);
      const params = route[1].exec(pathname)?.slice(1) ?? [];
      const result = await route[2]({ req, res }, ...params);
      if (!res.headersSent) sendJson(res, 200, result);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('[shop admin]', error);
      if (!res.headersSent) {
        sendJson(res, error instanceof HttpError ? error.status : 500, {
          error: error instanceof HttpError ? error.message : 'Something went wrong. The terminal running npm run dev has the details.',
        });
      }
    }
  };
}
