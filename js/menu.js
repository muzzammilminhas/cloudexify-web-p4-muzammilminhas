import { supabase } from './supabase.js';
import { createDishImage, debounce, formatPKR, setStatePanel, showToast } from './utils.js';

const MENU_CACHE_KEY = 'aatish-menu-cache-v1';

export class MenuManager {
  constructor({ grid, state, filters, search, sort, onAdd }) {
    this.grid = grid;
    this.state = state;
    this.filters = filters;
    this.search = search;
    this.sort = sort;
    this.onAdd = onAdd;
    this.items = [];
    this.channel = null;
    this.activeCategory = 'All';
    this.query = '';

    this.search?.addEventListener('input', debounce(() => {
      this.query = this.search.value.trim().toLocaleLowerCase('en');
      this.render();
    }));
    this.sort?.addEventListener('change', () => this.render());
  }

  subscribe(onLiveUpdate) {
    this.channel = supabase
      .channel('customer-live-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, async (payload) => {
        const items = await this.load({ silent: true });
        onLiveUpdate?.(items, payload);
      })
      .subscribe();
  }

  async destroy() {
    if (this.channel) await supabase.removeChannel(this.channel);
  }

  async load({ silent = false } = {}) {
    if (!silent) {
      this.state.hidden = false;
      this.grid.replaceChildren();
    }
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, description, price, category, image_url, image_position, badge, spice_level, dietary, available, featured, created_at')
        .eq('available', true)
        .order('featured', { ascending: false })
        .order('name');
      if (error) throw error;
      this.items = data || [];
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: this.items }));
      this.buildFilters();
      this.render();
      return this.items;
    } catch (error) {
      const cache = this.getCachedMenu();
      if (cache.length) {
        this.items = cache;
        this.buildFilters();
        this.render();
        showToast('Showing the last saved menu while the live kitchen reconnects.', 'info', 'Cached menu');
        return this.items;
      }
      this.grid.replaceChildren();
      setStatePanel(this.state, {
        mark: '×',
        title: 'The menu could not be opened.',
        message: 'Check your connection and refresh the page.',
      });
      throw error;
    }
  }

  getCachedMenu() {
    try {
      const cached = JSON.parse(localStorage.getItem(MENU_CACHE_KEY));
      return Array.isArray(cached?.items) ? cached.items : [];
    } catch {
      return [];
    }
  }

  buildFilters() {
    const categories = ['All', ...new Set(this.items.map((item) => item.category).filter(Boolean))];
    if (!categories.includes(this.activeCategory)) this.activeCategory = 'All';
    this.filters.replaceChildren();
    categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `category-filter${category === this.activeCategory ? ' active' : ''}`;
      button.textContent = category;
      button.setAttribute('aria-pressed', String(category === this.activeCategory));
      button.addEventListener('click', () => {
        this.activeCategory = category;
        this.buildFilters();
        this.render();
      });
      this.filters.append(button);
    });
  }

  getVisibleItems() {
    let items = this.items.filter((item) => {
      const categoryMatches = this.activeCategory === 'All' || item.category === this.activeCategory;
      const haystack = `${item.name} ${item.description} ${item.category} ${item.dietary || ''}`.toLocaleLowerCase('en');
      return categoryMatches && (!this.query || haystack.includes(this.query));
    });

    const sortValue = this.sort?.value || 'featured';
    items = [...items].sort((a, b) => {
      if (sortValue === 'price-asc') return Number(a.price) - Number(b.price);
      if (sortValue === 'price-desc') return Number(b.price) - Number(a.price);
      if (sortValue === 'name') return a.name.localeCompare(b.name);
      return Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name);
    });
    return items;
  }

  render() {
    const items = this.getVisibleItems();
    this.grid.replaceChildren();
    if (!items.length) {
      setStatePanel(this.state, {
        mark: '◇',
        title: this.items.length ? 'No dishes match that search.' : 'The kitchen is between menus.',
        message: this.items.length ? 'Try another name or category.' : 'Available dishes will appear here shortly.',
      });
      return;
    }

    this.state.hidden = true;
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.append(this.createMenuCard(item)));
    this.grid.append(fragment);
  }

  createMenuCard(item) {
    const column = document.createElement('div');
    column.className = 'col-sm-6 col-lg-4 col-xl-3';
    const article = document.createElement('article');
    article.className = 'menu-card';

    const image = createDishImage(item);
    if (item.badge) {
      const badge = document.createElement('span');
      badge.className = 'dish-badge';
      badge.textContent = item.badge;
      image.append(badge);
    }

    const body = document.createElement('div');
    body.className = 'menu-card-body';
    const meta = document.createElement('div');
    meta.className = 'dish-meta';
    const category = document.createElement('span');
    category.textContent = item.category;
    const note = document.createElement('span');
    note.textContent = item.dietary || (Number(item.spice_level) > 0 ? `Spice ${item.spice_level}/3` : 'Mild');
    meta.append(category, note);

    const title = document.createElement('h3');
    title.textContent = item.name;
    const description = document.createElement('p');
    description.className = 'dish-description';
    description.textContent = item.description;

    const footer = document.createElement('div');
    footer.className = 'dish-footer';
    const price = document.createElement('span');
    price.className = 'dish-price';
    price.textContent = formatPKR(item.price);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'add-cart-button';
    button.textContent = '+';
    button.setAttribute('aria-label', `Add ${item.name} to dastarkhwan`);
    button.addEventListener('click', () => this.onAdd(item, button));
    footer.append(price, button);

    body.append(meta, title, description, footer);
    article.append(image, body);
    column.append(article);
    return column;
  }
}
