import { supabase } from './supabase.js';
import { formatDateTime, formatPKR, formatTime, orderNumber, setStatePanel, statusClass, statusIndex } from './utils.js';

const ORDER_FIELDS = 'id, order_number, items, total, status, created_at, preparing_at, ready_at';

export class OrdersManager {
  constructor({ userId, list, state, onLiveUpdate }) {
    this.userId = userId;
    this.list = list;
    this.state = state;
    this.onLiveUpdate = onLiveUpdate;
    this.orders = [];
    this.channel = null;
  }

  async load({ silent = false } = {}) {
    if (!silent) {
      this.state.hidden = false;
      this.list.replaceChildren();
    }
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });
    if (error) {
      setStatePanel(this.state, { mark: '×', title: 'Orders are unavailable.', message: 'Refresh when your connection returns.' });
      throw error;
    }
    this.orders = data || [];
    this.render();
    return this.orders;
  }

  render() {
    this.list.replaceChildren();
    if (!this.orders.length) {
      setStatePanel(this.state, { mark: '◇', title: 'No orders yet.', message: 'Your first kitchen trail will appear here.' });
      return;
    }
    this.state.hidden = true;
    const fragment = document.createDocumentFragment();
    this.orders.forEach((order) => fragment.append(this.createOrderCard(order)));
    this.list.append(fragment);
  }

  createOrderCard(order) {
    const card = document.createElement('article');
    card.className = 'order-card';
    const header = document.createElement('header');
    header.className = 'order-card-header';
    const identity = document.createElement('div');
    const date = document.createElement('small');
    date.textContent = formatDateTime(order.created_at);
    const number = document.createElement('strong');
    number.textContent = `Order ${orderNumber(order)}`;
    identity.append(date, number);
    const badge = document.createElement('span');
    badge.className = `order-status-badge ${statusClass(order.status)}`;
    badge.textContent = order.status;
    header.append(identity, badge);

    const body = document.createElement('div');
    body.className = 'order-card-body';
    const summary = document.createElement('div');
    summary.className = 'order-items';
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      const line = document.createElement('div');
      line.className = 'order-item-line';
      const name = document.createElement('span');
      name.textContent = `${item.quantity} × ${item.name}`;
      const total = document.createElement('span');
      total.textContent = formatPKR(item.line_total);
      line.append(name, total);
      summary.append(line);
    });
    const totalRow = document.createElement('div');
    totalRow.className = 'order-total';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total';
    const total = document.createElement('strong');
    total.textContent = formatPKR(order.total);
    totalRow.append(totalLabel, total);
    summary.append(totalRow);
    body.append(summary, this.createStatusTrail(order));
    card.append(header, body);
    return card;
  }

  createStatusTrail(order) {
    const trail = document.createElement('div');
    trail.className = 'status-trail';
    trail.setAttribute('aria-label', `Order status: ${order.status}`);
    const currentIndex = statusIndex(order.status);
    const timestamps = [order.created_at, order.preparing_at, order.ready_at];
    ['Pending', 'Preparing', 'Ready'].forEach((status, index) => {
      const step = document.createElement('div');
      step.className = `status-step${index < currentIndex ? ' complete' : index === currentIndex ? ' current' : ''}`;
      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = status;
      const time = document.createElement('small');
      time.textContent = timestamps[index] ? formatTime(timestamps[index]) : 'Waiting';
      step.append(dot, label, time);
      trail.append(step);
    });
    return trail;
  }

  async place(cart, idempotencyKey) {
    const { data, error } = await supabase.rpc('place_order', {
      p_cart: cart,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  subscribe() {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = supabase
      .channel(`customer-orders-${this.userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${this.userId}`,
      }, async (payload) => {
        await this.load({ silent: true });
        this.onLiveUpdate?.(payload);
      })
      .subscribe();
  }

  destroy() {
    if (this.channel) supabase.removeChannel(this.channel);
  }
}

