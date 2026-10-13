import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8000/index.html';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };
const reale = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const razzo = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const vicino = (r, g, b, R, G, B, t = 40) => Math.abs(r - R) < t && Math.abs(g - G) < t && Math.abs(b - B) < t;
  const acc = { vetro: [0, 0, 0], fiamma: [0, 0, 0], rosso: [0, 0, 0], tutto: [0, 0, 0] };
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1; const bianchi = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4; if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = vicino(r, g, b, 76, 201, 240) ? 'vetro' : vicino(r, g, b, 255, 107, 0, 30) ? 'fiamma' : vicino(r, g, b, 229, 56, 59) ? 'rosso' : null;
    if (k) { acc[k][0] += x; acc[k][1] += y; acc[k][2]++; }
    if (vicino(r, g, b, 241, 243, 245, 12)) bianchi.push([x, y]);
    acc.tutto[2]++;
  }
  // forma del razzo = tutti i pixel colorati del razzo (esclude le stelle bianche piccole): bbox da vetro/fiamma/rosso
  const c3 = (k) => acc[k][2] ? { x: acc[k][0] / acc[k][2], y: acc[k][1] / acc[k][2], n: acc[k][2] } : null;
  // stelle: pixel semitrasparenti
  let stelle = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 20 && data[i] < 200) stelle++;
  return { vetro: c3('vetro'), fiamma: c3('fiamma'), rosso: c3('rosso'), stelle, W: width, H: height };
});
const bbox = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 200) {
    // ignora le stelle (piccole, bianche): solo pixel del razzo
    const i = (y * width + x) * 4; if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, W: width, H: height };
});
const b = await chromium.launch();
async function nuova() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'it-IT' });
  const p = await ctx.newPage(); p.err = [];
  p.on('pageerror', (e) => p.err.push(e.message)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/willReadFrequently/.test(m.text())) p.err.push(m.text()); });
  await p.clock.install(); await p.goto(URL);
  await p.evaluate(() => { localStorage.setItem('etr.avvisoLetto', 'true'); localStorage.setItem('etr.impostazioni', JSON.stringify({ opzioniAperte: true })); }); await p.reload(); await p.clock.install();
  return { ctx, p };
}
const avvia = async (p) => { await p.click('#btn-avvia'); await p.locator('#palco').waitFor({ state: 'visible' }); };

let { ctx, p } = await nuova();
// ---- interfaccia ----
ok(!(await p.locator('#bambino').isChecked()), 'modalità bambino spenta di default');
await p.locator('#bambino').check();
ok(await p.locator('#lettere').isDisabled(), 'con la modalità bambino le lettere sono disattivate');
await p.locator('#bambino').uncheck();
await p.locator('#lettere').check();
ok(await p.locator('#bambino').isDisabled(), 'e viceversa');
await p.locator('#lettere').uncheck();
await p.locator('#bambino').check();
await p.reload(); await p.clock.install();
ok(await p.locator('#bambino').isChecked(), 'scelta ricordata dopo il reload');

// ---- razzo: forma, orientamento, stelle ----
await p.locator('input[name=esercizio][value=orizzontale]').check();
await p.locator('#velocita').fill('6'); await p.locator('#durata').selectOption('2');
await avvia(p);
await p.clock.runFor(3200);
let r0 = await razzo(p);
ok(r0.vetro && r0.fiamma && r0.rosso, `si vedono oblò, fiamma e parti rosse (oblò ${r0.vetro?.n}px, fiamma ${r0.fiamma?.n}px)`);
ok(r0.stelle > 20, `ci sono le stelle sullo sfondo (${r0.stelle} px semitrasparenti)`);
const campioni = [];
for (let t = 0; t < 9000; t += 200) { await p.clock.runFor(200); campioni.push(await razzo(p)); }
let ok_dir = 0, tot = 0, versoDestra = 0, versoSinistra = 0;
for (let i = 1; i < campioni.length; i++) {
  const a = campioni[i - 1], c = campioni[i]; if (!a.vetro || !c.vetro || !c.fiamma) continue;
  const m = { x: c.vetro.x - a.vetro.x, y: c.vetro.y - a.vetro.y };
  if (Math.hypot(m.x, m.y) < 4) continue;
  const h = { x: c.vetro.x - c.fiamma.x, y: c.vetro.y - c.fiamma.y }; // dalla fiamma verso il muso
  tot++; if (h.x * m.x + h.y * m.y > 0) ok_dir++;
  if (h.x > 5) versoDestra++; if (h.x < -5) versoSinistra++;
}
ok(tot > 20 && ok_dir / tot >= 0.8, `il razzo punta dove va (${ok_dir}/${tot} campioni concordi)`);
ok(versoDestra > 3 && versoSinistra > 3, `ruota quando inverte la direzione (destra ${versoDestra}, sinistra ${versoSinistra})`);
await p.screenshot({ path: process.env.SHOTS + '/18-razzo.png' });
const testi = await p.evaluate(() => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (n.textContent.trim() && !e.closest('.solo-lettori') && !['SCRIPT', 'STYLE'].includes(e.tagName) && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) o.push(n.textContent.trim().slice(0, 30)); } return o; });
ok(testi.length === 0, 'schermo pulito anche in modalità bambino' + (testi.length ? ' → ' + testi.join('|') : ''));

// ---- fine: pensiero divergente ----
await p.clock.runFor(120000 - 3200 - 9000 + 3000);
await p.locator('#ov-idee').waitFor({ state: 'visible' });
ok(await p.locator('#ov-riposo').isHidden() && await p.locator('#ov-indovina').isHidden(), 'a fine esercizio compare la domanda creativa, non ancora il riposo');
const domanda = await p.locator('#domanda-idee').innerText();
ok(/diversi|diverse|diversi\./.test(domanda) && domanda.length > 20, 'domanda: ' + domanda);
ok(await p.evaluate(() => document.activeElement.id) === 'nuova-idea', 'il campo ha il focus');
ok(await p.evaluate(() => !!localStorage.getItem('etr.riposoFino')), 'blocco del riposo già attivo');
await p.keyboard.type('luna'); await p.keyboard.press('Enter');
await p.keyboard.type('f'); ok(!(await p.evaluate(() => !!document.fullscreenElement)) && await p.locator('#nuova-idea').inputValue() === 'f', 'scrivendo "f" non scatta lo schermo intero');
await p.locator('#nuova-idea').fill('Marte'); await p.keyboard.press('Enter');
await p.locator('#nuova-idea').fill('  LUNA! '); await p.keyboard.press('Enter');
ok(/c'è già/.test(await p.locator('#avviso-idee').innerText()) && await p.locator('#elenco-idee li').count() === 2, 'un\'idea ripetuta non conta e viene segnalato');
await p.locator('#nuova-idea').fill('un gelato gigante'); await p.keyboard.press('Enter');
ok(await p.locator('#elenco-idee li').count() === 3 && /3 idee diverse/.test(await p.locator('#contatore-idee').innerText()), 'contatore: ' + await p.locator('#contatore-idee').innerText());
await p.click('#btn-idea-voce'); await p.click('#btn-idea-voce');
ok(await p.locator('#elenco-idee li').count() === 5 && (await p.locator('#elenco-idee li').last().innerText()) === 'Idea detta a voce 2', '"+1 idea detta a voce" conta le idee non scritte (5 in tutto)');
await p.screenshot({ path: process.env.SHOTS + '/19-idee.png' });
await p.click('#btn-fatto-idee');
await p.locator('#ov-riposo').waitFor({ state: 'visible' });
ok(/Hai inventato 5 idee diverse/.test(await p.locator('#riposo-frase').innerText()), 'nel riposo: ' + await p.locator('#riposo-frase').innerText());
let reg = await p.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
ok(reg.length === 1 && reg[0].bambino === true && reg[0].idee === 5, 'sessione salvata: ' + JSON.stringify(reg[0]));
await p.keyboard.press('Escape');
await p.click('.tab[data-vista=progressi]');
ok((await p.locator('#tabella-sessioni tbody tr').first().innerText()).includes('razzo (5 idee)'), 'riepilogo: "+ razzo (5 idee)"');
await p.click('.tab[data-vista=allenamento]');

// ---- Esc nelle idee, stop anticipato ----
await p.evaluate(() => localStorage.removeItem('etr.riposoFino')); await p.clock.runFor(1500);
await avvia(p); await p.clock.runFor(3500 + 119000 + 3000);
await p.locator('#ov-idee').waitFor({ state: 'visible' });
await p.keyboard.press('Escape');
await p.locator('#ov-riposo').waitFor({ state: 'visible' });
ok(/nessuna idea/.test(await p.locator('#riposo-frase').innerText()), 'Esc nelle idee: parte il riposo (' + await p.locator('#riposo-frase').innerText() + ')');
await p.keyboard.press('Escape');
await p.evaluate(() => localStorage.removeItem('etr.riposoFino')); await p.clock.runFor(1500);
await avvia(p); await p.clock.runFor(3500 + 30000); await p.keyboard.press('Escape');
ok(await p.locator('#ov-idee').isHidden() && await p.locator('#palco').isHidden(), 'stop anticipato: nessuna domanda creativa');

// ---- dimensione minima e bordi ----
await p.locator('#dimensione').fill('20');
await p.locator('input[name=esercizio][value=verticale]').check(); await p.locator('#velocita').fill('10');
await avvia(p); await p.clock.runFor(2500);
const fermo = await bbox(p);
const alt = fermo.maxY - fermo.minY;
ok(alt >= 62, `con dimensione 20 il razzo è comunque almeno 64 px (altezza visibile ${alt})`);
let minY = 1e9, maxY = -1;
await p.clock.runFor(700);
for (let t = 0; t < 7000; t += 100) { await p.clock.runFor(100); const q = await bbox(p); minY = Math.min(minY, q.minY); maxY = Math.max(maxY, q.maxY); }
ok(minY >= 6 && maxY <= 794, `razzo sempre dentro lo schermo (y da ${minY} a ${maxY} su 800)`);
await p.keyboard.press('Escape');
ok(p.err.length === 0, 'nessun errore in console' + (p.err.length ? ': ' + p.err.join(' | ') : ''));
await ctx.close(); await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
