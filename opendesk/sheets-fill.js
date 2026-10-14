// Fill-handle logic for OpenDesk Sheets: pattern detection and formula reference shifting.
// Pure functions so they can be tested outside the browser.
(function (root) {
  const COLS = 26, ROWS = 100;
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const LISTS = [DAYS, DAYS.map(d => d.slice(0, 3)), MONTHS, MONTHS.map(m => m.slice(0, 3))];

  const isNum = s => s.trim() !== '' && !isNaN(Number(s));
  const clean = n => String(+n.toPrecision(12));

  // Move relative references by (dr, dc); $-prefixed parts stay put. Text in quotes is untouched.
  function shiftFormula(raw, dr, dc) {
    return raw.split(/("(?:[^"]|"")*")/).map((part, i) => (i % 2 ? part : part.replace(
      /(\$?)([A-Z])(\$?)(\d+)(?![\w(])/gi,
      (m, cAbs, col, rAbs, row) => {
        const c = cAbs ? col.toUpperCase().charCodeAt(0) - 65 : col.toUpperCase().charCodeAt(0) - 65 + dc;
        const r = rAbs ? +row : +row + dr;
        if (c < 0 || c >= COLS || r < 1 || r > ROWS) return '#REF!';
        return cAbs + String.fromCharCode(65 + c) + rAbs + r;
      }))).join('');
  }

  // Case of `sample` applied to `word` (MONDAY / monday / Monday).
  const matchCase = (word, sample) =>
    sample === sample.toUpperCase() ? word.toUpperCase() : sample === sample.toLowerCase() ? word.toLowerCase() : word;

  // Given a column/row of raw values, return a function k -> raw value for position k
  // (k = 0..n-1 are the sources themselves, k >= n continues the pattern).
  function pattern(vals) {
    const n = vals.length;
    const copy = k => ({ value: vals[((k % n) + n) % n], from: ((k % n) + n) % n });
    if (vals.some(v => v === '' || v.startsWith('='))) return copy;

    if (vals.every(isNum)) {
      if (n === 1) return copy; // a single number copies, like Excel/Sheets
      const nums = vals.map(Number), step = (nums[n - 1] - nums[0]) / (n - 1);
      return k => ({ value: clean(nums[0] + step * k) });
    }

    const dates = vals.map(v => /^(\d{4})-(\d{2})-(\d{2})$/.exec(v));
    if (dates.every(Boolean)) {
      const t = dates.map(m => Date.UTC(+m[1], +m[2] - 1, +m[3]));
      const step = n === 1 ? 86400000 : (t[n - 1] - t[0]) / (n - 1);
      return k => ({ value: new Date(t[0] + step * k).toISOString().slice(0, 10) });
    }

    for (const list of LISTS) {
      const idx = vals.map(v => list.findIndex(w => w.toLowerCase() === v.toLowerCase()));
      if (idx.every(i => i >= 0)) {
        const step = n === 1 ? 1 : Math.round((idx[n - 1] - idx[0]) / (n - 1)) || 1;
        return k => ({ value: matchCase(list[(((idx[0] + step * k) % list.length) + list.length) % list.length], vals[0]) });
      }
    }

    // "Item 1", "Q3", "Room 12" — same prefix, trailing integer.
    const parts = vals.map(v => /^(.*?)(\d+)$/.exec(v));
    if (parts.every(Boolean) && parts.every(p => p[1] === parts[0][1])) {
      const nums = parts.map(p => +p[2]);
      const step = n === 1 ? 1 : Math.round((nums[n - 1] - nums[0]) / (n - 1));
      return k => { const v = nums[0] + step * k; return v < 0 ? copy(k) : { value: parts[0][1] + v }; };
    }
    return copy;
  }

  const parseId = id => ({ c: id.charCodeAt(0) - 65, r: +id.slice(1) });
  const toId = (c, r) => String.fromCharCode(65 + c) + r;

  // Fill from source rectangle `src` ({c1,r1,c2,r2}, inclusive, 1-based rows) to `dest`
  // (a larger rectangle sharing src's columns or rows). Returns { [cellId]: rawValue }.
  function fill(raw, src, dest) {
    const out = {};
    const vertical = dest.c1 === src.c1 && dest.c2 === src.c2;
    const lines = vertical ? [src.c1, src.c2] : [src.r1, src.r2];
    for (let line = lines[0]; line <= lines[1]; line++) {
      const cells = [];
      if (vertical) for (let r = src.r1; r <= src.r2; r++) cells.push(toId(line, r));
      else for (let c = src.c1; c <= src.c2; c++) cells.push(toId(c, src.r1 + (line - src.r1)));
      const vals = cells.map(id => raw[id] ?? '');
      const p = pattern(vals);
      const start = vertical ? src.r1 : src.c1, end = vertical ? src.r2 : src.c2;
      const from = vertical ? dest.r1 : dest.c1, to = vertical ? dest.r2 : dest.c2;
      for (let pos = from; pos <= to; pos++) {
        if (pos >= start && pos <= end) continue;
        const k = pos - start;
        const res = p(k);
        let value = res.value;
        if (value.startsWith('=') && res.from !== undefined) {
          const d = pos - (start + res.from);
          value = vertical ? shiftFormula(value, d, 0) : shiftFormula(value, 0, d);
        }
        out[vertical ? toId(line, pos) : toId(pos, line)] = value;
      }
    }
    return out;
  }

  const api = { fill, pattern, shiftFormula, parseId, toId };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SheetFill = api;
})(this);
