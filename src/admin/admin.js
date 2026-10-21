// Local shop admin (dev only). Talks to the API in integrations/local-admin/api.ts.
import Alpine from 'alpinejs';

const SECTIONS = [
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'faq', label: 'FAQ' },
  { id: 'policies', label: 'Policies' },
  { id: 'settings', label: 'Shop settings' },
  { id: 'site-photos', label: 'Page photos' },
  { id: 'publish', label: 'Ready to publish' },
];

const STATUS_LABELS = {
  available: 'Ready to ship',
  'made-to-order': 'Made to order',
  'sold-out': 'Sold out',
  hidden: 'Hidden',
};

const CARE_LABELS = {
  'hand-wash': 'Hand wash',
  'machine-wash-cold': 'Machine wash cold',
  'no-bleach': 'Do not bleach',
  'dry-flat': 'Dry flat',
  'no-tumble-dry': 'Do not tumble dry',
  'no-iron': 'Do not iron',
};

const FAQ_GROUPS = ['Ordering', 'Payment', 'Shipping', 'Custom orders', 'Care', 'Returns'];

const YARN_COLOURS = [
  { id: 'berry', label: 'Berry' },
  { id: 'coral', label: 'Coral' },
  { id: 'marigold', label: 'Marigold' },
  { id: 'mint', label: 'Mint' },
  { id: 'teal', label: 'Teal' },
  { id: 'lilac', label: 'Lilac' },
];

const SITE_PHOTO_SLOTS = [
  { key: 'hero', label: 'Home page', hint: 'The large photo at the top of the home page.' },
  { key: 'about', label: 'About page', hint: 'Shown beside your story, and on the home page.' },
  { key: 'custom', label: 'Custom orders page', hint: 'Shown on Custom orders and on the home page.' },
];

async function api(path, { method = 'GET', json, file } = {}) {
  const response = await fetch(`/admin/api${path}`, {
    method,
    headers: json !== undefined ? { 'Content-Type': 'application/json' } : file ? { 'Content-Type': 'application/octet-stream' } : undefined,
    body: json !== undefined ? JSON.stringify(json) : file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Something went wrong (${response.status}).`);
  return data;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

Alpine.data('shopAdmin', () => ({
  sections: SECTIONS,
  statusLabels: STATUS_LABELS,
  careLabels: CARE_LABELS,
  faqGroups: FAQ_GROUPS,
  yarnColours: YARN_COLOURS,
  sitePhotoSlots: SITE_PHOTO_SLOTS,

  view: 'products',
  loading: true,
  loadError: '',
  busy: false,
  toastText: '',
  toastTimer: 0,
  photoVersion: Date.now(),

  settings: null,
  categories: [],
  products: [],
  faq: [],
  policies: [],
  checks: [],
  settingsSnapshot: 'null',
  categoriesSnapshot: '[]',
  faqSnapshot: '[]',

  search: '',
  categoryFilter: '',
  statusFilter: '',

  product: null,
  productSnapshot: '',
  productError: '',
  creating: null,
  createError: '',
  policy: null,
  policySnapshot: '',

  async init() {
    await this.load();
    this.applyHash();
    window.addEventListener('hashchange', () => this.applyHash());
    window.addEventListener('beforeunload', (event) => {
      if (this.hasUnsavedChanges()) event.preventDefault();
    });
  },

  async load() {
    try {
      const data = await api('/overview');
      this.settings = data.settings;
      this.categories = data.categories;
      this.products = data.products;
      this.faq = data.faq;
      this.policies = data.policies;
      this.checks = data.checks;
      this.settingsSnapshot = JSON.stringify(this.settings);
      this.categoriesSnapshot = JSON.stringify(this.categories);
      this.faqSnapshot = JSON.stringify(this.faq);
      this.loadError = '';
    } catch (error) {
      this.loadError = error.message;
    } finally {
      this.loading = false;
    }
  },

  async refreshChecks() {
    try {
      this.checks = (await api('/overview')).checks;
    } catch {
      // The checklist refreshes again on the next save.
    }
  },

  // ---------- Navigation ----------
  applyHash() {
    const [view, id] = location.hash.replace(/^#/, '').split('/');
    this.view = SECTIONS.some((section) => section.id === view) ? view : 'products';
    this.product = null;
    this.policy = null;
    if (this.view === 'products' && id) this.openProduct(id);
    if (this.view === 'policies' && id) this.openPolicy(id);
  },

  go(view) {
    if (!this.leaveView()) return;
    location.hash = view;
  },

  viewDirty() {
    switch (this.view) {
      case 'products':
        return this.productDirty;
      case 'categories':
        return JSON.stringify(this.categories) !== this.categoriesSnapshot;
      case 'faq':
        return JSON.stringify(this.faq) !== this.faqSnapshot;
      case 'policies':
        return this.policy !== null && JSON.stringify(this.policy) !== this.policySnapshot;
      case 'settings':
      case 'site-photos':
        return JSON.stringify(this.settings) !== this.settingsSnapshot;
      default:
        return false;
    }
  },

  hasUnsavedChanges() {
    return (
      this.productDirty ||
      (this.policy !== null && JSON.stringify(this.policy) !== this.policySnapshot) ||
      JSON.stringify(this.settings) !== this.settingsSnapshot ||
      JSON.stringify(this.categories) !== this.categoriesSnapshot ||
      JSON.stringify(this.faq) !== this.faqSnapshot
    );
  },

  /** Asks before throwing away unsaved edits in the current section, then restores the saved version. */
  leaveView() {
    if (!this.viewDirty()) return true;
    if (!confirm('You have unsaved changes here. Leave without saving them?')) return false;
    this.settings = JSON.parse(this.settingsSnapshot);
    this.categories = JSON.parse(this.categoriesSnapshot);
    this.faq = JSON.parse(this.faqSnapshot);
    this.productSnapshot = JSON.stringify(this.product);
    this.policySnapshot = JSON.stringify(this.policy);
    return true;
  },

  toast(message) {
    this.toastText = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastText = ''), 3500);
  },

  // ---------- Helpers ----------
  money(value) {
    return rupees.format(Number(value) || 0);
  },
  categoryName(id) {
    return this.categories.find((category) => category.id === id)?.name ?? id;
  },
  photoUrl(productId, src, width) {
    return `/admin/api/products/${productId}/photos/${String(src).replace('./', '')}?w=${width}&v=${this.photoVersion}`;
  },
  focusStyle(photo) {
    const [x, y] = (photo.focus || '50% 50%').split(' ');
    return `left: ${x}; top: ${y}`;
  },
  count(status) {
    return this.products.filter((product) => product.status === status).length;
  },
  productsIn(categoryId) {
    return this.products.filter((product) => product.category === categoryId).length;
  },
  moveItem(list, index, step) {
    const target = index + step;
    if (target < 0 || target >= list.length) return;
    list.splice(target, 0, list.splice(index, 1)[0]);
  },
  get problems() {
    return this.checks.filter((check) => !check.ok).length;
  },
  get filteredProducts() {
    const query = this.search.trim().toLowerCase();
    return this.products.filter(
      (item) =>
        (!query || String(item.name).toLowerCase().includes(query)) &&
        (!this.categoryFilter || item.category === this.categoryFilter) &&
        (!this.statusFilter || item.status === this.statusFilter),
    );
  },
  get whatsappPreview() {
    const digits = String(this.settings?.whatsappNumber ?? '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    return digits ? `+${digits}` : '';
  },

  // ---------- Product list ----------
  replaceProduct(updated) {
    const index = this.products.findIndex((item) => item.id === updated.id);
    if (index >= 0) this.products.splice(index, 1, updated);
    else this.products.push(updated);
  },

  async quickUpdate(item, changes, message) {
    try {
      this.replaceProduct(await api(`/products/${item.id}`, { method: 'PATCH', json: changes }));
      this.toast(message);
      this.refreshChecks();
    } catch (error) {
      this.toast(error.message);
      await this.load();
    }
  },

  // ---------- Product editor ----------
  editProduct(id) {
    location.hash = `products/${id}`;
  },

  openProduct(id) {
    const found = this.products.find((item) => item.id === id);
    if (!found) return;
    const copy = clone(found);
    copy.options = (copy.options ?? []).map((option) => ({ name: option.name, valuesText: option.values.join(', ') }));
    copy.careSymbols = copy.careSymbols ?? [];
    copy.leadTime = copy.leadTime ?? '';
    copy.size = copy.size ?? '';
    copy.featured = Boolean(copy.featured);
    copy.sample = Boolean(copy.sample);
    this.product = copy;
    this.productSnapshot = JSON.stringify(copy);
    this.productError = '';
  },

  get productDirty() {
    return this.product !== null && JSON.stringify(this.product) !== this.productSnapshot;
  },

  closeProduct() {
    if (!this.leaveView()) return;
    location.hash = 'products';
  },

  /** Keeps other unsaved edits flagged after the server changes some fields (like photos). */
  markSaved(fields) {
    const snapshot = JSON.parse(this.productSnapshot);
    for (const field of fields) snapshot[field] = clone(this.product[field]);
    this.productSnapshot = JSON.stringify(snapshot);
  },

  async saveProduct() {
    this.busy = true;
    this.productError = '';
    try {
      const payload = {
        ...this.product,
        options: this.product.options.map((option) => ({
          name: option.name,
          values: option.valuesText.split(',').map((value) => value.trim()).filter(Boolean),
        })),
      };
      const saved = await api(`/products/${this.product.id}`, { method: 'PUT', json: payload });
      this.replaceProduct(saved);
      this.openProduct(saved.id);
      this.toast(`Saved ${saved.name}.`);
      this.refreshChecks();
    } catch (error) {
      this.productError = error.message;
    } finally {
      this.busy = false;
    }
  },

  async deleteProduct() {
    const { id, name } = this.product;
    if (!confirm(`Move “${name}” to the bin?\n\nIt disappears from the shop. You can get it back from the .trash folder in the project.`)) return;
    try {
      await api(`/products/${id}`, { method: 'DELETE' });
      this.products = this.products.filter((item) => item.id !== id);
      this.product = null;
      this.toast(`Moved ${name} to the bin.`);
      location.hash = 'products';
      this.refreshChecks();
    } catch (error) {
      this.productError = error.message;
    }
  },

  async uploadPhotos(fileList) {
    const files = Array.from(fileList ?? []);
    for (const file of files) {
      this.busy = true;
      try {
        const updated = await api(`/products/${this.product.id}/photos`, { method: 'POST', file });
        this.replaceProduct(updated);
        this.product.photos = clone(updated.photos);
        this.product.sample = Boolean(updated.sample);
        this.markSaved(['photos', 'sample']);
        this.toast(`Added ${file.name}.`);
      } catch (error) {
        this.productError = `${file.name}: ${error.message}`;
      } finally {
        this.busy = false;
      }
    }
    this.photoVersion = Date.now();
    this.refreshChecks();
  },

  async removePhoto(photo) {
    if (!confirm('Remove this photo from the product? It goes to the .trash folder.')) return;
    try {
      const updated = await api(`/products/${this.product.id}/photos/${photo.src.replace('./', '')}`, { method: 'DELETE' });
      this.replaceProduct(updated);
      this.product.photos = clone(updated.photos);
      this.markSaved(['photos']);
    } catch (error) {
      this.productError = error.message;
    }
  },

  setFocus(photo, event) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - box.left) / box.width) * 100);
    const y = Math.round(((event.clientY - box.top) / box.height) * 100);
    photo.focus = `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`;
  },

  startCreate() {
    this.creating = { name: '', category: this.categories[0]?.id ?? '', price: '' };
    this.createError = '';
  },

  async createProduct() {
    this.busy = true;
    this.createError = '';
    try {
      const created = await api('/products', { method: 'POST', json: this.creating });
      this.products.push(created);
      this.creating = null;
      this.toast(`Created ${created.name}. It stays hidden until you set its status.`);
      this.editProduct(created.id);
    } catch (error) {
      this.createError = error.message;
    } finally {
      this.busy = false;
    }
  },

  // ---------- Categories and FAQ ----------
  addCategory() {
    this.categories.push({ id: '', name: '', description: '', colour: '', coverProduct: '' });
  },
  removeCategory(index) {
    const category = this.categories[index];
    if (category.id && this.productsIn(category.id) > 0) {
      this.toast(`Move the products in ${category.name} to another category first.`);
      return;
    }
    this.categories.splice(index, 1);
  },
  async saveCategories() {
    try {
      this.categories = await api('/categories', { method: 'PUT', json: this.categories });
      this.categoriesSnapshot = JSON.stringify(this.categories);
      this.toast('Categories saved.');
    } catch (error) {
      this.toast(error.message);
    }
  },

  addFaq() {
    this.faq.push({ id: '', group: 'Ordering', question: '', answer: '', onHome: false });
  },
  async saveFaq() {
    try {
      this.faq = await api('/faq', { method: 'PUT', json: this.faq });
      this.faqSnapshot = JSON.stringify(this.faq);
      this.toast('FAQ saved.');
    } catch (error) {
      this.toast(error.message);
    }
  },

  // ---------- Policies ----------
  selectPolicy(id) {
    if (!this.leaveView()) return;
    location.hash = `policies/${id}`;
  },
  openPolicy(id) {
    const found = this.policies.find((item) => item.id === id);
    if (!found) return;
    this.policy = { ...clone(found), draft: Boolean(found.draft) };
    this.policySnapshot = JSON.stringify(this.policy);
  },
  async savePolicy() {
    try {
      const saved = await api(`/policies/${this.policy.id}`, { method: 'PUT', json: this.policy });
      this.policies.splice(this.policies.findIndex((item) => item.id === saved.id), 1, saved);
      this.openPolicy(saved.id);
      this.toast(`Saved ${saved.title}.`);
      this.refreshChecks();
    } catch (error) {
      this.toast(error.message);
    }
  },

  // ---------- Settings and page photos ----------
  async saveSettings() {
    try {
      this.settings = await api('/settings', { method: 'PUT', json: this.settings });
      this.settingsSnapshot = JSON.stringify(this.settings);
      this.toast('Shop settings saved.');
      this.refreshChecks();
    } catch (error) {
      this.toast(error.message);
    }
  },
  sitePhotoUrl(key) {
    return `/admin/api/site-photos/${key}?w=900&v=${this.photoVersion}`;
  },
  async uploadSitePhoto(key, fileList) {
    const file = fileList?.[0];
    if (!file) return;
    this.busy = true;
    try {
      const saved = await api(`/site-photos/${key}`, { method: 'POST', file });
      this.settings.sitePhotos[key].sample = false;
      const snapshot = JSON.parse(this.settingsSnapshot);
      snapshot.sitePhotos = saved.sitePhotos;
      this.settingsSnapshot = JSON.stringify(snapshot);
      this.photoVersion = Date.now();
      this.toast('Photo replaced. Check its description below, then save.');
      this.refreshChecks();
    } catch (error) {
      this.toast(error.message);
    } finally {
      this.busy = false;
    }
  },
}));

Alpine.start();
