'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const FS = 'showDirectoryPicker' in window;

/* ---------- 文字変換 ---------- */
const HK = 'ｶﾞｶﾞｷﾞｷﾞｸﾞｸﾞｹﾞｹﾞｺﾞｺﾞｻﾞｻﾞｼﾞｼﾞｽﾞｽﾞｾﾞｾﾞｿﾞｿﾞﾀﾞﾀﾞﾁﾞﾁﾞﾂﾞﾂﾞﾃﾞﾃﾞﾄﾞﾄﾞﾊﾞﾊﾞﾋﾞﾋﾞﾌﾞﾌﾞﾍﾞﾍﾞﾎﾞﾎﾞﾊﾟﾊﾟﾋﾟﾋﾟﾌﾟﾌﾟﾍﾟﾍﾟﾎﾟﾎﾟｳﾞｳﾞ';
const HK_D = 'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴ';
const HK_S = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｰ｡｢｣､･';
const FK_S = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー。「」、・';
const conv = {
  z2h: s => s.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' '),
  h2z: s => s.replace(/[A-Za-z0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)),
  kana: s => {
    for (let i = 0; i < HK_D.length; i++) s = s.split(HK.substr(i * 4, 2)).join(HK_D[i]);
    return s.replace(/[｡-ﾟ]/g, c => { const i = HK_S.indexOf(c); return i < 0 ? c : FK_S[i]; });
  },
  k2h: s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)),
  h2k: s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)),
};
const pad = (n, d) => { const s = String(Math.abs(n)); return (n < 0 ? '-' : '') + (s.length >= d ? s : '0'.repeat(d - s.length) + s); };
const fmtDate = (t, f) => {
  const d = new Date(t);
  const m = { YYYY: d.getFullYear(), YY: pad(d.getFullYear() % 100, 2), MM: pad(d.getMonth() + 1, 2), DD: pad(d.getDate(), 2), hh: pad(d.getHours(), 2), mm: pad(d.getMinutes(), 2), ss: pad(d.getSeconds(), 2) };
  return f.replace(/YYYY|YY|MM|DD|hh|mm|ss/g, k => m[k]);
};
const place = (s, ins, pos, idx, sep) => {
  if (pos === 'start') return ins + sep + s;
  if (pos === 'end') return s + sep + ins;
  if (pos === 'replace') return ins;
  const i = Math.max(0, Math.min(s.length, idx < 0 ? s.length + idx + 1 : idx));
  return s.slice(0, i) + ins + s.slice(i);
};

/* ---------- ルール定義 ---------- */
const TARGET = ['target', 'seg', '', [['base', '名前'], ['ext', '拡張子'], ['full', '全体']]];
const POS = [['start', '先頭'], ['end', '末尾'], ['index', '位置']];
const RULES = {
  replace: {
    label: '置換',
    def: { find: '', repl: '', regex: false, icase: false, all: true, target: 'base' },
    form: [['find', 'text', '検索'], ['repl', 'text', '置換'], [['regex', 'chip', '.*', '正規表現'], ['icase', 'chip', 'Aa', '大文字と小文字を区別しない'], ['all', 'chip', 'すべて', 'すべて置換'], 'grow', TARGET]],
    apply(s, o) {
      if (!o.find) return s;
      const src = o.regex ? o.find : o.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(src, (o.all ? 'g' : '') + (o.icase ? 'i' : '') + 'u');
      return o.regex ? s.replace(re, o.repl) : s.replace(re, () => o.repl);
    },
  },
  insert: {
    label: '挿入',
    def: { text: '', pos: 'start', idx: 0, target: 'base' },
    form: [['text', 'text', '文字'], [['pos', 'seg', '', POS], ['idx', 'num', '', '位置（負数で末尾から）', 'pos=index'], 'grow', TARGET]],
    apply: (s, o) => o.text ? place(s, o.text, o.pos, o.idx, '') : s,
  },
  remove: {
    label: '削除',
    def: { mode: 'range', from: 0, count: 1, end: false, chars: '', target: 'base' },
    form: [
      [['mode', 'select', '', [['range', '範囲'], ['chars', '指定文字'], ['brackets', '括弧と中身'], ['space', '空白を整理'], ['all', 'すべて']]], 'grow', TARGET],
      [['from', 'num', '開始', '開始位置（0から）', 'mode=range'], ['count', 'num', '文字数', '削除する文字数', 'mode=range'], ['end', 'chip', '末尾から', '末尾から数える', 'mode=range']],
      ['chars', 'text', '文字', 'mode=chars'],
    ],
    apply(s, o) {
      switch (o.mode) {
        case 'range': {
          const n = Math.max(0, o.count | 0), f = Math.max(0, o.from | 0);
          if (o.end) { const e = Math.max(0, s.length - f); return s.slice(0, Math.max(0, e - n)) + s.slice(e); }
          return s.slice(0, f) + s.slice(f + n);
        }
        case 'chars': return o.chars ? [...s].filter(c => !o.chars.includes(c)).join('') : s;
        case 'brackets': return s.replace(/\s*(\([^()]*\)|（[^（）]*）|\[[^\[\]]*\]|【[^【】]*】|「[^「」]*」|\{[^{}]*\})\s*/g, ' ').replace(/ {2,}/g, ' ').trim();
        case 'space': return s.replace(/[\s　]+/g, ' ').trim();
        case 'all': return '';
      }
      return s;
    },
  },
  seq: {
    label: '連番',
    def: { start: 1, step: 1, digits: 3, pos: 'end', idx: 0, sep: '_', perDir: false, target: 'base' },
    form: [
      [['start', 'num', '開始', '開始番号'], ['step', 'num', '増分', '増分'], ['digits', 'num', '桁', '桁数']],
      [['pos', 'seg', '', [...POS, ['replace', '置換']]], ['idx', 'num', '', '位置', 'pos=index'], ['sep', 'text', '', '区切り文字', 'pos!=index&pos!=replace', 'w'], 'grow'],
      [['perDir', 'chip', 'フォルダごと', 'フォルダごとに番号を振り直す'], 'grow', TARGET],
    ],
    apply: (s, o, c) => place(s, pad((+o.start || 0) + (o.perDir ? c.di : c.i) * (+o.step || 0), +o.digits || 0), o.pos, o.idx, o.sep),
  },
  date: {
    label: '日時',
    def: { src: 'mtime', fmt: 'YYYYMMDD', pos: 'start', idx: 0, sep: '_', target: 'base' },
    form: [
      ['fmt', 'text', '書式', '', 'YYYY YY MM DD hh mm ss'],
      [['src', 'seg', '', [['mtime', '更新日時'], ['now', '現在']]], 'grow'],
      [['pos', 'seg', '', [...POS, ['replace', '置換']]], ['idx', 'num', '', '位置', 'pos=index'], ['sep', 'text', '', '区切り文字', 'pos!=index&pos!=replace', 'w'], 'grow', TARGET],
    ],
    apply: (s, o, c) => place(s, fmtDate(o.src === 'now' ? c.now : c.f.mtime, o.fmt || 'YYYYMMDD'), o.pos, o.idx, o.sep),
  },
  case: {
    label: '大文字・小文字',
    def: { mode: 'lower', target: 'base' },
    form: [[['mode', 'select', '', [['lower', 'abc 小文字'], ['upper', 'ABC 大文字'], ['title', 'Abc Def 単語の頭'], ['first', 'Abc def 先頭のみ']]], 'grow', TARGET]],
    apply(s, o) {
      if (o.mode === 'lower') return s.toLowerCase();
      if (o.mode === 'upper') return s.toUpperCase();
      if (o.mode === 'title') return s.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    },
  },
  width: {
    label: '文字種',
    def: { mode: 'z2h', target: 'base' },
    form: [[['mode', 'select', '', [['z2h', '全角英数記号 → 半角'], ['h2z', '半角英数 → 全角'], ['kana', '半角カナ → 全角'], ['k2h', 'カタカナ → ひらがな'], ['h2k', 'ひらがな → カタカナ']]], 'grow', TARGET]],
    apply: (s, o) => conv[o.mode](s),
  },
  ext: {
    label: '拡張子',
    def: { mode: 'lower', value: '' },
    form: [[['mode', 'select', '', [['lower', '小文字'], ['upper', '大文字'], ['set', '変更'], ['add', '追加'], ['remove', '削除']]], ['value', 'text', '', '新しい拡張子', 'mode=set|mode=add']]],
  },
};
const ORDER = ['replace', 'insert', 'remove', 'seq', 'date', 'case', 'width', 'ext'];

/* ---------- 状態 ---------- */
const S = {
  files: [], rules: store.get('rn.rules', []), presets: store.get('rn.presets', {}),
  root: null, mode: null, recursive: store.get('rn.sub', false), filter: '', sort: { k: 'name', d: 1 }, history: [], busy: false,
};
let uid = 1;
const splitName = n => { const i = n.lastIndexOf('.'); return i > 0 ? [n.slice(0, i), n.slice(i + 1)] : [n, null]; };
const joinName = (b, e) => e == null ? b : b + '.' + e;

function applyRules(f, ctx) {
  let [b, e] = splitName(f.name);
  for (const r of S.rules) {
    if (!r.on) continue;
    const R = RULES[r.type];
    try {
      if (r.type === 'ext') {
        if (r.mode === 'lower' && e != null) e = e.toLowerCase();
        else if (r.mode === 'upper' && e != null) e = e.toUpperCase();
        else if (r.mode === 'remove') e = null;
        else if (r.mode === 'set') e = r.value.replace(/^\./, '') || null;
        else if (r.mode === 'add' && r.value) e = e == null ? r.value.replace(/^\./, '') : e + '.' + r.value.replace(/^\./, '');
      } else if (r.target === 'ext') { if (e != null) e = R.apply(e, r, ctx); }
      else if (r.target === 'full') { [b, e] = splitName(R.apply(joinName(b, e), r, ctx)); }
      else b = R.apply(b, r, ctx);
      r._err = '';
    } catch (err) { r._err = err.message; }
  }
  return joinName(b, e);
}

const BAD = /[\\/:*?"<>|\x00-\x1f]/;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
const wildRe = s => {
  if (!s) return null;
  const hasWild = /[*?]/.test(s);
  const src = s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(hasWild ? '^' + src + '$' : src, 'i');
};
const visible = () => { const re = wildRe(S.filter); return S.files.filter(f => !re || re.test(f.name)); };

function sorted(list) {
  const { k, d } = S.sort;
  const col = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  return list.slice().sort((a, b) => {
    const x = a[k], y = b[k];
    const r = typeof x === 'number' ? x - y : col.compare(x ?? '', y ?? '');
    return r * d || col.compare(a.dir + a.name, b.dir + b.name);
  });
}

function compute() {
  const vis = sorted(visible());
  const shown = new Set(vis);
  const now = Date.now();
  let i = 0; const per = {};
  for (const f of S.files) { f.newName = f.name; f.inc = f.checked && shown.has(f); f.err = ''; }
  for (const f of vis) {
    if (!f.inc) continue;
    per[f.dir] = (per[f.dir] ?? -1) + 1;
    f.newName = applyRules(f, { i: i++, di: per[f.dir], f, now });
  }
  const taken = new Map();
  for (const f of S.files) { const k = f.dir + '/' + f.newName.toLowerCase(); taken.set(k, (taken.get(k) || 0) + 1); }
  for (const f of S.files) {
    if (!f.inc || f.newName === f.name) continue;
    const n = f.newName;
    if (!n) f.err = '名前が空です';
    else if (BAD.test(n)) f.err = '使用できない文字: \\ / : * ? " < > |';
    else if (/[. ]$/.test(n)) f.err = '末尾にピリオドや空白は使えません';
    else if (RESERVED.test(n)) f.err = '予約されている名前です';
    else if (n.length > 255) f.err = '名前が長すぎます';
    else if (taken.get(f.dir + '/' + n.toLowerCase()) > 1) f.err = '名前が重複しています';
  }
  return vis;
}

/* ---------- 描画 ---------- */
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
function diffHtml(a, b) {
  if (a === b) return esc(b);
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const mid = b.slice(p, b.length - s);
  return esc(b.slice(0, p)) + (mid ? '<mark>' + esc(mid) + '</mark>' : '') + esc(b.slice(b.length - s));
}
let raf = 0;
const refresh = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

function render() {
  const vis = compute();
  const tb = $('#rows');
  const out = [];
  let changed = 0, errs = 0, inc = 0;
  for (const f of vis) {
    const ch = f.inc && f.newName !== f.name;
    if (f.inc) inc++;
    if (ch && !f.err) changed++;
    if (f.err) errs++;
    const cls = [!f.checked && 'ex', f.err && 'bad', f.done && !ch && 'done'].filter(Boolean).join(' ');
    out.push(`<tr data-id="${f.id}" class="${cls}"${f.err ? ` title="${esc(f.err)}"` : ''}><td class="ck"><input type="checkbox"${f.checked ? ' checked' : ''}></td><td title="${esc(f.name)}">${esc(f.name)}</td><td class="ar">${ch ? '<svg><use href="#i-arrow"/></svg>' : ''}</td><td class="nn${ch ? '' : ' same'}">${ch ? diffHtml(f.name, f.newName) : esc(f.name)}</td><td class="dirc" title="${esc(f.dir)}">${esc(f.dir || '.')}</td><td class="num">${fmtSize(f.size)}</td><td class="dt">${fmtDate(f.mtime, 'YYYY/MM/DD hh:mm')}</td></tr>`);
  }
  tb.innerHTML = out.join('');
  $('#tbl').classList.toggle('nosub', !S.files.some(f => f.dir));
  $('#empty').hidden = S.files.length > 0;
  $('#ckAll').checked = vis.length > 0 && vis.every(f => f.checked);
  $('#ckAll').indeterminate = vis.some(f => f.checked) && !vis.every(f => f.checked);
  document.querySelectorAll('thead th[data-k]').forEach(th => { th.classList.toggle('asc', th.dataset.k === S.sort.k && S.sort.d > 0); th.classList.toggle('desc', th.dataset.k === S.sort.k && S.sort.d < 0); });
  $('#bRun').disabled = S.busy || !changed;
  $('#bUndo').disabled = S.busy || !S.history.length;
  $('#bReload').disabled = !S.root;
  $('#bClear').disabled = !S.files.length;
  const hidden = S.files.length - vis.length;
  $('#st').innerHTML = S.files.length
    ? `<b>${S.files.length}</b> 件${hidden ? `（表示 ${vis.length}）` : ''}　選択 <b>${inc}</b>　変更 <b>${changed}</b>${errs ? `　<span class="e">エラー ${errs}</span>` : ''}`
    : '';
  $('#mode').textContent = S.mode === 'fs' ? (S.root ? S.root.name : '') : S.mode === 'mem' ? 'ZIPで保存' : '';
  for (const r of S.rules) { const el = document.querySelector(`.rule[data-id="${r.id}"]`); if (el) { el.classList.toggle('err', !!r._err); const e = el.querySelector('.rerr'); if (e) { e.textContent = r._err || ''; e.hidden = !r._err; } } }
}

/* ---------- ルールUI ---------- */
const cond = (r, c) => !c || c.split('|').some(alt => alt.split('&').every(p => { const m = p.match(/^(\w+)(!?=)(.*)$/); return m[2] === '=' ? String(r[m[1]]) === m[3] : String(r[m[1]]) !== m[3]; }));
function field(r, f) {
  if (f === 'grow') return '<span class="grow"></span>';
  const [k, type, label, extra, c, w] = f;
  const hide = cond(r, c) ? '' : ' hidden';
  const tip = typeof extra === 'string' && extra ? ` data-tip="${esc(extra)}"` : '';
  if (type === 'text') {
    const ph = type === 'text' && f[0] === 'fmt' ? extra : '';
    const ip = `<input class="f" data-k="${k}" value="${esc(r[k])}" spellcheck="false"${ph ? ` placeholder="${esc(ph)}"` : ''}${!label && extra ? tip : ''}${w ? ' style="flex:0 0 44px;width:44px"' : ''}>`;
    return label ? `<div class="row"${hide}><label class="l">${label}</label>${ip}</div>` : ip.replace('<input', `<input${hide}`);
  }
  if (type === 'num') {
    const ip = `<input class="f n" type="number" data-k="${k}" value="${esc(r[k])}"${tip}${hide}>`;
    return label ? `<label class="l" style="width:auto"${hide}>${label}</label>${ip}` : ip;
  }
  if (type === 'chip') return `<label class="chip"${tip}${hide}><input type="checkbox" data-k="${k}"${r[k] ? ' checked' : ''}>${esc(label)}</label>`;
  if (type === 'seg') return `<span class="seg"${hide}>${extra.map(([v, t]) => `<label><input type="radio" name="${k}-${r.id}" data-k="${k}" value="${v}"${r[k] === v ? ' checked' : ''}>${t}</label>`).join('')}</span>`;
  if (type === 'select') return `<select data-k="${k}"${hide}>${extra.map(([v, t]) => `<option value="${v}"${r[k] === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  return '';
}
function renderRules() {
  const L = $('#ruleList');
  L.innerHTML = S.rules.map(r => {
    const R = RULES[r.type];
    const body = R.form.map(f => Array.isArray(f[0]) || f === 'grow' || (Array.isArray(f) && f.some(x => Array.isArray(x) || x === 'grow'))
      ? `<div class="row">${f.map(x => field(r, x)).join('')}</div>`
      : field(r, f)).join('');
    return `<div class="rule${r.on ? '' : ' off'}" data-id="${r.id}"><div class="rh"><span class="grip" draggable="true" data-tip="ドラッグで並べ替え"><svg><use href="#i-grip"/></svg></span><input type="checkbox" class="on"${r.on ? ' checked' : ''} data-tip="有効"><span class="tt">${R.label}</span><button class="ib dup" data-tip="複製"><svg><use href="#i-copy"/></svg></button><button class="ib del" data-tip="削除"><svg><use href="#i-x"/></svg></button></div><div class="rb">${body}<div class="rerr" hidden></div></div></div>`;
  }).join('');
  saveRules();
  refresh();
}
const saveRules = () => store.set('rn.rules', S.rules.map(({ _err, ...r }) => r));
const addRule = type => { S.rules.push({ id: uid++, type, on: true, ...structuredClone(RULES[type].def) }); renderRules(); const el = $('#ruleList').lastElementChild; el?.scrollIntoView({ block: 'nearest' }); el?.querySelector('input.f')?.focus(); };
S.rules.forEach(r => { r.id = uid++; r.on ??= true; for (const [k, v] of Object.entries(RULES[r.type]?.def || {})) r[k] ??= v; });
S.rules = S.rules.filter(r => RULES[r.type]);

const ruleOf = el => S.rules.find(r => r.id === +el.closest('.rule')?.dataset.id);
$('#ruleList').addEventListener('input', e => {
  const r = ruleOf(e.target); if (!r) return;
  const t = e.target;
  if (t.classList.contains('on')) { r.on = t.checked; t.closest('.rule').classList.toggle('off', !r.on); }
  else if (t.dataset.k) {
    const k = t.dataset.k;
    r[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? 0 : +t.value) : t.value;
    if (t.type === 'radio' || t.tagName === 'SELECT') { renderRules(); return; }
  }
  saveRules(); refresh();
});
$('#ruleList').addEventListener('click', e => {
  const r = ruleOf(e.target); if (!r) return;
  if (e.target.closest('.del')) { S.rules = S.rules.filter(x => x !== r); renderRules(); }
  else if (e.target.closest('.dup')) { const i = S.rules.indexOf(r); const { _err, ...c } = r; S.rules.splice(i + 1, 0, { ...structuredClone(c), id: uid++ }); renderRules(); }
});
let dragId = null;
$('#ruleList').addEventListener('dragstart', e => { const el = e.target.closest('.rule'); if (!el) return; dragId = +el.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(el, 10, 10); setTimeout(() => el.classList.add('drag')); });
$('#ruleList').addEventListener('dragover', e => {
  if (dragId == null) return; e.preventDefault();
  document.querySelectorAll('.rule.over').forEach(x => x.classList.remove('over'));
  e.target.closest('.rule')?.classList.add('over');
});
$('#ruleList').addEventListener('drop', e => {
  if (dragId == null) return; e.preventDefault(); e.stopPropagation();
  const el = e.target.closest('.rule');
  const from = S.rules.findIndex(r => r.id === dragId);
  if (el && from >= 0) {
    const [m] = S.rules.splice(from, 1);
    let to = S.rules.findIndex(r => r.id === +el.dataset.id);
    const rc = el.getBoundingClientRect();
    if (e.clientY > rc.top + rc.height / 2) to++;
    S.rules.splice(to < 0 ? S.rules.length : to, 0, m);
  }
  dragId = null; renderRules();
});
$('#ruleList').addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.rule.drag,.rule.over').forEach(x => x.classList.remove('drag', 'over')); });

/* ---------- メニュー・ツールチップ・トースト ---------- */
function menu(anchor, items) {
  const m = $('#menu');
  m.innerHTML = items.map((it, i) => `<button data-i="${i}">${esc(it[0])}</button>`).join('');
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 4) + 'px';
  m.style.top = r.bottom + 4 + 'px';
  m.onclick = e => { const b = e.target.closest('button'); if (b) { m.hidden = true; items[+b.dataset.i][1](); } };
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('#menu')) $('#menu').hidden = true; }, true);
let tipT = 0;
document.addEventListener('pointerover', e => {
  const el = e.target.closest('[data-tip]'); const tip = $('#tip');
  clearTimeout(tipT);
  if (!el) { tip.hidden = true; return; }
  tipT = setTimeout(() => {
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect();
    let x = r.left + r.width / 2 - tip.offsetWidth / 2; x = Math.max(4, Math.min(x, innerWidth - tip.offsetWidth - 4));
    let y = r.bottom + 6; if (y + tip.offsetHeight > innerHeight) y = r.top - tip.offsetHeight - 6;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }, 350);
});
document.addEventListener('pointerdown', () => { clearTimeout(tipT); $('#tip').hidden = true; });
let toastT = 0;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' e' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, err ? 5000 : 2500); }

/* ---------- ファイル読み込み ---------- */
async function scan(dh, dir, out) {
  for await (const [name, h] of dh.entries()) {
    if (h.kind === 'file') {
      try { const f = await h.getFile(); out.push({ id: uid++, name, dir, dh, h, size: f.size, mtime: f.lastModified, checked: true }); } catch {}
    } else if (S.recursive) await scan(h, dir ? dir + '/' + name : name, out);
  }
}
async function loadDir(dh) {
  if (dh.requestPermission && (await dh.requestPermission({ mode: 'readwrite' })) !== 'granted') { toast('書き込みの許可が必要です', true); return; }
  const prev = new Map(S.root === dh || (S.root && await S.root.isSameEntry?.(dh)) ? S.files.map(f => [f.dir + '/' + f.name, f.checked]) : []);
  const out = [];
  await scan(dh, '', out);
  for (const f of out) { const c = prev.get(f.dir + '/' + f.name); if (c != null) f.checked = c; }
  if (S.root !== dh) S.history = [];
  S.root = dh; S.mode = 'fs'; S.files = out;
  refresh();
}
async function openFolder() {
  if (!FS) { $('#fileIn').click(); return; }
  try { await loadDir(await showDirectoryPicker({ id: 'renamer', mode: 'readwrite' })); }
  catch (e) { if (e.name !== 'AbortError') toast(e.message, true); }
}
function addMemFiles(list) {
  if (S.mode === 'fs') { S.files = []; S.root = null; S.history = []; }
  S.mode = 'mem';
  const seen = new Set(S.files.map(f => f.dir + '/' + f.name));
  for (const file of list) {
    const dir = (file.webkitRelativePath || '').split('/').slice(0, -1).join('/');
    if (seen.has(dir + '/' + file.name)) continue;
    S.files.push({ id: uid++, name: file.name, dir, file, size: file.size, mtime: file.lastModified, checked: true });
  }
  refresh();
}
$('#bOpen').onclick = openFolder;
$('#bOpen2').onclick = openFolder;
$('#bFiles').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => { addMemFiles(e.target.files); e.target.value = ''; };
$('#bSub').setAttribute('aria-pressed', S.recursive);
$('#bSub').onclick = async () => { S.recursive = !S.recursive; store.set('rn.sub', S.recursive); $('#bSub').setAttribute('aria-pressed', S.recursive); if (S.root) await loadDir(S.root); };
$('#bReload').onclick = () => S.root && loadDir(S.root);
$('#bClear').onclick = () => { S.files = []; S.root = null; S.mode = null; S.history = []; refresh(); };

const drop = $('#drop');
drop.addEventListener('dragover', e => { if (dragId != null) return; e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', e => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('dragover'); });
drop.addEventListener('drop', async e => {
  if (dragId != null) return;
  e.preventDefault(); drop.classList.remove('dragover');
  const items = [...e.dataTransfer.items].filter(i => i.kind === 'file');
  if (FS && items[0]?.getAsFileSystemHandle) {
    const hs = (await Promise.all(items.map(i => i.getAsFileSystemHandle()))).filter(Boolean);
    const d = hs.find(h => h.kind === 'directory');
    if (d) { try { await loadDir(d); } catch (err) { toast(err.message, true); } return; }
  }
  addMemFiles(e.dataTransfer.files);
});

/* ---------- テーブル操作 ---------- */
$('#rows').addEventListener('click', e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const f = S.files.find(x => x.id === +tr.dataset.id); if (!f) return;
  if (e.target.type !== 'checkbox' && !e.target.closest('td.ck')) return;
  f.checked = e.target.type === 'checkbox' ? e.target.checked : !f.checked;
  refresh();
});
$('#ckAll').onchange = e => { for (const f of visible()) f.checked = e.target.checked; refresh(); };
document.querySelectorAll('thead th[data-k]').forEach(th => th.onclick = () => {
  const k = th.dataset.k; S.sort = { k, d: S.sort.k === k ? -S.sort.d : 1 }; refresh();
});
$('#filter').addEventListener('input', e => { S.filter = e.target.value; refresh(); });

/* ---------- リネーム実行 ---------- */
async function exists(dh, name) { try { await dh.getFileHandle(name); return true; } catch { return false; } }
async function mv(f, to) {
  if (f.h.move) {
    try { await f.h.move(to); f.name = to; return; }
    catch (e) { if (e.name === 'NotAllowedError' || e.name === 'NoModificationAllowedError') throw e; }
  }
  if (await exists(f.dh, to)) throw new Error(`「${to}」は既に存在します`);
  const file = await f.h.getFile();
  const nh = await f.dh.getFileHandle(to, { create: true });
  try {
    const w = await nh.createWritable(); await w.write(file); await w.close();
    await f.dh.removeEntry(f.name);
  } catch (e) { try { await f.dh.removeEntry(to); } catch {} throw e; }
  f.h = nh; f.name = to;
}
async function batch(pairs) {
  // pairs: [{f, to}] — 衝突を避けるため一時名を経由
  const cur = new Set(S.files.map(f => f.dir + '/' + f.name.toLowerCase()));
  const tag = '.rn' + Date.now().toString(36);
  const staged = [];
  const done = [];
  try {
    for (const [i, p] of pairs.entries()) {
      p.from = p.f.name;
      if (cur.has(p.f.dir + '/' + p.to.toLowerCase())) { await mv(p.f, `${tag}-${i}.tmp`); staged.push(p); }
    }
    for (const p of pairs) { await mv(p.f, p.to); done.push(p); }
  } catch (e) {
    for (const p of staged) if (!done.includes(p)) { try { await mv(p.f, p.from); } catch {} }
    throw Object.assign(e, { done });
  }
  return done;
}
async function run() {
  if (S.busy) return;
  compute();
  const jobs = S.files.filter(f => f.inc && f.newName !== f.name && !f.err);
  if (!jobs.length) return;
  const skipped = S.files.filter(f => f.inc && f.err).length;
  if (S.mode === 'mem') { await saveZip(jobs); return; }
  S.busy = true; render();
  for (const f of S.files) f.done = false;
  let done = [];
  try { done = await batch(jobs.map(f => ({ f, to: f.newName }))); toast(`${done.length} 件をリネームしました${skipped ? `（エラー ${skipped} 件はスキップ）` : ''}`); }
  catch (e) { done = e.done || []; toast(`${done.length} 件で停止: ${e.message}`, true); }
  for (const p of done) p.f.done = true;
  if (done.length) S.history.push(done.map(p => ({ f: p.f, from: p.from, to: p.to })));
  S.busy = false; refresh();
}
async function undo() {
  const last = S.history.pop(); if (!last || S.busy) return;
  S.busy = true; render();
  try { const d = await batch(last.filter(x => S.files.includes(x.f) && x.f.name === x.to).map(x => ({ f: x.f, to: x.from }))); toast(`${d.length} 件を元に戻しました`); }
  catch (e) { toast(e.message, true); }
  for (const f of S.files) f.done = false;
  S.busy = false; refresh();
}
$('#bRun').onclick = run;
$('#bUndo').onclick = undo;

/* ---------- ZIP（読み取り専用モード） ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
async function saveZip(jobs) {
  const all = S.files.filter(f => f.inc);
  const te = new TextEncoder();
  const parts = [], central = []; let off = 0;
  for (const f of all) {
    const data = new Uint8Array(await f.file.arrayBuffer());
    const name = te.encode((f.dir ? f.dir + '/' : '') + f.newName);
    const crc = crc32(data), d = new Date(f.mtime);
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(c.buffer, name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.byteLength, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, all.length, true); e.setUint16(10, all.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const blob = new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'renamed.zip'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast(`${jobs.length} 件の名前を変更してZIPに保存しました`);
}

/* ---------- プリセット ---------- */
function renderPresets() {
  const sel = $('#preset');
  sel.innerHTML = '<option value="">プリセット</option>' + Object.keys(S.presets).sort().map(k => `<option>${esc(k)}</option>`).join('');
}
$('#preset').onchange = e => {
  const p = S.presets[e.target.value]; if (!p) return;
  S.rules = structuredClone(p).map(r => ({ ...structuredClone(RULES[r.type].def), ...r, id: uid++ }));
  renderRules();
};
$('#bSave').onclick = () => {
  if (!S.rules.length) return;
  const name = prompt('プリセット名', $('#preset').value || '');
  if (!name) return;
  S.presets[name] = S.rules.map(({ id, _err, ...r }) => r);
  store.set('rn.presets', S.presets); renderPresets(); $('#preset').value = name;
};
$('#bDelPreset').onclick = () => { const k = $('#preset').value; if (!k) return; delete S.presets[k]; store.set('rn.presets', S.presets); renderPresets(); };
$('#bResetRules').onclick = () => { S.rules = []; $('#preset').value = ''; renderRules(); };
$('#bAdd').onclick = e => menu(e.currentTarget, ORDER.map(t => [RULES[t].label, () => addRule(t)]));

/* ---------- キーボード ---------- */
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'Enter') { e.preventDefault(); run(); }
  else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && !e.target.closest('input,select')) { e.preventDefault(); undo(); }
  else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openFolder(); }
  else if (e.key === 'Escape') $('#menu').hidden = true;
});

/* ---------- 起動 ---------- */
if (!FS) { $('#bOpen').dataset.tip = 'フォルダを開く（ZIPで保存）'; $('#fileIn').setAttribute('webkitdirectory', ''); $('#bFiles').onclick = () => { $('#fileIn').removeAttribute('webkitdirectory'); $('#fileIn').click(); setTimeout(() => $('#fileIn').setAttribute('webkitdirectory', ''), 0); }; }
renderPresets();
renderRules();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__rn = { S, RULES, applyRules, compute, conv, loadDir, run, undo, addRule, renderRules };
