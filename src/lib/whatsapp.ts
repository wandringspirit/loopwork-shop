import { site } from '../site.config';
import { formatPrice } from './format';

export type OrderItem = {
  productId: string;
  name: string;
  options: Record<string, string>;
  qty: number;
  unitPrice: number;
};

export type OrderSummary = {
  id: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  customer: { name: string; whatsapp: string; email?: string };
  delivery: { method: 'ship' | 'pickup'; address?: string; city?: string; pincode?: string };
  giftNote?: string;
  notes?: string;
};

export const whatsappLink = (text?: string) =>
  `https://wa.me/${site.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const describeOptions = (options: Record<string, string>) =>
  Object.entries(options)
    .map(([name, value]) => `${name}: ${value}`)
    .join(', ');

export function orderMessage(order: OrderSummary): string {
  const lines = [
    `Hi ${site.name}! I'd like to order:`,
    '',
    ...order.items.map((item) => {
      const options = describeOptions(item.options);
      return `• ${item.qty} × ${item.name}${options ? ` (${options})` : ''} — ${formatPrice(item.unitPrice * item.qty)}`;
    }),
    '',
    `Subtotal: ${formatPrice(order.subtotal)} (shipping to be confirmed)`,
    `Order ref: ${order.id}`,
    '',
    `Name: ${order.customer.name}`,
    `WhatsApp: ${order.customer.whatsapp}`,
  ];
  if (order.customer.email) lines.push(`Email: ${order.customer.email}`);
  if (order.delivery.method === 'pickup') {
    lines.push("Delivery: I'll pick it up");
  } else {
    const address = [order.delivery.address, order.delivery.city, order.delivery.pincode].filter(Boolean);
    lines.push(`Deliver to: ${address.join(', ')}`);
  }
  if (order.giftNote) lines.push(`Gift note: ${order.giftNote}`);
  if (order.notes) lines.push(`Notes: ${order.notes}`);
  return lines.join('\n');
}

export const productQuestion = (name: string, url: string) =>
  `Hi ${site.name}! I have a question about the ${name}: ${url}`;
