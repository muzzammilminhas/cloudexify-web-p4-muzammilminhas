import { supabase } from './supabase.js';
import { requireCustomer, signOut } from './auth.js';
import { CartManager } from './cart.js';
import { MenuManager } from './menu.js';
import { OrdersManager } from './orders.js';
import { friendlyError, initializeConnectionMonitor, orderNumber, showToast } from './utils.js';

let menuManager;
let cartManager;
let ordersManager;

function setupNavigation() {
  const nav = document.querySelector('.site-nav');
  const update = () => nav?.classList.toggle('nav-scrolled', window.scrollY > 30);
  window.addEventListener('scroll', update, { passive: true });
  update();

  document.querySelectorAll('#mainNav .nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      const collapse = window.bootstrap?.Collapse.getInstance(document.getElementById('mainNav'));
      collapse?.hide();
    });
  });
}

async function initialize() {
  setupNavigation();
  const auth = await requireCustomer();
  if (!auth) return;
  const { user, profile } = auth;
  document.getElementById('navUserName').textContent = profile.full_name || user.email;
  document.getElementById('adminNavItem').classList.toggle('d-none', profile.role !== 'admin');

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try { await signOut(); } catch (error) { showToast(friendlyError(error, 'Could not log out.'), 'error'); }
  });

  ordersManager = new OrdersManager({
    userId: user.id,
    list: document.getElementById('ordersList'),
    state: document.getElementById('ordersState'),
    onLiveUpdate: (payload) => {
      if (payload.eventType === 'UPDATE') showToast(`Order ${payload.new.order_number || ''} is now ${payload.new.status}.`, 'success', 'Kitchen update');
    },
  });

  cartManager = new CartManager({
    userId: user.id,
    itemsElement: document.getElementById('cartItems'),
    subtotalElement: document.getElementById('cartSubtotal'),
    countElements: [document.getElementById('navCartCount'), document.getElementById('mobileCartCount')],
    totalElement: document.getElementById('mobileCartTotal'),
    checkoutButton: document.getElementById('checkoutButton'),
    mobileButton: document.getElementById('mobileCartButton'),
    onCheckout: async (payload, token) => {
      if (!navigator.onLine) {
        showToast('Reconnect before sending an order to the kitchen.', 'error', 'Checkout paused');
        return;
      }
      if (!payload.length) return;
      cartManager.setCheckoutLoading(true);
      try {
        const order = await ordersManager.place(payload, token);
        cartManager.clear();
        await ordersManager.load({ silent: true });
        window.bootstrap?.Offcanvas.getOrCreateInstance(document.getElementById('cartOffcanvas')).hide();
        showToast(`Order ${orderNumber(order)} was accepted at ${order.total ? new Intl.NumberFormat('en-PK').format(Number(order.total)) + ' PKR' : 'the current kitchen total'}.`, 'success', 'Order placed');
        document.getElementById('orders').scrollIntoView({ behavior: 'smooth' });
      } catch (error) {
        showToast(friendlyError(error, error.message || 'The kitchen could not accept this order.'), 'error', 'Order not placed');
      } finally {
        cartManager.setCheckoutLoading(false);
      }
    },
  });

  menuManager = new MenuManager({
    grid: document.getElementById('menuGrid'),
    state: document.getElementById('menuState'),
    filters: document.getElementById('categoryFilters'),
    search: document.getElementById('menuSearch'),
    sort: document.getElementById('menuSort'),
    onAdd: (item) => cartManager.add(item),
  });

  initializeConnectionMonitor(async () => {
    await Promise.allSettled([menuManager.load({ silent: true }), ordersManager.load({ silent: true })]);
    cartManager.render();
  });
  window.addEventListener('offline', () => cartManager.render());

  const [menuResult] = await Promise.allSettled([menuManager.load(), ordersManager.load()]);
  if (menuResult.status === 'fulfilled') cartManager.setMenu(menuResult.value);
  menuManager.subscribe((items, payload) => {
    cartManager.setMenu(items);
    const itemName = payload.new?.name || payload.old?.name || 'The menu';
    showToast(`${itemName} was updated by the kitchen.`, 'info', 'Live menu update');
  });
  ordersManager.subscribe();

  const message = sessionStorage.getItem('aatish-auth-message');
  if (message) {
    sessionStorage.removeItem('aatish-auth-message');
    showToast(message, 'success');
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('login.html');
  });
}

initialize().catch((error) => {
  console.error('Customer app initialization failed:', error);
  showToast(friendlyError(error, 'The dining room could not open. Please refresh.'), 'error', 'Unable to start');
});

window.addEventListener('beforeunload', () => {
  menuManager?.destroy();
  ordersManager?.destroy();
});
