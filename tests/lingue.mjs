// Lingue: scelta automatica dal browser, nessun testo italiano rimasto, cambio al volo,
// lettere in alfabeti non latini (cinese, devanagari), idee e risposte in ogni alfabeto.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.URL || 'http://localhost:8000/index.html';
const SHOTS = process.env.SHOTS || '.';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };

const QUI = dirname(fileURLToPath(import.meta.url));
const LINGUE = runInNewContext(readFileSync(join(QUI, '..', 'testi.js'), 'utf8') + ';LINGUE');
const CODICI = Object.keys(LINGUE);
const LOCALE = { it: 'it-IT', en: 'en-US', zh: 'zh-CN', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR' };

// Tutti i testi di una lingua, come stringhe semplici (i valori con <strong> senza tag)
function testiPiatti(lingua) {
  const out = new Set();
  const aggiungi = (v) => { if (typeof v === 'string') out.add(v.replace(/<[^>]+>/g, '').trim()); };
  for (const v of Object.values(LINGUE[lingua])) {
    if (Array.isArray(v)) v.forEach((x) => (typeof x === 'object' ? Object.values(x).forEach(aggiungi) : aggiungi(x)));
    else aggiungi(v);
  }
  return out;
}

// Testi visibili della pagina: per elemento tradotto e, a parte, quelli "liberi" fuori dal dizionario
const leggiPagina = (page) => page.evaluate(() => {
  const DINAMICI = ['hud-esercizio', 'hud-tempo', 'hud-velocita', 'velocita-val', 'dimensione-val', 'dimensione-min-val',
    'dimensione-max-val', 'etichetta-velocita', 'larghezza-schermo', 'opzioni-attive', 'percorso-elenco', 'percorso-conteggio',
    'tot-minuti', 'tot-sessioni', 'tabella-sessioni', 'esito', 'blocco-riposo-testo', 'btn-tema', 'lingua', 'conto-numero',
    'riposo-titolo', 'riposo-tempo', 'riposo-frase', 'riposo-testo', 'btn-esci-riposo', 'domanda-idee', 'frase-aiuto',
    'avviso-idee', 'contatore-idee', 'elenco-idee', 'annunci'];
  const visibile = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || e.tagName === 'OPTION';
  const tradotti = [...document.querySelectorAll('[data-t], [data-t-html]')].filter(visibile).map((e) => e.textContent.trim());
  const liberi = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const testo = n.textContent.trim(); const e = n.parentElement;
    if (!testo || !/\p{L}/u.test(testo) || ['SCRIPT', 'STYLE'].includes(e.tagName)) continue;
    if (e.closest('[data-t], [data-t-html]') || DINAMICI.some((id) => e.closest(`#${id}`))) continue;
    if (testo === 'F' || testo === 'Eye Gym') continue; // tasto F e nome del marchio, uguali in ogni lingua
    liberi.push(testo);
  }
  const attributi = [...document.querySelectorAll('[data-t-attr]')].flatMap((e) => e.dataset.tAttr.split(';').map((c) => e.getAttribute(c.split('=')[0])));
  return { tradotti, liberi, attributi, lang: document.documentElement.lang, titolo: document.title };
});

const b = await chromium.launch();
async function pagina(locale, prima) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale });
  const page = await ctx.newPage(); page.err = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/willReadFrequently/.test(m.text())) page.err.push(m.text()); });
  page.on('pageerror', (e) => page.err.push(e.message));
  if (prima) await page.addInitScript(prima);
  await page.clock.install();
  await page.goto(URL);
  return { ctx, page };
}

// ---------- 1. dizionario completo ----------
console.log('1) Dizionario');
const chiaviIt = Object.keys(LINGUE.it);
for (const c of CODICI) {
  const k = Object.keys(LINGUE[c]);
  const mancano = chiaviIt.filter((x) => !k.includes(x));
  ok(mancano.length === 0 && k.length === chiaviIt.length, `${c}: ${k.length} chiavi${mancano.length ? `, mancano ${mancano.join(', ')}` : ''}`);
}

// ---------- 2. ogni lingua: scelta automatica e nessun testo rimasto in italiano ----------
console.log('2) Testi in ogni lingua');
const italiani = testiPiatti('it');
for (const c of CODICI) {
  const L = LINGUE[c];
  const { ctx, page } = await pagina(LOCALE[c], () => {
    localStorage.setItem('etr.avvisoLetto', 'true');
    localStorage.setItem('etr.impostazioni', JSON.stringify({ opzioniAperte: true, esercizio: 'misto' }));
    // una sessione salvata, così la tabella dei progressi ha una riga da tradurre
    localStorage.setItem('etr.sessioni', JSON.stringify([{ data: '2026-10-13', ora: new Date().toISOString(), esercizio: 'cerchio', velocita: 3, durata: 120, progressiva: true, livello: 2, lettere: true, indovinata: true, bambino: false }]));
  });
  await page.locator('#calibrazione').evaluate((d) => { d.open = true; });
  await page.locator('#dimensione-variabile').check(); await page.locator('#lettere').check();
  const viste = [await leggiPagina(page)];
  await page.click('.tab[data-vista=percorso]'); viste.push(await leggiPagina(page));
  await page.click('.tab[data-vista=progressi]'); viste.push(await leggiPagina(page));
  await page.click('.tab[data-vista=allenamento]');
  await page.locator('#dlg-avviso').evaluate((d) => d.showModal()); viste.push(await leggiPagina(page));
  await page.keyboard.press('Escape');
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  viste.push(await leggiPagina(page));
  await page.screenshot({ path: `${SHOTS}/lingua-${c}-conto.png` });
  await page.keyboard.press('Escape');

  ok(viste[0].lang === L['meta.lang'] && viste[0].titolo === L['meta.titolo'], `${c}: lingua scelta dal browser (${LOCALE[c]}), lang="${viste[0].lang}", titolo tradotto`);
  const liberi = [...new Set(viste.flatMap((v) => v.liberi))];
  ok(liberi.length === 0, `${c}: nessun testo fuori dal dizionario${liberi.length ? ': ' + liberi.join(' | ') : ''}`);
  if (c !== 'it') {
    const propri = testiPiatti(c);
    const rimasti = [...new Set(viste.flatMap((v) => [...v.tradotti, ...v.attributi]))].filter((x) => italiani.has(x) && !propri.has(x));
    ok(rimasti.length === 0, `${c}: nessun testo rimasto in italiano${rimasti.length ? ': ' + rimasti.join(' | ') : ''}`);
    const percorso = await page.locator('#percorso-elenco').innerText().catch(() => '');
    await page.click('.tab[data-vista=percorso]');
    const testoPercorso = await page.locator('#percorso-elenco').textContent(); // testo vero: il CSS mette alcune etichette in maiuscolo
    ok(testoPercorso.includes(L.livello(1)) && testoPercorso.includes(L.livelli[0]) && testoPercorso.includes(L.mondi[0].nome), `${c}: livelli e mondi tradotti (${L.livello(1)} · ${L.livelli[0]})`);
    await page.click('.tab[data-vista=progressi]');
    const riga = await page.locator('#tabella-sessioni tbody tr').first().innerText();
    ok(riga.includes(L['es.cerchio']) && riga.includes(L['tab.liv'](2).trim()) && riga.includes(L['tab.progressiva'].trim()), `${c}: riga dei progressi tradotta (${riga.replace(/\s+/g, ' ')})`);
    void percorso;
  }
  await page.click('.tab[data-vista=allenamento]');
  ok(await page.locator('#velocita-val').innerText() === `3 / 10 · ${(10.5).toLocaleString(L['meta.locale'])}°/s`, `${c}: numeri nel formato locale (${await page.locator('#velocita-val').innerText()})`);
  await page.screenshot({ path: `${SHOTS}/lingua-${c}.png`, fullPage: true });
  ok(page.err.length === 0, `${c}: nessun errore in console` + (page.err.length ? ': ' + page.err.join(' | ') : ''));
  await ctx.close();
}

// ---------- 3. ripiego e varianti ----------
console.log('3) Lingua del browser non disponibile o variante');
for (const [locale, atteso] of [['de-DE', 'en'], ['zh-TW', 'zh'], ['pt-BR', 'en'], ['es-MX', 'es'], ['fr-CA', 'fr']]) {
  const { ctx, page } = await pagina(locale);
  ok(await page.locator('#lingua').inputValue() === atteso, `browser ${locale} → ${atteso}`);
  await ctx.close();
}

// ---------- 4. cambio al volo e memoria ----------
console.log('4) Cambio lingua al volo');
{
  const { ctx, page } = await pagina('it-IT');
  ok(await page.locator('#lingua option').count() === 6, '6 lingue nel menu, ognuna col proprio nome: ' + (await page.locator('#lingua option').allInnerTexts()).join(', '));
  ok(await page.locator('h1').innerText() === LINGUE.it['app.titolo'], 'parte in italiano');
  await page.locator('#lingua').selectOption('hi');
  ok(await page.locator('h1').innerText() === LINGUE.hi['app.titolo'] && await page.evaluate(() => document.documentElement.lang) === 'hi', 'cambio in hindi senza ricaricare');
  ok(await page.locator('#btn-avvia').innerText() === LINGUE.hi.avvia, 'pulsante di avvio in hindi');
  await page.reload();
  ok(await page.locator('#lingua').inputValue() === 'hi' && await page.locator('h1').innerText() === LINGUE.hi['app.titolo'], 'la scelta resta dopo il reload');
  await page.locator('#lingua').selectOption('it');
  ok(await page.locator('h1').innerText() === LINGUE.it['app.titolo'], 'e si torna all\'italiano');
  await ctx.close();
}

// ---------- 5. lettere e risposta in cinese e hindi ----------
console.log('5) Modalità lettere in cinese e hindi');
const segmenta = (testo, locale) => [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(testo)].map((x) => x.segment);
for (const c of ['zh', 'hi']) {
  const L = LINGUE[c];
  const frase = L.frasi[0];
  const { ctx, page } = await pagina(LOCALE[c], () => {
    Math.random = () => 0; // prima frase, prima domanda
    localStorage.setItem('etr.avvisoLetto', 'true');
    localStorage.setItem('etr.impostazioni', JSON.stringify({ lettere: true, passoLettere: 1, durata: 2, opzioniAperte: true }));
    const P = CanvasRenderingContext2D.prototype, testo = P.fillText, pulisci = P.clearRect;
    P.clearRect = function (...a) { if (this.canvas.id === 'canvas') window.__lettera = null; return pulisci.apply(this, a); };
    P.fillText = function (s, ...a) { if (this.canvas.id === 'canvas') window.__lettera = s; return testo.call(this, s, ...a); };
  });
  const attesi = [];
  for (const g of segmenta(frase.toLocaleUpperCase(L['meta.locale']), L['meta.locale'])) {
    if (/[\p{L}\p{N}]/u.test(g)) attesi.push(g);
    else if (attesi.length && attesi.at(-1) !== null) attesi.push(null);
  }
  attesi.push(null);
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 300));
  await page.clock.runFor(3500);
  await page.screenshot({ path: `${SHOTS}/lingua-${c}-lettera.png` });
  const visti = [];
  for (let i = 0; i < attesi.length * 2; i++) { visti.push(await page.evaluate(() => window.__lettera)); await page.clock.runFor(1000); }
  const diverse = visti.filter((v, i) => v !== attesi[i % attesi.length]).length;
  ok(diverse === 0, `${c}: sul bersaglio compaiono i segni interi della frase, in ordine (${visti.map((v) => v ?? '·').join(' ')})`);
  if (c === 'hi') ok(visti.includes('धी') && visti.includes('रे'), 'hi: le sillabe devanagari non vengono spezzate (धी, रे)');
  await page.clock.runFor(120000);
  await page.locator('#ov-indovina').waitFor({ state: 'visible' });
  const lettere = attesi.filter((x) => x !== null).length, parole = attesi.filter((x) => x === null).length;
  ok(await page.locator('#frase-aiuto').innerText() === L['frase.aiuto'](parole, lettere), `${c}: aiuto con ${lettere} segni`);
  await page.locator('#risposta-frase').fill(` ${frase}！`);
  await page.keyboard.press('Enter');
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  ok(await page.locator('#riposo-frase').innerText() === L['frase.giusta'](frase), `${c}: risposta giusta riconosciuta (${await page.locator('#riposo-frase').innerText()})`);
  ok(await page.locator('#riposo-titolo').innerText() === L['riposo.titolo'], `${c}: schermata di riposo tradotta`);
  ok(page.err.length === 0, `${c}: nessun errore in console` + (page.err.length ? ': ' + page.err.join(' | ') : ''));
  await ctx.close();
}

// ---------- 6. idee del razzo in hindi ----------
console.log('6) Modalità bambino in hindi');
{
  const L = LINGUE.hi;
  const { ctx, page } = await pagina('hi-IN', () => {
    Math.random = () => 0;
    localStorage.setItem('etr.avvisoLetto', 'true');
    localStorage.setItem('etr.impostazioni', JSON.stringify({ bambino: true, durata: 2, opzioniAperte: true }));
  });
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(3500 + 121000);
  await page.locator('#ov-idee').waitFor({ state: 'visible' });
  ok(await page.locator('#domanda-idee').innerText() === L.domande[0], 'domanda creativa in hindi');
  await page.locator('#nuova-idea').fill('चाँद'); await page.keyboard.press('Enter');
  await page.locator('#nuova-idea').fill(' चाँद! '); await page.keyboard.press('Enter');
  ok(await page.locator('#avviso-idee').innerText() === L['idee.doppia'] && await page.locator('#elenco-idee li').count() === 1, 'idea ripetuta riconosciuta anche in devanagari');
  await page.click('#btn-idea-voce');
  ok((await page.locator('#elenco-idee li').last().innerText()) === L['idee.vocale'](1), '"+1 idea a voce" tradotto');
  await page.click('#btn-fatto-idee');
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  ok(await page.locator('#riposo-frase').innerText() === L['idee.esito'](2), 'esito delle idee in hindi');
  ok(page.err.length === 0, 'nessun errore in console' + (page.err.length ? ': ' + page.err.join(' | ') : ''));
  await ctx.close();
}

await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
