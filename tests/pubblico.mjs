// Gli stessi controlli, sul sito realmente pubblicato.  Uso:  node pubblico.mjs [indirizzo]
import { controlla, SITO_ATTESO } from './controlli-sito.mjs';
const base = process.argv[2] || process.env.SITO || SITO_ATTESO;
console.log(`Sito pubblico: ${base}`);
const ko = await controlla(base, { pubblico: true, shots: process.env.SHOTS || '.' });
console.log(ko ? `${ko} FALLITI` : 'TUTTO OK'); process.exit(ko ? 1 : 0);
