// Formula engine for OpenDesk Sheets. Cells are keyed "A1".."Z100".
// Supports numbers, + - * / ^ %, comparisons, &-concatenation, cell refs,
// ranges (A1:B5) and the functions in FUNCS below.
(function (root) {
  const flat = args => args.flat(Infinity);
  const nums = args => flat(args).filter(v => typeof v === 'number' && !isNaN(v));

  const FUNCS = {
    SUM: (...a) => nums(a).reduce((s, v) => s + v, 0),
    AVERAGE: (...a) => { const n = nums(a); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : '#DIV/0!'; },
    MIN: (...a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: (...a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: (...a) => nums(a).length,
    COUNTA: (...a) => flat(a).filter(v => v !== '').length,
    ROUND: (v, d = 0) => { const f = 10 ** d; return Math.round(v * f) / f; },
    ABS: v => Math.abs(v),
    SQRT: v => Math.sqrt(v),
    POWER: (a, b) => a ** b,
    MOD: (a, b) => a % b,
    IF: (c, a, b = false) => (c ? a : b),
    AND: (...a) => flat(a).every(Boolean),
    OR: (...a) => flat(a).some(Boolean),
    NOT: v => !v,
    CONCAT: (...a) => flat(a).join(''),
    LEN: v => String(v).length,
    UPPER: v => String(v).toUpperCase(),
    LOWER: v => String(v).toLowerCase(),
    TODAY: () => new Date().toISOString().slice(0, 10),
  };

  const colIndex = letters => letters.charCodeAt(0) - 65;
  const colName = i => String.fromCharCode(65 + i);

  function tokenize(src) {
    const re = /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"]|"")*")|(\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)|([A-Z][A-Z0-9]*)(?=\s*\()|(<=|>=|<>|[-+*/^%&(),=<>:]))/gyi;
    const tokens = [];
    let m;
    re.lastIndex = 0;
    while (re.lastIndex < src.length) {
      const start = re.lastIndex;
      m = re.exec(src);
      if (!m) {
        if (/^\s*$/.test(src.slice(start))) break;
        throw new Error('syntax');
      }
      if (m[1]) tokens.push({ t: 'num', v: parseFloat(m[1]) });
      else if (m[2]) tokens.push({ t: 'str', v: m[2].slice(1, -1).replace(/""/g, '"') });
      else if (m[3]) tokens.push({ t: 'ref', v: m[3].toUpperCase().replace(/\$/g, '') }); // $ only matters when filling
      else if (m[4]) tokens.push({ t: 'fn', v: m[4].toUpperCase() });
      else tokens.push({ t: 'op', v: m[5] });
    }
    return tokens;
  }

  // Recursive-descent parser that evaluates directly (no eval / Function).
  function evaluate(src, getCell) {
    const tokens = tokenize(src);
    let i = 0;
    const peek = () => tokens[i];
    const isOp = v => peek() && peek().t === 'op' && peek().v === v;
    const expect = v => { if (!isOp(v)) throw new Error('syntax'); i++; };
    const num = v => {
      if (typeof v === 'number') return v;
      if (v === '' || v === false) return 0;
      if (v === true) return 1;
      if (typeof v === 'string' && v.startsWith('#')) throw new Error(v);
      const n = Number(v);
      if (isNaN(n)) throw new Error('#VALUE!');
      return n;
    };

    function comparison() {
      let left = concat();
      while (peek() && peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
        const op = tokens[i++].v, right = concat();
        left = { '=': left == right, '<>': left != right, '<': left < right, '>': left > right, '<=': left <= right, '>=': left >= right }[op];
      }
      return left;
    }
    function concat() {
      let left = additive();
      while (isOp('&')) { i++; left = String(left) + String(additive()); }
      return left;
    }
    function additive() {
      let left = term();
      while (isOp('+') || isOp('-')) {
        const op = tokens[i++].v, right = term();
        left = op === '+' ? num(left) + num(right) : num(left) - num(right);
      }
      return left;
    }
    function term() {
      let left = power();
      while (isOp('*') || isOp('/')) {
        const op = tokens[i++].v, right = power();
        if (op === '/' && num(right) === 0) throw new Error('#DIV/0!');
        left = op === '*' ? num(left) * num(right) : num(left) / num(right);
      }
      return left;
    }
    function power() {
      let base = unary();
      while (isOp('^')) { i++; base = num(base) ** num(unary()); }
      return base;
    }
    function unary() {
      if (isOp('-')) { i++; return -num(unary()); }
      if (isOp('+')) { i++; return num(unary()); }
      let v = primary();
      while (isOp('%')) { i++; v = num(v) / 100; }
      return v;
    }
    function primary() {
      const tok = tokens[i++];
      if (!tok) throw new Error('syntax');
      if (tok.t === 'num' || tok.t === 'str') return tok.v;
      if (tok.t === 'ref') {
        if (tok.v.includes(':')) {
          const [a, b] = tok.v.split(':').map(parseRef);
          const out = [];
          for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++)
            for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++)
              out.push(getCell(colName(c) + (r + 1)));
          return out;
        }
        return getCell(tok.v);
      }
      if (tok.t === 'fn') {
        const fn = FUNCS[tok.v];
        if (!fn) throw new Error('#NAME?');
        expect('(');
        const args = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) { i++; args.push(comparison()); }
        }
        expect(')');
        flat(args).forEach(v => { if (typeof v === 'string' && /^#[A-Z/0!?]+[!?]$/.test(v) && v !== '') throw new Error(v); });
        return fn(...args);
      }
      if (tok.t === 'op' && tok.v === '(') { const v = comparison(); expect(')'); return v; }
      throw new Error('syntax');
    }

    const result = comparison();
    if (i < tokens.length) throw new Error('syntax');
    return result;
  }

  function parseRef(ref) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    return { c: colIndex(m[1]), r: parseInt(m[2], 10) - 1 };
  }

  // Compute every cell's display value. `raw` maps "A1" -> user input string.
  function computeAll(raw) {
    const values = {};
    const visiting = new Set();
    function getCell(id) {
      if (id in values) return values[id];
      const input = raw[id];
      if (input == null || input === '') return '';
      if (input[0] !== '=') {
        const n = Number(input);
        return input.trim() !== '' && !isNaN(n) ? n : input;
      }
      if (visiting.has(id)) throw new Error('#CYCLE!');
      visiting.add(id);
      let v;
      try { v = evaluate(input.slice(1), getCell); }
      catch (e) { v = e.message.startsWith('#') ? e.message : '#ERROR!'; }
      visiting.delete(id);
      if (typeof v === 'number' && !isFinite(v)) v = '#NUM!';
      if (Array.isArray(v)) v = '#VALUE!';
      values[id] = v;
      return v;
    }
    const out = {};
    for (const id of Object.keys(raw)) out[id] = getCell(id);
    return out;
  }

  const api = { computeAll, evaluate, colName, FUNCS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SheetEngine = api;
})(this);
