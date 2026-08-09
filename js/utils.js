import { APP_CONFIG } from './config.js';

const STATUS_ORDER = ['Pending', 'Preparing', 'Ready'];
const ALLOWED_IMAGE_POSITIONS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);

export function formatPKR(value) {
  const amount = Number(value);
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: APP_CONFIG.currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0).replace('PKR', 'PKR ');
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: APP_CONFIG.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: APP_CONFIG.timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDashboardDate() {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: APP_CONFIG.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function debounce(callback, wait = 180) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

export function setButtonLoading(button, loading, loadingLabel = 'Please wait…') {
  if (!button) return;
  if (loading) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = loadingLabel;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

export function showFormAlert(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
  if (message) element.focus({ preventScroll: true });
}

export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Confirm your email address before signing in.';
  if (message.includes('user already registered')) return 'An account already exists for this email.';
  if (message.includes('rate limit')) return 'Too many attempts. Wait a moment and try again.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'The service is unreachable. Check your connection and try again.';
  if (message.includes('not configured')) return error.message;
  if (message.includes('permission') || message.includes('row-level security')) return 'That action is not permitted for this account.';
  return fallback;
}

export function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toastContainer');
  if (!container || !window.bootstrap?.Toast) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');

  const row = document.createElement('div');
  row.className = 'd-flex align-items-start';
  const body = document.createElement('div');
  body.className = 'toast-body';
  if (title) {
    const heading = document.createElement('strong');
    heading.className = 'd-block mb-1';
    heading.textContent = title;
    body.append(heading);
  }
  const copy = document.createElement('span');
  copy.textContent = message;
  body.append(copy);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-close m-2';
  close.dataset.bsDismiss = 'toast';
  close.setAttribute('aria-label', 'Close notification');
  row.append(body, close);
  toast.append(row);
  container.append(toast);

  const instance = window.bootstrap.Toast.getOrCreateInstance(toast, { delay: type === 'error' ? 6500 : 3500 });
  toast.addEventListener('hidden.bs.toast', () => toast.remove(), { once: true });
  instance.show();
}

export function safeImageUrl(rawUrl) {
  if (!rawUrl) return new URL('assets/menu-atlas.webp', window.location.href).href;
  try {
    const url = new URL(String(rawUrl).trim(), window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported image protocol');
    return url.href;
  } catch {
    return new URL('assets/menu-atlas.webp', window.location.href).href;
  }
}

export function createDishImage(item, wrapperClass = 'dish-image-wrap') {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;
  const image = document.createElement('img');
  const position = ALLOWED_IMAGE_POSITIONS.has(item.image_position) ? item.image_position : 'center';
  image.src = safeImageUrl(item.image_url);
  image.alt = item.name ? `${item.name}, plated at Aatish & Aangan` : 'Restaurant dish';
  image.loading = 'lazy';
  image.decoding = 'async';
  if (position === 'center') {
    image.className = 'image-full';
  } else {
    image.className = `image-atlas pos-${position}`;
  }
  image.addEventListener('error', () => {
    image.src = new URL('assets/menu-atlas.webp', window.location.href).href;
    image.className = 'image-atlas pos-top-left';
  }, { once: true });
  wrapper.append(image);
  return wrapper;
}

export function statusClass(status) {
  return STATUS_ORDER.includes(status) ? `status-${status.toLowerCase()}` : 'status-pending';
}

export function statusIndex(status) {
  const index = STATUS_ORDER.indexOf(status);
  return index < 0 ? 0 : index;
}

export function orderNumber(order) {
  return `AA-${String(order.order_number || 0).padStart(4, '0')}`;
}

export function setStatePanel(element, { title = '', message = '', mark = '', action = null } = {}) {
  if (!element) return;
  element.replaceChildren();
  if (mark) {
    const symbol = document.createElement('div');
    symbol.className = 'state-mark';
    symbol.textContent = mark;
    element.append(symbol);
  }
  if (title) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    element.append(heading);
  }
  if (message) {
    const copy = document.createElement('p');
    copy.textContent = message;
    element.append(copy);
  }
  if (action) element.append(action);
  element.hidden = false;
}

export function setOnlineState() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  banner.hidden = navigator.onLine;
  document.documentElement.classList.toggle('is-offline', !navigator.onLine);
}

export function initializeConnectionMonitor(onReconnect) {
  setOnlineState();
  window.addEventListener('offline', () => {
    setOnlineState();
    showToast('Checkout and live updates are paused until your connection returns.', 'info', 'You are offline');
  });
  window.addEventListener('online', () => {
    setOnlineState();
    showToast('Live menu and kitchen updates are available again.', 'success', 'Back online');
    onReconnect?.();
  });
}

export function downloadCsv(filename, rows) {
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

