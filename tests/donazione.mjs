// Donazione: pulsante e QR compaiono solo nel piè di pagina e nella schermata di riposo, mai durante l'esercizio;
// il QR si decodifica e coincide con DONATE_URL; se il link non è valido tutto sparisce; nessuna risorsa esterna.
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.URL || 'http://localhost:8000/index.html';
const SHOTS = process.env.SHOTS || '.';
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DONATE_URL = readFileSync(join(RADICE, 'app.js'), 'utf8').match(/const DONATE_URL = '([^']*)';/)[1];
const SVG_URL = URL.replace('index.html', 'qr-donazione.svg');

const b = await chromium.launch();
async function pagina({ viewport = { width: 1280, height: 900 }, locale = 'it-IT', senzaLink = false, inizio } = {}) {
  const ctx = await b.newContext({ viewport, locale });
  const page = await ctx.newPage(); page.err = []; page.richieste = [];
  page.on('pageerror', (e) => page.err.push(e.message));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/willReadFrequently/.test(m.text())) page.err.push(m.text()); });
  page.on('request', (r) => page.richieste.push(r.url()));
  if (senzaLink) await page.route('**/app.js', async (route) => {
    const resp = await route.fetch();
    await route.fulfill({ response: resp, body: (await resp.text()).replace(/const DONATE_URL = '[^']*';/, "const DONATE_URL = '';") });
  });
  await page.addInitScript(() => { localStorage.setItem('etr.avvisoLetto', 'true'); });
  if (inizio) await page.addInitScript(inizio);
  await page.clock.install();
  await page.goto(URL);
  return { ctx, page };
}
const visibili = (page, selettore) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0).length, selettore);

// ---------- 1. il QR contiene esattamente DONATE_URL ----------
console.log('1) QR code');
{
  const { ctx, page } = await pagina();
  // si disegna il file SVG su un canvas della pagina normale (stessa origine) e lo si legge come farebbe un telefono
  const img = await page.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const lato = 1000; const c = document.createElement('canvas'); c.width = c.height = lato;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, lato, lato); g.drawImage(im, 0, 0, lato, lato);
    return { dati: Array.from(g.getImageData(0, 0, lato, lato).data), lato };
  }, SVG_URL);
  const letto = jsQR(new Uint8ClampedArray(img.dati), img.lato, img.lato);
  ok(letto && letto.data === DONATE_URL, `decodificato: "${letto && letto.data}" = DONATE_URL`);
  const svg = readFileSync(join(RADICE, 'qr-donazione.svg'), 'utf8');
  const [, vb] = svg.match(/viewBox="0 0 (\d+) \d+"/);
  const moduli = +vb - 8;
  const scuri = svg.match(/stroke="#000000" d="([^"]+)"/)[1]; // solo il percorso dei moduli scuri, non lo sfondo
  const x0 = Math.min(...[...scuri.matchAll(/M(\d+)/g)].map((m) => +m[1]));
  ok(x0 >= 4 && moduli === 29, `vettoriale, ${moduli}×${moduli} moduli, prima area scura a ${x0} (quiet zone ≥ 4 moduli)`);
  ok(/fill="#ffffff"/.test(svg) && /stroke="#000000"/.test(svg) && !/<image|http:\/\/(?!www\.w3\.org)/.test(svg), 'scuro su bianco, nessuna immagine o riferimento esterno nel file');
  // robustezza: il QR resta leggibile anche rimpicciolito a 130 px e con ~10% di moduli rovinati (livello M)
  const piccolo = await page.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 130;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 130, 130); g.drawImage(im, 0, 0, 130, 130);
    return Array.from(g.getImageData(0, 0, 130, 130).data);
  }, SVG_URL);
  const l2 = jsQR(new Uint8ClampedArray(piccolo), 130, 130);
  ok(l2 && l2.data === DONATE_URL, 'leggibile anche a 130 px');
  const danneggiato = await page.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const lato = 740; const c = document.createElement('canvas'); c.width = c.height = lato;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, lato, lato); g.drawImage(im, 0, 0, lato, lato);
    const m = lato / 37; // un modulo in pixel
    g.fillStyle = '#fff'; g.fillRect(4 * m + 20 * m, 4 * m + 16 * m, 4 * m, 3 * m); // cancella 12 moduli dei dati (non i riquadri di posizione)
    return Array.from(g.getImageData(0, 0, lato, lato).data);
  }, SVG_URL);
  const l3 = jsQR(new Uint8ClampedArray(danneggiato), 740, 740);
  ok(l3 && l3.data === DONATE_URL, 'ancora leggibile con un\'area di dati cancellata (correzione errori)');
  await ctx.close();
}

// ---------- 2. dove compare ----------
console.log('2) Dove compare');
{
  const { ctx, page } = await pagina();
  ok(await visibili(page, '.piede .dona__bottone') === 1 && await visibili(page, '.piede .qr img') === 1, 'piè di pagina: pulsante e QR visibili');
  const a = page.locator('.piede .dona__bottone');
  ok(await a.getAttribute('href') === DONATE_URL && await a.getAttribute('target') === '_blank' && /noopener/.test(await a.getAttribute('rel')) && /noreferrer/.test(await a.getAttribute('rel')),
    `il pulsante apre ${DONATE_URL} in una nuova scheda con rel="${await a.getAttribute('rel')}"`);
  ok(/si apre in una nuova scheda/.test(await a.textContent()), 'avvisa gli screen reader che si apre in una nuova scheda');
  const alt = await page.locator('.piede .qr img').getAttribute('alt');
  ok(/QR code/.test(alt) && /PayPal/.test(alt), `testo alternativo del QR: "${alt}"`);
  ok(/Inquadra con il telefono per donare via PayPal/.test(await page.locator('.piede figcaption').innerText()), 'didascalia: Inquadra con il telefono per donare via PayPal');
  const testo = await page.locator('.piede .dona__corpo').innerText();
  ok(/gratuita e resta gratuita/.test(testo) && /volontaria/.test(testo) && /non sblocca nulla/.test(testo), 'testo onesto: gratuita, volontaria, non sblocca nulla');
  ok(!/\d+\s*(€|euro|donator|persone)|obiettivo|urgente|ultim[oa] possibilit|aiutaci a sopravvivere|salute|migliora la vista/i.test(testo), 'nessun contatore, pressione o promessa sulla salute');
  // sfondo del QR bianco anche nel tema scuro
  const sfondo = await page.locator('.piede .qr').evaluate((e) => getComputedStyle(e).backgroundColor);
  ok(sfondo === 'rgb(255, 255, 255)' && await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', `tema scuro: il QR sta su un riquadro bianco (${sfondo})`);
  await page.locator('.piede').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/donazione-piede.png`, clip: await page.locator('.dona').first().boundingBox() });
  for (const v of ['percorso', 'progressi']) {
    await page.click(`.tab[data-vista=${v}]`);
    ok(await visibili(page, '.piede .dona__bottone') === 1, `anche nella vista ${v}`);
  }
  await page.click('.tab[data-vista=allenamento]');

  // non durante conto alla rovescia ed esercizio
  await page.evaluate(() => localStorage.setItem('etr.impostazioni', JSON.stringify({ durata: 2 }))); await page.reload(); await page.clock.install();
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(1000);
  ok(await visibili(page, '.dona') === 0, 'durante il conto alla rovescia: nessun pulsante di donazione');
  await page.clock.runFor(4000);
  ok(await visibili(page, '.dona') === 0 && await visibili(page, '.dona__bottone, .dona__qr, .qr') === 0, 'durante l\'esercizio: nessun pulsante né QR');
  await page.keyboard.press('Space');
  ok(await visibili(page, '.dona') === 0, 'in pausa: nessun pulsante di donazione');
  await page.keyboard.press('Space');
  await page.mouse.click(300, 400); await new Promise((r) => setTimeout(r, 500));
  ok(await visibili(page, '.dona') === 0, 'anche richiamando i comandi con un tocco');
  ok(await page.locator('dialog[open]').count() === 0, 'nessun popup');
  // riposo
  await page.clock.runFor(124000);
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  ok(await visibili(page, '#ov-riposo .dona__bottone') === 1 && await visibili(page, '#ov-riposo .qr img') === 1, 'schermata di riposo: pulsante e QR visibili');
  ok(await page.locator('#ov-riposo .dona__bottone').getAttribute('href') === DONATE_URL, 'il pulsante del riposo apre lo stesso link');
  await page.screenshot({ path: `${SHOTS}/donazione-riposo.png` });
  await page.keyboard.press('Escape');
  ok(page.err.length === 0, 'nessun errore in console' + (page.err.length ? ': ' + page.err.join(' | ') : ''));
  // nessuna richiesta a siti esterni: tutto arriva dalla stessa origine del sito
  const origine = new globalThis.URL(URL).origin;
  const esterne = page.richieste.filter((u) => !u.startsWith(origine) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok(esterne.length === 0, `nessuna risorsa esterna caricata (${page.richieste.length} richieste, tutte locali)${esterne.length ? ': ' + esterne.join(', ') : ''}`);
  await ctx.close();
}

// ---------- 3. altre schermate dell'esercizio senza donazione ----------
console.log('3) Indovinello e idee senza donazione');
{
  const { ctx, page } = await pagina({ inizio: () => { Math.random = () => 0; localStorage.setItem('etr.impostazioni', JSON.stringify({ lettere: true, durata: 2, opzioniAperte: true })); } });
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(3500 + 121000);
  await page.locator('#ov-indovina').waitFor({ state: 'visible' });
  ok(await visibili(page, '.dona') === 0, 'indovinello: nessuna donazione');
  await ctx.close();
}

// ---------- 4. telefono ----------
console.log('4) Telefono');
{
  const { ctx, page } = await pagina({ viewport: { width: 390, height: 844 } });
  ok(await visibili(page, '.piede .dona__bottone') === 1 && await visibili(page, '.piede .dona__qr') === 0, 'telefono: pulsante visibile, QR nascosto');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'nessuno scroll orizzontale');
  await page.locator('.piede').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/donazione-telefono.png` });
  await ctx.close();
}

// ---------- 5. link non valido: tutto nascosto ----------
console.log('5) Link vuoto o non raggiungibile');
{
  const { ctx, page } = await pagina({ senzaLink: true });
  ok(await visibili(page, '.dona, .dona__bottone, .qr, .dona__qr') === 0, 'DONATE_URL vuoto: pulsante, QR e testo spariscono dal piè di pagina');
  ok(await page.locator('.piede .dona__bottone').getAttribute('href') === null, 'e il link non ha nessun indirizzo');
  await page.evaluate(() => localStorage.setItem('etr.impostazioni', JSON.stringify({ durata: 2 }))); await page.reload(); await page.clock.install();
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  await page.clock.runFor(3500 + 124000);
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  ok(await visibili(page, '#ov-riposo .dona, #ov-riposo .qr') === 0, 'DONATE_URL vuoto: nessuna donazione nemmeno nel riposo');
  await ctx.close();
}

// ---------- 6. lingue ----------
console.log('6) Lingue');
{
  const { ctx, page } = await pagina({ locale: 'en-US' });
  ok(await page.locator('.piede .dona__bottone > span').first().innerText() === 'Donate with PayPal', 'inglese: pulsante "Donate with PayPal"');
  ok(/Scan with your phone to donate via PayPal/.test(await page.locator('.piede figcaption').innerText()), 'inglese: didascalia del QR');
  await page.locator('#lingua').selectOption('zh');
  ok((await page.locator('.piede .dona__bottone > span').first().innerText()) === '通过 PayPal 捐款' && /二维码/.test(await page.locator('.piede .qr img').getAttribute('alt')), 'cinese: pulsante e testo alternativo tradotti');
  await ctx.close();
}

await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
