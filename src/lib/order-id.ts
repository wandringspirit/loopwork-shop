import { site } from '../site.config';

// No look-alike characters (0/O, 1/I/L), so an ID is easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newOrderId(prefix = site.orderIdPrefix): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const code = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  return `${prefix}-${code}`;
}
