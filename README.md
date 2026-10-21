# Crochet shop website

**Live:** https://loopwork.leadspilot.co

A website for a handmade crochet shop. Customers browse pieces, fill a cart and send an order request; you confirm the order and take payment on WhatsApp. It's built with [Astro](https://astro.build) and deploys to Cloudflare Workers.

The plan, the page list and the order workflow are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> **Preview content.** The WhatsApp number, email, Instagram link, the 15 products and their photos are samples. The product photos come from Unsplash ([list](docs/sample-photos.md)). Replace them with your own before launch.

## Run it on your computer

```bash
npm install
npm run dev
```

Then open http://localhost:4321.

## Manage the shop

While `npm run dev` is running, open **http://localhost:4321/admin** (or click **Manage shop** in the corner of any page). From there you can:

- add products, change prices and stock status (ready to ship, made to order, sold out, hidden), and choose what's featured on the home page
- upload, reorder and describe product photos, and pick which part of each photo stays in view when it's cropped
- edit categories, FAQ answers, policies and shop settings (WhatsApp number, email, Instagram, shipping and payment text)
- replace the photos on the Home, About and Custom orders pages
- see what's left to do before launch under **Ready to publish**

Everything you save goes straight into the project files, so the shop at localhost:4321 updates right away. The live website only changes when you deploy. The admin exists only on your computer and is never part of the published site.

Nothing is deleted outright: removed products and photos are moved to the `.trash` folder, so you can put them back.

## Everyday changes (without the admin)

| To… | Edit |
| --- | --- |
| Set the shop name, WhatsApp number, email, Instagram, shipping and payment text | `src/site.config.ts` |
| Add a product | Make a folder `src/content/products/<product-id>/` with an `index.md` and the product's photos |
| Sell out, pause or re-list a product | Change `status:` in the product's `index.md` |
| Add or rename a category | `src/content/categories.yaml` |
| Change FAQ answers | `src/content/faq.yaml` |
| Change policies | `src/content/policies/*.md`, and remove `draft: true` when the wording is final |
| Change the hero, About and Custom orders photos | `src/assets/site/` |

The `<product-id>` folder name becomes the page address, for example `/shop/carrot-bunny/`.

### A product file

```yaml
---
name: Carrot Bunny
summary: A snuggly cream bunny with peach ears and paws, holding its very own crochet carrot.
price: 899                   # in rupees
category: amigurumi          # an id from categories.yaml
status: available            # available | made-to-order | sold-out | hidden
leadTime: Ships in 2–3 days
options:                     # optional choices shown as buttons
  - name: Ears & paws
    values: [Peach, Blush pink, Lilac]
photos:                      # the first photo is the main one
  - src: ./carrot-bunny-1.jpg
    alt: Cream crochet bunny with peach ears holding an orange carrot
    focus: 50% 40%           # optional: which part to keep when the photo is cropped
size: About 18 cm tall, sitting
materials: Soft milk cotton yarn, polyester fibre filling, safety eyes
care: Spot clean with a damp cloth, or hand wash cold and dry flat.
careSymbols: [hand-wash, no-bleach, dry-flat, no-tumble-dry]
featured: true               # show on the home page
sortOrder: 10                # lower numbers appear first in the shop
---

The longer description goes here, in plain text or Markdown.
```

| Status | What customers see |
| --- | --- |
| `available` | "Ready to ship" with the lead time. Can be added to the cart. |
| `made-to-order` | "Made to order" with the lead time. Can be added to the cart. |
| `sold-out` | The page stays up with an **Ask for a custom one** button. Can't be ordered. |
| `hidden` | Removed from the site. Keep the folder to bring it back later. |

## How ordering works right now

1. Customers add pieces to the cart. The cart is saved in their browser.
2. On the cart page they add their details and press **Send order on WhatsApp**.
3. WhatsApp opens with the whole order and an order number such as `ORD-7K3QX`, addressed to the `whatsappNumber` in `src/site.config.ts`.

Round 2 adds the Cloudflare Worker and Make, so orders also land in a Google Sheet and trigger a WhatsApp alert (`orderMode: 'api'`).

## Sell this as a done-for-you shop

This project is also the demo you show to other handmade sellers.

- **Demo banner:** while `demo.enabled` is `true` in `src/data/settings.json`, every page shows a "Demo shop" bar that links to the sales page. Set it to `false` to go back to the normal preview banner.
- **One link for everyone:** `/sell` opens the ₹ page for visitors in India and the USD page for everyone else (`worker/index.js`, the only code that runs on Cloudflare; locally, `src/pages/sell.astro` guesses from the time zone).
- **Sales pages:** `/for-sellers/` for India (₹) and `/for-sellers/international/` for everyone else (US dollars, paid by PayPal invoice). Both use `src/components/SellerOffer.astro`; each page's copy is in `src/pages/for-sellers/`, and its plans, prices and add-ons in `src/data/offers/india.json` or `international.json`. Put your own WhatsApp number in `demo.sellerWhatsapp` (and optionally your name or studio name in `demo.sellerName`), or the **Chat on WhatsApp** buttons go nowhere. Open a page and use **Print → Save as PDF** for a handout to send on WhatsApp; the current ones are `docs/for-sellers.pdf` and `docs/for-sellers-international.pdf`.
- **A copy for a client:** run

  ```bash
  npm run starter -- "C:\Clients\their-shop"
  ```

  It copies the shop without the demo banner, the sales page, `docs/` or any Unsplash photo (each one becomes a placeholder of the same size), and resets the contact details. Then `npm install`, `npm run dev`, and set the shop up in `/admin` with the client's name, products and photos. The logo in `src/components/Logo.astro` is drawn for "Loopwork", so make a new one for each client.

## Build and deploy

```bash
npm run build
```

```bash
npx astro check
```

The built site is in `dist/`. Deploying needs your Cloudflare account (Round 2). Set `SHOP_ENV=production` for the live build: it stops with a list of what's left while any product still has `sample: true` or any policy still has `draft: true`.
