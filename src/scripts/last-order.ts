import type { OrderSummary } from '../lib/whatsapp';

const STORAGE_KEY = 'shop:last-order';

/** Keeps the order that was just sent, for the "Order received" page in the same tab. */
export function saveLastOrder(order: OrderSummary) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Storage can be blocked; the order has already been handed to WhatsApp.
  }
}

export function readLastOrder(): OrderSummary | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OrderSummary) : null;
  } catch {
    return null;
  }
}
