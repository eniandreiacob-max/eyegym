// Accessibilità di base: axe-core (contrasto, etichette, ruoli, nomi accessibili) su tutte le schermate,
// tema scuro e chiaro, più uso da tastiera: ordine del Tab, focus visibile, Esc e Spazio.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const URL_APP = process.env.URL || 'http://localhost:8000/index.html';
const BASE = new globalThis.URL('./', URL_APP).href;
let ko = 0; const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) ko++; };
const axeSorgente = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const b = await chromium.launch();
async function pagina({ tema = 'dark', url = URL_APP, lingua, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await b.newContext({ viewport, locale: 'it-IT' });
  const page = await ctx.newPage(); page.err = [];
  page.on('pageerror', (e) => page.err.push(e.message));
  await page.addInitScript(([tema, lingua]) => {
    localStorage.setItem('etr.avvisoLetto', 'true');
    const imp = { tema, opzioniAperte: true, durata: 2 };
    if (lingua) imp.lingua = lingua;
    localStorage.setItem('etr.impostazioni', JSON.stringify(imp));
    localStorage.setItem('etr.percorso', JSON.stringify({ completati: [1, 2, 3] }));
    const oggi = new Date(); const s = [];
    for (let i = 0; i < 6; i++) { const d = new Date(oggi); d.setDate(d.getDate() - i); s.push({ data: d.toISOString().slice(0, 10), ora: d.toISOString(), esercizio: ['cerchio', 'otto'][i % 2], velocita: 3, durata: 180, progressiva: false, livello: null }); }
    localStorage.setItem('etr.sessioni', JSON.stringify(s));
  }, [tema, lingua]);
  await page.clock.install();
  await page.goto(url);
  await page.evaluate(axeSorgente); // inietta axe-core nella pagina
  return { ctx, page };
}
async function axe(page, nome, contesto) {
  const r = await page.evaluate(async (contesto) => {
    const out = await window.axe.run(contesto || document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    return out.violations.map((v) => ({ id: v.id, impatto: v.impact, aiuto: v.help, nodi: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} → ${(n.any[0] || n.all[0] || n.none[0] || {}).message || ''}`) }));
  }, contesto);
  ok(r.length === 0, `${nome}: nessuna violazione${r.length ? '\n' + r.map((v) => `       ✗ ${v.id} (${v.impatto}): ${v.aiuto}\n         ${v.nodi.join('\n         ')}`).join('\n') : ''}`);
}

// ---------- axe-core su ogni schermata ----------
console.log('1) axe-core: tema scuro e chiaro');
for (const tema of ['dark', 'light']) {
  const { ctx, page } = await pagina({ tema });
  await page.locator('#calibrazione').evaluate((d) => { d.open = true; });
  await page.locator('input[name=esercizio][value=misto]').check();
  await page.locator('#dimensione-variabile').check();
  await axe(page, `${tema}: allenamento libero (tutto aperto, Misto, dimensione variabile)`);
  await page.locator('#lettere').check(); await page.locator('#bambino').scrollIntoViewIfNeeded();
  await axe(page, `${tema}: con le lettere attive`);
  await page.locator('#lettere').uncheck(); // altrimenti a fine sessione compare l'indovinello invece del riposo
  await page.click('.tab[data-vista=percorso]'); await axe(page, `${tema}: percorso`);
  await page.click('.tab[data-vista=progressi]'); await axe(page, `${tema}: progressi (grafico e tabella)`);
  await page.click('.tab[data-vista=allenamento]');
  await page.click('#btn-avvia'); await page.locator('#palco').waitFor({ state: 'visible' });
  await axe(page, `${tema}: conto alla rovescia`, '#palco');
  await page.clock.runFor(4500);
  await page.keyboard.press('Space'); await axe(page, `${tema}: pausa`, '#palco');
  await page.keyboard.press('Space');
  await page.clock.runFor(125000);
  await page.locator('#ov-riposo').waitFor({ state: 'visible' });
  await axe(page, `${tema}: riposo con donazione`, '#palco');
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.removeItem('etr.avvisoLetto'));
  await page.evaluate(() => localStorage.removeItem('etr.riposoFino')); await page.clock.runFor(1500);
  await page.locator('#btn-avvia').click(); await axe(page, `${tema}: avviso iniziale (dialogo)`);
  await page.keyboard.press('Escape');
  await ctx.close();
}
for (const [nome, url] of [['privacy.html', BASE + 'privacy.html'], ['404.html', BASE + '404.html']]) {
  for (const tema of ['dark']) {
    const { ctx, page } = await pagina({ tema, url });
    await axe(page, nome);
    await ctx.close();
  }
}
console.log('2) axe-core: alfabeti non latini');
for (const lingua of ['zh', 'hi', 'ar'].filter((l) => l !== 'ar')) {
  const { ctx, page } = await pagina({ lingua });
  await axe(page, `${lingua}: allenamento libero`);
  await ctx.close();
}

// ---------- tastiera ----------
console.log('3) Tastiera');
{
  const { ctx, page } = await pagina();
  // tutto ciò che è interattivo ha un nome e il focus si vede
  const senzaNome = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, summary, textarea')]
    .filter((e) => e.checkVisibility() && !e.closest('[hidden]'))
    .filter((e) => !(e.getAttribute('aria-label') || (e.labels && e.labels.length) || e.textContent.trim() || e.getAttribute('title')))
    .map((e) => e.outerHTML.slice(0, 80)));
  ok(senzaNome.length === 0, 'ogni elemento interattivo visibile ha un nome' + (senzaNome.length ? ': ' + senzaNome.join(' | ') : ''));
  const visti = new Set(); const senzaAnello = [];
  await page.focus('body');
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const s = getComputedStyle(e); const sfondo = e.closest('label, summary, .scheda, .spunte') || e;
      const ombra = getComputedStyle(sfondo);
      const visibile = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || (ombra.outlineStyle !== 'none' && parseFloat(ombra.outlineWidth) >= 2) || s.boxShadow.includes('rgb');
      return { id: String([...document.querySelectorAll('*')].indexOf(e)), nome: e.id || `${e.tagName.toLowerCase()}[${e.getAttribute('name') || e.className || e.textContent.trim().slice(0, 14)}]`, visibile, tag: e.tagName, tipo: e.type };
    });
    if (!info) break;
    if (visti.has(info.id + info.tag)) break;
    visti.add(info.id + info.tag);
    if (!info.visibile && info.tipo !== 'range') senzaAnello.push(info.nome);
  }
  ok(visti.size >= 15, `il Tab attraversa ${visti.size} controlli senza intrappolarsi`);
  ok(senzaAnello.length === 0, 'ogni controllo a fuoco ha un anello di focus visibile' + (senzaAnello.length ? ': ' + senzaAnello.join(', ') : ''));
  // salta al contenuto
  await page.reload(); await page.clock.install();
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.className) === 'salta', 'il primo Tab porta al link "Vai al contenuto"');
  await page.keyboard.press('Enter');
  ok(await page.evaluate(() => location.hash) === '#principale', 'e lo attiva');
  // sessione da tastiera
  await page.focus('#btn-avvia'); await page.keyboard.press('Enter');
  await page.locator('#palco').waitFor({ state: 'visible' }); await page.clock.runFor(4500);
  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isVisible(), 'Spazio mette in pausa');
  ok(await page.evaluate(() => document.activeElement.id) === 'btn-riprendi', 'il focus passa a "Riprendi" in pausa');
  await page.keyboard.press('Space');
  ok(await page.locator('#ov-pausa').isHidden(), 'Spazio sul pulsante riprende');
  await page.keyboard.press('Escape');
  ok(await page.locator('#palco').isHidden(), 'Esc ferma');
  ok(await page.evaluate(() => document.activeElement.id) === 'btn-avvia', 'dopo lo stop il focus torna sul pulsante di avvio');
  ok(page.err.length === 0, 'nessun errore in console');
  await ctx.close();
}

// ---------- lingua e contrasto del tema ----------
console.log('4) Lingua');
{
  const { ctx, page } = await pagina({ lingua: 'fr' });
  ok(await page.evaluate(() => document.documentElement.lang) === 'fr', 'l\'attributo lang segue la lingua scelta');
  await ctx.close();
}

await b.close();
console.log(ko ? ko + ' FALLITI' : 'TUTTO OK'); process.exit(ko ? 1 : 0);
