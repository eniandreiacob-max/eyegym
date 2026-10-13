// Avvia un server statico sulla cartella dell'app ed esegue i test uno dopo l'altro.
// Uso: npm test            → tutti i file
//      npm test velocita   → solo i file il cui nome contiene "velocita"
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const FILE = ['suite.mjs', 'lingue.mjs', 'anteprime.mjs', 'donazione.mjs', 'accessibilita.mjs', 'sottocartella.mjs', 'bordi.mjs', 'velocita.mjs', 'dimensione.mjs', 'bambino.mjs'];
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const percorso = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (percorso.startsWith('..') || percorso.startsWith('tests')) { res.writeHead(404).end(); return; }
  try {
    const corpo = await readFile(join(RADICE, percorso || 'index.html'));
    res.writeHead(200, { 'content-type': TIPI[extname(percorso)] || 'application/octet-stream' }).end(corpo);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const URL_APP = `http://127.0.0.1:${server.address().port}/index.html`;
const SHOTS = join(QUI, 'screenshots');
await mkdir(SHOTS, { recursive: true });

const filtro = process.argv[2];
const daEseguire = FILE.filter((f) => !filtro || f.includes(filtro));
const esiti = [];
for (const file of daEseguire) {
  console.log(`\n=== ${file} ===`);
  const codice = await new Promise((ok) => {
    const figlio = spawn(process.execPath, [join(QUI, file)], { stdio: 'inherit', env: { ...process.env, URL: URL_APP, SHOTS } });
    figlio.on('exit', ok);
  });
  esiti.push({ file, ok: codice === 0 });
}
server.close();
console.log('\n=== Riepilogo ===');
esiti.forEach((e) => console.log(`${e.ok ? 'OK  ' : 'FAIL'} ${e.file}`));
process.exit(esiti.every((e) => e.ok) ? 0 : 1);
