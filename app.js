/*
 * IROS Inventory 1.0 — vanilla JavaScript, no server and no external dependencies.
 * Data is local to this browser + origin + repository path, NOT shared across devices.
 * All user/imported strings are escaped before HTML rendering. See README.md.
 */
(() => {
  'use strict';

  const CATEGORIES = Object.freeze([
    { id: 'robot-kit', name: 'Robot dan kit', code: 'ROB', icon: 'robot', unit: 'set', description: 'Robot rakitan dan kit praktik, tersimpan dengan rapi.' },
    { id: 'elektronik', name: 'Komponen elektronik', code: 'ELK', icon: 'chip', unit: 'pcs', description: 'Board, sensor, motor, kabel, dan komponen elektronik lainnya.' },
    { id: 'tools', name: 'Tools', code: 'TLS', icon: 'tool', unit: 'unit', description: 'Peralatan kerja untuk merakit, mengukur, dan memperbaiki.' },
    { id: 'habis-pakai', name: 'Benda habis pakai', code: 'HBS', icon: 'box', unit: 'pcs', description: 'Bahan yang berkurang saat digunakan untuk kegiatan IROS.' },
    { id: 'kelas', name: 'Kebutuhan kelas', code: 'KLS', icon: 'book', unit: 'pcs', description: 'Perlengkapan pendukung agar setiap kelas siap berjalan.' },
    { id: 'event', name: 'Kebutuhan event', code: 'EVT', icon: 'flag', unit: 'unit', description: 'Perlengkapan workshop, pameran, dan kegiatan IROS.' }
  ]);
  const CONDITIONS = Object.freeze({ 'baik': 'Baik', 'perlu-dicek': 'Perlu dicek', 'rusak': 'Rusak' });
  const UNITS = Object.freeze(['unit', 'set', 'pcs', 'pak', 'boks', 'rol', 'meter', 'lembar', 'botol', 'pasang', 'liter']);
  const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const MAX_ITEMS = 5000;
  const MAX_QUANTITY = 1000000000;
  const MAX_EVENTS = 250;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const PAGE_SIZE = 10;
  const BASE_PATH = location.pathname.replace(/\/[^/]*\.[^/]*$/, '/').replace(/\/$/, '') || '/';
  const STORE_KEY = `iros-inventaris:v1:${BASE_PATH}`;
  const META_KEY = `${STORE_KEY}:backup-meta`;
  const RECOVERY_KEY = `${STORE_KEY}:before-import`;
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(n);
  const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const now = () => new Date().toISOString();
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const uid = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  const rounded = value => Math.round(value * 1000) / 1000;
  const normalize = text => text.trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');

  /** @typedef {{id:string, code:string, categoryId:string, name:string, quantity:number, unit:string, location:string, condition:string, notes:string, createdAt:string, updatedAt:string}} InventoryItem */
  /** @typedef {{app:string, version:number, revision:number, items:InventoryItem[], events:Object[], sequences:Object, updatedAt:string|null}} InventoryStore */
  function blankStore() {
    return { app: 'iros-inventaris', version: 1, revision: 0, items: [], events: [], sequences: Object.fromEntries(CATEGORIES.map(c => [c.code, 0])), updatedAt: null };
  }
  let store = blankStore();
  let demoStore = null;
  let isDemo = false;
  let storageIssue = '';
  let categoryId = 'all';
  let currentPage = 1;
  let editingItem = null;
  let quantityItem = null;
  let pendingImport = null;
  let unitTouched = false;
  let confirmHandler = null;
  let confirmBusy = false;
  let drawerReturnFocus = null;
  const dialogReturnFocus = new WeakMap();
  const currentStore = () => isDemo ? demoStore : store;
  const currentItems = () => currentStore().items;

  function requiredText(value, label, maxLength, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > maxLength || (!allowEmpty && !value.trim())) {
      throw new Error(`${label} tidak valid. Gunakan teks${allowEmpty ? '' : ' yang tidak kosong'} maksimal ${maxLength} karakter.`);
    }
    return value.trim();
  }
  function validTimestamp(value, label) {
    if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
      throw new Error(`${label} tidak valid.`);
    }
    return value;
  }
  function validQuantity(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_QUANTITY && Math.abs(value - rounded(value)) < 0.0000001;
  }
  /** Strict schema validation: never trust JSON imported from disk or stored by another tab. */
  function validateStore(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.app !== 'iros-inventaris' || data.version !== 1 || !Array.isArray(data.items) || !Array.isArray(data.events)) {
      throw new Error('File bukan cadangan Inventaris IROS versi 1 yang didukung. Gunakan file JSON dari menu Cadangan data.');
    }
    if (data.items.length > MAX_ITEMS) throw new Error(`Maksimal ${fmt(MAX_ITEMS)} baris barang per inventaris.`);
    const clean = blankStore();
    const ids = new Set();
    const codes = new Set();
    clean.revision = Number.isSafeInteger(data.revision) && data.revision >= 0 ? data.revision : 0;
    clean.updatedAt = data.updatedAt ? validTimestamp(data.updatedAt, 'Waktu pembaruan') : null;
    for (let n = 0; n < data.items.length; n++) {
      const item = data.items[n];
      const label = `Barang ke-${n + 1}`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${label} tidak valid.`);
      const id = requiredText(item.id, `${label}: ID`, 100);
      if (!/^[a-zA-Z0-9_-]{5,100}$/.test(id)) throw new Error(`${label}: format ID tidak valid.`);
      const cat = CATEGORY_BY_ID[item.categoryId];
      if (!cat || !CATEGORIES.some(c => c.id === item.categoryId)) throw new Error(`${label}: kategori tidak dikenal.`);
      const code = requiredText(item.code, `${label}: kode`, 30).toUpperCase();
      if (!(new RegExp(`^IROS-${cat.code}-\\d{3,6}$`)).test(code) || Number(code.split('-').at(-1)) < 1) {
        throw new Error(`${label}: kode barang tidak cocok dengan kategori.`);
      }
      if (ids.has(id) || codes.has(code)) throw new Error(`${label}: ada ID atau kode barang duplikat. File tidak diimpor agar stok tidak ganda.`);
      ids.add(id); codes.add(code);
      if (!validQuantity(item.quantity)) throw new Error(`${label}: jumlah harus 0–${fmt(MAX_QUANTITY)}, maksimal 3 angka desimal.`);
      if (!UNITS.includes(item.unit)) throw new Error(`${label}: satuan hitung tidak didukung.`);
      if (!Object.hasOwn(CONDITIONS, item.condition)) throw new Error(`${label}: kondisi tidak dikenal.`);
      clean.items.push({
        id, code, categoryId: cat.id,
        name: requiredText(item.name, `${label}: nama`, 120),
        quantity: rounded(item.quantity), unit: item.unit,
        location: requiredText(item.location ?? '', `${label}: lokasi`, 100, true),
        condition: item.condition,
        notes: requiredText(item.notes ?? '', `${label}: catatan`, 600, true),
        createdAt: validTimestamp(item.createdAt, `${label}: waktu dibuat`),
        updatedAt: validTimestamp(item.updatedAt, `${label}: waktu diperbarui`)
      });
      clean.sequences[cat.code] = Math.max(clean.sequences[cat.code], Number(code.split('-').at(-1)));
    }
    for (const cat of CATEGORIES) {
      const sequence = data.sequences?.[cat.code];
      if (Number.isInteger(sequence) && sequence >= 0 && sequence <= 999999) clean.sequences[cat.code] = Math.max(sequence, clean.sequences[cat.code]);
    }
    const eventTypes = ['add', 'update', 'quantity', 'delete', 'undo', 'import', 'restore'];
    // Event history is intentionally capped; it is not an immutable audit trail.
    clean.events = data.events.slice(0, MAX_EVENTS).map((event, n) => {
      if (!event || !eventTypes.includes(event.type)) throw new Error(`Riwayat ke-${n + 1} tidak valid.`);
      return {
        id: requiredText(event.id, 'ID riwayat', 100), type: event.type,
        title: requiredText(event.title, 'Judul riwayat', 160),
        detail: requiredText(event.detail ?? '', 'Detail riwayat', 1200, true),
        at: validTimestamp(event.at, 'Waktu riwayat')
      };
    });
    return clean;
  }
  function readStore() {
    const raw = localStorage.getItem(STORE_KEY);
    return raw === null ? blankStore() : validateStore(JSON.parse(raw));
  }
  function humanError(error) {
    if (error?.name === 'QuotaExceededError') return 'Penyimpanan browser penuh. Perubahan belum disimpan. Unduh cadangan, lalu kosongkan ruang penyimpanan browser yang tidak diperlukan.';
    if (error?.name === 'SecurityError') return 'Browser memblokir penyimpanan. Perubahan belum disimpan. Buka melalui GitHub Pages di browser biasa dan izinkan penyimpanan data situs.';
    if (error instanceof SyntaxError) return 'Format data tidak dapat dibaca. Data lama tidak dihapus. Pilih cadangan JSON yang valid melalui menu Cadangan data.';
    return error?.message || 'Perubahan belum disimpan. Coba lagi dan pastikan penyimpanan browser diizinkan.';
  }
  async function locked(operation) {
    // Web Locks serializes changes from tabs of this same app when supported.
    // Fallback reads latest data immediately before a synchronous write.
    if (navigator.locks?.request) return navigator.locks.request(STORE_KEY, operation);
    return operation();
  }
  /** Apply a synchronous mutator, persist FIRST, then update the rendered state. */
  async function commit(mutator, { saveRecovery = false } = {}) {
    if (isDemo) {
      const draft = clone(demoStore);
      const result = mutator(draft);
      draft.updatedAt = now(); draft.revision += 1;
      demoStore = validateStore(draft);
      render();
      return result;
    }
    return locked(() => {
      const latest = readStore();
      const draft = clone(latest);
      const result = mutator(draft);
      draft.updatedAt = now(); draft.revision = latest.revision + 1;
      const checked = validateStore(draft);
      if (saveRecovery) localStorage.setItem(RECOVERY_KEY, JSON.stringify(latest));
      localStorage.setItem(STORE_KEY, JSON.stringify(checked));
      store = checked; storageIssue = '';
      render();
      return result;
    });
  }
  async function replaceStore(incoming, { restore = false } = {}) {
    if (isDemo) throw new Error('Keluar dari mode contoh terlebih dahulu.');
    return locked(() => {
      const oldRaw = localStorage.getItem(STORE_KEY);
      let oldRevision = 0;
      try { oldRevision = oldRaw ? validateStore(JSON.parse(oldRaw)).revision : 0; } catch (_) { /* Preserve corrupt raw data, never silently overwrite it without a recovery copy. */ }
      const next = validateStore(incoming);
      next.revision = oldRevision + 1; next.updatedAt = now();
      pushEvent(next, restore ? 'restore' : 'import', restore ? 'Data sebelum impor dipulihkan' : 'Inventaris dipulihkan dari cadangan', `${fmt(next.items.length)} baris barang. ${restore ? 'Kembali ke salinan sebelum impor.' : 'Seluruh data barang diganti sesuai file cadangan.'}`);
      if (!restore) localStorage.setItem(RECOVERY_KEY, oldRaw || JSON.stringify(blankStore()));
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      store = next; storageIssue = '';
      if (restore) { try { localStorage.removeItem(RECOVERY_KEY); } catch (_) { /* Main data is already safely persisted. */ } }
      render();
    });
  }
  function pushEvent(target, type, title, detail) {
    target.events.unshift({ id: uid(), type, title: String(title).slice(0, 160), detail: String(detail).slice(0, 1200), at: now() });
    target.events = target.events.slice(0, MAX_EVENTS);
  }
  function nextCode(target, category) {
    const prefix = CATEGORY_BY_ID[category].code;
    let sequence = target.sequences[prefix] || 0;
    const used = new Set(target.items.map(i => i.code));
    let code;
    do { sequence += 1; code = `IROS-${prefix}-${String(sequence).padStart(3, '0')}`; } while (used.has(code) && sequence <= 999999);
    if (sequence > 999999) throw new Error('Batas nomor kode untuk kategori ini sudah tercapai.');
    target.sequences[prefix] = sequence;
    return code;
  }
  function ensureFresh(target, snapshot) {
    const found = target.items.find(i => i.id === snapshot.id);
    if (!found) throw new Error('Barang sudah dihapus di tab lain. Tutup formulir dan periksa daftar terbaru.');
    if (JSON.stringify(found) !== JSON.stringify(snapshot)) throw new Error('Barang ini sudah berubah di tab lain. Tutup formulir, lalu buka kembali agar perubahan terbaru tidak tertimpa.');
    return found;
  }

  function getCategoryItems() { return currentItems().filter(item => categoryId === 'all' || item.categoryId === categoryId); }
  const needsAttention = item => item.quantity === 0 || item.condition !== 'baik';
  function filteredItems() {
    const query = normalize($('search').value);
    const status = $('status-filter').value;
    const items = getCategoryItems().filter(item => {
      const searchMatches = !query || normalize(`${item.name} ${item.code} ${item.location} ${item.notes} ${CATEGORY_BY_ID[item.categoryId].name}`).includes(query);
      const statusMatches = status === 'all' || (status === 'zero' && item.quantity === 0) || (status === 'available' && item.quantity > 0) || (status === 'attention' && needsAttention(item)) || item.condition === status;
      return searchMatches && statusMatches;
    });
    const sort = $('sort-order').value;
    return items.sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'id');
      if (sort === 'quantity') return a.quantity - b.quantity || a.name.localeCompare(b.name, 'id');
      return a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }) || a.code.localeCompare(b.code);
    });
  }
  function renderNav() {
    const items = currentItems();
    const navLink = (id, label, iconName, count) => `<a href="#${id === 'all' ? 'semua' : id}" class="nav-item ${categoryId === id ? 'active' : ''}" ${categoryId === id ? 'aria-current="page"' : ''}>${icon(iconName)}<span>${label}</span><span class="nav-count">${fmt(count)}</span></a>`;
    $('category-nav').innerHTML = navLink('all', 'Semua barang', 'grid', items.length) + '<span class="nav-heading">KATEGORI BARANG</span>' + CATEGORIES.map(c => navLink(c.id, c.name, c.icon, items.filter(i => i.categoryId === c.id).length)).join('');
    $('category-cards').innerHTML = CATEGORIES.map(c => `<a class="category-card" href="#${c.id}"><span class="category-icon">${icon(c.icon)}</span>${icon('right', 'card-arrow')}<strong>${c.name}</strong><small><b>${fmt(items.filter(i => i.categoryId === c.id).length)}</b> jenis barang</small></a>`).join('');
  }
  function renderRows(items) {
    $('inventory-body').innerHTML = items.map(item => {
      const category = CATEGORY_BY_ID[item.categoryId];
      return `<tr>
        <td><div class="name-cell"><span class="item-avatar" aria-hidden="true">${icon(category.icon)}</span><div class="item-info"><span class="item-name">${esc(item.name)}</span><span class="item-code">${esc(item.code)}</span></div></div></td>
        <td class="category-cell"><span class="category-badge">${category.name}</span></td>
        <td class="quantity-cell"><button class="quantity-button ${item.quantity === 0 ? 'zero' : ''}" data-action="quantity" data-id="${esc(item.id)}" aria-label="Ubah jumlah ${esc(item.name)}, saat ini ${fmt(item.quantity)} ${esc(item.unit)}" title="Klik untuk mengubah jumlah"><strong>${fmt(item.quantity)}</strong><span>${esc(item.unit)}</span></button></td>
        <td class="location-cell"><span class="location-text ${item.location ? '' : 'is-empty'}">${item.location ? `${icon('pin', 'tiny')}${esc(item.location)}` : 'Belum diisi'}</span></td>
        <td class="condition-cell"><span class="condition-badge ${item.condition}">${CONDITIONS[item.condition]}</span></td>
        <td class="actions-cell"><div class="row-actions"><button class="edit-button" data-action="edit" data-id="${esc(item.id)}" aria-label="Ubah ${esc(item.name)}">${icon('edit')}Ubah</button><button class="icon-btn delete-button" data-action="delete" data-id="${esc(item.id)}" aria-label="Hapus ${esc(item.name)}" title="Hapus barang">${icon('trash')}</button></div></td>
      </tr>`;
    }).join('');
  }
  function render() {
    const label = categoryId === 'all' ? 'Semua barang' : CATEGORY_BY_ID[categoryId].name;
    document.title = `Inventaris IROS — ${label}${isDemo ? ' (Contoh)' : ''}`;
    $('page-title').innerHTML = `${label}<span class="title-dot">.</span>`;
    $('breadcrumb-current').textContent = label;
    $('page-description').textContent = categoryId === 'all' ? 'Semua perlengkapan IROS, tercatat di satu tempat.' : CATEGORY_BY_ID[categoryId].description;
    $('category-section').hidden = categoryId !== 'all';
    $('table-caption').textContent = `Daftar inventaris IROS — ${label}`;
    $('demo-banner').hidden = !isDemo;
    $('system-banner').hidden = !storageIssue || isDemo;
    if (storageIssue) $('system-banner').innerHTML = `<span>${esc(storageIssue)}</span><button class="btn btn-small" data-action="backup">Buka cadangan data</button>`;
    renderNav(); renderTable(); renderBackupLabels();
    const locations = [...new Set(currentItems().map(i => i.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    $('location-options').innerHTML = locations.map(loc => `<option value="${esc(loc)}"></option>`).join('');
    if ($('history-dialog').open) renderHistory();
    if ($('backup-dialog').open) renderRecovery();
  }
  function renderTable() {
    const items = filteredItems();
    const total = getCategoryItems().length;
    const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), pageCount);
    const start = (currentPage - 1) * PAGE_SIZE;
    renderRows(items.slice(start, start + PAGE_SIZE));
    $('list-total').textContent = `${fmt(total)} jenis`;
    $('table-scroll').hidden = !items.length;
    $('empty-state').hidden = !!items.length;
    $('export-csv').disabled = !items.length;
    $('pagination').hidden = pageCount <= 1;
    $('page-number').textContent = `${currentPage} / ${pageCount}`;
    $('prev-page').disabled = currentPage <= 1;
    $('next-page').disabled = currentPage >= pageCount;
    const hasFilters = !!$('search').value || $('status-filter').value !== 'all';
    $('active-filters').hidden = !hasFilters;
    const statusLabel = $('status-filter').selectedOptions[0].textContent;
    $('filter-summary').textContent = `${fmt(items.length)} hasil${$('search').value ? ` untuk “${$('search').value}”` : ''}${$('status-filter').value !== 'all' ? ` · ${statusLabel}` : ''}`;
    const attention = getCategoryItems().filter(needsAttention).length;
    $('attention-filter').hidden = !attention;
    $('attention-text').textContent = `${fmt(attention)} perlu perhatian`;
    $('result-count').textContent = items.length ? `${fmt(start + 1)}–${fmt(Math.min(start + PAGE_SIZE, items.length))} dari ${fmt(items.length)} jenis barang${hasFilters ? ` · ${fmt(total)} total di kategori ini` : ''}` : total ? 'Tidak ada barang yang sesuai pencarian atau filter.' : 'Belum ada barang tercatat.';
    if (!items.length) {
      const noMatches = hasFilters;
      $('empty-title').textContent = noMatches ? 'Barangnya belum ketemu.' : categoryId === 'all' ? 'Mulai dari barang pertama.' : 'Kategori ini masih kosong.';
      $('empty-description').textContent = noMatches ? 'Coba nama lain atau hapus filter untuk melihat daftar barang.' : categoryId === 'all' ? 'Tidak perlu mendata semuanya sekaligus. Tambahkan satu barang, lalu lanjutkan pelan-pelan.' : `Tambahkan barang pertama untuk kategori ${CATEGORY_BY_ID[categoryId].name.toLocaleLowerCase('id-ID')}.`;
      $('empty-add').hidden = noMatches;
      $('empty-clear').hidden = !noMatches;
      $('try-demo').hidden = noMatches || isDemo || currentItems().length > 0;
    }
  }
  function readBackupMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (_) { return null; } }
  function renderBackupLabels() {
    const state = currentStore();
    const last = readBackupMeta();
    const validLast = last && typeof last.at === 'string' && Number.isFinite(Date.parse(last.at));
    $('save-status').textContent = isDemo ? 'Mode contoh' : storageIssue ? 'Periksa penyimpanan' : state.updatedAt ? 'Tersimpan di browser' : 'Penyimpanan lokal';
    $('backup-last-time').textContent = validLast ? `Unduhan cadangan terakhir: ${dateTime(last.at)}.` : 'Belum ada unduhan cadangan.';
    $('last-backup-label').textContent = isDemo ? 'Data contoh tidak masuk inventaris asli.' : validLast ? (last.dataUpdatedAt === store.updatedAt ? `Cadangan: ${dateTime(last.at)}` : 'Ada perubahan setelah cadangan terakhir.') : 'Buat cadangan setelah selesai mendata.';
  }
  function resetFilters() { $('search').value = ''; $('status-filter').value = 'all'; currentPage = 1; renderTable(); }
  function updateRoute() {
    const hash = location.hash.slice(1);
    categoryId = CATEGORIES.some(c => c.id === hash) ? hash : 'all';
    $('search').value = ''; $('status-filter').value = 'all'; currentPage = 1;
    closeSidebar(); render();
  }

  function showError(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
  function openModal(id) {
    const dialog = $(id);
    dialogReturnFocus.set(dialog, document.activeElement);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function closeModal(id) { if ($(id).open) $(id).close(); }
  function openConfirm({ title, description, label, danger = false, onConfirm }) {
    $('confirm-title').textContent = title;
    $('confirm-description').textContent = description;
    $('confirm-action').textContent = label;
    $('confirm-action').className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    $('confirm-action').disabled = false;
    showError('confirm-error'); confirmHandler = onConfirm; confirmBusy = false;
    openModal('confirm-dialog');
  }
  function toast(message, { error = false, actionLabel = '', action = null, duration = 6500 } = {}) {
    const el = document.createElement('div');
    el.className = `toast${error ? ' error' : ''}`;
    if (error) el.setAttribute('role', 'alert');
    el.innerHTML = `${icon(error ? 'alert' : 'check')}<span>${esc(message)}</span>`;
    if (action && actionLabel) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = actionLabel;
      button.addEventListener('click', async () => { button.disabled = true; try { await action(); el.remove(); } catch (e) { button.disabled = false; toast(humanError(e), { error: true, duration: 13000 }); } });
      el.append(button);
    }
    const close = document.createElement('button'); close.type = 'button'; close.className = 'toast-close'; close.setAttribute('aria-label', 'Tutup pemberitahuan'); close.innerHTML = icon('close'); close.addEventListener('click', () => el.remove()); el.append(close);
    $('toasts').append(el);
    while ($('toasts').children.length > 3) $('toasts').firstElementChild.remove();
    let timer = setTimeout(() => el.remove(), duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(() => el.remove(), duration); });
    el.addEventListener('focusin', () => clearTimeout(timer));
    el.addEventListener('focusout', () => { timer = setTimeout(() => el.remove(), duration); });
  }

  function openItem(id = null) {
    editingItem = id ? clone(currentItems().find(i => i.id === id) || null) : null;
    if (id && !editingItem) return toast('Barang sudah tidak ada. Daftar telah diperbarui.', { error: true });
    unitTouched = !!editingItem;
    $('item-form').reset(); $('extra-fields').open = false; showError('item-error');
    $('item-dialog-title').textContent = editingItem ? 'Ubah barang' : 'Tambah barang';
    $('item-eyebrow').textContent = editingItem ? 'PERBARUI DATA BARANG' : 'DATA BARANG BARU';
    $('item-name').value = editingItem?.name || '';
    $('item-category').value = editingItem?.categoryId || (categoryId === 'all' ? '' : categoryId);
    $('item-quantity').value = editingItem?.quantity ?? 1;
    $('item-unit').value = editingItem?.unit || CATEGORY_BY_ID[$('item-category').value]?.unit || 'unit';
    $('item-location').value = editingItem?.location || '';
    $('item-condition').value = editingItem?.condition || 'perlu-dicek';
    $('item-notes').value = editingItem?.notes || '';
    $('save-item').disabled = false;
    updateCodeNote(); openModal('item-dialog');
    $('item-name').focus();
  }
  function updateCodeNote() {
    $('code-note').textContent = editingItem ? $('item-category').value === editingItem.categoryId ? `Kode barang: ${editingItem.code}.` : 'Kategori berubah; kode baru dibuat otomatis. Kode lama tidak digunakan ulang.' : 'Kode barang dibuat otomatis setelah disimpan.';
  }
  function readItemForm() {
    const input = {
      name: requiredText($('item-name').value, 'Nama barang', 120),
      categoryId: $('item-category').value,
      quantity: Number($('item-quantity').value),
      unit: $('item-unit').value,
      location: requiredText($('item-location').value, 'Lokasi', 100, true),
      condition: $('item-condition').value,
      notes: requiredText($('item-notes').value, 'Catatan', 600, true)
    };
    if (!CATEGORIES.some(c => c.id === input.categoryId)) throw new Error('Pilih kategori barang terlebih dahulu.');
    if (!validQuantity(input.quantity) || $('item-quantity').value === '') throw new Error('Jumlah harus nol atau lebih, maksimal 3 angka desimal.');
    input.quantity = rounded(input.quantity);
    return input;
  }
  async function saveItem(input, snapshot) {
    $('save-item').disabled = true;
    try {
      const saved = await commit(draft => {
        if (snapshot) {
          const existing = ensureFresh(draft, snapshot);
          const updated = { ...existing, ...input, updatedAt: now() };
          if (existing.categoryId !== input.categoryId) updated.code = nextCode(draft, input.categoryId);
          draft.items[draft.items.findIndex(i => i.id === existing.id)] = updated;
          const detail = [];
          if (existing.name !== updated.name) detail.push(`Nama: ${existing.name} → ${updated.name}.`);
          if (existing.quantity !== updated.quantity || existing.unit !== updated.unit) detail.push(`Jumlah: ${fmt(existing.quantity)} ${existing.unit} → ${fmt(updated.quantity)} ${updated.unit}.`);
          if (existing.categoryId !== updated.categoryId) detail.push(`Kategori: ${CATEGORY_BY_ID[existing.categoryId].name} → ${CATEGORY_BY_ID[updated.categoryId].name}. Kode: ${existing.code} → ${updated.code}.`);
          if (existing.location !== updated.location) detail.push(`Lokasi: ${existing.location || 'belum diisi'} → ${updated.location || 'belum diisi'}.`);
          if (existing.condition !== updated.condition) detail.push(`Kondisi: ${CONDITIONS[existing.condition]} → ${CONDITIONS[updated.condition]}.`);
          if (existing.notes !== updated.notes) detail.push('Catatan diubah.');
          pushEvent(draft, 'update', updated.name, `${updated.code} · ${detail.join(' ') || 'Detail barang disimpan kembali.'}`);
          return updated;
        }
        if (draft.items.length >= MAX_ITEMS) throw new Error(`Batas ${fmt(MAX_ITEMS)} baris sudah tercapai.`);
        const stamp = now();
        const created = { id: uid(), code: nextCode(draft, input.categoryId), ...input, createdAt: stamp, updatedAt: stamp };
        draft.items.push(created);
        pushEvent(draft, 'add', created.name, `${created.code} · Ditambahkan: ${fmt(created.quantity)} ${created.unit}. ${CATEGORY_BY_ID[created.categoryId].name}.`);
        return created;
      });
      closeModal('item-dialog');
      if (categoryId !== 'all' && categoryId !== saved.categoryId) location.hash = saved.categoryId;
      resetFilters();
      toast(`${saved.name} ${snapshot ? 'berhasil diperbarui' : 'berhasil ditambahkan'}${isDemo ? ' (contoh)' : ''}.`);
    } catch (error) { showError('item-error', humanError(error)); throw error; }
    finally { $('save-item').disabled = false; }
  }
  async function submitItem(event) {
    event.preventDefault(); showError('item-error');
    if (!$('item-form').reportValidity()) return;
    try {
      const input = readItemForm();
      const snapshot = editingItem ? clone(editingItem) : null;
      const duplicate = currentItems().find(i => i.id !== snapshot?.id && normalize(i.name) === normalize(input.name) && i.categoryId === input.categoryId && normalize(i.location) === normalize(input.location) && i.condition === input.condition);
      if (duplicate) {
        openConfirm({ title: 'Barang serupa sudah tercatat', description: `“${duplicate.name}” (${duplicate.code}) memiliki kategori, lokasi, dan kondisi yang sama. Untuk menambah stok barang lama, batalkan lalu klik jumlahnya. Tetap simpan sebagai baris terpisah?`, label: 'Simpan baris terpisah', onConfirm: () => saveItem(input, snapshot) });
      } else { await saveItem(input, snapshot); }
    } catch (error) { showError('item-error', humanError(error)); }
  }
  function openQuantity(id) {
    quantityItem = clone(currentItems().find(i => i.id === id) || null);
    if (!quantityItem) return toast('Barang tidak ditemukan.', { error: true });
    $('quantity-form').reset(); showError('quantity-error');
    $('quantity-name').textContent = `${quantityItem.name} · ${quantityItem.code}`;
    $('quantity-current').textContent = `${fmt(quantityItem.quantity)} ${quantityItem.unit}`;
    $('quantity-value').value = '1';
    previewQuantity(); openModal('quantity-dialog'); $('quantity-value').select();
  }
  function quantityMode() { return document.querySelector('input[name="quantity-mode"]:checked').value; }
  function quantityResult() {
    const amount = Number($('quantity-value').value);
    const mode = quantityMode();
    return rounded(mode === 'set' ? amount : quantityItem.quantity + (mode === 'subtract' ? -amount : amount));
  }
  function previewQuantity() {
    if (!quantityItem) return;
    const mode = quantityMode();
    $('quantity-input-label').textContent = { add: 'Jumlah yang ditambahkan', subtract: 'Jumlah yang dikurangi', set: 'Jumlah akhir yang benar' }[mode];
    $('quantity-value').min = mode === 'set' ? '0' : '0.001';
    const result = quantityResult();
    const valid = validQuantity(result);
    $('quantity-result').textContent = valid ? `${fmt(result)} ${quantityItem.unit}` : 'Jumlah tidak valid';
    $('quantity-result').parentElement.classList.toggle('invalid', !valid);
  }
  async function submitQuantity(event) {
    event.preventDefault(); showError('quantity-error');
    if (!$('quantity-form').reportValidity()) return;
    const button = $('quantity-form').querySelector('[type="submit"]'); button.disabled = true;
    try {
      const value = Number($('quantity-value').value);
      const result = quantityResult();
      if (!validQuantity(value) || !validQuantity(result)) throw new Error('Jumlah akhir tidak boleh negatif atau melebihi batas. Gunakan maksimal 3 angka desimal.');
      const reason = requiredText($('quantity-reason').value, 'Keterangan', 200, true);
      const name = quantityItem.name;
      await commit(draft => {
        const item = ensureFresh(draft, quantityItem);
        const before = item.quantity; item.quantity = result; item.updatedAt = now();
        const operation = { add: 'Tambah', subtract: 'Kurangi', set: 'Atur ulang' }[quantityMode()];
        pushEvent(draft, 'quantity', item.name, `${item.code} · ${operation}: ${fmt(before)} → ${fmt(result)} ${item.unit}.${reason ? ` ${reason}` : ''}`);
      });
      closeModal('quantity-dialog'); toast(`Jumlah ${name} diperbarui menjadi ${fmt(result)} ${quantityItem.unit}.`);
    } catch (error) { showError('quantity-error', humanError(error)); }
    finally { button.disabled = false; }
  }
  function deleteItem(id) {
    const item = currentItems().find(i => i.id === id);
    if (!item) return;
    const snapshot = clone(item); const wasDemo = isDemo;
    openConfirm({ title: 'Hapus barang ini?', description: `“${item.name}” (${item.code}), sebanyak ${fmt(item.quantity)} ${item.unit}, akan dihapus dari daftar. Untuk mencatat stok habis, ubah jumlahnya menjadi 0 tanpa menghapus barang.`, label: 'Hapus barang', danger: true, onConfirm: async () => {
      await commit(draft => { ensureFresh(draft, snapshot); draft.items = draft.items.filter(i => i.id !== id); pushEvent(draft, 'delete', item.name, `${item.code} · Dihapus dari inventaris (${fmt(item.quantity)} ${item.unit}).`); });
      toast(`${item.name} dihapus.`, { duration: 12000, actionLabel: 'Batalkan', action: async () => {
        if (wasDemo !== isDemo) throw new Error('Mode inventaris sudah berubah. Pembatalan tidak diterapkan ke data lain.');
        await commit(draft => {
          if (draft.items.some(i => i.id === snapshot.id || i.code === snapshot.code)) throw new Error('ID atau kode barang sudah digunakan. Pembatalan tidak menggandakan data.');
          if (draft.items.length >= MAX_ITEMS) throw new Error('Batas jumlah baris sudah tercapai.');
          draft.items.push({ ...snapshot, updatedAt: now() });
          pushEvent(draft, 'undo', snapshot.name, `${snapshot.code} · Penghapusan dibatalkan.`);
        });
        toast('Penghapusan dibatalkan. Barang kembali ke daftar.');
      } });
    } });
  }

  function fileStamp() {
    const d = new Date(); const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
  function download(content, filename, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function downloadBackup() {
    if (isDemo) return toast('Keluar dari mode contoh untuk mencadangkan data asli.', { error: true });
    try {
      // Read the latest persisted state, not a potentially stale rendered copy.
      store = readStore();
      const at = now();
      download(JSON.stringify({ ...store, exportedAt: at }, null, 2), `iros-inventaris-${fileStamp()}.json`, 'application/json;charset=utf-8');
      try { localStorage.setItem(META_KEY, JSON.stringify({ at, dataUpdatedAt: store.updatedAt })); } catch (_) { /* File download does not require saving this optional UI metadata. */ }
      renderBackupLabels(); toast('Unduhan cadangan dimulai. Simpan file JSON di tempat aman.');
    } catch (error) { toast(humanError(error), { error: true, duration: 13000 }); }
  }
  function csvCell(value) {
    let text = String(value ?? '');
    // Defend against spreadsheet formula injection, including whitespace prefixes.
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  }
  function exportCSV() {
    const items = filteredItems(); if (!items.length) return;
    const rows = [['Kode', 'Nama Barang', 'Kategori', 'Jumlah', 'Satuan', 'Lokasi', 'Kondisi', 'Catatan', 'Diperbarui'], ...items.map(i => [i.code, i.name, CATEGORY_BY_ID[i.categoryId].name, i.quantity, i.unit, i.location, CONDITIONS[i.condition], i.notes, i.updatedAt])];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    download(csv, `iros-${categoryId === 'all' ? 'semua-barang' : categoryId}${isDemo ? '-CONTOH' : ''}-${fileStamp()}.csv`, 'text/csv;charset=utf-8');
    toast(`${fmt(items.length)} baris sesuai filter diekspor ke CSV.`);
  }
  function renderRecovery() {
    let exists = false;
    try { const raw = localStorage.getItem(RECOVERY_KEY); if (raw) { validateStore(JSON.parse(raw)); exists = true; } } catch (_) { /* Invalid backups are never automatically restored. */ }
    $('restore-previous').hidden = !exists;
    $('download-raw').hidden = !storageIssue;
    $('download-backup').disabled = !!storageIssue;
  }
  function openBackup() {
    if (isDemo) return toast('Keluar dari mode contoh untuk mengelola cadangan data asli.');
    pendingImport = null; $('import-file').value = ''; $('import-file-name').textContent = 'Format .json · maksimal 5 MB'; $('import-preview').hidden = true; showError('import-error');
    document.querySelector('input[name="import-mode"][value="merge"]').checked = true;
    renderRecovery(); renderBackupLabels(); openModal('backup-dialog');
  }
  async function readImportFile() {
    pendingImport = null; $('import-preview').hidden = true; showError('import-error');
    const file = $('import-file').files[0];
    if (!file) return;
    $('import-file-name').textContent = file.name;
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('File terlalu besar. Maksimal 5 MB untuk satu file cadangan.');
      const raw = await file.text();
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      pendingImport = validateStore(parsed);
      const existingIds = new Set(store.items.map(i => i.id));
      const existingCodes = new Set(store.items.map(i => i.code));
      const existingCount = pendingImport.items.filter(i => existingIds.has(i.id) || existingCodes.has(i.code)).length;
      $('import-summary').textContent = `${fmt(pendingImport.items.length)} baris barang · ${fmt(existingCount)} kode/ID sudah ada di browser ini.`;
      $('import-preview').hidden = false;
      if (storageIssue) document.querySelector('input[name="import-mode"][value="replace"]').checked = true;
    } catch (error) { showError('import-error', humanError(error)); }
  }
  function applyImport() {
    if (!pendingImport) return;
    const incoming = clone(pendingImport);
    const replace = document.querySelector('input[name="import-mode"]:checked').value === 'replace';
    openConfirm({ title: replace ? 'Ganti seluruh inventaris?' : 'Tambahkan dari cadangan?', description: replace ? `Seluruh data barang di browser ini akan diganti dengan ${fmt(incoming.items.length)} baris dari file cadangan. Salinan data sebelum impor disimpan untuk pemulihan satu langkah; cadangan file terpisah tetap disarankan.` : `Barang dengan ID atau kode yang sudah ada akan dilewati, bukan dijumlahkan atau diperbarui. Hanya baris baru yang ditambahkan dari ${fmt(incoming.items.length)} baris dalam cadangan.`, label: replace ? 'Ganti dengan cadangan' : 'Tambahkan barang baru', danger: replace, onConfirm: async () => {
      let added = 0; let skipped = 0;
      if (replace) { await replaceStore(incoming); added = incoming.items.length; }
      else {
        await commit(draft => {
          const ids = new Set(draft.items.map(i => i.id)); const codes = new Set(draft.items.map(i => i.code));
          for (const item of incoming.items) {
            if (ids.has(item.id) || codes.has(item.code)) { skipped += 1; continue; }
            if (draft.items.length >= MAX_ITEMS) throw new Error(`Gabungan data melebihi ${fmt(MAX_ITEMS)} baris. Tidak ada data yang diimpor.`);
            draft.items.push(clone(item)); ids.add(item.id); codes.add(item.code); added += 1;
          }
          CATEGORIES.forEach(c => { draft.sequences[c.code] = Math.max(draft.sequences[c.code], incoming.sequences[c.code]); });
          pushEvent(draft, 'import', 'Barang baru dari cadangan', `${fmt(added)} ditambahkan, ${fmt(skipped)} dilewati karena ID/kode sudah ada. Riwayat pada file sumber tidak digabungkan.`);
        }, { saveRecovery: true });
      }
      closeModal('backup-dialog'); pendingImport = null;
      resetFilters(); toast(replace ? `${fmt(added)} baris barang dipulihkan dari cadangan.` : `${fmt(added)} barang ditambahkan. ${fmt(skipped)} kode/ID yang sudah ada dilewati.`, { duration: 9500 });
    } });
  }
  function restorePrevious() {
    openConfirm({ title: 'Kembali ke data sebelum impor?', description: 'Data saat ini akan diganti dengan salinan yang tersimpan sebelum impor terakhir. Perubahan setelah impor tidak ikut dipertahankan. Unduh cadangan data saat ini terlebih dahulu bila masih diperlukan.', label: 'Pulihkan data sebelumnya', danger: true, onConfirm: async () => {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) throw new Error('Salinan sebelum impor tidak tersedia.');
      const previous = validateStore(JSON.parse(raw));
      await replaceStore(previous, { restore: true });
      closeModal('backup-dialog'); resetFilters(); toast('Data sebelum impor berhasil dipulihkan.');
    } });
  }
  function renderHistory() {
    const events = currentStore().events;
    if (!events.length) { $('history-list').innerHTML = '<p class="history-empty">Belum ada perubahan. Aktivitas akan muncul setelah barang mulai dicatat.</p>'; return; }
    const icons = { add: 'plus', update: 'edit', quantity: 'box', delete: 'trash', undo: 'history', import: 'upload', restore: 'history' };
    const labels = { add: 'Barang ditambahkan', update: 'Detail diubah', quantity: 'Jumlah diubah', delete: 'Barang dihapus', undo: 'Penghapusan dibatalkan', import: 'Data diimpor', restore: 'Data dipulihkan' };
    $('history-list').innerHTML = events.map(e => `<article class="history-entry"><span class="history-icon">${icon(icons[e.type])}</span><div><h3>${esc(e.title)}</h3><p>${labels[e.type]}<br>${esc(e.detail)}</p><time datetime="${esc(e.at)}">${esc(dateTime(e.at))}</time></div></article>`).join('');
  }

  function makeDemo() {
    const data = blankStore(); const stamp = now();
    const examples = [
      ['robot-kit', 'Kit line follower', 6, 'set', 'Rak A · Kotak 01', 'baik', 'Data contoh, bukan hasil stok opname.'],
      ['robot-kit', 'Kit Solar Fan', 8, 'set', 'Rak A · Kotak 02', 'baik', 'Contoh satu baris per jenis kit.'],
      ['robot-kit', 'Robot soccer demo', 2, 'unit', 'Rak A · Atas', 'perlu-dicek', ''],
      ['elektronik', 'Arduino Uno R3', 12, 'pcs', 'Rak B · Kotak 01', 'baik', ''],
      ['elektronik', 'ESP32 DevKit', 8, 'pcs', 'Rak B · Kotak 02', 'baik', ''],
      ['elektronik', 'Sensor ultrasonik HC-SR04', 14, 'pcs', 'Rak B · Kotak 03', 'baik', ''],
      ['elektronik', 'Motor DC gearbox', 20, 'pcs', 'Rak B · Kotak 04', 'baik', ''],
      ['tools', 'Multimeter digital', 3, 'unit', 'Laci tools · 01', 'baik', ''],
      ['tools', 'Solder listrik', 2, 'unit', 'Laci tools · 02', 'perlu-dicek', 'Periksa sebelum digunakan.'],
      ['habis-pakai', 'Cable ties 10 cm', 0, 'pak', 'Rak C · Kotak 01', 'baik', 'Contoh stok habis.'],
      ['habis-pakai', 'Lem tembak isi ulang', 25, 'pcs', 'Rak C · Kotak 02', 'baik', ''],
      ['habis-pakai', 'Timah solder', 2, 'rol', 'Rak C · Kotak 03', 'baik', ''],
      ['kelas', 'Alas kerja siswa', 18, 'pcs', 'Lemari kelas', 'baik', ''],
      ['kelas', 'Papan tulis kecil', 1, 'unit', 'Ruang kelas', 'baik', ''],
      ['event', 'Banner IROS', 2, 'unit', 'Gudang event', 'rusak', 'Contoh kondisi rusak.'],
      ['event', 'Arena robot', 1, 'set', 'Gudang event', 'baik', '']
    ];
    for (const [category, name, quantity, unit, location, condition, notes] of examples) {
      data.items.push({ id: uid(), code: nextCode(data, category), categoryId: category, name, quantity, unit, location, condition, notes, createdAt: stamp, updatedAt: stamp });
    }
    return data;
  }
  function enterDemo() {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    demoStore = makeDemo(); isDemo = true;
    const url = new URL(location.href); url.searchParams.set('demo', '1'); url.hash = 'semua'; history.replaceState(null, '', url);
    categoryId = 'all'; resetFilters(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Mode contoh aktif. Data asli tidak diubah.');
  }
  function exitDemo() {
    isDemo = false; demoStore = null;
    const url = new URL(location.href); url.searchParams.delete('demo'); url.hash = 'semua'; history.replaceState(null, '', url);
    categoryId = 'all'; resetFilters(); render(); toast('Kembali ke inventaris asli di browser ini.');
  }
  function openSidebar() {
    if (!matchMedia('(max-width: 760px)').matches) return;
    drawerReturnFocus = document.activeElement;
    $('sidebar').inert = false; $('sidebar').classList.add('open'); $('sidebar-scrim').hidden = false;
    $('open-sidebar').setAttribute('aria-expanded', 'true'); document.querySelector('.app-shell').inert = true;
    document.body.style.overflow = 'hidden'; $('close-sidebar').focus();
  }
  function closeSidebar() {
    const wasOpen = $('sidebar').classList.contains('open');
    $('sidebar').classList.remove('open'); $('sidebar-scrim').hidden = true;
    $('open-sidebar').setAttribute('aria-expanded', 'false'); document.querySelector('.app-shell').inert = false;
    document.body.style.overflow = '';
    $('sidebar').inert = matchMedia('(max-width: 760px)').matches;
    if (wasOpen && drawerReturnFocus?.isConnected) drawerReturnFocus.focus();
  }
  function bindEvents() {
    $('item-category').innerHTML = '<option value="">Pilih kategori barang</option>' + CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    $('item-unit').innerHTML = UNITS.map(unit => `<option value="${unit}">${unit}</option>`).join('');
    window.addEventListener('hashchange', updateRoute);
    $('search').addEventListener('input', () => { currentPage = 1; renderTable(); });
    $('status-filter').addEventListener('change', () => { currentPage = 1; renderTable(); });
    $('sort-order').addEventListener('change', () => { currentPage = 1; renderTable(); });
    $('clear-filters').addEventListener('click', resetFilters); $('empty-clear').addEventListener('click', resetFilters);
    $('attention-filter').addEventListener('click', () => { $('status-filter').value = 'attention'; currentPage = 1; renderTable(); });
    $('prev-page').addEventListener('click', () => { currentPage -= 1; renderTable(); });
    $('next-page').addEventListener('click', () => { currentPage += 1; renderTable(); });
    $('export-csv').addEventListener('click', exportCSV);
    $('item-form').addEventListener('submit', submitItem);
    $('item-category').addEventListener('change', () => { if (!unitTouched && CATEGORY_BY_ID[$('item-category').value]) $('item-unit').value = CATEGORY_BY_ID[$('item-category').value].unit; updateCodeNote(); });
    $('item-unit').addEventListener('change', () => { unitTouched = true; });
    $('quantity-form').addEventListener('submit', submitQuantity);
    $('quantity-value').addEventListener('input', previewQuantity);
    document.querySelectorAll('input[name="quantity-mode"]').forEach(input => input.addEventListener('change', previewQuantity));
    $('download-backup').addEventListener('click', downloadBackup);
    $('import-file').addEventListener('change', readImportFile);
    $('apply-import').addEventListener('click', applyImport);
    $('restore-previous').addEventListener('click', restorePrevious);
    $('download-raw').addEventListener('click', () => {
      try { download(localStorage.getItem(STORE_KEY) || '', `iros-data-mentah-${fileStamp()}.txt`, 'text/plain;charset=utf-8'); toast('Data mentah diunduh tanpa diubah.'); }
      catch (error) { toast(humanError(error), { error: true }); }
    });
    $('confirm-action').addEventListener('click', async () => {
      if (!confirmHandler || confirmBusy) return;
      confirmBusy = true; $('confirm-action').disabled = true; showError('confirm-error');
      try { await confirmHandler(); closeModal('confirm-dialog'); }
      catch (error) { showError('confirm-error', humanError(error)); }
      finally { confirmBusy = false; $('confirm-action').disabled = false; }
    });
    document.addEventListener('click', event => {
      const close = event.target.closest('[data-close]');
      if (close) { const dialog = close.closest('dialog'); if (dialog?.id === 'confirm-dialog' && confirmBusy) return; dialog?.close(); return; }
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.action; const id = button.dataset.id;
      if ($('sidebar').contains(button)) closeSidebar();
      switch (action) {
        case 'add': openItem(); break;
        case 'edit': openItem(id); break;
        case 'quantity': openQuantity(id); break;
        case 'delete': deleteItem(id); break;
        case 'backup': openBackup(); break;
        case 'history': renderHistory(); openModal('history-dialog'); break;
        case 'help': openModal('help-dialog'); break;
        case 'demo': enterDemo(); break;
        case 'exit-demo': exitDemo(); break;
      }
    });
    $('category-nav').addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (link && link.getAttribute('href') === location.hash) { closeSidebar(); resetFilters(); }
    });
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('cancel', event => { if (dialog.id === 'confirm-dialog' && confirmBusy) event.preventDefault(); });
      dialog.addEventListener('close', () => {
        const target = dialogReturnFocus.get(dialog);
        if (target?.isConnected && !target.closest('[inert]')) { try { target.focus(); } catch (_) {} }
        else if (!document.querySelector('dialog[open]')) document.querySelector('.page-heading [data-action="add"]').focus({ preventScroll: true });
      });
    });
    $('open-sidebar').addEventListener('click', openSidebar); $('close-sidebar').addEventListener('click', closeSidebar); $('sidebar-scrim').addEventListener('click', closeSidebar);
    matchMedia('(max-width: 760px)').addEventListener('change', closeSidebar);
    document.addEventListener('keydown', event => {
      if ($('sidebar').classList.contains('open')) {
        if (event.key === 'Escape') { event.preventDefault(); closeSidebar(); }
        if (event.key === 'Tab') {
          const elements = [...$('sidebar').querySelectorAll('a,button:not([disabled])')].filter(el => el.offsetParent !== null);
          const first = elements[0]; const last = elements.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
      }
      if (event.key === '/' && !event.ctrlKey && !event.altKey && !event.metaKey && !document.querySelector('dialog[open]') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); $('search').focus(); }
    });
    window.addEventListener('storage', event => {
      if (event.key === STORE_KEY || event.key === null) {
        try { store = readStore(); storageIssue = ''; } catch (error) { storageIssue = humanError(error); }
        if (!isDemo) { render(); toast('Penyimpanan berubah di tab lain. Daftar diperbarui.'); }
      } else if (event.key === META_KEY) renderBackupLabels();
    });
  }
  function init() {
    try { store = readStore(); }
    catch (error) { storageIssue = `Data belum dapat dibaca. ${humanError(error)}`; }
    bindEvents();
    if (new URLSearchParams(location.search).get('demo') === '1') { isDemo = true; demoStore = makeDemo(); }
    updateRoute();
  }
  init();
})();
