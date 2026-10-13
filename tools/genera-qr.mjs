// Genera qr-donazione.svg a partire da DONATE_URL (la stessa costante in cima ad app.js).
// Si esegue solo quando il link cambia:  cd tools && npm install && npm run qr
// Il sito pubblicato usa soltanto il file SVG prodotto: nessuna libreria, nessuno script esterno.
import QRCode from 'qrcode';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');

const app = await readFile(join(RADICE, 'app.js'), 'utf8');
const trovato = app.match(/const DONATE_URL = '([^']*)';/);
if (!trovato) throw new Error('DONATE_URL non trovato in app.js');
const url = trovato[1];
if (!/^https:\/\/\S+$/.test(url)) throw new Error(`DONATE_URL non è un indirizzo https valido: "${url}"`);

const OPZIONI = {
  errorCorrectionLevel: 'M', // recupera fino a circa il 15% di danni
  margin: 4,                 // quiet zone di 4 moduli, come richiesto dallo standard
  color: { dark: '#000000', light: '#ffffff' }, // scuro su chiaro, alto contrasto anche nel tema scuro
};

const qr = QRCode.create(url, { errorCorrectionLevel: OPZIONI.errorCorrectionLevel });
if (qr.errorCorrectionLevel.bit !== 0) throw new Error('Livello di correzione errori diverso da M'); // M = 00 nello standard

let svg = await QRCode.toString(url, { ...OPZIONI, type: 'svg' });
// Titolo e descrizione per chi usa il file da solo; la pagina ha comunque il proprio testo alternativo
svg = svg.replace('<svg ', `<svg role="img" aria-label="QR code: ${url}" `);
const uscita = join(RADICE, 'qr-donazione.svg');
await writeFile(uscita, svg.endsWith('\n') ? svg : `${svg}\n`);

console.log(`qr-donazione.svg scritto (${svg.length} byte)`);
console.log(`  contenuto: ${url}`);
console.log(`  versione ${qr.version}, ${qr.modules.size}×${qr.modules.size} moduli, correzione errori M, margine ${OPZIONI.margin} moduli`);
