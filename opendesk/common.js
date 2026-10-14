// Shared helpers: storage that never throws, file download/open, HTML sanitizing.
const Store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  // Returns false when storage is unavailable or full, so callers can trim and retry.
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};

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
    try { localStorage.removeItem(this.key(id)); localStorage.removeItem(this.key(id) + '.history'); } catch { /* ignore */ }
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
