# Roadmap

What's left to start selling done-for-you shops, in order. **Who** says whose move it is: **You** for things only the owner can do (accounts, payments, messages, approvals), **Claude** for code and content in this repo. Last updated **2026-10-21**.

## Now: start selling

| To do | Who | Details |
|---|---|---|
| Get PayPal fully verified | You | Needed before taking USD. Steps in the `paypal-india-merchant-operator` notes; escalate if it's in review for more than a week. Use Wise or a bank transfer for a first client in the meantime. |
| Confirm or change the prices | You | Suggested prices are in `src/data/offers/india.json` and `international.json`. Change them, then make the PDFs again ([DEPLOY.md](DEPLOY.md)). |
| Choose a name for the service | You | The sales pages say "Shop websites for handmade sellers". A name goes in `demo.sellerName` in `src/data/settings.json`. |
| Set up a business Instagram | You | Put loopwork.leadspilot.co/sell in the bio (it opens the ₹ or USD page by country), and post the demo shop. |
| Start the daily outreach | You | 20 personalised DMs a day, tracked in a sheet. Plan and messages in [OUTREACH.md](OUTREACH.md). |
| Point the demo's test orders at your WhatsApp | You / Claude | The shop's `whatsappNumber` is still the sample, so a prospect's test order goes nowhere. Set it in `/admin` and redeploy. |

## Before the first international client goes live

| To do | Who | Details |
|---|---|---|
| Support other countries in the shop | Claude | Currency and locale come from settings (today ₹ and `en-IN` are fixed in `src/site.config.ts`); phone check that accepts any country (today it only accepts Indian mobile numbers); postcode/ZIP instead of PIN code; wording such as "Made in India", "Ships across India" and the custom order budgets. |
| A demo in US dollars | Claude | International prospects currently see ₹ prices in the demo shop. Add a USD version of the demo, for example at a second address. |
| Orders by email | Claude | WhatsApp is less common in the US. Round 2's Worker (`/api/order`) can email or log orders as well. See [ARCHITECTURE.md](ARCHITECTURE.md). |

## When a client buys an add-on

| To do | Who | Details |
|---|---|---|
| Online checkout | Claude | Razorpay (India) or Stripe/PayPal (abroad), on the client's own payment account. Needs a small Worker to create payments and confirm them. Sold "from ₹3,999 / $199". |
| Order book in Google Sheets | Claude | The Round 2 Worker plus Make, as planned in [ARCHITECTURE.md](ARCHITECTURE.md) §6–8. |

## Later: once there are paying clients

| To do | Who | Details |
|---|---|---|
| Testimonials and client shops on the sales pages | Claude | After the first 3 clients agree. |
| An online admin for clients | Claude | Today the admin only runs on a computer, which is why the care plan exists. A hosted one would let clients edit products themselves. |
| A short demo video | You / Claude | A 30-second phone screen recording of browsing, adding to cart and sending an order, to attach to DMs. |
