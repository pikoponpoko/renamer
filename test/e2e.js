const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ locale: 'ja-JP' });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8765/');
  // 単体: ルール適用
  const r = await p.evaluate(() => {
    const { RULES, applyRules, S, conv } = window.__rn;
    const mk = (type, o) => ({ id: 1, type, on: true, ...structuredClone(RULES[type].def), ...o });
    const t = (rules, name, ctx = {}) => { S.rules = rules; return applyRules({ name, mtime: new Date(2024, 0, 5, 9, 3, 7).getTime() }, { i: 0, di: 0, now: 0, f: { mtime: new Date(2024, 0, 5, 9, 3, 7).getTime() }, ...ctx }); };
    return {
      rep: t([mk('replace', { find: 'a', repl: 'b' })], 'banana.txt'),
      rx: t([mk('replace', { find: '(\\d+)-(\\d+)', repl: '$2-$1', regex: true })], 'x12-34.jpg'),
      lit: t([mk('replace', { find: '.', repl: '_' })], 'a.b.c.txt'),
      icase: t([mk('replace', { find: 'IMG', repl: 'p', icase: true })], 'img_1.JPG'),
      ins: t([mk('insert', { text: '★', pos: 'index', idx: 2 })], 'abcd.png'),
      insEnd: t([mk('insert', { text: '-x', pos: 'index', idx: -1 })], 'abcd.png'),
      rmRange: t([mk('remove', { from: 0, count: 4 })], 'IMG_0001.jpg'),
      rmEnd: t([mk('remove', { from: 0, count: 2, end: true })], 'abcdef.jpg'),
      rmBr: t([mk('remove', { mode: 'brackets' })], '曲名 (Live) 【高音質】.mp3'),
      seq: t([mk('seq', {})], 'a.jpg', { i: 4 }),
      seqRep: t([mk('seq', { pos: 'replace', digits: 2, start: 10, step: 5 })], 'a.jpg', { i: 2 }),
      date: t([mk('date', { fmt: 'YYYY-MM-DD_hhmmss' })], 'a.jpg'),
      title: t([mk('case', { mode: 'title' })], 'hello wORLD.TXT'),
      extLow: t([mk('ext', { mode: 'lower' })], 'A.JPG'),
      extSet: t([mk('ext', { mode: 'set', value: '.jpeg' })], 'a.jpg'),
      extRm: t([mk('ext', { mode: 'remove' })], 'a.tar.gz'),
      extTarget: t([mk('case', { mode: 'upper', target: 'ext' })], 'a.png'),
      full: t([mk('replace', { find: 'jpg', repl: 'png', target: 'full' })], 'jpg.jpg'),
      z2h: conv.z2h('ＡＢＣ１２３　テスト'),
      kana: conv.kana('ｶﾞｯｺｳ ﾃｽﾄ'),
      k2h: conv.k2h('カタカナ'),
      off: t([mk('replace', { find: 'a', repl: 'b', on: false })], 'a.txt'),
      chain: t([mk('remove', { mode: 'all' }), mk('seq', { pos: 'replace', digits: 4 })], 'x.jpg', { i: 6 }),
      bad: (() => { S.rules = [mk('replace', { find: '(', repl: '', regex: true })]; applyRules({ name: 'a(b' }, {}); return !!S.rules[0]._err; })(),
    };
  });
  const exp = { rep: 'bbnbnb.txt', rx: 'x34-12.jpg', lit: 'a_b_c.txt', icase: 'p_1.JPG', ins: 'ab★cd.png', insEnd: 'abcd-x.png', rmRange: '0001.jpg', rmEnd: 'abcd.jpg', rmBr: '曲名.mp3', seq: 'a_005.jpg', seqRep: '20.jpg', date: '2024-01-05_090307_a.jpg', title: 'Hello World.TXT', extLow: 'A.jpg', extSet: 'a.jpeg', extRm: 'a.tar', extTarget: 'a.PNG', full: 'png.png', z2h: 'ABC123 テスト', kana: 'ガッコウ テスト', k2h: 'かたかな', off: 'a.txt', chain: '0007.jpg', bad: true };
  for (const k in exp) assert(r[k] === exp[k], `${k}: ${r[k]}`);

  // E2E: OPFSフォルダでリネーム・衝突・元に戻す
  const e = await p.evaluate(async () => {
    const { S, RULES, loadDir, run, undo, renderRules } = window.__rn;
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    const d = await root.getDirectoryHandle('t', { create: true });
    const w = async (dh, n, c) => { const h = await dh.getFileHandle(n, { create: true }); const x = await h.createWritable(); await x.write(c); await x.close(); };
    await w(d, 'b.txt', 'B'); await w(d, 'a.txt', 'A'); await w(d, 'c.TXT', 'C');
    const sub = await d.getDirectoryHandle('sub', { create: true }); await w(sub, 'z.txt', 'Z');
    const ls = async dh => { const o = []; for await (const [n, h] of dh.entries()) if (h.kind === 'file') o.push(n + '=' + await (await h.getFile()).text()); return o.sort().join(','); };
    await loadDir(d);
    const n0 = S.files.length;
    // スワップ: a<->b （連番で置換し衝突）
    S.rules = [{ id: 1, type: 'remove', on: true, ...RULES.remove.def, mode: 'all' }, { id: 2, type: 'seq', on: true, ...RULES.seq.def, pos: 'replace', digits: 1 }, { id: 3, type: 'ext', on: true, ...RULES.ext.def, mode: 'lower' }];
    S.sort = { k: 'name', d: -1 };
    renderRules();
    await run();
    const after = await ls(d);
    // 衝突エラーの検出
    S.rules = [{ id: 4, type: 'remove', on: true, ...RULES.remove.def, mode: 'all' }, { id: 5, type: 'insert', on: true, ...RULES.insert.def, text: 'same' }];
    renderRules(); window.__rn.compute();
    const dupErr = S.files.filter(f => f.err === '名前が重複しています').length;
    await undo();
    const undone = await ls(d);
    S.recursive = true; await loadDir(d);
    const withSub = S.files.map(f => f.dir + '/' + f.name).sort().join(',');
    return { n0, after, dupErr, undone, withSub };
  });
  assert(e.n0 === 3, 'サブフォルダ除外で3件');
  assert(e.after === '1.txt=C,2.txt=B,3.txt=A', 'リネーム後 ' + e.after);
  assert(e.dupErr === 3, '重複エラー検出 ' + e.dupErr);
  assert(e.undone === 'a.txt=A,b.txt=B,c.TXT=C', '元に戻す ' + e.undone);
  assert(e.withSub === '/a.txt,/b.txt,/c.TXT,sub/z.txt', 'サブフォルダ ' + e.withSub);
  assert(errs.length === 0, 'コンソールエラーなし ' + errs.join(' | '));
  await b.close();
})();
