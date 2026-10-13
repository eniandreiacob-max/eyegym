// Genera og-image.png (1200×630), l'immagine mostrata quando il link viene condiviso sui social.
// Disegna una pagina HTML con lo stesso design dell'app e ne fa uno screenshot con Chromium.
// Si esegue solo quando cambia il design:  cd tools && npm install && npx playwright install chromium && npm run og
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Otto sdraiato (stessa forma dell'esercizio): x = sin f, y = sin 2f / 2
const punti = Array.from({ length: 241 }, (_, i) => {
  const f = (i / 240) * 2 * Math.PI;
  return [600 + Math.sin(f) * 190, 300 + (Math.sin(2 * f) * 95)];
});
const percorso = punti.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
const [px, py] = punti[34];

const html = `<!doctype html><html lang="it"><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #f2efe8;
    background: radial-gradient(900px 520px at 12% -10%, rgba(226,193,124,.20), transparent 60%),
                radial-gradient(800px 480px at 100% 110%, rgba(132,148,255,.10), transparent 60%), #0a0b0e;
    font-family: "Helvetica Neue", Arial, "PingFang SC", sans-serif; }
  svg { position: absolute; inset: 0; }
  .testo { position: absolute; left: 84px; bottom: 92px; }
  .nome { font: 400 148px/1 Georgia, "Iowan Old Style", "Palatino Linotype", serif; letter-spacing: -4px; }
  .sotto { margin-top: 22px; font-size: 34px; color: #b8b4aa; letter-spacing: .2px; }
  .sotto b { color: #e2c17c; font-weight: 600; }
  .marchio { position: absolute; left: 84px; top: 70px; display: flex; align-items: center; gap: 16px; font-size: 24px; letter-spacing: 6px; color: #a6a39c; text-transform: uppercase; }
</style><body>
  <svg viewBox="0 0 1200 630" width="1200" height="630">
    <path d="${percorso}" fill="none" stroke="#e2c17c" stroke-opacity=".28" stroke-width="3" transform="translate(190 -70)"/>
    <g transform="translate(190 -70)">
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="46" fill="#e2c17c" fill-opacity=".14"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="24" fill="#ffe14d"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7" fill="#0a0b0e"/>
    </g>
  </svg>
  <div class="marchio"><svg viewBox="0 0 32 32" width="42" height="42" style="position:static">
    <circle cx="16" cy="16" r="15" fill="none" stroke="#e2c17c" stroke-opacity=".55" stroke-width="1.2"/>
    <path d="M5 16c3.2-5.2 6.9-7.8 11-7.8s7.8 2.6 11 7.8c-3.2 5.2-6.9 7.8-11 7.8S8.2 21.2 5 16z" fill="none" stroke="#f2efe8" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="16" cy="16" r="3.4" fill="#e2c17c"/></svg>esercizi occhi</div>
  <div class="testo"><div class="nome">Eye Gym</div>
    <div class="sotto">Inseguimento visivo e <b>saccadi</b>, gratis, su schermo</div></div>
</body></html>`;

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await pagina.setContent(html);
await pagina.screenshot({ path: join(RADICE, 'og-image.png'), type: 'png' });
await browser.close();
console.log('og-image.png scritto (1200×630)');
