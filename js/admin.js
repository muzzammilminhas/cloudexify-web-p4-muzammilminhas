import { supabase } from './supabase.js';
import { requireAdmin, signOut } from './auth.js';
import {
  createDishImage,
  downloadCsv,
  formatDashboardDate,
  formatDateTime,
  formatPKR,
  friendlyError,
  initializeConnectionMonitor,
  orderNumber,
  setButtonLoading,
  showFormAlert,
  showToast,
} from './utils.js';

const ORDER_SELECT = 'id, order_number, user_id, items, total, status, created_at, preparing_at, ready_at, profiles!orders_user_id_fkey(full_name)';
const MENU_SELECT = 'id, name, description, price, category, image_url, image_position, badge, spice_level, dietary, available, featured, created_at';

let currentAdmin;
let orders = [];
let menuItems = [];
let orderChannel;
let menuChannel;
let refreshTimer;
let itemPendingDelete = null;

const orderState = document.getElementById('adminOrdersState');
const orderWrap = document.getElementById('ordersTableWrap');
const orderBody = document.getElementById('ordersTableBody');
const menuState = document.getElementById('adminMenuState');
const menuWrap = document.getElementById('menuTableWrap');
const menuBody = document.getElementById('menuTableBody');
const statusFilter = document.getElementById('orderStatusFilter');
const menuModalElement = document.getElementById('menuItemModal');
const menuModal = window.bootstrap?.Modal.getOrCreateInstance(menuModalElement);
const deleteModal = window.bootstrap?.Modal.getOrCreateInstance(document.getElementById('deleteConfirmModal'));

function showAdminState(element, message, error = false) {
  element.replaceChildren();
  const mark = document.createElement('div');
  mark.className = error ? 'text-danger fs-2' : 'spinner-border text-warning';
  if (error) mark.textContent = '×'; else mark.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('p');
  copy.textContent = message;
  element.append(mark, copy);
  element.hidden = false;
}

async function loadDashboardStats() {
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
  if (error) throw error;
  const stats = Array.isArray(data) ? data[0] : data;
  document.getElementById('statOrders').textContent = Number(stats.total_orders_today || 0).toLocaleString('en-PK');
  document.getElementById('statRevenue').textContent = formatPKR(stats.total_revenue_today || 0);
  document.getElementById('statPending').textContent = Number(stats.pending_orders || 0).toLocaleString('en-PK');
  document.getElementById('statMenu').textContent = Number(stats.total_menu_items || 0).toLocaleString('en-PK');
  document.getElementById('statUnavailable').textContent = `${Number(stats.unavailable_menu_items || 0).toLocaleString('en-PK')} unavailable`;
  document.getElementById('pendingNavCount').textContent = Number(stats.pending_orders || 0).toLocaleString('en-PK');
}

async function loadOrders({ silent = false } = {}) {
  if (!silent) {
    showAdminState(orderState, 'Opening the kitchen pass…');
    orderWrap.hidden = true;
  }
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(250);
  if (error) {
    showAdminState(orderState, 'The order queue could not be loaded.', true);
    throw error;
  }
  orders = data || [];
  renderOrders();
}

function getFilteredOrders() {
  const filter = statusFilter.value;
  if (filter === 'active') return orders.filter((order) => order.status !== 'Ready');
  if (filter === 'all') return orders;
  return orders.filter((order) => order.status === filter);
}

function renderOrders() {
  orderBody.replaceChildren();
  const filtered = getFilteredOrders();
  if (!filtered.length) {
    orderWrap.hidden = true;
    showAdminState(orderState, orders.length ? 'No orders match this status.' : 'No orders have arrived yet.');
    orderState.querySelector('.spinner-border')?.remove();
    return;
  }
  orderState.hidden = true;
  orderWrap.hidden = false;
  const fragment = document.createDocumentFragment();
  filtered.forEach((order) => fragment.append(createOrderRow(order)));
  orderBody.append(fragment);
}

function createOrderRow(order) {
  const row = document.createElement('tr');

  const identityCell = document.createElement('td');
  identityCell.className = 'table-order-id';
  const identity = document.createElement('strong');
  identity.textContent = orderNumber(order);
  const date = document.createElement('small');
  date.textContent = formatDateTime(order.created_at);
  identityCell.append(identity, date);

  const customerCell = document.createElement('td');
  customerCell.className = 'table-customer';
  const customer = document.createElement('strong');
  customer.textContent = order.profiles?.full_name || 'Customer';
  const userId = document.createElement('small');
  userId.textContent = `${String(order.user_id).slice(0, 8)}…`;
  customerCell.append(customer, userId);

  const itemsCell = document.createElement('td');
  itemsCell.className = 'table-items';
  itemsCell.textContent = (Array.isArray(order.items) ? order.items : []).map((item) => `${item.quantity}× ${item.name}`).join(' · ');

  const totalCell = document.createElement('td');
  const total = document.createElement('strong');
  total.textContent = formatPKR(order.total);
  totalCell.append(total);

  const placedCell = document.createElement('td');
  placedCell.textContent = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((new Date(order.created_at).getTime() - Date.now()) / 60000),
    'minute',
  );
  placedCell.title = formatDateTime(order.created_at);

  const statusCell = document.createElement('td');
  const select = document.createElement('select');
  select.className = `form-select form-select-sm status-select status-${order.status}`;
  select.setAttribute('aria-label', `Status for order ${orderNumber(order)}`);
  const allowed = order.status === 'Pending' ? ['Pending', 'Preparing'] : order.status === 'Preparing' ? ['Preparing', 'Ready'] : ['Ready'];
  allowed.forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    option.selected = status === order.status;
    select.append(option);
  });
  select.disabled = !navigator.onLine || order.status === 'Ready';
  select.addEventListener('change', async () => {
    const original = order.status;
    select.disabled = true;
    try {
      const { error } = await supabase.rpc('admin_update_order_status', {
        p_order_id: order.id,
        p_new_status: select.value,
      });
      if (error) throw error;
      showToast(`${orderNumber(order)} moved to ${select.value}.`, 'success', 'Status updated');
      await Promise.all([loadOrders({ silent: true }), loadDashboardStats()]);
    } catch (error) {
      select.value = original;
      showToast(friendlyError(error, error.message || 'Status could not be updated.'), 'error');
    } finally {
      select.disabled = !navigator.onLine || order.status === 'Ready';
    }
  });
  statusCell.append(select);

  row.append(identityCell, customerCell, itemsCell, totalCell, placedCell, statusCell);
  return row;
}

async function loadMenu({ silent = false } = {}) {
  if (!silent) {
    showAdminState(menuState, 'Reading the menu…');
    menuWrap.hidden = true;
  }
  const { data, error } = await supabase.from('menu_items').select(MENU_SELECT).order('category').order('name');
  if (error) {
    showAdminState(menuState, 'Menu management could not be loaded.', true);
    throw error;
  }
  menuItems = data || [];
  renderMenu();
}

function renderMenu() {
  menuBody.replaceChildren();
  if (!menuItems.length) {
    menuWrap.hidden = true;
    showAdminState(menuState, 'No menu items exist yet.');
    menuState.querySelector('.spinner-border')?.remove();
    return;
  }
  menuState.hidden = true;
  menuWrap.hidden = false;
  const fragment = document.createDocumentFragment();
  menuItems.forEach((item) => fragment.append(createMenuRow(item)));
  menuBody.append(fragment);
}

function createMenuRow(item) {
  const row = document.createElement('tr');
  const dishCell = document.createElement('td');
  const dish = document.createElement('div');
  dish.className = 'menu-dish-cell';
  dish.append(createDishImage(item, 'menu-thumb'));
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = item.name;
  const description = document.createElement('small');
  description.textContent = item.badge || item.dietary || 'Evening menu';
  copy.append(title, description);
  dish.append(copy);
  dishCell.append(dish);

  const categoryCell = document.createElement('td');
  categoryCell.textContent = item.category;
  const priceCell = document.createElement('td');
  priceCell.textContent = formatPKR(item.price);

  const availableCell = document.createElement('td');
  const availability = document.createElement('label');
  availability.className = 'availability-toggle';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'form-check-input';
  toggle.checked = item.available;
  toggle.disabled = !navigator.onLine;
  toggle.setAttribute('aria-label', `${item.available ? 'Mark' : 'Restore'} ${item.name} ${item.available ? 'unavailable' : 'available'}`);
  const label = document.createElement('span');
  label.textContent = item.available ? 'Available' : 'Sold out';
  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    try {
      const { error } = await supabase.from('menu_items').update({ available: toggle.checked }).eq('id', item.id);
      if (error) throw error;
      item.available = toggle.checked;
      label.textContent = toggle.checked ? 'Available' : 'Sold out';
      showToast(`${item.name} is now ${toggle.checked ? 'available' : 'sold out'}.`, 'success');
      await loadDashboardStats();
    } catch (error) {
      toggle.checked = !toggle.checked;
      showToast(friendlyError(error, 'Availability could not be changed.'), 'error');
    } finally {
      toggle.disabled = !navigator.onLine;
    }
  });
  availability.append(toggle, label);
  availableCell.append(availability);

  const actionCell = document.createElement('td');
  const actions = document.createElement('div');
  actions.className = 'table-actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn btn-sm btn-outline-dark';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => openEditModal(item));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-sm btn-outline-danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => openDeleteModal(item));
  actions.append(edit, remove);
  actionCell.append(actions);
  row.append(dishCell, categoryCell, priceCell, availableCell, actionCell);
  return row;
}

function resetMenuForm() {
  const form = document.getElementById('menuItemForm');
  form.reset();
  form.classList.remove('was-validated');
  document.getElementById('menuItemId').value = '';
  document.getElementById('itemImageUrl').value = 'assets/menu-atlas.webp';
  document.getElementById('itemAvailable').checked = true;
  document.getElementById('menuItemModalTitle').textContent = 'Add a dish';
  showFormAlert(document.getElementById('menuFormAlert'), '');
}

function openEditModal(item) {
  resetMenuForm();
  document.getElementById('menuItemModalTitle').textContent = 'Edit this dish';
  document.getElementById('menuItemId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemPrice').value = Number(item.price);
  document.getElementById('itemDescription').value = item.description;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemBadge').value = item.badge || '';
  document.getElementById('itemImageUrl').value = item.image_url;
  document.getElementById('itemImagePosition').value = item.image_position || 'center';
  document.getElementById('itemSpiceLevel').value = Number(item.spice_level || 0);
  document.getElementById('itemDietary').value = item.dietary || '';
  document.getElementById('itemAvailable').checked = item.available;
  document.getElementById('itemFeatured').checked = item.featured;
  menuModal.show();
}

function openDeleteModal(item) {
  itemPendingDelete = item;
  document.getElementById('deleteConfirmCopy').textContent = `${item.name} will disappear from the live menu. Historical order snapshots stay intact.`;
  deleteModal.show();
}

document.getElementById('addMenuItemButton').addEventListener('click', resetMenuForm);

document.getElementById('menuItemForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const alertBox = document.getElementById('menuFormAlert');
  form.classList.add('was-validated');
  showFormAlert(alertBox, '');
  if (!form.checkValidity()) return;

  const button = document.getElementById('saveMenuItemButton');
  setButtonLoading(button, true, 'Saving…');
  const id = document.getElementById('menuItemId').value;
  const payload = {
    name: document.getElementById('itemName').value.trim().replace(/\s+/g, ' '),
    description: document.getElementById('itemDescription').value.trim(),
    price: Number(document.getElementById('itemPrice').value),
    category: document.getElementById('itemCategory').value,
    image_url: document.getElementById('itemImageUrl').value.trim(),
    image_position: document.getElementById('itemImagePosition').value,
    badge: document.getElementById('itemBadge').value.trim() || null,
    spice_level: Number(document.getElementById('itemSpiceLevel').value),
    dietary: document.getElementById('itemDietary').value.trim() || null,
    available: document.getElementById('itemAvailable').checked,
    featured: document.getElementById('itemFeatured').checked,
  };
  try {
    const query = id
      ? supabase.from('menu_items').update(payload).eq('id', Number(id))
      : supabase.from('menu_items').insert(payload);
    const { error } = await query;
    if (error) throw error;
    menuModal.hide();
    showToast(`${payload.name} was ${id ? 'updated' : 'added'} successfully.`, 'success');
    await Promise.all([loadMenu({ silent: true }), loadDashboardStats()]);
  } catch (error) {
    showFormAlert(alertBox, friendlyError(error, error.message || 'The dish could not be saved.'));
  } finally {
    setButtonLoading(button, false);
  }
});

document.getElementById('confirmDeleteButton').addEventListener('click', async (event) => {
  if (!itemPendingDelete) return;
  const button = event.currentTarget;
  setButtonLoading(button, true, 'Removing…');
  try {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemPendingDelete.id);
    if (error) throw error;
    const name = itemPendingDelete.name;
    itemPendingDelete = null;
    deleteModal.hide();
    showToast(`${name} was removed from the live menu.`, 'success');
    await Promise.all([loadMenu({ silent: true }), loadDashboardStats()]);
  } catch (error) {
    showToast(friendlyError(error, 'The dish could not be removed.'), 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

statusFilter.addEventListener('change', renderOrders);

document.getElementById('exportCsvButton').addEventListener('click', () => {
  const rows = [['Order', 'Customer', 'Items', 'Total PKR', 'Status', 'Placed PKT']];
  getFilteredOrders().forEach((order) => rows.push([
    orderNumber(order),
    order.profiles?.full_name || 'Customer',
    (Array.isArray(order.items) ? order.items : []).map((item) => `${item.quantity}x ${item.name}`).join('; '),
    Number(order.total).toFixed(2),
    order.status,
    formatDateTime(order.created_at),
  ]));
  downloadCsv(`aatish-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  showToast('The visible order queue was exported.', 'success', 'CSV ready');
});

async function refreshAll({ silent = true } = {}) {
  await Promise.all([loadDashboardStats(), loadOrders({ silent }), loadMenu({ silent })]);
}

function subscribeRealtime() {
  orderChannel = supabase
    .channel('admin-live-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
      await Promise.all([loadOrders({ silent: true }), loadDashboardStats()]);
      if (payload.eventType === 'INSERT') showToast(`A new order entered the kitchen queue.`, 'info', 'Incoming order');
    })
    .subscribe();

  menuChannel = supabase
    .channel('admin-live-menu')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => loadMenu({ silent: true }))
    .subscribe();
}

function setupSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const toggle = document.getElementById('adminMenuToggle');
  const backdrop = document.getElementById('sidebarBackdrop');
  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.querySelectorAll('nav a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
}

async function initialize() {
  currentAdmin = await requireAdmin();
  if (!currentAdmin) return;
  document.getElementById('adminUserEmail').textContent = currentAdmin.user.email;
  document.getElementById('dashboardDate').textContent = formatDashboardDate();
  setupSidebar();
  initializeConnectionMonitor(() => refreshAll({ silent: true }));
  document.getElementById('adminLogoutButton').addEventListener('click', async () => {
    try { await signOut(); } catch (error) { showToast(friendlyError(error, 'Could not log out.'), 'error'); }
  });
  document.getElementById('refreshDashboard').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setButtonLoading(button, true, 'Refreshing…');
    try { await refreshAll({ silent: true }); showToast('Dashboard data is current.', 'success'); }
    catch (error) { showToast(friendlyError(error, 'Dashboard refresh failed.'), 'error'); }
    finally { setButtonLoading(button, false); }
  });

  await refreshAll({ silent: false });
  subscribeRealtime();
  refreshTimer = window.setInterval(() => refreshAll({ silent: true }).catch(() => {}), 30_000);
}

initialize().catch((error) => {
  console.error('Admin initialization failed:', error);
  showToast(friendlyError(error, 'The admin dashboard could not start.'), 'error', 'Unable to start');
});

window.addEventListener('beforeunload', () => {
  if (refreshTimer) window.clearInterval(refreshTimer);
  if (orderChannel) supabase.removeChannel(orderChannel);
  if (menuChannel) supabase.removeChannel(menuChannel);
});
