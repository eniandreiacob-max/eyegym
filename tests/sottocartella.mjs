// Imita GitHub Pages: il sito vive in /eye-gym/ e le pagine inesistenti rispondono 404 con 404.html.
// Se qualche percorso del sito non fosse relativo, qui si romperebbe.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlla } from './controlli-sito.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIPI = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const PREFISSO = '/eye-gym/';

const server = createServer(async (req, res) => {
  const percorso = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const manda404 = async () => { const pagina = await readFile(join(RADICE, '404.html')); res.writeHead(404, { 'content-type': TIPI['.html'] }).end(pagina); };
  if (percorso === '/eye-gym') { res.writeHead(301, { location: PREFISSO }).end(); return; }
  if (!percorso.startsWith(PREFISSO)) { await manda404(); return; }
  const resto = percorso.slice(PREFISSO.length);
  const relativo = resto === '' ? 'index.html' : normalize(resto); // come GitHub Pages: la cartella serve index.html
  if (relativo.startsWith('..') || relativo.startsWith('tests') || relativo.startsWith('tools') || relativo.startsWith('.git')) { await manda404(); return; }
  const nome = relativo.endsWith('/') ? `${relativo}index.html` : relativo;
  let corpo = null;
  try { corpo = await readFile(join(RADICE, nome)); } catch { /* manca: 404 */ }
  if (corpo === null) await manda404();
  else res.writeHead(200, { 'content-type': TIPI[extname(nome)] || 'text/plain' }).end(corpo);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}${PREFISSO}`;
console.log(`Sito imitato in sottocartella: ${base}`);
const ko = await controlla(base, { pubblico: false, shots: process.env.SHOTS || '.' });
server.close();
console.log(ko ? `${ko} FALLITI` : 'TUTTO OK'); process.exit(ko ? 1 : 0);
