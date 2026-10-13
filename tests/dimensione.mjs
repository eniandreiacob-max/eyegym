import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8000/index.html';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };
const forma = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0, minY = 1e9, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 0) { n++; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { n, minY, maxY, H: height };
});
const b = await chromium.launch();
async function nuova() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'it-IT' });
  const p = await ctx.newPage(); p.err = [];
  p.on('pageerror', (e) => p.err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.err.push(m.text()); });
  await p.clock.install(); await p.goto(URL);
  await p.evaluate(() => { localStorage.setItem('etr.avvisoLetto', 'true'); localStorage.setItem('etr.impostazioni', JSON.stringify({ opzioniAperte: true })); }); await p.reload(); await p.clock.install();
  return { ctx, p };
}
async function corsa(p, secondi, passo = 100) {
  await p.click('#btn-avvia'); await p.locator('#palco').waitFor({ state: 'visible' });
  await p.clock.runFor(3080);
  const f = [];
  for (let t = 0; t < secondi * 1000; t += passo) { await p.clock.runFor(passo); f.push(await forma(p)); }
  await p.keyboard.press('Escape');
  return f;
}
const A = (r) => Math.PI * (r / 2) ** 2; // area di un bersaglio di diametro r

// ---- interfaccia ----
let { ctx, p } = await nuova();
ok(await p.locator('#campo-dimensione').isVisible() && await p.locator('#opzioni-dimensione-variabile').isHidden(), 'di default: slider singolo, nessun intervallo');
await p.locator('#dimensione-variabile').check();
ok(await p.locator('#campo-dimensione').isHidden() && await p.locator('#opzioni-dimensione-variabile').isVisible(), 'con l\'opzione: compaiono minimo e massimo, sparisce lo slider singolo');
ok(await p.locator('#dimensione-min-val').innerText() === '16 px' && await p.locator('#dimensione-max-val').innerText() === '48 px', 'intervallo predefinito 16–48 px');
await p.locator('#dimensione-min').fill('70');
ok(await p.locator('#dimensione-max').inputValue() === '70' && await p.locator('#dimensione-max-val').innerText() === '70 px', 'alzando il minimo oltre il massimo, il massimo lo segue (70/70)');
await p.locator('#dimensione-max').fill('30');
ok(await p.locator('#dimensione-min').inputValue() === '30' && await p.locator('#dimensione-min-val').innerText() === '30 px', 'abbassando il massimo sotto il minimo, il minimo lo segue (30/30)');
await p.locator('#dimensione-min').fill('20'); await p.locator('#dimensione-max').fill('60');
await p.screenshot({ path: process.env.SHOTS + '/17-intervallo-dimensione.png', fullPage: true });
await p.reload();
ok(await p.locator('#dimensione-min').inputValue() === '20' && await p.locator('#dimensione-max').inputValue() === '60' && await p.locator('#dimensione-variabile').isChecked(), 'intervallo ricordato dopo il reload (20–60)');
await p.clock.install();

// ---- comportamento 20–60 ----
await p.locator('input[name=esercizio][value=orizzontale]').check();
let f = await corsa(p, 12);
let a = f.map((x) => x.n);
ok(Math.abs(a[0] - A(20)) / A(20) < 0.45, `parte dal minimo (area ${a[0]} ≈ ${Math.round(A(20))})`);
const imax = a.indexOf(Math.max(...a));
ok(Math.abs(Math.max(...a) - A(60)) / A(60) < 0.1, `raggiunge il massimo (area ${Math.max(...a)} ≈ ${Math.round(A(60))})`);
ok(Math.abs(imax - 50) <= 6, `il massimo arriva a metà ciclo (~5 s): campione ${imax} su 100 ogni 10 s`);
ok(Math.min(...a) >= A(20) * 0.85, `non scende sotto il minimo scelto (area minima ${Math.min(...a)})`);
ok(Math.abs(a[100] - a[0]) / a[0] < 0.3, `dopo 10 s è tornato al minimo (${a[0]} → ${a[100]})`);
const passi = a.slice(1).map((v, i) => Math.abs(v - a[i]) / a[i]);
ok(Math.max(...passi) < 0.2, `cambio graduale (max ${(Math.max(...passi) * 100).toFixed(1)}% tra campioni a 100 ms)`);

// ---- minimo = massimo: costante ----
await p.locator('#dimensione-min').fill('40'); await p.locator('#dimensione-max').fill('40');
f = await corsa(p, 6); a = f.map((x) => x.n);
ok(Math.max(...a) / Math.min(...a) < 1.06, `minimo = massimo: dimensione costante (aree ${Math.min(...a)}–${Math.max(...a)})`);

// ---- ampio, verticale a tutta altezza: sempre dentro lo schermo ----
await p.locator('#dimensione-min').fill('12'); await p.locator('#dimensione-max').fill('80');
await p.locator('input[name=esercizio][value=verticale]').check(); await p.locator('#velocita').fill('10');
f = await corsa(p, 14);
const minY = Math.min(...f.map((x) => x.minY)), maxY = Math.max(...f.map((x) => x.maxY));
a = f.map((x) => x.n);
ok(minY >= 9 && maxY <= f[0].H - 10, `intervallo 12–80: sempre dentro lo schermo (y da ${minY} a ${maxY} su ${f[0].H})`);
ok(Math.max(...a) / Math.min(...a) > 25, `ampiezza grande (rapporto aree ${(Math.max(...a) / Math.min(...a)).toFixed(0)}, atteso ~44)`);

// ---- con le lettere ----
await p.locator('input[name=esercizio][value=orizzontale]').check(); await p.locator('#velocita').fill('3');
await p.locator('#lettere').check();
await p.locator('#dimensione-min').fill('20'); await p.locator('#dimensione-max').fill('80');
f = await corsa(p, 12); a = f.map((x) => x.n);
ok(Math.min(...a) >= 0.9 * A(48), `lettere + 20–80: il minimo effettivo è 48 px (area minima ${Math.min(...a)} ≥ ${Math.round(0.9 * A(48))})`);
ok(Math.abs(Math.max(...a) - A(80)) / A(80) < 0.1, `…e il massimo resta 80 px (area ${Math.max(...a)} ≈ ${Math.round(A(80))})`);
await p.locator('#dimensione-min').fill('20'); await p.locator('#dimensione-max').fill('40');
f = await corsa(p, 6); a = f.map((x) => x.n);
ok(Math.max(...a) / Math.min(...a) < 1.06 && Math.abs(a[0] - A(48)) / A(48) < 0.1, `lettere + 20–40: tutto sotto 48 px, quindi costante a 48 (aree ${Math.min(...a)}–${Math.max(...a)})`);
ok(p.err.length === 0, 'nessun errore in console' + (p.err.length ? ': ' + p.err.join(' | ') : ''));
await ctx.close();

// ---- impostazioni salvate dalla versione precedente (±50%, nessun intervallo) ----
({ ctx, p } = await nuova());
await p.evaluate(() => localStorage.setItem('etr.impostazioni', JSON.stringify({ esercizio: 'cerchio', velocita: 4, dimensione: 40, dimensioneVariabile: true, opzioniAperte: true })));
await p.reload();
ok(await p.locator('#dimensione-min').inputValue() === '16' && await p.locator('#dimensione-max').inputValue() === '48' && await p.locator('#dimensione-variabile').isChecked(), 'impostazioni vecchie (senza intervallo) si aprono con 16–48');
await ctx.close();
await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
