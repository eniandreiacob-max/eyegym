// Velocità in gradi al secondo: uguale su schermi diversi, corretta dalla calibrazione e dalla distanza,
// con il percorso limitato a ±20° dal centro.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8000/index.html';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };

const PX_PER_GRADO = (distanza, cmPerPx) => (distanza * Math.PI / 180) / cmPerPx;
const NOMINALE = 2.54 / 96;
const vicino = (misurato, atteso, tolleranza = 0.08) => Math.abs(misurato - atteso) / atteso <= tolleranza;

const centro = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let sx = 0, n = 0;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3] > 0) { sx += x; n++; }
  return sx / n;
});

const b = await chromium.launch();
async function pagina(viewport = { width: 1280, height: 800 }) {
  const ctx = await b.newContext({ viewport, locale: 'it-IT' });
  const p = await ctx.newPage(); p.err = [];
  p.on('pageerror', (e) => p.err.push(e.message));
  await p.clock.install(); await p.goto(URL);
  await p.evaluate(() => localStorage.setItem('etr.avvisoLetto', 'true')); await p.reload(); await p.clock.install();
  return { ctx, p };
}
// Esercizio orizzontale: velocità di picco (px/s) e ampiezza (px) misurate sul bersaglio
async function misura(p, livello, secondi) {
  await p.locator('input[name=esercizio][value=orizzontale]').check();
  await p.locator('#velocita').fill(String(livello));
  await p.click('#btn-avvia'); await p.locator('#palco').waitFor({ state: 'visible' });
  // clock fermo e campioni ogni 4 frame esatti (il clock simulato avanza a frame di 16 ms)
  const ora = await p.evaluate(() => Date.now());
  await p.clock.pauseAt(new Date(ora + 300));
  await p.clock.runFor(3200);
  const PASSO = 64;
  const xs = [];
  for (let t = 0; t < secondi * 1000; t += PASSO) { await p.clock.runFor(PASSO); xs.push(await centro(p)); }
  await p.keyboard.press('Escape');
  const passi = xs.slice(1).map((x, i) => Math.abs(x - xs[i]) / (PASSO / 1000));
  return { picco: Math.max(...passi), ampiezza: Math.max(...xs) - Math.min(...xs) };
}

// 1) stima nominale, 60 cm
let { ctx, p } = await pagina();
ok(/10,5°\/s/.test(await p.locator('#velocita-val').innerText()), 'il livello 3 è mostrato come 10,5°/s');
let atteso = 10.5 * PX_PER_GRADO(60, NOMINALE);
let m = await misura(p, 3, 10);
ok(vicino(m.picco, atteso), `livello 3, schermo 1280 px: picco ${Math.round(m.picco)} px/s (atteso ${Math.round(atteso)})`);
const piccoGrande = m.picco;
m = await misura(p, 10, 4);
atteso = 28 * PX_PER_GRADO(60, NOMINALE);
ok(vicino(m.picco, atteso), `livello 10: picco ${Math.round(m.picco)} px/s, cioè 28°/s (atteso ${Math.round(atteso)})`);
await ctx.close();

// 2) finestra più piccola: stessa velocità (prima scalava con la larghezza)
({ ctx, p } = await pagina({ width: 900, height: 700 }));
m = await misura(p, 3, 10);
ok(vicino(m.picco, piccoGrande, 0.06), `schermo 900 px: stesso picco (${Math.round(m.picco)} contro ${Math.round(piccoGrande)} px/s)`);
await ctx.close();

// 3) calibrazione con la carta: pixel più piccoli → più pixel al secondo per la stessa velocità in gradi
({ ctx, p } = await pagina());
ok(!(await p.locator('#calibrazione').evaluate((d) => d.open)), 'il blocco "Schermo e distanza" è chiuso di default');
await p.locator('#calibrazione summary').click();
ok(/Non calibrato/.test(await p.locator('#larghezza-schermo').innerText()), 'stato iniziale: non calibrato');
await p.locator('#carta').fill('600');
const cm = 8.56 / 600;
ok(Math.abs(await p.locator('#carta-rettangolo').evaluate((e) => e.getBoundingClientRect().width) - 600) < 2, 'il rettangolo della carta segue lo slider');
ok(/Calibrato/.test(await p.locator('#larghezza-schermo').innerText()), await p.locator('#larghezza-schermo').innerText());
await p.reload(); await p.clock.install();
ok(await p.locator('#carta').inputValue() === '600', 'calibrazione ricordata dopo il reload');
m = await misura(p, 3, 6);
atteso = 10.5 * PX_PER_GRADO(60, cm);
ok(vicino(m.picco, atteso), `calibrato: picco ${Math.round(m.picco)} px/s (atteso ${Math.round(atteso)})`);

// 4) distanza 40 cm: meno pixel per grado, e l'ampiezza si ferma a ±20°
await p.locator('#calibrazione').evaluate((d) => { d.open = true; });
await p.locator('#btn-ripristina-calibrazione').click();
ok(/Non calibrato/.test(await p.locator('#larghezza-schermo').innerText()), '"Usa la stima" annulla la calibrazione');
await p.locator('#distanza').selectOption('40');
m = await misura(p, 3, 12);
atteso = 10.5 * PX_PER_GRADO(40, NOMINALE);
const ampiezzaAttesa = 2 * 20 * PX_PER_GRADO(40, NOMINALE);
ok(vicino(m.picco, atteso), `40 cm: picco ${Math.round(m.picco)} px/s (atteso ${Math.round(atteso)})`);
ok(vicino(m.ampiezza, ampiezzaAttesa, 0.03), `40 cm: percorso limitato a ±20° (${Math.round(m.ampiezza)} px contro ${Math.round(ampiezzaAttesa)}, lo schermo ne permetterebbe 1224)`);
await p.locator('#distanza').selectOption('60');
m = await misura(p, 3, 10);
ok(vicino(m.ampiezza, 1224, 0.03), `60 cm: nessun limite, il percorso usa tutta la larghezza (${Math.round(m.ampiezza)} px)`);
ok(p.err.length === 0, 'nessun errore in console' + (p.err.length ? ': ' + p.err.join(' | ') : ''));
await ctx.close();
await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
