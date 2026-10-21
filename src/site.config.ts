import settings from './data/settings.json';

/**
 * How the cart sends orders.
 * 'whatsapp' — the customer sends the finished order to you on WhatsApp (no server needed).
 * 'api'      — the order goes to the Worker and Make (Round 2).
 */
export type OrderMode = 'whatsapp' | 'api';

/** '919876543210' → '+91 98765 43210' */
export const formatWhatsApp = (digits: string) =>
  digits.length === 12 && digits.startsWith('91') ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;

/**
 * Shop-wide settings. Change them in the local admin (run `npm run dev`, then open /admin),
 * or edit src/data/settings.json directly.
 */
export const site = {
  ...settings,
  whatsappDisplay: formatWhatsApp(settings.whatsappNumber),
  locale: 'en-IN',
  currency: 'INR',
  country: 'India',
  orderMode: 'whatsapp' as OrderMode,
};
