// Lingua per le pagine statiche (privacy.html): stessa scelta dell'app (salvata, altrimenti quella del browser),
// stessi testi di testi.js. Sostituisce data-t, data-t-html e il titolo, e permette di cambiare lingua.
(() => {
  'use strict';
  const salvata = () => {
    try { return JSON.parse(localStorage.getItem('etr.impostazioni') || '{}').lingua; } catch { return null; }
  };
  function linguaIniziale() {
    if (LINGUE[salvata()]) return salvata();
    const richieste = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const r of richieste) {
      const codice = String(r).toLowerCase().split('-')[0];
      if (LINGUE[codice]) return codice;
    }
    return 'en';
  }

  let lingua = linguaIniziale();
  const t = (chiave, ...argomenti) => {
    const v = chiave in LINGUE[lingua] ? LINGUE[lingua][chiave] : LINGUE.it[chiave];
    return typeof v === 'function' ? v(...argomenti) : v;
  };

  function applica() {
    document.documentElement.lang = t('meta.lang');
    document.title = `${t('app.titolo')} – ${t(document.body.dataset.titolo)}`;
    document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
    document.querySelectorAll('[data-t-html]').forEach((e) => { e.innerHTML = t(e.dataset.tHtml); });
    document.querySelectorAll('[data-t-attr]').forEach((e) => {
      e.dataset.tAttr.split(';').forEach((coppia) => { const [a, k] = coppia.split('='); e.setAttribute(a, t(k)); });
    });
    document.querySelectorAll('time[datetime]').forEach((e) => {
      const data = new Date(`${e.getAttribute('datetime')}T12:00:00`).toLocaleDateString(t('meta.locale'), { dateStyle: 'long' });
      e.textContent = t('privacy.aggiornato', data);
    });
    selettore.value = lingua;
  }

  const selettore = document.getElementById('lingua');
  Object.entries(LINGUE).forEach(([codice, testi]) => {
    const o = document.createElement('option');
    o.value = codice; o.textContent = testi['meta.nome']; o.lang = testi['meta.lang'];
    selettore.append(o);
  });
  selettore.addEventListener('change', () => {
    if (!LINGUE[selettore.value]) return;
    lingua = selettore.value;
    // la scelta vale anche per l'app, che la legge dalle stesse impostazioni
    try {
      const imp = JSON.parse(localStorage.getItem('etr.impostazioni') || '{}');
      imp.lingua = lingua;
      localStorage.setItem('etr.impostazioni', JSON.stringify(imp));
    } catch { /* senza localStorage la scelta vale solo per questa pagina */ }
    applica();
  });
  applica();
})();
