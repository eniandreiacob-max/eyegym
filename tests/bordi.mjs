import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8000/index.html';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };
const centroide = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3] > 0) { sx += x; sy += y; n++; }
  return { x: sx / n, y: sy / n };
});
const b = await chromium.launch();
for (const dim of [32, 80]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'it-IT' });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message));
  await p.clock.install(); await p.goto(URL);
  await p.evaluate(() => localStorage.setItem('etr.avvisoLetto', 'true')); await p.reload(); await p.clock.install();
  await p.locator('#dimensione').fill(String(dim));
  const r = dim / 2, atteso = r + 12;
  for (const [es, asse, lim] of [['verticale', 'y', 800], ['orizzontale', 'x', 1280]]) {
    await p.locator(`input[name=esercizio][value=${es}]`).check();
    await p.locator('#velocita').fill('10');
    await p.click('#btn-avvia'); await p.locator('#palco').waitFor({ state: 'visible' });
    await p.clock.runFor(3500);
    let min = 1e9, max = -1e9;
    for (let t = 0; t < 6000; t += 50) { await p.clock.runFor(50); const c = await centroide(p); min = Math.min(min, c[asse]); max = Math.max(max, c[asse]); }
    await p.keyboard.press('Escape');
    ok(Math.abs(min - atteso) < 6 && Math.abs(max - (lim - atteso)) < 6,
      `bersaglio ${dim}px, ${es}: da ${Math.round(min)} a ${Math.round(max)} su ${lim} (atteso ${atteso} … ${lim - atteso})`);
  }
  await ctx.close();
}
// i pulsanti restano cliccabili con il canvas sopra la barra
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'it-IT' });
const p = await ctx.newPage(); await p.clock.install(); await p.goto(URL);
await p.evaluate(() => localStorage.setItem('etr.avvisoLetto', 'true')); await p.reload(); await p.clock.install();
await p.click('#btn-avvia'); await p.locator('#palco').waitFor({ state: 'visible' });
await p.clock.runFor(4500); await p.mouse.click(300, 400);
await new Promise((r) => setTimeout(r, 600));
await p.click('#btn-pausa');
ok(await p.locator('#ov-pausa').isVisible(), 'clic sul pulsante Pausa funziona (canvas non blocca i clic)');
await p.click('#btn-riprendi'); await p.keyboard.press('Escape');
await ctx.close(); await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
