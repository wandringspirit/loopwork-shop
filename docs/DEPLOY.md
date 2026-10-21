# Local development and deployment

## Local development

Requirements: Node 20 or newer (24 is installed) and npm. No Cloudflare account or API keys are needed to work locally.

```bash
npm install
npm run dev        # http://localhost:4321, with the shop admin at /admin
npm run check      # astro check: types and templates
npm run build      # static site in dist/
npm run preview    # serves dist/ the way it will be deployed
```

The admin at `/admin` only exists while `npm run dev` runs. It writes straight into the project files.

## The demo site (loopwork.leadspilot.co)

| | |
|---|---|
| Worker | `loopwork-demo` (static assets only, no Worker code yet) |
| Cloudflare account | the one that owns leadspilot.co: **leadpilot01@gmail.com**, account `53053160…` |
| Domain | `loopwork.leadspilot.co`, a custom domain on the Worker (`routes` in `wrangler.jsonc`) |
| Config | `wrangler.jsonc` |

Your other projects deploy to the piyushgaur17 account. Wrangler is signed in to one account at a time, so check before deploying:

```bash
npx wrangler whoami
```

If it doesn't show leadpilot01@gmail.com, sign in again (a browser tab opens; choose that account):

```bash
npx wrangler login
```

Then build and deploy:

```bash
npm run deploy
```

`npm run deploy` runs `astro build` and then `wrangler deploy`. Add a **Deployed** line to [CHANGES.md](CHANGES.md) with the new version ID and the previous one.

### Rolling back

```bash
npx wrangler deployments list
```

```bash
npx wrangler rollback <version-id>
```

### After deploying

- Open https://loopwork.leadspilot.co, `/for-sellers/` and `/for-sellers/international/` on a phone.
- If you changed prices or the seller number, make the handouts again (below).

## The sales handouts (PDF)

The PDFs are printed from the built site, so the photos load:

1. `npm run build`, then `npm run preview -- --port 4322`.
2. Print each page to PDF with headless Chrome:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf="docs/for-sellers.pdf" http://localhost:4322/for-sellers/
```

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf="docs/for-sellers-international.pdf" http://localhost:4322/for-sellers/international/
```

Each should be two pages. Or open the page in a browser and use **Print → Save as PDF**.

## A client's shop

1. Make their copy outside this project:

```bash
npm run starter -- "C:\Clients\their-shop"
```

2. In the new folder: `git init`, `npm install`, `npm run dev`, then set it up in `/admin` (name, WhatsApp, email, Instagram, products, photos, policies).
3. Make their logo (`src/components/Logo.astro` is drawn for "Loopwork").
4. Check that it's ready to launch:

```bash
SHOP_ENV=production npm run build
```

It refuses while any product still has sample photos, any policy is a draft or the contact details are samples.

5. Deploy to **the client's own Cloudflare account**: they create a free account and invite you, or you sign in to it with them on a call. Set `name` in `wrangler.jsonc` to their shop and add their domain under `routes` (`{ "pattern": "theirshop.com", "custom_domain": true }`). The domain must be on that same Cloudflare account.
6. Never deploy a client's shop to the leadpilot01 or piyushgaur17 account: the client should own their site, and it keeps your accounts out of their business.

## Running costs

| Item | Cost |
|---|---|
| Hosting (Workers static assets, free plan) | ₹0 / $0 |
| Domain | about ₹700–1,200 a year for .in or .com in India, about $10–20 a year abroad, paid by the client |
| Payments (if the checkout add-on is built) | the provider's fee per sale |
