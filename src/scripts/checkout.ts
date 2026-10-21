import { site } from '../site.config';
import { formatPrice, plural } from '../lib/format';
import { newOrderId } from '../lib/order-id';
import { orderMessage, whatsappLink, type OrderSummary } from '../lib/whatsapp';
import { cart } from './cart';
import { bindLineActions, renderCartLines, resolveCart, type ResolvedCart } from './cart-view';
import { loadCatalog, type Catalog } from './catalog-client';
import { saveLastOrder } from './last-order';
import {
  clearErrorsOnInput,
  isValidEmail,
  isValidPincode,
  normaliseIndianMobile,
  validate,
  type Rule,
} from './validation';

const page = document.querySelector<HTMLElement>('[data-cart-page]');
if (page) void setUpCartPage(page);

async function setUpCartPage(page: HTMLElement) {
  const part = <T extends HTMLElement>(selector: string) => {
    const element = page.querySelector<T>(selector);
    if (!element) throw new Error(`Cart page is missing ${selector}`);
    return element;
  };
  const loading = part('[data-cart-loading]');
  const empty = part('[data-cart-empty]');
  const layout = part('[data-cart-layout]');
  const lineList = part('[data-cart-lines]');
  const itemsCount = part('[data-items-count]');
  const unavailableNotice = part('[data-unavailable-notice]');
  const subtotal = part('[data-subtotal]');
  const submit = part<HTMLButtonElement>('[data-submit]');
  const form = part<HTMLFormElement>('[data-checkout-form]');
  const formStatus = part('[data-form-status]');
  const giftToggle = part<HTMLInputElement>('[data-gift-toggle]');
  const giftNote = part('[data-gift-note]');
  const addressFields = part('[data-address-fields]');

  let catalog: Catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    loading.textContent = 'We couldn’t load your cart. Check your connection and refresh the page.';
    return;
  }

  let current: ResolvedCart = resolveCart(cart.lines(), catalog);

  const render = () => {
    current = resolveCart(cart.lines(), catalog);
    loading.hidden = true;
    const isEmpty = current.lines.length === 0;
    empty.hidden = !isEmpty;
    layout.hidden = isEmpty;
    if (isEmpty) return;

    renderCartLines(lineList, current.lines);
    itemsCount.textContent = plural(current.count, 'piece');
    subtotal.textContent = formatPrice(current.subtotal);
    unavailableNotice.hidden = !current.hasUnavailable;
    submit.disabled = current.hasUnavailable || current.orderableLines.length === 0;
  };

  render();
  const unsubscribe = cart.subscribe(render);
  bindLineActions(lineList);

  giftToggle.addEventListener('change', () => {
    giftNote.hidden = !giftToggle.checked;
  });

  const isPickup = () => {
    const delivery = form.elements.namedItem('delivery');
    return delivery instanceof RadioNodeList && delivery.value === 'pickup';
  };
  form.addEventListener('change', (event) => {
    if ((event.target as HTMLInputElement).name === 'delivery') addressFields.hidden = isPickup();
  });

  const rules: Rule[] = [
    { name: 'name', check: (value) => (value.length >= 2 ? '' : 'Please enter your name.') },
    {
      name: 'whatsapp',
      check: (value) => (normaliseIndianMobile(value) ? '' : 'Enter a 10-digit mobile number, like 98765 43210.'),
    },
    { name: 'email', check: (value) => (!value || isValidEmail(value) ? '' : 'Check your email address, or leave it blank.') },
    { name: 'address', check: (value) => (isPickup() || value.length >= 8 ? '' : 'Please enter your full address.') },
    { name: 'city', check: (value) => (isPickup() || value.length >= 2 ? '' : 'Please enter your town or city.') },
    { name: 'pincode', check: (value) => (isPickup() || isValidPincode(value) ? '' : 'Enter your 6-digit PIN code.') },
    { name: 'consent', check: (value) => (value ? '' : 'Tick this so we can confirm your order on WhatsApp.') },
  ];
  clearErrorsOnInput(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    formStatus.textContent = '';

    if (current.hasUnavailable) {
      formStatus.textContent = 'Remove the pieces that are no longer available, then send again.';
      return;
    }
    if (!validate(form, rules)) {
      formStatus.textContent = 'A few details need another look.';
      return;
    }

    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const order: OrderSummary = {
      id: newOrderId(),
      createdAt: new Date().toISOString(),
      items: current.orderableLines.flatMap(({ line, product }) =>
        product
          ? [{ productId: line.productId, name: product.name, options: line.options, qty: line.qty, unitPrice: product.price }]
          : [],
      ),
      subtotal: current.subtotal,
      customer: {
        name: text('name'),
        whatsapp: normaliseIndianMobile(text('whatsapp')) ?? text('whatsapp'),
        email: text('email') || undefined,
      },
      delivery: isPickup()
        ? { method: 'pickup' }
        : { method: 'ship', address: text('address'), city: text('city'), pincode: text('pincode') },
      giftNote: giftToggle.checked ? text('giftNote') || undefined : undefined,
      notes: text('notes') || undefined,
    };

    saveLastOrder(order);
    // Round 2 adds orderMode 'api', which sends the order to the Worker and Make instead.
    if (site.orderMode === 'whatsapp') window.open(whatsappLink(orderMessage(order)), '_blank', 'noopener');
    unsubscribe();
    cart.clear();
    window.location.assign('/order/received/');
  });
}
