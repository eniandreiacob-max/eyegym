// Controlli sul sito così com'è pubblicato (o imitato in locale in una sottocartella):
// pagine e file di servizio, meta tag, nessuna risorsa che fallisce, ogni esercizio parte,
// riposo, donazione solo dove prevista, QR decodificato, 404 con codice giusto.
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DONATE_URL = readFileSync(join(RADICE, 'app.js'), 'utf8').match(/const DONATE_URL = '([^']*)';/)[1];
export const SITO_ATTESO = 'https://eniandreiacob-max.github.io/eyegym/';
const TITOLO = 'Eye Gym – allenamento del movimento oculare';
const DESCRIZIONE = 'Esercizi gratuiti su schermo per allenare inseguimento visivo e saccadi. Non è una cura né sostituisce una visita.';
const ESERCIZI = ['orizzontale', 'verticale', 'cerchio', 'ellisse', 'otto', 'saccadi', 'zigzag', 'misto'];

export async function controlla(base, { pubblico = false, shots = '.' } = {}) {
  let ko = 0;
  const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };
  const url = (p) => new URL(p, base).href;
  const browser = await chromium.launch();

  async function nuova(opz = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'it-IT', ...opz });
    const page = await ctx.newPage();
    page.err = []; page.fallite = []; page.richieste = [];
    page.on('pageerror', (e) => page.err.push(e.message));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/willReadFrequently/.test(m.text())) page.err.push(m.text()); });
    page.on('response', (r) => { page.richieste.push(r.url()); if (r.status() >= 400 && !/\/favicon\.ico$/.test(r.url())) page.fallite.push(`${r.status()} ${r.url()}`); });
    return { ctx, page };
  }
  const centroide = (page) => page.evaluate(() => {
    const c = document.getElementById('canvas');
    const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3] > 0) { sx += x; sy += y; n++; }
    return n ? { x: sx / n, y: sy / n } : null;
  });
  const visibili = (page, s) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0).length, s);

  // ---------- 1. file e pagine ----------
  console.log('1) Pagine e file di servizio');
  const prendi = async (p) => { const r = await fetch(url(p), { redirect: 'follow' }); return { r, tipo: r.headers.get('content-type') || '', testo: await r.clone().text().catch(() => ''), buf: Buffer.from(await r.arrayBuffer()) }; };
  for (const [p, tipo, contiene] of [
    ['', /text\/html/, 'Eye Gym'], ['privacy.html', /text\/html/, 'Privacy'], ['robots.txt', /text\/plain/, 'Allow: /'],
    ['sitemap.xml', /xml/, '<urlset'], ['favicon.svg', /svg/, '<svg'], ['qr-donazione.svg', /svg/, '<svg'],
    ['style.css', /css/, ':root'], ['app.js', /javascript/, 'DONATE_URL'], ['testi.js', /javascript/, 'LINGUE'], ['pagine.js', /javascript/, 'LINGUE'],
    ['LICENSE', /.*/, 'MIT License'],
  ]) {
    const { r, tipo: t, testo } = await prendi(p);
    ok(r.status === 200 && tipo.test(t) && testo.includes(contiene), `${p || '/'} → ${r.status} ${t.split(';')[0]}`);
  }
  const og = await prendi('og-image.png');
  const larg = og.buf.readUInt32BE(16), alt = og.buf.readUInt32BE(20);
  ok(og.r.status === 200 && /image\/png/.test(og.tipo) && larg === 1200 && alt === 630, `og-image.png → ${og.r.status} PNG ${larg}×${alt}`);
  const robots = (await prendi('robots.txt')).testo;
  ok(/Sitemap:\s*https:\/\/\S+sitemap\.xml/.test(robots) && !/Disallow:\s*\//.test(robots), 'robots.txt: consente tutto e indica la sitemap');
  const sitemap = (await prendi('sitemap.xml')).testo;
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(locs.length === 2 && locs.every((l) => l.startsWith('https://')), `sitemap.xml: ${locs.length} pagine (${locs.join(', ')})`);
  if (pubblico) {
    ok(locs[0] === SITO_ATTESO && locs[1] === `${SITO_ATTESO}privacy.html`, 'sitemap.xml: gli indirizzi sono quelli reali del sito');
    for (const l of locs) ok((await fetch(l)).status === 200, `sitemap: ${l} risponde 200`);
  }
  const nf = await fetch(url('questa-pagina-non-esiste/xyz'));
  const nfTesto = await nf.text();
  ok(nf.status === 404 && /<h1[^>]*>/.test(nfTesto) && /404/.test(nfTesto) && /Eye Gym/.test(nfTesto), `pagina inesistente → ${nf.status} con la pagina 404 di Eye Gym`);

  // ---------- 2. home: caricamento, meta tag ----------
  console.log('2) Home');
  {
    const { ctx, page } = await nuova();
    await page.clock.install();
    await page.goto(url(''));
    ok(await page.title() === TITOLO, `title: "${await page.title()}"`);
    const meta = (sel, attr = 'content') => page.locator(sel).first().getAttribute(attr);
    ok(await page.evaluate(() => document.documentElement.lang) === 'it', 'lang="it"');
    ok(await meta('meta[name=description]') === DESCRIZIONE, 'meta description come richiesto');
    ok(/width=device-width/.test(await meta('meta[name=viewport]')), 'meta viewport');
    ok(!!(await meta('meta[name=theme-color]')), `theme-color ${await meta('meta[name=theme-color]')}`);
    const canonico = await meta('link[rel=canonical]', 'href');
    ok(/^https:\/\/.+\/eyegym\/$/.test(canonico), `canonical ${canonico}`);
    const ogTag = {};
    for (const p of ['title', 'description', 'url', 'image', 'type', 'site_name', 'locale']) ogTag[p] = await meta(`meta[property="og:${p}"]`);
    ok(ogTag.title === TITOLO && ogTag.description === DESCRIZIONE && ogTag.url === canonico && ogTag.image === `${canonico}og-image.png` && ogTag.type === 'website' && ogTag.site_name === 'Eye Gym', 'Open Graph completo e coerente col canonical');
    ok(await meta('meta[name="twitter:card"]') === 'summary_large_image' && await meta('meta[name="twitter:image"]') === ogTag.image, 'Twitter card summary_large_image');
    if (pubblico) ok(canonico === SITO_ATTESO && ogTag.url === SITO_ATTESO, 'canonical e og:url sono l\'indirizzo reale del sito');
    ok(/esercizi occhi/i.test(await page.locator('body').innerText()) && /inseguimento visivo/i.test(await page.locator('body').innerText()) && /saccadi/i.test(await page.locator('body').innerText()), 'nel testo compaiono "esercizi occhi", "inseguimento visivo", "saccadi"');
    ok(await page.locator('h1').innerText() === 'Eye Gym', 'intestazione: Eye Gym');
    ok(page.fallite.length === 0, `nessuna risorsa fallita (${page.richieste.length} richieste)${page.fallite.length ? ': ' + page.fallite.join(', ') : ''}`);
    const origine = new URL(base).origin;
    const esterne = page.richieste.filter((u) => !u.startsWith(origine) && !u.startsWith('data:') && !u.startsWith('blob:'));
    ok(esterne.length === 0, `nessuna risorsa da altri siti${esterne.length ? ': ' + esterne.join(', ') : ''}`);
    if (pubblico) ok(page.richieste.every((u) => u.startsWith('https://')), 'solo richieste https');
    const href = await page.locator('.piede__link a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    ok(href.includes('privacy.html') && href.some((h) => /github\.com\/.+\/eyegym$/.test(h)) && href.some((h) => /github\.com\/.+\/eyegym\/blob\/main\/LICENSE$/.test(h)), `footer: privacy, repository, licenza (${href.join(', ')})`);
    ok(await page.locator('.piede__link a[target=_blank]').evaluateAll((as) => as.every((a) => /noopener/.test(a.rel) && /noreferrer/.test(a.rel))), 'link esterni con rel="noopener noreferrer"');
    ok(page.err.length === 0, 'nessun errore in console' + (page.err.length ? ': ' + page.err.join(' | ') : ''));
    await page.screenshot({ path: join(shots, pubblico ? 'pubblico-home.png' : 'sottocartella-home.png'), fullPage: true });
    await ctx.close();
  }

  // ---------- 3. ogni esercizio parte e si muove ----------
  console.log('3) Esercizi');
  {
    const { ctx, page } = await nuova();
    await page.addInitScript(() => localStorage.setItem('etr.avvisoLetto', 'true'));
    await page.clock.install();
    await page.goto(url(''));
    for (const es of ESERCIZI) {
      await page.locator(`input[name=esercizio][value=${es}]`).check();
      await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
      await page.clock.runFor(3400);
      const punti = [];
      for (let i = 0; i < 6; i++) { await page.clock.runFor(700); punti.push(await centroide(page)); }
      const mosso = new Set(punti.map((p) => `${Math.round(p.x / 3)},${Math.round(p.y / 3)}`)).size;
      ok(mosso >= 2, `${es}: parte e il bersaglio si muove (${mosso} posizioni distinte)`);
      await page.keyboard.press('Escape');
    }
    ok(page.fallite.length === 0 && page.err.length === 0, 'nessun errore né risorsa fallita durante gli esercizi' + [...page.err, ...page.fallite].join(' | '));
    await ctx.close();
  }

  // ---------- 4. riposo e donazione ----------
  console.log('4) Riposo e donazione');
  {
    const { ctx, page } = await nuova();
    await page.addInitScript(() => { localStorage.setItem('etr.avvisoLetto', 'true'); localStorage.setItem('etr.impostazioni', JSON.stringify({ durata: 2 })); });
    await page.clock.install();
    await page.goto(url(''));
    ok(await visibili(page, '.piede .dona__bottone') === 1 && await visibili(page, '.piede .qr img') === 1, 'footer: pulsante e QR di donazione visibili');
    const a = page.locator('.piede .dona__bottone');
    ok(await a.getAttribute('href') === DONATE_URL && await a.getAttribute('target') === '_blank' && /noopener/.test(await a.getAttribute('rel')), `il pulsante apre ${DONATE_URL} in una nuova scheda`);
    await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
    await page.clock.runFor(4500);
    ok(await visibili(page, '.dona') === 0, 'durante l\'esercizio nessuna donazione');
    await page.clock.runFor(124000);
    await page.locator('#ov-riposo').waitFor({ state: 'visible' });
    ok(await visibili(page, '#ov-riposo .dona__bottone') === 1 && await visibili(page, '#ov-riposo .qr img') === 1, 'a fine sessione: la pausa di riposo compare con pulsante e QR');
    ok(/^1:5\d$|^2:00$/.test(await page.locator('#riposo-tempo').innerText()), `riposo di 2 minuti (${await page.locator('#riposo-tempo').innerText()})`);
    await page.screenshot({ path: join(shots, pubblico ? 'pubblico-riposo.png' : 'sottocartella-riposo.png') });
    ok(await page.locator('#btn-avvia').count() === 1, 'schermata di riposo raggiunta');
    await ctx.close();
  }
  // QR dal file realmente servito
  {
    const { ctx, page } = await nuova();
    await page.goto(url(''));
    const img = await page.evaluate(async (u) => {
      const im = new Image(); im.src = u; await im.decode();
      const c = document.createElement('canvas'); c.width = c.height = 1000;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1000, 1000); g.drawImage(im, 0, 0, 1000, 1000);
      return Array.from(g.getImageData(0, 0, 1000, 1000).data);
    }, url('qr-donazione.svg'));
    const letto = jsQR(new Uint8ClampedArray(img), 1000, 1000);
    ok(letto && letto.data === DONATE_URL, `QR del sito decodificato: "${letto && letto.data}" = DONATE_URL`);
    await ctx.close();
  }

  // ---------- 5. privacy e 404 nel browser ----------
  console.log('5) Privacy e 404');
  {
    const { ctx, page } = await nuova();
    await page.goto(url('privacy.html'));
    ok(/Privacy/.test(await page.title()) && /non raccoglie dati personali/i.test(await page.locator('main').innerText()), 'privacy.html in italiano');
    const t = await page.locator('main').innerText();
    ok(/cookie/i.test(t) && /analytics/i.test(t) && /localStorage/.test(t) && /PayPal/.test(t) && /GitHub Pages/.test(t), 'privacy: cookie, analytics, localStorage, PayPal, GitHub Pages');
    await page.locator('#lingua').selectOption('en');
    ok(/does not collect personal data/.test(await page.locator('main').innerText()), 'privacy: si cambia lingua');
    await page.locator('#lingua').selectOption('it');
    await page.click('main a.btn');
    ok(new URL(page.url()).pathname.endsWith('/') || /index\.html$/.test(page.url()), 'il link "Torna a Eye Gym" riporta alla home');
    await page.goto(url('pagina/che/non/esiste'));
    ok(await page.locator('h1').innerText() === 'Pagina non trovata' && await page.locator('a').getAttribute('href') !== null, '404: pagina in tema con il link per tornare');
    const veri = page.err.filter((e) => !/status of 404/.test(e)); // la 404 della pagina inesistente è attesa
    ok(veri.length === 0, 'nessun errore in console (a parte la 404 attesa)' + (veri.length ? ': ' + veri.join(' | ') : ''));
    await page.screenshot({ path: join(shots, pubblico ? 'pubblico-404.png' : 'sottocartella-404.png') });
    await ctx.close();
  }

  await browser.close();
  return ko;
}
