// Shared helpers: storage, file download/open, HTML sanitizing.

// Storage lives in IndexedDB (hundreds of MB) behind a synchronous in-memory cache:
// pages `await Store.ready` once, then get/set are instant and writes persist in the background.
// Falls back to localStorage (~5 MB) where IndexedDB is unavailable.
const Store = (() => {
  const cache = new Map();
  const listeners = new Set();
  const channel = 'BroadcastChannel' in self ? new BroadcastChannel('opendesk-store') : null;
  let db = null, pending = Promise.resolve(), backend = 'memory';

  const clone = v => (v == null ? null : structuredClone(v));
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('opendesk', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('blocked'));
    });
  }

  function persist(op, key, value) {
    if (backend === 'local') {
      try { op === 'put' ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key); return true; }
      catch { return false; }
    }
    if (backend !== 'idb') return true;
    pending = pending.then(() => new Promise(resolve => {
      const tx = db.transaction('kv', 'readwrite');
      op === 'put' ? tx.objectStore('kv').put(value, key) : tx.objectStore('kv').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => {
        if (/quota/i.test(tx.error?.name || '')) Docs.storageFull();
        resolve();
      };
    }));
    return true;
  }

  const ready = (async () => {
    try {
      db = await openDB();
      const store = db.transaction('kv').objectStore('kv');
      const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
      keys.forEach((k, i) => cache.set(k, values[i]));
      backend = 'idb';
      // One-time copy of data saved before the IndexedDB move. The localStorage copy is left in place.
      if (!cache.has('opendesk.storage-migrated')) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith('opendesk.') && !cache.has(k)) { const v = lsGet(k); cache.set(k, v); persist('put', k, v); }
        }
        cache.set('opendesk.storage-migrated', true); persist('put', 'opendesk.storage-migrated', true);
      }
    } catch {
      backend = 'local';
      try {
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('opendesk.')) cache.set(k, lsGet(k)); }
      } catch { backend = 'memory'; }
    }
  })();

  // Other tabs' writes arrive here so live data and file lists stay current.
  if (channel) channel.onmessage = e => {
    const { key, value, removed } = e.data || {};
    if (typeof key !== 'string') return;
    removed ? cache.delete(key) : cache.set(key, value);
    listeners.forEach(fn => fn(key));
  };

  return {
    ready,
    get backend() { return backend; },
    get(key) { return clone(cache.get(key)); },
    // Returns false only when the localStorage fallback is full (IndexedDB quota errors alert via Docs.storageFull).
    set(key, value) {
      const v = clone(value);
      cache.set(key, v);
      channel?.postMessage({ key, value: v });
      return persist('put', key, v);
    },
    remove(key) {
      cache.delete(key);
      channel?.postMessage({ key, removed: true });
      persist('delete', key);
    },
    keys() { return [...cache.keys()]; },
    // Resolves once every write so far is safely on disk — await before navigating away.
    flush() { return pending; },
    subscribe(fn) { listeners.add(fn); },
  };
})();

// Navigate only after pending writes are saved (a just-created file must exist on the next page).
async function go(url, replace) {
  await Store.flush();
  replace ? location.replace(url) : (location.href = url);
}

function download(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

function safeName(title, fallback) {
  return (title || fallback).replace(/[\\/:*?"<>|]+/g, '_').trim() || fallback;
}

// Strip anything executable from untrusted HTML (opened files, share links).
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script,style,iframe,frame,object,embed,link,meta,base,form,input,button,textarea,select')
    .forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    const name = a.name.toLowerCase();
    if (name.startsWith('on')) n.removeAttribute(a.name);
    else if (/(^|:)(href|src|action|formaction)$/.test(name) &&
             !/^\s*(https?:|mailto:|#|data:image\/(png|jpe?g|gif|webp);)/i.test(a.value)) n.removeAttribute(a.name);
  }));
  return doc.body.innerHTML;
}

// Multiple named documents. Index at "opendesk.index"; content at "opendesk.doc.<id>";
// version history at "opendesk.doc.<id>.history".
const Docs = {
  INDEX: 'opendesk.index',
  key: id => 'opendesk.doc.' + id,
  url: (app, id) => `${app}.html?id=${encodeURIComponent(id)}`,
  all() { return Store.get(this.INDEX) || []; },
  list(app) { return this.all().filter(d => !app || d.app === app).sort((a, b) => b.updated - a.updated); },
  meta(id) { return this.all().find(d => d.id === id); },
  get(id) { return Store.get(this.key(id)); },
  warned: false,
  storageFull() {
    if (this.warned) return;
    this.warned = true;
    alert('Browser storage is full, so recent changes are NOT being saved.\n\nDownload your file now (Save/Export), then free space from the OpenDesk home page: delete old files or remove large images.');
  },
  create(app, state) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    if (!Store.set(this.key(id), state)) { this.storageFull(); return null; }
    const index = this.all();
    index.push({ id, app, title: String(state.title || 'Untitled'), updated: Date.now() });
    Store.set(this.INDEX, index);
    return id;
  },
  save(id, state) {
    if (!Store.set(this.key(id), state)) { this.storageFull(); return false; }
    const index = this.all();
    const m = index.find(d => d.id === id);
    if (m) { m.title = String(state.title || 'Untitled'); m.updated = Date.now(); Store.set(this.INDEX, index); }
    return true;
  },
  remove(id) {
    Store.remove(this.key(id)); Store.remove(this.key(id) + '.history');
    Store.set(this.INDEX, this.all().filter(d => d.id !== id));
  },
  // Move single-file data saved before multi-file support into a normal file (once). Returns its id.
  migrate(app) {
    const legacyKey = 'opendesk.' + app, legacy = Store.get(legacyKey);
    if (!legacy || Store.get('opendesk.migrated.' + app)) return null;
    const id = this.create(app, legacy);
    const h = Store.get(legacyKey + '.history');
    if (id && h) Store.set(this.key(id) + '.history', h);
    Store.set('opendesk.migrated.' + app, true);
    return id;
  },
  // Which document this page edits: ?id=…, else (unless ?new) migrate pre-multi-file data or
  // reopen the newest file, else create a blank one. The URL is rewritten to ?id=… either way.
  open(app, blank) {
    const params = new URLSearchParams(location.search);
    let id = params.get('id');
    if (!id || this.meta(id)?.app !== app) {
      id = null;
      if (!params.has('new')) id = this.migrate(app) || this.list(app)[0]?.id || null;
      if (!id) id = this.create(app, blank);
      if (id) history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(id) + location.hash);
    }
    return { id, key: id ? this.key(id) : 'opendesk.unsaved', state: (id && this.get(id)) || blank };
  },
};

// Offline support: cache the app so it works with no connection.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// A page restored from the back/forward cache holds an old copy of storage and could save over
// newer edits made in another page meanwhile, so reload it fresh.
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
