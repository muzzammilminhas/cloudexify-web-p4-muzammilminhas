import { createDishImage, formatPKR, showToast } from './utils.js';

const MAX_QUANTITY = 20;

export class CartManager {
  constructor({ userId, itemsElement, subtotalElement, countElements, totalElement, checkoutButton, mobileButton, onCheckout }) {
    this.storageKey = `aatish-cart-v1:${userId}`;
    this.itemsElement = itemsElement;
    this.subtotalElement = subtotalElement;
    this.countElements = countElements.filter(Boolean);
    this.totalElement = totalElement;
    this.checkoutButton = checkoutButton;
    this.mobileButton = mobileButton;
    this.onCheckout = onCheckout;
    this.menu = new Map();
    this.lines = this.read();
    this.checkoutToken = crypto.randomUUID();

    this.checkoutButton.addEventListener('click', () => this.onCheckout?.(this.getPayload(), this.checkoutToken));
    this.render();
  }

  read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.storageKey));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((line) => ({ id: Number(line.id), quantity: Number(line.quantity) }))
        .filter((line) => Number.isSafeInteger(line.id) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= MAX_QUANTITY);
    } catch {
      return [];
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.lines));
    this.checkoutToken = crypto.randomUUID();
    this.render();
  }

  setMenu(items) {
    this.menu = new Map(items.map((item) => [Number(item.id), item]));
    const validLines = this.lines.filter((line) => this.menu.has(line.id));
    if (validLines.length !== this.lines.length) {
      this.lines = validLines;
      localStorage.setItem(this.storageKey, JSON.stringify(this.lines));
    }
    this.render();
  }

  add(item) {
    const id = Number(item.id);
    const existing = this.lines.find((line) => line.id === id);
    if (existing) {
      if (existing.quantity >= MAX_QUANTITY) {
        showToast(`The maximum quantity for ${item.name} is ${MAX_QUANTITY}.`, 'info');
        return;
      }
      existing.quantity += 1;
    } else {
      this.lines.push({ id, quantity: 1 });
    }
    this.save();
    showToast(`${item.name} joined your dastarkhwan.`, 'success', 'Added to cart');
  }

  change(id, delta) {
    const line = this.lines.find((candidate) => candidate.id === id);
    if (!line) return;
    const next = line.quantity + delta;
    if (next <= 0) this.lines = this.lines.filter((candidate) => candidate.id !== id);
    else line.quantity = Math.min(MAX_QUANTITY, next);
    this.save();
  }

  remove(id) {
    this.lines = this.lines.filter((line) => line.id !== id);
    this.save();
  }

  clear() {
    this.lines = [];
    localStorage.removeItem(this.storageKey);
    this.checkoutToken = crypto.randomUUID();
    this.render();
  }

  get count() { return this.lines.reduce((sum, line) => sum + line.quantity, 0); }

  get subtotal() {
    return this.lines.reduce((sum, line) => {
      const item = this.menu.get(line.id);
      return sum + (item ? Number(item.price) * line.quantity : 0);
    }, 0);
  }

  getPayload() { return this.lines.map((line) => ({ item_id: line.id, quantity: line.quantity })); }

  setCheckoutLoading(loading) {
    this.checkoutButton.disabled = loading || this.lines.length === 0 || !navigator.onLine;
    this.checkoutButton.textContent = loading ? 'Sending to the kitchen…' : 'Place secure order';
    this.checkoutButton.toggleAttribute('aria-busy', loading);
  }

  render() {
    this.itemsElement.replaceChildren();
    const renderedLines = this.lines.filter((line) => this.menu.has(line.id));
    if (!renderedLines.length) {
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      const title = document.createElement('strong');
      title.textContent = 'Your dastarkhwan is empty.';
      const copy = document.createElement('span');
      copy.textContent = 'Choose a dish from the evening menu.';
      empty.append(title, copy);
      this.itemsElement.append(empty);
    } else {
      renderedLines.forEach((line) => this.itemsElement.append(this.createLine(line)));
    }

    this.subtotalElement.textContent = formatPKR(this.subtotal);
    this.totalElement.textContent = formatPKR(this.subtotal);
    this.countElements.forEach((element) => { element.textContent = this.count; });
    this.checkoutButton.disabled = renderedLines.length === 0 || !navigator.onLine;
    this.mobileButton.hidden = renderedLines.length === 0;
  }

  createLine(line) {
    const item = this.menu.get(line.id);
    const row = document.createElement('article');
    row.className = 'cart-line';
    row.append(createDishImage(item));

    const info = document.createElement('div');
    info.className = 'cart-line-info';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const price = document.createElement('span');
    price.textContent = formatPKR(Number(item.price) * line.quantity);
    const quantity = document.createElement('div');
    quantity.className = 'quantity-control';
    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.textContent = '−';
    decrease.setAttribute('aria-label', `Decrease ${item.name} quantity`);
    decrease.addEventListener('click', () => this.change(line.id, -1));
    const amount = document.createElement('span');
    amount.textContent = line.quantity;
    amount.setAttribute('aria-label', `${line.quantity} of ${item.name}`);
    const increase = document.createElement('button');
    increase.type = 'button';
    increase.textContent = '+';
    increase.disabled = line.quantity >= MAX_QUANTITY;
    increase.setAttribute('aria-label', `Increase ${item.name} quantity`);
    increase.addEventListener('click', () => this.change(line.id, 1));
    quantity.append(decrease, amount, increase);
    info.append(title, price, quantity);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cart-remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${item.name} from dastarkhwan`);
    remove.addEventListener('click', () => this.remove(line.id));

    row.append(info, remove);
    return row;
  }
}

