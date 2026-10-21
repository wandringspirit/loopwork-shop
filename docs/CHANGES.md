# Changes

A plain-language record of what changed in the Loopwork shop (`C:\Projects\Crochet Website`, live at https://loopwork.leadspilot.co) and when. The reasons behind the design live in the other files in `docs/`; this file is the dated log.

**Adding an entry:** put it under today's date at the top (add the heading if it's missing), one bullet per change, with the short commit hash once committed. Start each line with **Site**, **Sales**, **Starter**, **Infra**, **Docs** or **Fix**. When a deploy goes out, add a **Deployed** line with the Cloudflare version ID and the version to roll back to.

Newest first. Dates are IST.

---

## 2026-10-21

- **Docs:** Added CHANGES, DEPLOY, OUTREACH (how to find and close buyers) and ROADMAP. ARCHITECTURE.md moved to v0.3.
- **Sales:** Added `/for-sellers/international/`, a sales page for sellers outside India, priced in US dollars and paid by PayPal invoice. Both sales pages now share `src/components/SellerOffer.astro`, link to each other and declare `hreflang` alternates. Prices moved to `src/data/offers/india.json` and `international.json`. Added the handout `docs/for-sellers-international.pdf`.
- **Sales:** The WhatsApp number and demo address in the printed handout are now links. `be6941e`
- **Infra:** `wrangler.jsonc` now deploys the Worker `loopwork-demo` on the Cloudflare account that owns leadspilot.co, with loopwork.leadspilot.co as its custom domain. `npm run starter` resets the name, account and route for client copies. `be6941e`
- **Deployed:** version `7a78775a-4c08-4f30-9663-53064b5ee0a1` (roll back to `6002c65b-d0b5-4a86-872b-0283b83b411e`).
- **Sales:** Put the owner's WhatsApp number (+91 95998 98481) on the sales page and handout. `2828ee2`
- **Site:** The home page hero works on phones: the photo comes first, the heading and intro are smaller, and the selling points sit on one line each (the hero went from 1224 px to 869 px tall at 412 px wide). `--text-lg` now scales down on small screens. `4505843`
- **Sales:** Added the demo banner, the `/for-sellers/` sales page with plans, add-ons (including Razorpay/PayPal/Stripe checkout) and a printable two-page handout (`docs/for-sellers.pdf`). `4505843`
- **Starter:** Added `npm run starter -- <folder>`, which copies the shop for a client without the demo banner, the sales pages, `docs/` or any Unsplash photo (each becomes a same-size placeholder), and resets the contact details. `4505843`
- **Infra:** The project became a git repository (`main`). `4505843`

## 2026-10-21 (about 01:15)

- **Deployed:** version `6002c65b-d0b5-4a86-872b-0283b83b411e` to the new Worker `loopwork-demo` at loopwork.leadspilot.co, from another session (Round 1 site with the Preview banner).

## 2026-09-14

- **Site:** Added the yarn colour palette (berry, coral, marigold, mint, teal, lilac), coloured bands, scalloped edges and a colour per category.

## 2026-09-13

- **Site:** Round 1 built: Astro static site, 15 sample products, cart, ordering through WhatsApp, policies, FAQ and the local admin at `/admin`. The shop was named Loopwork, with a logo and favicon.
