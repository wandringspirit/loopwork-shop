import { site } from '../site.config';

/** One row in the cart. Prices are never stored: they're always read from the catalog. */
export type CartLine = {
  productId: string;
  options: Record<string, string>;
  qty: number;
};

const STORAGE_KEY = 'shop:cart:v1';
const CHANGE_EVENT = 'cart:change';

export const lineKey = ({ productId, options }: Pick<CartLine, 'productId' | 'options'>) => {
  const optionPart = Object.keys(options)
    .sort()
    .map((name) => `${name}=${options[name]}`)
    .join('&');
  return optionPart ? `${productId}?${optionPart}` : productId;
};

const clampQty = (qty: number) => Math.min(site.maxQtyPerItem, Math.max(1, Math.round(qty)));

const isLine = (value: unknown): value is CartLine => {
  const line = value as CartLine;
  return (
    typeof line?.productId === 'string' &&
    typeof line.qty === 'number' &&
    typeof line.options === 'object' &&
    line.options !== null
  );
};

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isLine) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the page still works for this visit.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export const cart = {
  lines: read,

  count: () => read().reduce((total, line) => total + line.qty, 0),

  add(productId: string, options: Record<string, string>, qty = 1) {
    const lines = read();
    const key = lineKey({ productId, options });
    const existing = lines.find((line) => lineKey(line) === key);
    if (existing) existing.qty = clampQty(existing.qty + qty);
    else lines.push({ productId, options, qty: clampQty(qty) });
    write(lines);
    return key;
  },

  setQty(key: string, qty: number) {
    write(read().map((line) => (lineKey(line) === key ? { ...line, qty: clampQty(qty) } : line)));
  },

  remove(key: string) {
    write(read().filter((line) => lineKey(line) !== key));
  },

  clear() {
    write([]);
  },

  /** Calls `listener` whenever the cart changes, in this tab or another. */
  subscribe(listener: (lines: CartLine[]) => void) {
    const onChange = () => listener(read());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  },
};

/** Ask the cart drawer to open, optionally highlighting the line that was just added. */
export const openCartDrawer = (addedKey?: string) =>
  window.dispatchEvent(new CustomEvent('cart:open', { detail: { addedKey } }));
