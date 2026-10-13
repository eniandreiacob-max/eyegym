import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:8000/index.html';
const SHOTS = process.env.SHOTS || '.';
let fallimenti = 0;
const ok = (cond, msg) => { console.log((cond ? '  OK   ' : '  FAIL ') + msg); if (!cond) fallimenti++; };

const centroide = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (data[(y * width + x) * 4 + 3] > 0) { sx += x; sy += y; n++; }
  }
  return n ? { x: sx / n, y: sy / n, n } : null;
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const range = (arr, k) => Math.max(...arr.map((p) => p[k])) - Math.min(...arr.map((p) => p[k]));
const reale = (ms = 150) => new Promise((r) => setTimeout(r, ms));

async function nuovaPagina(browser, opzioni = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'it-IT', ...opzioni });
  const page = await ctx.newPage();
  const errori = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/willReadFrequently/.test(m.text())) errori.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errori.push('pageerror: ' + e.message));
  await page.clock.install();
  await page.goto(URL);
  return { ctx, page, errori };
}
// pagina con avviso già letto
async function paginaPronta(browser, opzioni) {
  const r = await nuovaPagina(browser, opzioni);
  await r.page.evaluate(() => { localStorage.setItem('etr.avvisoLetto', 'true'); localStorage.setItem('etr.impostazioni', JSON.stringify({ opzioniAperte: true })); });
  await r.page.reload(); await r.page.clock.install();
  return r;
}
const sceltaEsercizio = (page, v) => page.locator(`input[name=esercizio][value=${v}]`).check();
const avvia = async (page) => { await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' }); };
const senzaErrori = (errori) => ok(errori.length === 0, 'nessun errore/warning in console' + (errori.length ? ': ' + errori.join(' | ') : ''));

const testoVisibile = (page) => page.evaluate(() => {
  const trovati = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim(); const e = n.parentElement;
    if (!t || ['SCRIPT', 'STYLE'].includes(e.tagName) || e.closest('.solo-lettori')) continue;
    if (e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) trovati.push(t.slice(0, 40));
  }
  return trovati;
});
const opacitaHud = (page) => page.locator('#hud').evaluate((h) => +getComputedStyle(h).opacity);

(async () => {
  const browser = await chromium.launch();
  let ctx, page, errori;

  /* ---------- 1. primo avvio: avviso, esercizi, pausa, stop ---------- */
  console.log('1) Avviso iniziale e esercizi');
  ({ ctx, page, errori } = await nuovaPagina(browser));
  ok(await page.title() !== '', 'pagina caricata, titolo presente');
  ok(await page.locator('input[name=esercizio]:checked').inputValue() === 'orizzontale', 'esercizio predefinito: orizzontale');
  ok(await page.locator('#velocita').inputValue() === '3', 'velocità predefinita 3');
  ok(await page.locator('#durata').inputValue() === '3', 'durata predefinita 3 minuti');
  await page.screenshot({ path: `${SHOTS}/01-setup-scuro.png`, fullPage: true });

  await page.click('#btn-avvia');
  ok(await page.locator('#dlg-avviso').evaluate((d) => d.open), 'avviso mostrato alla prima sessione');
  const testoAvviso = await page.locator('#dlg-avviso').innerText();
  ok(/vertigini/.test(testoAvviso) && /nausea/.test(testoAvviso) && /mal di testa/.test(testoAvviso) && /ortottista/.test(testoAvviso) && /oculista/.test(testoAvviso), 'avviso contiene sintomi e rimando a ortottista/oculista');
  ok(/non cura/.test(testoAvviso) && /non corregge/.test(testoAvviso), 'avviso: nessuna affermazione medica');
  await page.click('#btn-avviso-ok');
  await page.locator('#palco').waitFor({ state: 'visible' });
  ok(await page.locator('#ov-conto').isVisible(), 'conto alla rovescia visibile');
  ok(/50–70 cm/.test(await page.locator('#ov-conto').innerText()), 'distanza consigliata mostrata prima di iniziare');
  await page.clock.runFor(3500);
  ok(await page.locator('#ov-conto').isHidden(), 'conto finito, esercizio partito');

  let a = await centroide(page); await page.clock.runFor(1500); let b = await centroide(page);
  ok(a && b && Math.abs(a.x - b.x) > 5 && Math.abs(a.y - b.y) < 2, `orizzontale si muove (dx=${Math.round(b.x - a.x)}, dy=${Math.round(b.y - a.y)})`);

  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isVisible(), 'Spazio mette in pausa');
  const t1 = await page.locator('#hud-tempo').innerText(); a = await centroide(page);
  await page.clock.runFor(5000);
  const t2 = await page.locator('#hud-tempo').innerText(); b = await centroide(page);
  ok(t1 === t2 && dist(a, b) < 0.5, `in pausa tempo e bersaglio fermi (${t1}=${t2})`);
  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isHidden(), 'Spazio riprende (nessun doppio toggle)');
  await page.clock.runFor(1500);
  ok(await page.locator('#hud-tempo').innerText() !== t2, 'dopo la ripresa il tempo scorre');
  await page.locator('#btn-pausa').focus();
  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isVisible(), 'Spazio sul pulsante Pausa alterna una sola volta');
  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isHidden(), '…e una sola volta anche in ripresa');
  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isVisible(), 'dopo la ripresa lo Spazio funziona ancora');
  await page.keyboard.press('Space');

  await page.keyboard.press('Escape');
  ok(await page.locator('#palco').isHidden(), 'Esc ferma la sessione');
  ok((await page.locator('#esito').innerText()).includes('troppo breve'), 'sessione troppo breve non salvata, messaggio chiaro');

  for (const ex of ['orizzontale', 'verticale', 'cerchio', 'ellisse', 'otto', 'zigzag', 'saccadi']) {
    await sceltaEsercizio(page, ex);
    await avvia(page);
    await page.clock.runFor(3500);
    const punti = [];
    for (let i = 0; i < 14; i++) { await page.clock.runFor(900); punti.push(await centroide(page)); }
    const xs = punti.map((p) => p.x), ys = punti.map((p) => p.y);
    const escX = range(punti, 'x'), escY = range(punti, 'y');
    const distinti = new Set(punti.map((p) => `${Math.round(p.x / 4)},${Math.round(p.y / 4)}`)).size;
    let esito;
    if (ex === 'orizzontale') esito = escX > 20 && escY < 2;
    else if (ex === 'verticale') esito = escY > 20 && escX < 2;
    else if (ex === 'saccadi') esito = distinti >= 2;
    else esito = escX > 20 && escY > 20;
    ok(esito, `${ex}: si muove (escursione x=${Math.round(escX)} y=${Math.round(escY)}, posizioni distinte=${distinti})`);
    if (ex === 'cerchio') {
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      const raggi = punti.map((p) => Math.hypot(p.x - cx, p.y - cy));
      ok(Math.max(...raggi) - Math.min(...raggi) < 30, 'cerchio: distanza dal centro ~costante');
    }
    if (ex === 'ellisse') {
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      const ea = escX / 2, eb = escY / 2;
      const scarti = punti.map((p) => Math.abs(((p.x - cx) / ea) ** 2 + ((p.y - cy) / eb) ** 2 - 1));
      ok(ea > eb * 1.3 && Math.max(...scarti) < 0.15, `ellisse: più larga che alta (${Math.round(ea)}×${Math.round(eb)}) e i punti stanno sull'ovale (scarto max ${Math.max(...scarti).toFixed(2)})`);
    }
    await page.keyboard.press('Escape');
  }
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 2. saccadi: distanza minima tra salti ---------- */
  console.log('2) Saccadi: salti lontani dalla posizione precedente');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await sceltaEsercizio(page, 'saccadi');
  await page.locator('#velocita').fill('10');
  await avvia(page);
  await page.clock.runFor(3500);
  let prec = null, minD = Infinity, salti = 0;
  for (let t = 0; t < 40000; t += 100) {
    await page.clock.runFor(100);
    const c = await centroide(page);
    if (prec && dist(c, prec) > 1) { minD = Math.min(minD, dist(c, prec)); salti++; }
    prec = c;
  }
  const lato = Math.min(1280 - 2 * (16 + 24), 800 - 70 - 2 * 40);
  ok(salti >= 15, `salti osservati a velocità 10: ${salti}`);
  ok(minD >= 0.3 * lato, `distanza minima tra salti ${Math.round(minD)} px (>= ${Math.round(0.3 * lato)})`);
  await page.keyboard.press('Escape');
  await ctx.close();

  /* ---------- 3. fine sessione, riposo, salvataggio, riepilogo ---------- */
  console.log('3) Sessione completa, riposo, salvataggio, riepilogo');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await page.locator('#durata').selectOption('2');
  await sceltaEsercizio(page, 'cerchio');
  await avvia(page);
  await page.clock.runFor(3000 + 119000);
  ok(await page.locator('#ov-riposo').isHidden(), 'prima della fine non c\'è riposo');
  ok(/^0:0[12]$/.test(await page.locator('#hud-tempo').innerText()), 'timer a 0:01-0:02 prima della fine');
  await page.clock.runFor(2500);
  ok(await page.locator('#ov-riposo').isVisible(), 'a fine sessione scatta la pausa di riposo');
  ok(await page.locator('#hud').isHidden() && await page.locator('#canvas').evaluate((c) => !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v)), 'riposo: schermo neutro, nessun bersaglio, nessun HUD');
  ok(await page.locator('#palco').evaluate((p) => getComputedStyle(p).cursor) !== 'none', 'riposo: cursore visibile');
  ok(/2:0\d|1:5\d/.test(await page.locator('#riposo-tempo').innerText()), 'riposo dura quanto la sessione (2 min): ' + await page.locator('#riposo-tempo').innerText());
  await page.screenshot({ path: `${SHOTS}/04-riposo.png` });
  const salvate = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
  ok(salvate.length === 1 && salvate[0].durata === 120 && salvate[0].esercizio === 'cerchio' && salvate[0].velocita === 3 && /^\d{4}-\d\d-\d\d$/.test(salvate[0].data), 'sessione salvata: ' + JSON.stringify(salvate[0]));

  await page.keyboard.press('Escape');
  ok(await page.locator('#palco').isHidden(), 'Esc lascia la schermata di riposo');
  ok(await page.locator('#btn-avvia').isDisabled() && await page.locator('#blocco-riposo').isVisible(), 'nuova sessione bloccata durante il riposo');
  await page.locator('#btn-avvia').click({ force: true }).catch(() => {});
  ok(await page.locator('#palco').isHidden(), 'clic forzato su Avvia non fa partire nulla');
  await page.locator('#btn-avvia').evaluate((b) => b.form.requestSubmit());
  await page.clock.runFor(500);
  ok(await page.locator('#palco').isHidden(), 'nemmeno l\'invio del form fa partire nulla');
  await page.clock.runFor(119000);
  await page.clock.runFor(2000);
  ok(await page.locator('#btn-avvia').isEnabled() && await page.locator('#blocco-riposo').isHidden(), 'a riposo finito si può ripartire');

  await page.click('.tab[data-vista=progressi]');
  ok(await page.locator('#tot-sessioni').innerText() === '1', 'riepilogo: 1 sessione');
  ok(await page.locator('#tot-minuti').innerText() === '2', 'riepilogo: 2 minuti totali');
  ok((await page.locator('#tabella-sessioni tbody tr').count()) === 1, 'riepilogo: riga in tabella');
  const pix = await page.evaluate(() => {
    const c = document.getElementById('grafico');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
    return { w: c.width, h: c.height, n };
  });
  ok(pix.n > 1000, `grafico disegnato (${pix.w}x${pix.h}, ${pix.n} px non vuoti)`);
  ok((await page.locator('#grafico').getAttribute('aria-label')).split(',').length === 14, 'grafico: 14 giorni nell\'aria-label');
  await page.screenshot({ path: `${SHOTS}/06-progressi.png`, fullPage: true });

  await page.reload();
  ok(await page.locator('#tot-sessioni').innerText() === '1', 'dopo reload il riepilogo mantiene i dati (#progressi)');
  await page.click('#btn-cancella');
  ok(await page.locator('#dlg-cancella').evaluate((d) => d.open), 'dialogo di conferma cancellazione');
  await page.click('#dlg-cancella button[value=annulla]'); await reale();
  ok(await page.locator('#tot-sessioni').innerText() === '1', 'annulla: dati conservati');
  await page.click('#btn-cancella'); await page.click('#btn-cancella-ok'); await reale();
  ok(await page.locator('#tot-sessioni').innerText() === '0' && await page.locator('#tot-minuti').innerText() === '0', 'cancellazione: totali a zero');
  ok(await page.evaluate(() => localStorage.getItem('etr.sessioni')) === null, 'cancellazione: localStorage svuotato');
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 4. progressiva e stop parziale ---------- */
  console.log('4) Modalità progressiva e stop parziale');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await page.locator('#progressiva').check();
  await page.locator('#velocita').fill('4');
  ok(await page.locator('#etichetta-velocita').innerText() === 'Velocità massima', 'etichetta diventa "Velocità massima"');
  await avvia(page);
  await page.clock.runFor(3500);
  const vel = () => page.locator('#hud-velocita').innerText();
  const v0 = await vel(); await page.clock.runFor(30000); const v1 = await vel(); await page.clock.runFor(30000); const v2 = await vel();
  await page.clock.runFor(60000); const v3 = await vel();
  ok(v0 === '1 / 4' && v1 === '2 / 4' && v2 === '3 / 4' && v3 === '4 / 4', `velocità sale ogni 30 s e si ferma al massimo: ${v0} → ${v1} → ${v2} → ${v3}`);
  await page.keyboard.press('Escape');
  const parz = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
  ok(parz.length === 1 && parz[0].durata > 100 && parz[0].durata < 130 && parz[0].progressiva === true, 'stop: salvata la durata completata ' + JSON.stringify(parz[0]));
  ok(await page.locator('#btn-avvia').isEnabled(), 'dopo uno stop manuale non c\'è blocco di riposo');
  await page.reload();
  ok(await page.locator('#progressiva').isChecked() && await page.locator('#velocita').inputValue() === '4', 'impostazioni ricordate dopo il reload');
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 5. prefers-reduced-motion ---------- */
  console.log('5) Movimenti ridotti');
  ({ ctx, page, errori } = await paginaPronta(browser, { reducedMotion: 'reduce' }));
  ok(await page.locator('#avviso-movimento').isVisible(), 'avviso movimenti ridotti visibile nella pagina');
  await page.click('#btn-avvia'); await reale();
  ok(await page.locator('#dlg-movimento').evaluate((d) => d.open) && await page.locator('#palco').isHidden(), 'serve conferma: non parte da solo');
  await page.click('#dlg-movimento button[value=annulla]'); await reale();
  ok(await page.locator('#palco').isHidden(), 'annulla: non parte');
  await page.click('#btn-avvia'); await page.click('#btn-movimento-ok'); await reale();
  ok(await page.locator('#palco').isVisible(), 'dopo conferma parte');
  await page.keyboard.press('Escape');
  await ctx.close();

  /* ---------- 6. tema chiaro, tablet, mobile, schermo intero ---------- */
  console.log('6) Tema, responsive, schermo intero');
  ({ ctx, page, errori } = await paginaPronta(browser, { viewport: { width: 820, height: 1180 } }));
  await page.click('#btn-tema');
  ok(await page.locator('html').getAttribute('data-theme') === 'light', 'tema chiaro attivato');
  await page.screenshot({ path: `${SHOTS}/07-tablet-chiaro.png`, fullPage: true });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'tablet: nessuno scroll orizzontale');
  await avvia(page); await page.clock.runFor(4500);
  await page.screenshot({ path: `${SHOTS}/08-tablet-sessione-chiara.png` });
  await page.mouse.click(400, 500); await page.clock.runFor(300);
  await page.click('#btn-schermo-intero'); await page.clock.runFor(300);
  const fs = await page.evaluate(() => !!document.fullscreenElement);
  console.log('  info schermo intero attivato in headless: ' + fs);
  if (fs) {
    ok(await page.locator('#btn-schermo-intero').getAttribute('aria-pressed') === 'true', 'pulsante schermo intero: aria-pressed true');
    await page.mouse.click(400, 500); await page.click('#btn-schermo-intero'); await page.clock.runFor(300);
    ok(!(await page.evaluate(() => !!document.fullscreenElement)) && await page.locator('#palco').isVisible(), 'uscita da schermo intero col pulsante non ferma la sessione');
  }
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 700 });
  await page.click('.tab[data-vista=progressi]');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile 375px: nessuno scroll orizzontale (progressi)');
  await page.screenshot({ path: `${SHOTS}/09-mobile-progressi.png`, fullPage: true });
  await ctx.close();

  console.log('7) localStorage bloccato');
  ({ ctx, page, errori } = await nuovaPagina(browser));
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloccato'); } }); });
  await page.goto(URL);
  await page.clock.install();
  ok(await page.locator('#btn-avvia').isVisible(), 'app funziona anche senza localStorage');
  ok(errori.filter((e) => e.startsWith('pageerror')).length === 0, 'nessun pageerror senza localStorage');
  await ctx.close();

  /* ---------- 8. percorso a livelli ---------- */
  console.log('8) Percorso a livelli');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await page.click('.tab[data-vista=percorso]');
  ok(await page.locator('.livello').count() === 15 && await page.locator('.mondo').count() === 4, '15 livelli in 4 mondi');
  ok(await page.locator('#percorso-conteggio').innerText() === '0 / 15', 'conteggio iniziale 0 / 15');
  const abil = await page.locator('.btn-livello').evaluateAll((bs) => bs.map((x) => !x.disabled));
  ok(abil[0] === true && abil.slice(1).every((x) => !x), 'solo il livello 1 è sbloccato');
  await page.screenshot({ path: `${SHOTS}/10-percorso.png`, fullPage: true });
  await page.locator('.btn-livello').nth(4).evaluate((x) => x.click()); await reale();
  ok(await page.locator('#palco').isHidden(), 'un livello bloccato non parte nemmeno con clic forzato');

  await page.locator('.btn-livello').first().click();
  await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(3500);
  ok(/Livello 1 · Primo sguardo/.test(await page.locator('#hud-esercizio').innerText()) && await page.locator('#hud-velocita').innerText() === '1', 'HUD: livello 1, velocità 1');
  const cz = await centroide(page);
  ok(cz.n > 480 && cz.n < 760, `bersaglio del livello 1 grande 56 px (pixel campionati: ${cz.n})`);
  await page.clock.runFor(119000);
  await page.clock.runFor(2500);
  ok(await page.locator('#ov-riposo').isVisible(), 'a fine livello parte il riposo');
  const tit = await page.locator('#riposo-titolo').innerText();
  ok(/Livello 1 completato/.test(tit) && /Sbloccato il livello 2/.test(tit), 'riposo: ' + tit);
  const perc = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.percorso')));
  ok(JSON.stringify(perc.completati) === '[1]', 'percorso salvato: ' + JSON.stringify(perc));
  const sess = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
  ok(sess.length === 1 && sess[0].livello === 1 && sess[0].durata === 120, 'sessione salvata con livello');
  await page.keyboard.press('Escape');
  ok(await page.locator('#vista-percorso').isVisible() && /Livello 1 completato/.test(await page.locator('#esito').innerText()), 'ritorno al percorso con messaggio');
  ok(await page.locator('.btn-livello').evaluateAll((bs) => bs.every((x) => x.disabled)), 'durante il riposo tutti i pulsanti dei livelli sono bloccati');
  ok(await page.locator('#blocco-riposo').isVisible(), 'avviso di riposo visibile anche nel percorso');
  await page.clock.runFor(122000);
  const abil2 = await page.locator('.btn-livello').evaluateAll((bs) => bs.map((x) => !x.disabled));
  ok(abil2[0] && abil2[1] && !abil2[2], 'a riposo finito: livelli 1 (rigioca) e 2 sbloccati, 3 no');
  ok(await page.locator('.livello').nth(0).innerText().then((t) => /Completato/.test(t) && /Rigioca/.test(t)), 'livello 1 mostrato come completato');
  await page.click('.tab[data-vista=allenamento]');
  ok(await page.locator('#velocita').inputValue() === '3' && await page.locator('#dimensione').inputValue() === '32', 'le impostazioni libere non sono cambiate');
  await page.click('.tab[data-vista=percorso]');

  await page.locator('.btn-livello').nth(1).click();
  await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(3500 + 40000);
  await page.keyboard.press('Escape');
  ok(JSON.stringify((await page.evaluate(() => JSON.parse(localStorage.getItem('etr.percorso')))).completati) === '[1]', 'livello fermato a metà non risulta completato');
  ok(await page.locator('.btn-livello').nth(1).isEnabled(), 'stop manuale: nessun riposo, livello 2 rigiocabile');

  await page.evaluate(() => localStorage.setItem('etr.percorso', JSON.stringify({ completati: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })));
  await page.click('.tab[data-vista=allenamento]'); await page.click('.tab[data-vista=percorso]');
  await page.locator('.btn-livello').nth(10).click();
  await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(3500);
  ok(await page.locator('#hud-velocita').innerText() === '1 / 5', 'livello progressivo parte da 1 e arriva a 5');
  await page.keyboard.press('Escape');
  await page.click('#btn-azzera-percorso'); await page.click('#dlg-azzera button[value=annulla]'); await reale();
  ok(await page.locator('#percorso-conteggio').innerText() === '10 / 15', 'annulla azzeramento: percorso intatto');
  await page.click('#btn-azzera-percorso'); await page.click('#btn-azzera-ok'); await reale();
  ok(await page.locator('#percorso-conteggio').innerText() === '0 / 15', 'azzeramento percorso');
  await page.evaluate(() => localStorage.setItem('etr.percorso', JSON.stringify({ completati: [1, 2] })));
  await page.click('.tab[data-vista=progressi]'); await page.click('#btn-cancella'); await page.click('#btn-cancella-ok'); await reale();
  ok(await page.evaluate(() => localStorage.getItem('etr.percorso')) === null, 'Cancella i dati azzera anche il percorso');
  await page.goto('about:blank'); await page.goto(URL + '#percorso'); await page.clock.install();
  ok(await page.locator('#vista-percorso').isVisible(), '#percorso apre direttamente la vista');
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 9. esercizio Misto ---------- */
  console.log('9) Esercizio Misto (direzioni combinate)');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await page.addInitScript(() => { Math.random = (() => { let a = 12345; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(); }); // caso riproducibile
  await page.reload(); await page.clock.install();
  ok(await page.locator('#opzioni-misto').isHidden(), 'opzioni del Misto nascoste per gli altri esercizi');
  ok(await page.locator('input[name=misto][value=ellisse]').count() === 1, 'l\'ellisse si può combinare nel Misto');
  await sceltaEsercizio(page, 'misto');
  ok(await page.locator('#opzioni-misto').isVisible(), 'scegliendo Misto compaiono i tracciati');
  const spunte = await page.locator('input[name=misto]').evaluateAll((cs) => cs.filter((c) => c.checked).map((c) => c.value));
  ok(JSON.stringify(spunte) === '["orizzontale","verticale","cerchio","otto"]', 'predefinito: orizzontale, verticale, cerchio, otto');
  await page.screenshot({ path: `${SHOTS}/11-misto-impostazioni.png`, fullPage: true });
  for (const v of ['verticale', 'cerchio', 'otto']) await page.locator(`input[name=misto][value=${v}]`).uncheck();
  await page.click('#btn-avvia'); await reale();
  ok(await page.locator('#palco').isHidden() && /almeno due/.test(await page.locator('#esito').innerText()), 'con un solo tracciato non parte e spiega perché');
  for (const v of ['verticale', 'cerchio', 'otto']) await page.locator(`input[name=misto][value=${v}]`).check();

  await page.locator('#cambio').selectOption('10');
  await page.locator('#durata').selectOption('3');
  await avvia(page);
  await page.clock.runFor(3500);
  const titoli = [], campioni = []; let ultimoCambio = 0;
  let precP = null, maxSalto = 0;
  for (let t = 0; t < 95000; t += 100) {
    await page.clock.runFor(100);
    const titolo = await page.locator('#hud-esercizio').innerText();
    const c = await centroide(page);
    if (precP) maxSalto = Math.max(maxSalto, dist(c, precP));
    precP = c;
    if (titoli[titoli.length - 1] !== titolo) { titoli.push(titolo); ultimoCambio = t; }
    campioni.push({ titolo, ...c, stab: t - ultimoCambio > 3100 });
  }
  const seq = titoli.map((t) => t.replace('Misto · ', ''));
  const ORDINE = ['Orizzontale', 'Verticale', 'Cerchio', 'Otto'];
  ok(seq.every((t, i) => i === 0 || t !== seq[i - 1]), 'mai lo stesso tracciato due volte di fila: ' + seq.join(' → '));
  ok(ORDINE.every((t) => seq.includes(t)), 'tutti i tracciati scelti compaiono');
  ok(seq.some((t, i) => i > 0 && ORDINE[(ORDINE.indexOf(seq[i - 1]) + 1) % 4] !== t), 'l\'ordine non segue la lista: è imprevedibile');
  const cambi = []; { let prima = null; let i = 0; for (const c of campioni) { if (prima !== null && c.titolo !== prima) cambi.push(i); prima = c.titolo; i++; } }
  const durate = cambi.slice(1).map((v, i) => (v - cambi[i]) / 10);
  ok(durate.length >= 4 && Math.max(...durate) - Math.min(...durate) > 3, `durate dei tracciati variabili: ${durate.map((d) => d.toFixed(1)).join(', ')} s`);
  ok(maxSalto < 90, `nessun salto del bersaglio nelle transizioni (max spostamento in 100 ms: ${Math.round(maxSalto)} px)`);
  const orizz = campioni.filter((c) => c.stab && c.titolo.endsWith('Orizzontale')), vert = campioni.filter((c) => c.stab && c.titolo.endsWith('Verticale'));
  ok(range(orizz, 'y') < 2 && range(orizz, 'x') > 100, `segmento orizzontale: solo movimento in x (x=${Math.round(range(orizz, 'x'))}, y=${Math.round(range(orizz, 'y'))})`);
  ok(range(vert, 'x') < 2 && range(vert, 'y') > 100, `segmento verticale: solo movimento in y (x=${Math.round(range(vert, 'x'))}, y=${Math.round(range(vert, 'y'))})`);
  await page.keyboard.press('Escape');
  const sal = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
  ok(sal.length === 1 && sal[0].esercizio === 'misto', 'sessione Misto salvata come "misto"');
  await page.click('.tab[data-vista=progressi]');
  ok((await page.locator('#tabella-sessioni tbody tr').first().innerText()).includes('Misto'), 'riepilogo mostra "Misto"');
  await page.click('.tab[data-vista=allenamento]');
  await page.reload();
  ok(await page.locator('input[name=esercizio]:checked').inputValue() === 'misto' && await page.locator('#cambio').inputValue() === '10' && await page.locator('input[name=misto]:checked').count() === 4, 'scelte del Misto ricordate dopo il reload');

  await page.clock.install();
  for (const v of ['orizzontale', 'verticale', 'cerchio', 'otto']) await page.locator(`input[name=misto][value=${v}]`).uncheck();
  for (const v of ['diagonale_su', 'diagonale_giu', 'saccadi']) await page.locator(`input[name=misto][value=${v}]`).check();
  await page.locator('#cambio').selectOption('10');
  await avvia(page);
  await page.clock.runFor(3500);
  const tt2 = [], p2 = [];
  let prec2 = null, salto2 = 0;
  for (let t = 0; t < 45000; t += 100) {
    await page.clock.runFor(100);
    const titolo = await page.locator('#hud-esercizio').innerText();
    const c = await centroide(page);
    if (tt2[tt2.length - 1] !== titolo) tt2.push(titolo);
    if (!/Saccadi/.test(titolo) && prec2 && !/Saccadi/.test(p2[p2.length - 1]?.titolo || '')) salto2 = Math.max(salto2, dist(c, prec2));
    prec2 = c; p2.push({ titolo, ...c });
  }
  const sq = tt2.map((t) => t.replace('Misto · ', '')).join(' → ');
  const parti = tt2.map((t) => t.replace('Misto · ', ''));
  ok(parti.every((t, i) => ['Diagonale /', 'Diagonale \\', 'Saccadi'].includes(t) && (i === 0 || t !== parti[i - 1])), 'diagonali e saccadi a caso, senza ripetizioni consecutive: ' + sq);
  const dsu = p2.filter((c) => c.titolo.endsWith('Diagonale /'));
  const dsuStab = dsu.slice(Math.min(35, Math.floor(dsu.length / 2))); // dopo la transizione
  const dx = dsuStab.at(-1).x - dsuStab[0].x, dy = dsuStab.at(-1).y - dsuStab[0].y;
  ok(dsuStab.length < 2 || Math.abs(dx) < 5 || dy / dx < 0, `diagonale "/": in salita da sinistra a destra (Δx ${Math.round(dx)}, Δy ${Math.round(dy)})`);
  ok(salto2 < 90, `nessun salto fuori dalle saccadi (max ${Math.round(salto2)} px / 100 ms)`);
  await page.keyboard.press('Escape');
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 10. schermo pulito e zigzag ---------- */
  console.log('10) Schermo pulito durante l\'esercizio; zigzag');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await sceltaEsercizio(page, 'zigzag');
  await avvia(page);
  await page.clock.runFor(1000);
  ok((await testoVisibile(page)).length > 0 && await opacitaHud(page) === 1, 'durante il conto alla rovescia testo e comandi sono visibili');
  await page.clock.runFor(4000);
  const visibili = await testoVisibile(page);
  ok(visibili.length === 0, 'esercizio in corso: nessuna scritta visibile' + (visibili.length ? ' → ' + visibili.join(' | ') : ''));
  ok(await page.locator('#canvas').evaluate((c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v)), 'il bersaglio è comunque disegnato');
  await page.screenshot({ path: `${SHOTS}/12-schermo-pulito.png` });
  ok(await page.locator('#palco').evaluate((p) => getComputedStyle(p).cursor) === 'none', 'cursore nascosto durante l\'esercizio');

  await page.mouse.click(300, 400); await reale(600);
  ok(await opacitaHud(page) === 1 && (await testoVisibile(page)).length > 0, 'un clic richiama i comandi');
  await page.clock.runFor(1000); await reale(600);
  ok(await opacitaHud(page) === 1, 'dopo 1 s sono ancora visibili');
  await page.clock.runFor(3500); await reale(700);
  ok((await testoVisibile(page)).length === 0, 'dopo qualche secondo spariscono di nuovo');

  await page.keyboard.press('Tab'); await reale(600);
  ok(await opacitaHud(page) === 1, 'Tab mostra i comandi');
  await page.keyboard.press('Escape');

  await avvia(page);
  await page.clock.runFor(4500);
  await page.keyboard.press('Space');
  ok((await testoVisibile(page)).some((t) => /In pausa/.test(t)), 'in pausa compare la scritta e i comandi');
  await page.keyboard.press('Space');
  ok((await testoVisibile(page)).length === 0, 'alla ripresa le scritte spariscono di nuovo');
  await page.keyboard.press('Escape');

  const misura = async (esercizio, secondi) => {
    await sceltaEsercizio(page, esercizio);
    await avvia(page);
    await page.clock.runFor(3500);
    const pts = [];
    for (let t = 0; t < secondi * 1000; t += 100) { await page.clock.runFor(100); pts.push(await centroide(page)); }
    await page.keyboard.press('Escape');
    let lung = 0, inversioniY = 0, ultimoSegno = 0, picco = 0;
    for (let i = 1; i < pts.length; i++) {
      lung += dist(pts[i], pts[i - 1]);
      picco = Math.max(picco, dist(pts[i], pts[i - 1]) * 10);
      const dy = pts[i].y - pts[i - 1].y;
      if (Math.abs(dy) > 3) { const sg = Math.sign(dy); if (ultimoSegno && sg !== ultimoSegno) inversioniY++; ultimoSegno = sg; }
    }
    return { vel: lung / secondi, picco, inversioniY, rx: range(pts, 'x'), ry: range(pts, 'y') };
  };
  const hz = await misura('orizzontale', 20), zz = await misura('zigzag', 20);
  ok(zz.rx > 600 && zz.ry > 300, `zigzag occupa lo schermo (x=${Math.round(zz.rx)}, y=${Math.round(zz.ry)})`);
  ok(zz.inversioniY >= 5, `zigzag: inversioni verticali nette (${zz.inversioniY} in 20 s)`);
  ok(hz.inversioniY === 0, 'orizzontale: nessuna inversione verticale');
  ok(zz.vel > hz.picco * 0.8 && zz.vel < hz.picco * 1.2, `stessa velocità di picco: orizzontale ${Math.round(hz.picco)} px/s, zigzag costante ${Math.round(zz.vel)} px/s`);

  await sceltaEsercizio(page, 'misto');
  for (const v of ['orizzontale', 'verticale', 'cerchio', 'otto']) await page.locator(`input[name=misto][value=${v}]`).uncheck();
  await page.locator('input[name=misto][value=zigzag]').check(); await page.locator('input[name=misto][value=saccadi]').check();
  await page.locator('#cambio').selectOption('10');
  await avvia(page);
  await page.clock.runFor(3500);
  const seqz = [];
  for (let t = 0; t < 30000; t += 200) {
    await page.clock.runFor(200);
    const ti = await page.locator('#hud-esercizio').innerText();
    if (seqz[seqz.length - 1] !== ti) seqz.push(ti);
  }
  // il primo tracciato è casuale: con due soli tracciati devono comunque alternarsi
  const alterna = seqz.length >= 3 && seqz.every((x, i) => ['Misto · Zigzag', 'Misto · Saccadi'].includes(x) && (i === 0 || x !== seqz[i - 1]));
  ok(alterna, 'Misto con zigzag e saccadi, alternati: ' + seqz.join(' → '));
  await page.keyboard.press('Escape');
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 12. opzioni facoltative richiudibili ---------- */
  console.log('12) Opzioni facoltative richiudibili');
  ({ ctx, page, errori } = await nuovaPagina(browser));
  ok(!(await page.locator('#opzioni-facoltative').evaluate((d) => d.open)), 'chiuse di default');
  ok(await page.locator('#opzioni-attive').innerText() === '', 'nessuna opzione attiva nel titolo');
  await page.locator('#opzioni-facoltative summary').click();
  await page.locator('#progressiva').check(); await page.locator('#lettere').check();
  ok(/2 attive/.test(await page.locator('#opzioni-facoltative summary').innerText()), 'il titolo dice quante opzioni sono attive');
  await page.locator('#opzioni-facoltative summary').click();
  await page.reload();
  ok(await page.locator('#opzioni-facoltative').evaluate((d) => d.open), 'con opzioni attive si riaprono da sole');
  senzaErrori(errori);
  await ctx.close();

  /* ---------- 11. modalità lettere ---------- */
  console.log('11) Modalità lettere e indovina la frase');
  ({ ctx, page, errori } = await paginaPronta(browser));
  await page.addInitScript(() => {
    Math.random = () => 0; // la frase scelta è sempre la prima della lista
    // registra quale lettera viene disegnata nel frame corrente (ogni frame inizia con clearRect)
    const P = CanvasRenderingContext2D.prototype, testo = P.fillText, pulisci = P.clearRect;
    P.clearRect = function (...a) { if (this.canvas.id === 'canvas') window.__lettera = null; return pulisci.apply(this, a); };
    P.fillText = function (t, ...a) { if (this.canvas.id === 'canvas') window.__lettera = t; return testo.call(this, t, ...a); };
  });
  await page.reload(); await page.clock.install();
  const FRASE = 'chi va piano va sano e lontano';
  ok(await page.locator('#opzioni-lettere').isHidden() && !(await page.locator('#lettere').isChecked()), 'lettere: disattivate di default, opzioni nascoste');
  await page.locator('#lettere').check();
  ok(await page.locator('#opzioni-lettere').isVisible(), 'spuntando compare la scelta del ritmo');
  await page.locator('#passo-lettere').selectOption('1');
  await page.locator('#durata').selectOption('2');
  await page.reload(); await page.clock.install();
  ok(await page.locator('#lettere').isChecked() && await page.locator('#passo-lettere').inputValue() === '1', 'scelte ricordate dopo il reload');
  await page.screenshot({ path: `${SHOTS}/13-lettere-impostazioni.png`, fullPage: true });

  await avvia(page);
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 300)); // clock fermo: i campioni cadono sempre a metà di ogni lettera
  await page.clock.runFor(3500);
  await page.screenshot({ path: `${SHOTS}/14-lettere-bersaglio.png` });
  const visti = [];
  for (let i = 0; i < 66; i++) { visti.push(await page.evaluate(() => window.__lettera)); await page.clock.runFor(1000); }
  const attesi = [...'CHI VA PIANO VA SANO E LONTANO'].map((c) => (c === ' ' ? null : c)).concat([null]);
  const diverse = visti.filter((v, i) => v !== attesi[i % attesi.length]).length;
  ok(diverse === 0, `le lettere disegnate seguono la frase e ricominciano (${visti.map((v) => v ?? '·').join('')}${diverse ? `, ${diverse} diverse` : ''})`);
  ok(await page.locator('#ov-indovina').isHidden(), 'durante l\'esercizio non c\'è l\'indovinello');
  ok((await testoVisibile(page)).length === 0, 'anche con le lettere nessuna scritta HTML visibile durante l\'esercizio');

  await page.clock.runFor(56000);
  await page.locator('#ov-indovina').waitFor({ state: 'visible' });
  ok(await page.locator('#ov-riposo').isHidden(), 'a fine esercizio compare l\'indovinello, non ancora il riposo');
  ok(await page.evaluate(() => document.activeElement.id) === 'risposta-frase', 'il campo di risposta ha il focus');
  ok(/7 parole e 24 lettere/.test(await page.locator('#frase-aiuto').innerText()), 'aiuto: ' + await page.locator('#frase-aiuto').innerText());
  ok(!/chi va piano/i.test(await page.locator('#ov-indovina').innerText()), 'la frase non è rivelata nell\'indovinello');
  ok(await page.evaluate(() => !!localStorage.getItem('etr.riposoFino')), 'il blocco del riposo è già attivo durante l\'indovinello');
  await page.screenshot({ path: `${SHOTS}/15-indovina.png` });
  await page.keyboard.type('f');
  ok(await page.locator('#risposta-frase').inputValue() === 'f' && !(await page.evaluate(() => !!document.fullscreenElement)), 'scrivendo "f" non scatta lo schermo intero');
  await page.keyboard.press('Space');
  ok(await page.locator('#risposta-frase').inputValue() === 'f ', 'lo Spazio si scrive nel campo (nessuna pausa)');
  await page.locator('#risposta-frase').fill('CHI va  Piano va sano E lontano!');
  await page.keyboard.press('Enter');
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  ok(/Hai indovinato/.test(await page.locator('#riposo-frase').innerText()), 'risposta giusta (maiuscole/spazi/punteggiatura ignorati): ' + await page.locator('#riposo-frase').innerText());
  let reg = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
  ok(reg.length === 1 && reg[0].lettere === true && reg[0].indovinata === true && reg[0].durata === 120, 'sessione salvata con esito: ' + JSON.stringify(reg[0]));
  await page.screenshot({ path: `${SHOTS}/16-riposo-frase.png` });
  await page.keyboard.press('Escape');
  await page.click('.tab[data-vista=progressi]');
  ok((await page.locator('#tabella-sessioni tbody tr').first().innerText()).includes('lettere ✓'), 'riepilogo: "+ lettere ✓"');
  await page.click('.tab[data-vista=allenamento]');

  // risposta sbagliata, poi salto con Esc
  const finePrimoRiposo = () => page.evaluate(() => localStorage.removeItem('etr.riposoFino'));
  await finePrimoRiposo(); await page.clock.runFor(1500);
  await avvia(page); await page.clock.runFor(3500 + 119000 + 3000);
  await page.locator('#ov-indovina').waitFor({ state: 'visible' });
  await page.locator('#risposta-frase').fill('la fortuna aiuta gli audaci');
  await page.click('#form-frase button[type=submit]');
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  const sbagliata = await page.locator('#riposo-frase').innerText();
  ok(/Non esatto/.test(sbagliata) && /chi va piano va sano e lontano/.test(sbagliata), 'risposta sbagliata: ' + sbagliata);
  await page.keyboard.press('Escape');
  await finePrimoRiposo(); await page.clock.runFor(1500);
  await avvia(page); await page.clock.runFor(3500 + 119000 + 3000);
  await page.locator('#ov-indovina').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  ok(/^La frase era/.test(await page.locator('#riposo-frase').innerText()), 'Esc nell\'indovinello = salto, parte il riposo');
  reg = await page.evaluate(() => JSON.parse(localStorage.getItem('etr.sessioni')));
  ok(JSON.stringify(reg.map((x) => x.indovinata)) === '[true,false,null]', 'esiti salvati: ' + JSON.stringify(reg.map((x) => x.indovinata)));
  await page.keyboard.press('Escape');
  ok(await page.locator('#btn-avvia').isDisabled(), 'dopo il salto il riposo blocca comunque nuove sessioni');

  // fermare con Esc prima della fine non apre l'indovinello
  await finePrimoRiposo(); await page.clock.runFor(1500);
  await avvia(page); await page.clock.runFor(3500 + 30000);
  await page.keyboard.press('Escape');
  ok(await page.locator('#ov-indovina').isHidden() && await page.locator('#palco').isHidden(), 'stop anticipato: nessun indovinello');
  senzaErrori(errori);
  await ctx.close();

  await browser.close();
  console.log(fallimenti === 0 ? '\nTUTTO OK' : `\n${fallimenti} CONTROLLI FALLITI`);
  process.exit(fallimenti ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
