// Anteprime animate nelle schede degli esercizi: si muovono al passaggio del mouse, restano sul tracciato
// disegnato, tornano a riposo; partono anche da tastiera e su touch; restano ferme con "riduci movimento".
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8000/index.html';
const SHOTS = process.env.SHOTS || '.';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));
const TIPI = ['orizzontale', 'verticale', 'cerchio', 'ellisse', 'otto', 'saccadi', 'zigzag', 'misto'];
const CONTINUI = ['orizzontale', 'verticale', 'cerchio', 'ellisse', 'otto', 'zigzag'];

const b = await chromium.launch();
async function pagina(opz = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'it-IT', ...opz });
  const page = await ctx.newPage(); page.err = [];
  page.on('pageerror', (e) => page.err.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.err.push(m.text()); });
  await page.goto(URL);
  return { ctx, page };
}
const scheda = (page, tipo) => page.locator(`.scheda:has(input[value=${tipo}])`);
const punto = (page, tipo) => scheda(page, tipo).locator('.punto').evaluate((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- mouse ----------
let { ctx, page } = await pagina();
for (const tipo of TIPI) {
  const riposo = await punto(page, tipo);
  await scheda(page, tipo).hover({ position: { x: 30, y: 30 } });
  const campioni = [];
  for (let i = 0; i < 8; i++) { await aspetta(160); campioni.push(await punto(page, tipo)); }
  const spostamento = Math.max(...campioni.map((p) => dist(p, riposo)));
  ok(spostamento > 2, `${tipo}: al passaggio del mouse il pallino si muove (fino a ${spostamento.toFixed(1)} unità)`);
  if (CONTINUI.includes(tipo)) {
    const traccia = (await scheda(page, tipo).locator('.scheda__icona path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d')))).join('');
    const punti = [...traccia.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
    const fuori = Math.max(...campioni.map((p) => Math.min(...punti.map((q) => dist(p, q)))));
    ok(punti.length > 100 && fuori < 0.8, `${tipo}: il pallino resta sul tracciato disegnato (scarto max ${fuori.toFixed(2)})`);
  }
  if (tipo === 'otto') await page.screenshot({ path: `${SHOTS}/anteprima-otto.png`, clip: await scheda(page, tipo).boundingBox() });
  await page.mouse.move(5, 890); await aspetta(80);
  ok(dist(await punto(page, tipo), riposo) < 0.01, `${tipo}: togliendo il mouse torna fermo nella posizione di riposo`);
}
ok(await page.locator('.scheda--anteprima').count() === 0, 'nessuna anteprima resta accesa');

// ---------- tastiera ----------
await page.locator('input[name=esercizio][value=orizzontale]').focus();
await page.keyboard.press('ArrowDown'); // seleziona e mette a fuoco "verticale" da tastiera
const r0 = await punto(page, 'verticale'); await aspetta(400);
ok(dist(await punto(page, 'verticale'), r0) > 1, 'da tastiera: l\'esercizio a fuoco mostra l\'anteprima');
ok(page.err.length === 0, 'nessun errore in console' + (page.err.length ? ': ' + page.err.join(' | ') : ''));
await ctx.close();

// ---------- touch ----------
({ ctx, page } = await pagina({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
const t0 = await punto(page, 'cerchio');
await scheda(page, 'cerchio').tap();
await aspetta(500);
ok(dist(await punto(page, 'cerchio'), t0) > 1, 'touch: scegliendo l\'esercizio l\'anteprima parte');
await aspetta(3600);
ok(dist(await punto(page, 'cerchio'), t0) < 0.01 && await page.locator('.scheda--anteprima').count() === 0, 'touch: dopo qualche secondo si ferma da sola');
await ctx.close();

// ---------- riduci movimento ----------
({ ctx, page } = await pagina({ reducedMotion: 'reduce' }));
const m0 = await punto(page, 'otto');
await scheda(page, 'otto').hover({ position: { x: 30, y: 30 } }); await aspetta(500);
ok(dist(await punto(page, 'otto'), m0) < 0.01, 'con "riduci movimento" le icone restano ferme');
await ctx.close();

await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
