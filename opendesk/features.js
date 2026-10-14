// Cross-app features: share links (no server), version history with diffs,
// and live spreadsheet ranges for Writer and Slides.
// Each app calls OpenDesk.setup({ app, key, getState, setState, toText }) after loading.
const OpenDesk = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cfg;

  // ---------- modal ----------
  function modal(title, wide) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="x" aria-label="Close">✕</button></div>
      <div class="modal-body"></div></div>`;
    const close = () => { back.remove(); removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    back.querySelector('.x').onclick = close;
    addEventListener('keydown', onKey);
    document.body.appendChild(back);
    return { body: back.querySelector('.modal-body'), close };
  }

  // ---------- share links ----------
  // The document lives in the URL fragment (#share=...), which browsers never send to a server.
  const b64u = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const pipe = async (bytes, stream) =>
    new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encodeShare(app, state, password) {
    const bytes = await pipe(new TextEncoder().encode(JSON.stringify({ v: 1, app, state })), new CompressionStream('deflate'));
    if (!password) return 'p.' + b64u(bytes);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), bytes));
    const out = new Uint8Array(28 + ct.length);
    out.set(salt); out.set(iv, 16); out.set(ct, 28);
    return 'e.' + b64u(out);
  }

  async function decodeShare(token, password) {
    let bytes = unb64u(token.slice(2));
    if (token.startsWith('e.')) {
      const key = await deriveKey(password, bytes.slice(0, 16));
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28) }, key, bytes.slice(28)));
    }
    return JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate'))));
  }

  function openShareDialog() {
    const m = modal('Share by link');
    m.body.innerHTML = `
      <p class="hint">The whole document is packed into the link itself. Nothing is uploaded anywhere — not even to the site hosting OpenDesk.</p>
      <label class="field">Password (optional — encrypts the link)
        <input type="password" id="sharePw" autocomplete="new-password" placeholder="Leave empty for an open link"></label>
      <button class="primary" id="shareGo">Create link</button>
      <div id="shareOut" class="hidden">
        <div class="row"><input id="shareUrl" readonly aria-label="Share link"><button id="shareCopy">Copy</button></div>
        <p class="hint" id="shareInfo"></p>
      </div>`;
    m.body.querySelector('#shareGo').onclick = async () => {
      const pw = m.body.querySelector('#sharePw').value;
      const token = await encodeShare(cfg.app, cfg.getState(), pw);
      const url = location.origin + location.pathname + '#share=' + token;
      m.body.querySelector('#shareOut').classList.remove('hidden');
      m.body.querySelector('#shareUrl').value = url;
      const kb = Math.round(url.length / 1024);
      m.body.querySelector('#shareInfo').textContent =
        (pw ? 'Encrypted (AES-256). Send the password separately. ' : 'Anyone with this link can open it. ') +
        `Link length: ${kb} KB.` +
        (url.length > 60000 ? ' ⚠ Long link — some chat apps and email clients cut long links off. Images make links large; try removing them or saving as a file instead.' : '');
    };
    m.body.querySelector('#shareCopy').onclick = async e => {
      const input = m.body.querySelector('#shareUrl');
      try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
      e.target.textContent = 'Copied ✓';
    };
  }

  async function openIncomingShare() {
    const match = /^#share=([pe]\.[A-Za-z0-9_-]+)$/.exec(location.hash);
    if (!match) return;
    const token = match[1];
    history.replaceState(null, '', location.pathname + location.search);
    let data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      let pw = '';
      if (token.startsWith('e.')) {
        pw = prompt(attempt ? 'Wrong password. Try again:' : 'This shared document is password-protected. Password:');
        if (pw == null) return;
      }
      try { data = await decodeShare(token, pw); }
      catch { if (!token.startsWith('e.')) { alert('This share link is damaged or incomplete.'); return; } }
    }
    if (!data) return;
    if (data.app !== cfg.app) { alert(`This link is for OpenDesk ${data.app}, not this app.`); return; }
    snapshot('Before opening a shared link');
    cfg.setState(data.state);
    snapshot('Opened from shared link');
  }

  // ---------- version history ----------
  const HISTORY_MAX = 40;
  const historyKey = key => key + '.history';

  function pushHistory(key, state, label) {
    const s = JSON.stringify(state);
    if (s.length > 1.5e6) return; // too big for localStorage history
    const list = Store.get(historyKey(key)) || [];
    if (list.length && list[list.length - 1].s === s) return;
    list.push({ t: Date.now(), s, label });
    while (list.length > HISTORY_MAX) list.shift();
    while (!Store.set(historyKey(key), list) && list.length > 1) list.shift();
  }
  const snapshot = label => pushHistory(cfg.key, cfg.getState(), label);

  // Word-level diff: trim common prefix/suffix, then LCS on the changed middle.
  function diffWords(a, b) {
    const A = a.match(/\s+|[^\s]+/g) || [], B = b.match(/\s+|[^\s]+/g) || [];
    let p = 0;
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    let ea = A.length, eb = B.length;
    while (ea > p && eb > p && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
    const ma = A.slice(p, ea), mb = B.slice(p, eb), n = ma.length, m = mb.length;
    const mid = [];
    if (n * m > 4e6) {
      ma.forEach(w => mid.push(['-', w])); mb.forEach(w => mid.push(['+', w]));
    } else {
      const w = m + 1, dp = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
          dp[i * w + j] = ma[i] === mb[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (ma[i] === mb[j]) { mid.push(['=', ma[i]]); i++; j++; }
        else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) mid.push(['-', ma[i++]]);
        else mid.push(['+', mb[j++]]);
      }
      while (i < n) mid.push(['-', ma[i++]]);
      while (j < m) mid.push(['+', mb[j++]]);
    }
    return [...A.slice(0, p).map(t => ['=', t]), ...mid, ...A.slice(ea).map(t => ['=', t])];
  }

  function diffHTML(raw) {
    // Merge neighbouring tokens with the same op so a changed sentence is one highlight.
    const ops = [];
    for (const [op, t] of raw) {
      const last = ops[ops.length - 1];
      if (last && last[0] === op) last[1] += t; else ops.push([op, t]);
    }
    if (!ops.some(o => o[0] !== '=')) return '<p class="hint">No differences from the current version.</p>';
    // Collapse long unchanged stretches to a little context on each side.
    const out = [];
    let run = [];
    const flush = (isEnd, isStart) => {
      const text = run.join('');
      if (text.length > 400) {
        const head = isStart ? '' : text.slice(0, 150), tail = isEnd ? '' : text.slice(-150);
        out.push(esc(head) + '<span class="gap"> … </span>' + esc(tail));
      } else out.push(esc(text));
      run = [];
    };
    let started = false;
    for (const [op, t] of ops) {
      if (op === '=') { run.push(t); continue; }
      flush(false, !started); started = true;
      out.push(op === '+' ? `<ins>${esc(t)}</ins>` : `<del>${esc(t)}</del>`);
    }
    flush(true, false);
    return out.join('');
  }

  function timeAgo(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(t).toLocaleString();
  }

  function openHistoryDialog() {
    snapshot('Autosave');
    const list = (Store.get(historyKey(cfg.key)) || []).slice().reverse();
    const m = modal('Version history', true);
    if (!list.length) { m.body.innerHTML = '<p class="hint">No versions yet. A version is saved every minute while you work.</p>'; return; }
    m.body.innerHTML = `<div class="history">
      <div class="versions" role="listbox" aria-label="Versions"></div>
      <div class="diffpane"><div class="legend"><ins>added since</ins> <del>removed since</del> — compared with what you have now</div>
        <div class="diff"></div><button class="primary" id="restore">Restore this version</button></div></div>`;
    const versions = m.body.querySelector('.versions');
    const currentJSON = JSON.stringify(cfg.getState());
    const current = cfg.toText(JSON.parse(currentJSON));
    // Preselect the newest version that differs from what's on screen.
    const firstDiff = Math.max(0, list.findIndex(e => e.s !== currentJSON));
    let chosen;
    const show = (entry, btn) => {
      chosen = entry;
      versions.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      m.body.querySelector('.diff').innerHTML = diffHTML(diffWords(cfg.toText(JSON.parse(entry.s)), current));
    };
    list.forEach((entry, i) => {
      const b = document.createElement('button');
      const label = entry.s === currentJSON ? 'Same as now' : entry.label || 'Autosave';
      b.innerHTML = `<strong>${esc(timeAgo(entry.t))}</strong><span>${esc(label)}</span>`;
      b.title = new Date(entry.t).toLocaleString();
      b.onclick = () => show(entry, b);
      versions.appendChild(b);
      if (i === firstDiff) show(entry, b);
    });
    m.body.querySelector('#restore').onclick = () => {
      snapshot('Before restoring an older version');
      cfg.setState(JSON.parse(chosen.s));
      m.close();
    };
  }

  // ---------- live spreadsheet ranges ----------
  const RANGE_RE = /^([A-Z])(\d{1,3})(?::([A-Z])(\d{1,3}))?$/;
  const fmt = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(+v.toPrecision(10)))
    : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v == null ? '' : String(v);

  function rangeRows(range) {
    const m = RANGE_RE.exec(String(range).toUpperCase().trim());
    if (!m) return null;
    const saved = Store.get('opendesk.sheets');
    const values = saved?.raw ? SheetEngine.computeAll(saved.raw) : {};
    const c1 = m[1].charCodeAt(0), r1 = +m[2], c2 = (m[3] || m[1]).charCodeAt(0), r2 = +(m[4] || m[2]);
    const rows = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      const row = [];
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) row.push(values[String.fromCharCode(c) + r] ?? '');
      rows.push(row);
    }
    return rows;
  }

  // Chart: first column = labels, second column = values.
  function chartData(rows) {
    const data = rows.filter(r => typeof r[1] === 'number').map(r => ({ label: fmt(r[0]), value: r[1] }));
    return { labels: data.map(d => d.label), values: data.map(d => d.value) };
  }

  function renderLive(range, mode) {
    const rows = rangeRows(range);
    const tag = `<div class="live-tag">⇄ Sheets ${esc(String(range).toUpperCase())}</div>`;
    if (!rows) return tag + '<p>Invalid range.</p>';
    if (mode === 'chart') {
      const { labels, values } = chartData(rows);
      if (!values.length) return tag + '<p>No numbers in the second column of this range.</p>';
      const W = 600, H = 300, pad = 30, max = Math.max(...values, 0) || 1, min = Math.min(...values, 0);
      const bw = (W - pad * 2) / values.length, scale = (H - pad * 2) / (max - min), zero = pad + max * scale;
      const bars = values.map((v, i) => {
        const h = Math.abs(v) * scale, y = v >= 0 ? zero - h : zero;
        const x = pad + i * bw + bw * 0.15;
        return `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${Math.max(h, 1)}" fill="#2b6cb0" rx="2"></rect>
          <text x="${x + bw * 0.35}" y="${v >= 0 ? y - 4 : y + h + 12}" text-anchor="middle" font-size="11" fill="#333">${esc(fmt(v))}</text>
          <text x="${x + bw * 0.35}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#555">${esc(labels[i].slice(0, 14))}</text>`;
      }).join('');
      return tag + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of ${esc(range)}" style="width:100%;height:auto;max-height:100%">
        <line x1="${pad}" x2="${W - pad}" y1="${zero}" y2="${zero}" stroke="#999"></line>${bars}</svg>`;
    }
    const body = rows.map((r, i) => '<tr>' + r.map(v => {
      const cell = i === 0 ? 'th' : 'td';
      return `<${cell}${typeof v === 'number' ? ' style="text-align:right"' : ''}>${esc(fmt(v))}</${cell}>`;
    }).join('') + '</tr>').join('');
    return tag + `<table class="live-table">${body}</table>`;
  }

  // Ask for a range + mode. Resolves { range, mode } or null.
  function askRange() {
    return new Promise(resolve => {
      const m = modal('Insert live spreadsheet data');
      const saved = Store.get('opendesk.sheets');
      const cells = Object.keys(saved?.raw || {});
      m.body.innerHTML = `
        <p class="hint">Shows a range from your OpenDesk Sheets spreadsheet. It updates automatically when the spreadsheet changes — even in another tab.</p>
        ${cells.length ? '' : '<p class="hint warn">Your spreadsheet is empty. Add data in Sheets first — the range will fill in once you do.</p>'}
        <label class="field">Range <input id="rg" value="A1:B5" placeholder="A1:C10" spellcheck="false"></label>
        <label class="field">Show as <select id="md"><option value="table">Table</option><option value="chart">Bar chart (labels in 1st column, numbers in 2nd)</option></select></label>
        <div class="preview"></div>
        <button class="primary" id="ins">Insert</button>`;
      const rg = m.body.querySelector('#rg'), md = m.body.querySelector('#md'), pv = m.body.querySelector('.preview');
      const update = () => { pv.innerHTML = RANGE_RE.test(rg.value.toUpperCase().trim()) ? renderLive(rg.value, md.value) : '<p class="hint warn">Enter a range like A1:C10</p>'; };
      rg.oninput = md.onchange = update; update();
      let done = false;
      m.body.querySelector('#ins').onclick = () => {
        const range = rg.value.toUpperCase().trim();
        if (!RANGE_RE.test(range)) return;
        done = true; m.close(); resolve({ range, mode: md.value });
      };
      const obs = new MutationObserver(() => { if (!document.body.contains(m.body)) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(document.body, { childList: true });
    });
  }

  // Call fn whenever the spreadsheet changes (other tabs via 'storage', same tab on focus).
  function onSheetChange(fn) {
    addEventListener('storage', e => { if (e.key === 'opendesk.sheets') fn(); });
    addEventListener('focus', fn);
  }

  // ---------- setup ----------
  function setup(options) {
    cfg = options;
    const bar = document.querySelector('.toolbar');
    const sep = document.createElement('span'); sep.className = 'sep';
    const share = document.createElement('button'); share.textContent = '🔗 Share'; share.title = 'Share by link — no upload';
    const hist = document.createElement('button'); hist.textContent = '🕘 History'; hist.title = 'Version history';
    share.onclick = openShareDialog; hist.onclick = openHistoryDialog;
    bar.append(sep, share, hist);
    snapshot('Opened');
    setInterval(() => snapshot('Autosave'), 60000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) snapshot('Autosave'); });
    openIncomingShare();
  }

  return { setup, pushHistory, renderLive, rangeRows, chartData, askRange, onSheetChange, diffWords, encodeShare, decodeShare, fmt };
})();
