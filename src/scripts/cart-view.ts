import { site } from '../site.config';
import { formatPrice } from '../lib/format';
import { isOrderable } from '../lib/status';
import { describeOptions } from '../lib/whatsapp';
import { cart, lineKey, type CartLine } from './cart';
import type { Catalog, CatalogProduct } from './catalog-client';

export type ResolvedLine = {
  key: string;
  line: CartLine;
  product: CatalogProduct | undefined;
  orderable: boolean;
  total: number;
};

export type ResolvedCart = {
  lines: ResolvedLine[];
  orderableLines: ResolvedLine[];
  count: number;
  subtotal: number;
  hasUnavailable: boolean;
};

/** Joins saved cart lines with the live catalog: current prices, and whether each piece can still be ordered. */
export function resolveCart(lines: CartLine[], catalog: Catalog): ResolvedCart {
  const resolved = lines.map((line): ResolvedLine => {
    const product = catalog.get(line.productId);
    const orderable = product !== undefined && isOrderable(product.status);
    return { key: lineKey(line), line, product, orderable, total: product && orderable ? product.price * line.qty : 0 };
  });
  const orderableLines = resolved.filter((entry) => entry.orderable);
  return {
    lines: resolved,
    orderableLines,
    count: orderableLines.reduce((sum, entry) => sum + entry.line.qty, 0),
    subtotal: orderableLines.reduce((sum, entry) => sum + entry.total, 0),
    hasUnavailable: orderableLines.length < resolved.length,
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

type LineAction = 'decrease' | 'increase' | 'remove';

function actionButton(key: string, action: LineAction, label: string, text: string, disabled = false) {
  const button = el('button', action === 'remove' ? 'cart-line-remove' : '', text);
  button.type = 'button';
  button.disabled = disabled;
  button.dataset.key = key;
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  return button;
}

function lineElement({ key, line, product, orderable }: ResolvedLine, highlight: boolean) {
  const item = el('li', 'cart-line');
  item.classList.toggle('is-unavailable', !orderable);
  item.classList.toggle('is-highlighted', highlight);

  const media = el('div', 'cart-line-media');
  if (product) {
    const image = el('img');
    image.src = product.image;
    image.alt = '';
    image.width = 180;
    image.height = 225;
    image.loading = 'lazy';
    media.append(image);
  }

  const info = el('div', 'cart-line-info');
  if (product) {
    const link = el('a', 'cart-line-name', product.name);
    link.href = product.url;
    info.append(link);
  } else {
    info.append(el('p', 'cart-line-name', 'A piece that’s no longer listed'));
  }
  const options = describeOptions(line.options);
  if (options) info.append(el('p', 'cart-line-meta', options));
  if (product && orderable && line.qty > 1) info.append(el('p', 'cart-line-meta', `${formatPrice(product.price)} each`));
  if (!orderable) {
    const reason = product?.status === 'sold-out' ? 'Sold out' : 'No longer available';
    info.append(el('p', 'cart-line-warning', `${reason}. Remove it to continue.`));
  }

  const total = el('p', 'cart-line-total', product ? formatPrice(product.price * line.qty) : '');

  const controls = el('div', 'cart-line-controls');
  const name = product?.name ?? 'this piece';
  if (orderable) {
    const stepper = el('div', 'stepper stepper-sm');
    const qty = el('output', '', String(line.qty));
    qty.setAttribute('aria-label', `Quantity of ${name}`);
    stepper.append(
      actionButton(key, 'decrease', `One fewer ${name}`, '−', line.qty <= 1),
      qty,
      actionButton(key, 'increase', `One more ${name}`, '+', line.qty >= site.maxQtyPerItem),
    );
    controls.append(stepper);
  }
  controls.append(actionButton(key, 'remove', `Remove ${name} from your cart`, 'Remove'));

  item.append(media, info, total, controls);
  return item;
}

let pendingFocus: { key: string; action: string } | undefined;

export function renderCartLines(list: HTMLElement, lines: ResolvedLine[], highlightKey?: string) {
  list.replaceChildren(...lines.map((entry) => lineElement(entry, entry.key === highlightKey)));

  // Rendering replaces the buttons, so put keyboard focus back where the customer was.
  if (!pendingFocus) return;
  const { key, action } = pendingFocus;
  pendingFocus = undefined;
  const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('button[data-action]'));
  const target =
    buttons.find((button) => button.dataset.key === key && button.dataset.action === action && !button.disabled) ??
    buttons.find((button) => button.dataset.key === key && button.dataset.action === 'remove') ??
    buttons.find((button) => button.dataset.action === 'remove');
  target?.focus();
}

/** Wires the quantity and remove buttons in a list rendered by `renderCartLines`. */
export function bindLineActions(list: HTMLElement) {
  list.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    const key = button?.dataset.key;
    const action = button?.dataset.action;
    if (!key || !action) return;

    pendingFocus = { key, action };
    if (action === 'remove') {
      cart.remove(key);
      return;
    }
    const line = cart.lines().find((entry) => lineKey(entry) === key);
    if (line) cart.setQty(key, line.qty + (action === 'increase' ? 1 : -1));
  });
}
