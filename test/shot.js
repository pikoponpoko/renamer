const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ locale: 'ja-JP', colorScheme: scheme, viewport: { width: 1100, height: 600 }, deviceScaleFactor: 2 });
    await p.goto('http://localhost:8765/');
    await p.evaluate(async () => {
      const { S, RULES, loadDir, renderRules } = window.__rn;
      const names = ['IMG_0412.JPG', 'IMG_0413.JPG', 'IMG_0414.JPG', 'IMG_0415.JPG', 'DSC00021.JPG', 'DSC00022.JPG', '京都 (1).png', '京都 (2).png', 'ﾒﾓ.txt', 'スケジュール.pdf'];
      S.mode = 'fs'; S.root = { name: '旅行写真' };
      S.files = names.map((n, i) => ({ id: 100 + i, name: n, dir: '', size: (i * 734211 + 81234) % 4e6, mtime: new Date(2025, 9, 3 + i, 10 + i, 12).getTime(), checked: true }));
      S.rules = [
        { id: 1, type: 'replace', on: true, ...RULES.replace.def, find: '^(IMG_|DSC)', repl: '', regex: true },
        { id: 2, type: 'seq', on: true, ...RULES.seq.def, pos: 'start', digits: 3 },
        { id: 3, type: 'width', on: true, ...RULES.width.def, mode: 'kana' },
        { id: 4, type: 'ext', on: true, ...RULES.ext.def, mode: 'lower' },
      ];
      S.files[9].checked = false;
      renderRules();
    });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `/tmp/claude-0/-home-claude/c4a0d82d-eb26-5800-8b5e-c50aeadbde06/scratchpad/shot-${scheme}.png` });
    if (scheme === 'light') {
      await p.click('#bAdd'); await p.waitForTimeout(100);
      await p.screenshot({ path: `/tmp/claude-0/-home-claude/c4a0d82d-eb26-5800-8b5e-c50aeadbde06/scratchpad/shot-menu.png`, clip: { x: 0, y: 0, width: 420, height: 360 } });
      const font = await p.evaluate(() => document.fonts.check('12px "Noto Sans JP"'));
      console.log('noto loaded', font);
    }
  }
  await b.close();
})();
