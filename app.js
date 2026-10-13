(() => {
  'use strict';

  // Donazione volontaria: l'app è e resta gratuita. Se vuoto o non https, pulsante e QR sono nascosti.
  // Se cambi il link rigenera il QR:  cd tools && npm run qr
  const DONATE_URL = 'https://www.paypal.me/andreieni';

  /* ================= Configurazione ================= */

  // Esercizi e tracciati: solo identificativi; i nomi visibili sono in testi.js ('es.*', 'tr.*')
  const ESERCIZI = ['orizzontale', 'verticale', 'cerchio', 'ellisse', 'otto', 'zigzag', 'saccadi', 'misto'];
  // Tracciati che si possono combinare nell'esercizio Misto (eseguiti in ordine casuale)
  const TRACCIATI = ['orizzontale', 'verticale', 'diagonale_su', 'diagonale_giu', 'cerchio', 'ellisse', 'otto', 'zigzag', 'saccadi'];
  const ZIGZAG_SCATTI = 6;                 // inversioni verticali in ogni passata orizzontale (pari)
  // Modalità lettere (facoltativa): sul bersaglio compaiono le lettere di una frase (testi.js, 'frasi'), una alla volta
  const PASSI_LETTERE = [1, 1.5, 2];       // secondi tra una lettera e la successiva
  const DIAMETRO_MIN_LETTERE = 48;         // sotto questa misura le lettere non si leggono
  // Dimensione variabile (facoltativa): il diametro oscilla lentamente tra un minimo e un massimo scelti
  const PERIODO_DIMENSIONE = 10;           // secondi per un ciclo completo (ingrandisce e rimpicciolisce)
  const DIAMETRO_MIN = 12;
  const DIAMETRO_MAX = 80;
  // Modalità bambino (facoltativa): il bersaglio è un razzo e a fine esercizio c'è una domanda creativa ('domande')
  const DIAMETRO_MIN_BAMBINO = 64;         // sotto questa misura il razzo non si riconosce
  const MAX_IDEE = 20;
  const CAMBI = [10, 20, 30];              // durata media di un tracciato nel Misto (varia a caso da 0,5× a 1,5×)

  // Velocità in gradi al secondo dell'occhio (non in pixel): lo stesso livello è uguale su ogni schermo
  const DISTANZE = [40, 50, 60, 70];       // cm tra occhi e schermo
  const CM_PER_PX_STIMA = 2.54 / 96;       // dimensione nominale di un pixel CSS, se lo schermo non è calibrato
  const CARTA = { larghezza: 8.56, altezza: 5.398 }; // carta di credito / tessera sanitaria, in cm
  const AMPIEZZA_MAX_GRADI = 20;           // oltre ±20° dal centro servirebbe girare la testa
  const DURATE = [2, 3, 5, 10];            // minuti ammessi (massimo 10)
  const SALTO_PROGRESSIVO = 30;            // secondi per salire di un livello
  const CONTO_ALLA_ROVESCIA = 3;           // secondi prima di partire
  const SOGLIA_SALVATAGGIO = 10;           // sotto questi secondi una sessione fermata non viene salvata
  const DT_MAX = 0.25;                     // tetto al delta-time di un frame (secondi)
  const GIORNI_GRAFICO = 14;

  const CHIAVI = {
    sessioni: 'etr.sessioni',
    impostazioni: 'etr.impostazioni',
    avviso: 'etr.avvisoLetto',
    riposo: 'etr.riposoFino',
    percorso: 'etr.percorso',
  };

  // Percorso a livelli: dal facile al difficile. La difficoltà cresce con velocità più alta, bersaglio
  // più piccolo, sessioni più lunghe e modalità progressiva (parte da 1 e sale fino a `velocita`).
  // Nomi dei mondi e dei livelli: testi.js ('mondi', 'livelli'), nello stesso ordine.
  const LIVELLI = [
    { mondo: 0, esercizio: 'orizzontale', velocita: 1, dimensione: 56, durata: 2 },
    { mondo: 0, esercizio: 'verticale', velocita: 1, dimensione: 56, durata: 2 },
    { mondo: 0, esercizio: 'orizzontale', velocita: 2, dimensione: 48, durata: 2 },
    { mondo: 0, esercizio: 'cerchio', velocita: 1, dimensione: 56, durata: 2 },
    { mondo: 1, esercizio: 'verticale', velocita: 3, dimensione: 40, durata: 3 },
    { mondo: 1, esercizio: 'cerchio', velocita: 3, dimensione: 40, durata: 3 },
    { mondo: 1, esercizio: 'otto', velocita: 2, dimensione: 48, durata: 3 },
    { mondo: 1, esercizio: 'saccadi', velocita: 2, dimensione: 48, durata: 2 },
    { mondo: 2, esercizio: 'otto', velocita: 4, dimensione: 36, durata: 3 },
    { mondo: 2, esercizio: 'saccadi', velocita: 4, dimensione: 40, durata: 3 },
    { mondo: 2, esercizio: 'cerchio', velocita: 5, dimensione: 32, durata: 3, progressiva: true },
    { mondo: 2, esercizio: 'orizzontale', velocita: 6, dimensione: 28, durata: 5, progressiva: true },
    { mondo: 3, esercizio: 'otto', velocita: 7, dimensione: 26, durata: 5, progressiva: true },
    { mondo: 3, esercizio: 'saccadi', velocita: 7, dimensione: 24, durata: 5, progressiva: true },
    { mondo: 3, esercizio: 'otto', velocita: 7, dimensione: 22, durata: 5 },
  ].map((l, i) => ({ progressiva: false, ...l, id: i + 1 }));
  const NUMERO_MONDI = 4;

  // Lingua: quella salvata, altrimenti la prima del browser tra quelle disponibili, altrimenti l'inglese
  function linguaPredefinita() {
    const richieste = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const r of richieste) {
      const codice = String(r).toLowerCase().split('-')[0];
      if (LINGUE[codice]) return codice;
    }
    return 'en';
  }

  const BASE = {
    esercizio: 'orizzontale', velocita: 3, dimensione: 32, durata: 3, progressiva: false, tema: 'dark',
    misto: ['orizzontale', 'verticale', 'cerchio', 'otto'], cambio: 20,
    lettere: false, passoLettere: 1.5, dimensioneVariabile: false, dimMin: 16, dimMax: 48, bambino: false,
    distanza: 60, cmPerPx: null, opzioniAperte: false, lingua: null,
  };

  /* ================= Utilità ================= */

  const $ = (id) => document.getElementById(id);
  const limita = (v, min, max) => Math.min(max, Math.max(min, v));

  function mmss(secondi) {
    const s = Math.max(0, Math.ceil(secondi));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function chiaveGiorno(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const gg = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${gg}`;
  }

  // localStorage può essere bloccato (navigazione privata, file:// in alcuni browser)
  const deposito = {
    leggi(chiave, predefinito) {
      try {
        const v = localStorage.getItem(chiave);
        return v === null ? predefinito : JSON.parse(v);
      } catch { return predefinito; }
    },
    scrivi(chiave, valore) {
      try { localStorage.setItem(chiave, JSON.stringify(valore)); return true; } catch { return false; }
    },
    rimuovi(chiave) {
      try { localStorage.removeItem(chiave); } catch { /* niente da fare */ }
    },
  };

  /* ================= Impostazioni ================= */

  function pulisciImpostazioni(grezze) {
    const o = { ...BASE, ...(grezze && typeof grezze === 'object' ? grezze : {}) };
    if (!ESERCIZI.includes(o.esercizio)) o.esercizio = BASE.esercizio;
    o.velocita = limita(Math.round(+o.velocita) || BASE.velocita, 1, 10);
    o.dimensione = limita(Math.round(+o.dimensione) || BASE.dimensione, DIAMETRO_MIN, DIAMETRO_MAX);
    o.durata = DURATE.includes(+o.durata) ? +o.durata : BASE.durata;
    o.progressiva = o.progressiva === true;
    o.tema = o.tema === 'light' ? 'light' : 'dark';
    o.misto = Array.isArray(o.misto) ? TRACCIATI.filter((t) => o.misto.includes(t)) : [...BASE.misto];
    o.cambio = CAMBI.includes(+o.cambio) ? +o.cambio : BASE.cambio;
    o.lettere = o.lettere === true;
    o.dimensioneVariabile = o.dimensioneVariabile === true;
    o.dimMin = limita(Math.round(+o.dimMin) || BASE.dimMin, DIAMETRO_MIN, DIAMETRO_MAX);
    o.dimMax = limita(Math.round(+o.dimMax) || BASE.dimMax, DIAMETRO_MIN, DIAMETRO_MAX);
    if (o.dimMin > o.dimMax) o.dimMax = o.dimMin;
    o.bambino = o.bambino === true;
    if (o.bambino) o.lettere = false; // le due modalità non si combinano
    o.passoLettere = PASSI_LETTERE.includes(+o.passoLettere) ? +o.passoLettere : BASE.passoLettere;
    o.distanza = DISTANZE.includes(+o.distanza) ? +o.distanza : BASE.distanza;
    o.cmPerPx = +o.cmPerPx >= 0.01 && +o.cmPerPx <= 0.06 ? +o.cmPerPx : null; // null = non calibrato
    o.lingua = LINGUE[o.lingua] ? o.lingua : linguaPredefinita();
    o.opzioniAperte = o.opzioniAperte === true;
    return o;
  }

  let impostazioni = pulisciImpostazioni(deposito.leggi(CHIAVI.impostazioni, {}));
  const salvaImpostazioni = () => deposito.scrivi(CHIAVI.impostazioni, impostazioni);

  /* ================= Lingua ================= */

  // Testo nella lingua scelta (con ripiego sull'italiano); le funzioni ricevono gli argomenti
  function t(chiave, ...argomenti) {
    const testi = LINGUE[impostazioni.lingua] || LINGUE.it;
    const valore = chiave in testi ? testi[chiave] : LINGUE.it[chiave];
    return typeof valore === 'function' ? valore(...argomenti) : valore;
  }
  const locale = () => t('meta.locale');
  const numero = (n) => Number(n).toLocaleString(locale());
  const nomeEsercizio = (id) => t(`es.${id}`);
  const nomeTracciato = (id) => t(`tr.${id}`);
  const nomeLivello = (l) => t('livelli')[l.id - 1];
  const scegliACaso = (elenco) => elenco[Math.floor(Math.random() * elenco.length)];

  /* ================= Movimento (funzioni pure) ================= */

  // Velocità di picco dello sguardo negli inseguimenti: da 5,5°/s (livello 1) a 28°/s (livello 10),
  // sotto il limite oltre il quale l'occhio non insegue più in modo fluido
  const velocitaAngolare = (livello) => 3 + 2.5 * livello;
  // Secondi tra un salto e l'altro nelle saccadi: ~3 s (livello 1) -> 0,8 s (livello 10)
  const intervalloSaccadi = (velocita) => 3.2 - 0.24 * velocita;

  // Onda triangolare tra -1 e 1 con periodo 2π: segmenti dritti e inversioni nette
  const onda = (fase) => (2 / Math.PI) * Math.asin(Math.sin(fase));

  // Semiassi dell'ellisse: sempre più larga che alta, così non diventa mai un cerchio
  const semiassiEllisse = (g) => ({ a: g.mezzaL, b: Math.min(g.mezzaA, g.mezzaL * 0.55) });

  // Pixel percorsi per ogni radiante di fase nel punto più veloce del tracciato.
  // Dividendo la velocità voluta (px/s) per questo valore si ottiene quanto deve avanzare la fase.
  function lunghezzaDiFase(tracciato, g) {
    switch (tracciato) {
      case 'orizzontale': return g.mezzaL;
      case 'verticale': return g.mezzaA;
      case 'diagonale_su':
      case 'diagonale_giu': return Math.hypot(g.mezzaL, g.mezzaA);
      case 'cerchio': return Math.min(g.mezzaL, g.mezzaA);
      case 'ellisse': return semiassiEllisse(g).a;
      case 'otto': return 2 * Math.SQRT2 * Math.min(g.mezzaA, g.mezzaL / 2); // al centro dell'incrocio
      case 'zigzag': return (2 / Math.PI) * Math.hypot(g.mezzaL, ZIGZAG_SCATTI * g.mezzaA); // velocità costante
      default: return 1;
    }
  }

  /**
   * Posizione in pixel del bersaglio. `g` è l'area utile (centro e semi-assi),
   * `fase` in radianti per gli inseguimenti, `punto` normalizzato (-1..1) per le saccadi.
   */
  function posizioneBersaglio(tracciato, g, fase, punto) {
    switch (tracciato) {
      case 'orizzontale':
        return { x: g.cx + Math.sin(fase) * g.mezzaL, y: g.cy };
      case 'verticale':
        return { x: g.cx, y: g.cy + Math.sin(fase) * g.mezzaA };
      case 'diagonale_su': // da in basso a sinistra a in alto a destra
        return { x: g.cx + Math.sin(fase) * g.mezzaL, y: g.cy - Math.sin(fase) * g.mezzaA };
      case 'diagonale_giu': // da in alto a sinistra a in basso a destra
        return { x: g.cx + Math.sin(fase) * g.mezzaL, y: g.cy + Math.sin(fase) * g.mezzaA };
      case 'cerchio': {
        const r = Math.min(g.mezzaL, g.mezzaA);
        return { x: g.cx + Math.cos(fase) * r, y: g.cy + Math.sin(fase) * r };
      }
      case 'ellisse': {
        const { a, b } = semiassiEllisse(g);
        return { x: g.cx + Math.cos(fase) * a, y: g.cy + Math.sin(fase) * b };
      }
      case 'zigzag': // passata orizzontale lenta con inversioni verticali nette
        return { x: g.cx + onda(fase) * g.mezzaL, y: g.cy + onda(ZIGZAG_SCATTI * fase) * g.mezzaA };
      case 'otto': {
        // Lissajous 1:2, sempre in proporzione 2:1 per restare un otto
        const b = Math.min(g.mezzaA, g.mezzaL / 2);
        return { x: g.cx + Math.sin(fase) * 2 * b, y: g.cy + Math.sin(2 * fase) * b };
      }
      default: // saccadi
        return { x: g.cx + punto.x * g.mezzaL, y: g.cy + punto.y * g.mezzaA };
    }
  }

  // Nuovo punto casuale (coordinate normalizzate) ad almeno il 40% del lato corto dal precedente
  function nuovoPunto(g, precedente) {
    const distMin = 0.4 * 2 * Math.min(g.mezzaL, g.mezzaA);
    for (let i = 0; i < 100; i++) {
      const p = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
      const d = Math.hypot((p.x - precedente.x) * g.mezzaL, (p.y - precedente.y) * g.mezzaA);
      if (d >= distMin) return p;
    }
    return { x: precedente.x > 0 ? -1 : 1, y: precedente.y > 0 ? -1 : 1 }; // angolo opposto
  }

  /* ================= Elementi DOM ================= */

  const el = {
    tabs: document.querySelectorAll('.tab'),
    vistaAllenamento: $('vista-allenamento'),
    vistaProgressi: $('vista-progressi'),
    vistaPercorso: $('vista-percorso'),
    percorsoElenco: $('percorso-elenco'),
    percorsoConteggio: $('percorso-conteggio'),
    percorsoBarra: $('percorso-barra'),
    btnAzzeraPercorso: $('btn-azzera-percorso'),
    btnTema: $('btn-tema'),
    lingua: $('lingua'),
    form: $('impostazioni'),
    velocita: $('velocita'),
    velocitaVal: $('velocita-val'),
    etichettaVelocita: $('etichetta-velocita'),
    dimensione: $('dimensione'),
    dimensioneVariabile: $('dimensione-variabile'),
    campoDimensione: $('campo-dimensione'),
    opzioniDimensione: $('opzioni-dimensione-variabile'),
    dimMin: $('dimensione-min'),
    dimMax: $('dimensione-max'),
    dimMinVal: $('dimensione-min-val'),
    dimMaxVal: $('dimensione-max-val'),
    anteprimaMin: $('anteprima-min'),
    anteprimaMax: $('anteprima-max'),
    dimensioneVal: $('dimensione-val'),
    anteprima: $('anteprima-bersaglio'),
    durata: $('durata'),
    opzioniMisto: $('opzioni-misto'),
    cambio: $('cambio'),
    progressiva: $('progressiva'),
    btnAvvia: $('btn-avvia'),
    avvisoMovimento: $('avviso-movimento'),
    bloccoRiposo: $('blocco-riposo'),
    bloccoRiposoTesto: $('blocco-riposo-testo'),
    esito: $('esito'),
    palco: $('palco'),
    canvas: $('canvas'),
    hud: $('hud'),
    hudEsercizio: $('hud-esercizio'),
    hudTempo: $('hud-tempo'),
    hudVelocita: $('hud-velocita'),
    hudBarra: $('hud-barra'),
    btnPausa: $('btn-pausa'),
    btnSchermoIntero: $('btn-schermo-intero'),
    btnFerma: $('btn-ferma'),
    ovConto: $('ov-conto'),
    contoNumero: $('conto-numero'),
    ovPausa: $('ov-pausa'),
    btnRiprendi: $('btn-riprendi'),
    btnFermaPausa: $('btn-ferma-pausa'),
    ovRiposo: $('ov-riposo'),
    riposoTitolo: $('riposo-titolo'),
    riposoTempo: $('riposo-tempo'),
    riposoTesto: $('riposo-testo'),
    riposoFrase: $('riposo-frase'),
    ovIndovina: $('ov-indovina'),
    formFrase: $('form-frase'),
    fraseAiuto: $('frase-aiuto'),
    rispostaFrase: $('risposta-frase'),
    btnSaltaFrase: $('btn-salta-frase'),
    bambino: $('bambino'),
    ovIdee: $('ov-idee'),
    formIdee: $('form-idee'),
    domandaIdee: $('domanda-idee'),
    nuovaIdea: $('nuova-idea'),
    elencoIdee: $('elenco-idee'),
    contatoreIdee: $('contatore-idee'),
    avvisoIdee: $('avviso-idee'),
    btnFattoIdee: $('btn-fatto-idee'),
    btnIdeaVoce: $('btn-idea-voce'),
    opzioniFacoltative: $('opzioni-facoltative'),
    opzioniAttive: $('opzioni-attive'),
    distanza: $('distanza'),
    carta: $('carta'),
    cartaRettangolo: $('carta-rettangolo'),
    larghezzaSchermo: $('larghezza-schermo'),
    btnRipristinaCalibrazione: $('btn-ripristina-calibrazione'),
    lettere: $('lettere'),
    opzioniLettere: $('opzioni-lettere'),
    passoLettere: $('passo-lettere'),
    btnEsciRiposo: $('btn-esci-riposo'),
    dlgAvviso: $('dlg-avviso'),
    dlgMovimento: $('dlg-movimento'),
    dlgCancella: $('dlg-cancella'),
    dlgAzzera: $('dlg-azzera'),
    totMinuti: $('tot-minuti'),
    totSessioni: $('tot-sessioni'),
    grafico: $('grafico'),
    tabella: $('tabella-sessioni'),
    nessunaSessione: $('nessuna-sessione'),
    btnCancella: $('btn-cancella'),
    annunci: $('annunci'),
  };
  const ctx = el.canvas.getContext('2d');

  function annuncia(testo) {
    el.annunci.textContent = '';
    // il ritardo minimo fa rileggere il messaggio anche se uguale al precedente
    setTimeout(() => { el.annunci.textContent = testo; }, 50);
  }

  /* ================= Tema e colori ================= */

  let colori = {};

  function leggiColori() {
    const stile = getComputedStyle(document.documentElement);
    const v = (nome) => stile.getPropertyValue(nome).trim();
    colori = {
      bersaglio: v('--bersaglio'), nucleo: v('--nucleo'), barra: v('--barra'), barra2: v('--barra-2'),
      griglia: v('--griglia'), testo: v('--testo'), attenuato: v('--attenuato'),
    };
  }

  function applicaTema() {
    document.documentElement.dataset.theme = impostazioni.tema;
    el.btnTema.textContent = impostazioni.tema === 'dark' ? t('tema.chiaro') : t('tema.scuro');
    leggiColori();
    if (!el.vistaProgressi.hidden) disegnaProgressi();
  }

  /* ================= Sessione ================= */

  // stato: 'fermo' | 'conto' | 'in_corso' | 'pausa' | 'indovina' | 'idee' | 'riposo'
  let stato = 'fermo';
  let sessione = null;
  let idCiclo = null;
  let ultimoTs = null;
  let larghezza = 0;
  let altezza = 0;
  let idRiposo = null;
  let fineRiposo = 0;
  let uscitaSchermoInteroVolontaria = false;

  // Un livello del percorso ha la sua dimensione, senza toccare le impostazioni libere
  const dimensioneBersaglio = () => (sessione ? sessione.dimensione : impostazioni.dimensione);
  // Distanza massima dal centro: il razzo (con la fiamma) ingombra più di un cerchio
  const ingombroBersaglio = () => dimensioneBersaglio() * (sessione && sessione.bambino ? 0.95 : 0.5);

  // Il bersaglio può usare tutto lo schermo, fino a poco dal bordo (la barra dei comandi è sotto al canvas)
  const MARGINE_BORDO = 12;

  const cmPerPx = () => impostazioni.cmPerPx || CM_PER_PX_STIMA;
  // Pixel per grado di rotazione dell'occhio vicino al centro dello schermo
  const pxPerGrado = () => (impostazioni.distanza * Math.PI / 180) / cmPerPx();

  function geometria() {
    const margine = ingombroBersaglio() + MARGINE_BORDO;
    const ampiezzaMax = AMPIEZZA_MAX_GRADI * pxPerGrado(); // su schermi grandi il percorso non va oltre ±20°
    return {
      cx: larghezza / 2,
      cy: altezza / 2,
      mezzaL: Math.max(10, Math.min(larghezza / 2 - margine, ampiezzaMax)),
      mezzaA: Math.max(10, Math.min(altezza / 2 - margine, ampiezzaMax)),
    };
  }

  function misura() {
    const r = el.palco.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    larghezza = r.width;
    altezza = r.height;
    el.canvas.width = Math.round(larghezza * dpr);
    el.canvas.height = Math.round(altezza * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function mostraOverlay(nome) {
    el.ovConto.hidden = nome !== 'conto';
    el.ovPausa.hidden = nome !== 'pausa';
    el.ovRiposo.hidden = nome !== 'riposo';
    el.ovIndovina.hidden = nome !== 'indovina';
    el.ovIdee.hidden = nome !== 'idee';
  }

  function aggiornaHud() {
    const s = sessione;
    el.hudTempo.textContent = mmss(s.durata - s.trascorso);
    el.hudVelocita.textContent = `${s.velocita}${s.progressiva ? ` / ${s.velocitaMax}` : ''}`;
    el.hudBarra.style.width = `${(100 * s.trascorso) / s.durata}%`;
  }

  function aggiornaTitoloHud(livello) {
    const s = sessione;
    const parti = [];
    if (s.livello) {
      const l = livello || LIVELLI.find((x) => x.id === s.livello);
      parti.push(`${t('livello', l.id)} · ${nomeLivello(l)}`);
    }
    parti.push(nomeEsercizio(s.esercizio));
    // durante il passaggio si mostra già il tracciato in arrivo
    if (s.esercizio === 'misto') parti.push(nomeTracciato(s.transizione ? s.sequenza[s.transizione.indice] : s.tracciato));
    el.hudEsercizio.textContent = parti.join(' · ');
  }

  // `livello` = voce di LIVELLI, oppure null per l'allenamento libero (usa le impostazioni)
  function avviaSessione(livello) {
    const p = livello || impostazioni;
    const misto = p.esercizio === 'misto';
    const sequenza = misto ? p.misto : [p.esercizio];
    const lettere = p.lettere === true;
    const bambino = p.bambino === true;
    // Con le lettere o il razzo il bersaglio non scende sotto il diametro minimo riconoscibile
    const minimoDiametro = lettere ? DIAMETRO_MIN_LETTERE : bambino ? DIAMETRO_MIN_BAMBINO : 0;
    const variabile = p.dimensioneVariabile === true;
    const dMin = Math.max(variabile ? p.dimMin : p.dimensione, minimoDiametro);
    const dMax = Math.max(variabile ? p.dimMax : p.dimensione, minimoDiametro);
    // Nel Misto anche il primo tracciato, il punto di partenza e il verso sono a caso
    const primo = misto ? Math.floor(Math.random() * sequenza.length) : 0;
    const cambio = p.cambio || BASE.cambio;
    const frase = lettere ? scegliACaso(t('frasi')) : '';
    sessione = {
      livello: livello ? livello.id : null,
      esercizio: p.esercizio,
      sequenza,                 // tracciati disponibili (uno solo fuori dal Misto)
      indice: primo,
      tracciato: sequenza[primo], // tracciato in corso
      cambio,
      durataSegmento: misto ? durataCasuale(cambio) : Infinity,
      tSegmento: 0,
      verso: misto ? versoCasuale() : 1,
      transizione: null,        // { da, a, t, durata, indice } mentre si passa a un altro tracciato
      dimensioneMin: dMin,
      dimensioneMax: dMax,
      dimensione: dMin, // diametro attuale: se è variabile parte dal minimo
      dimensioneVariabile: variabile && dMax > dMin,
      tDimensione: 0,
      lettere,
      bambino,
      domanda: bambino ? scegliACaso(t('domande')) : '',
      idee: [],
      ideeVoce: 0,
      borsa: [],                // Misto: tracciati ancora da fare nel giro in corso
      stelle: bambino ? Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, a: 0.25 + Math.random() * 0.5 })) : [],
      angolo: 0,
      ultimaPos: null,
      tFiamma: 0,
      frase,
      simboli: lettere ? simboliFrase(frase) : [],
      indiceLettera: 0,
      tLettera: 0,
      passoLettera: p.passoLettere || BASE.passoLettere,
      velocitaMax: p.velocita,
      velocita: p.progressiva ? 1 : p.velocita,
      progressiva: p.progressiva,
      durata: p.durata * 60,
      trascorso: 0,
      fase: misto ? faseCasuale() : 0,
      tSaccade: 0,
      punto: { x: 0, y: 0 },
      conto: CONTO_ALLA_ROVESCIA,
    };
    stato = 'conto';
    document.body.classList.add('in-sessione');
    el.palco.hidden = false;
    el.hud.hidden = false;
    aggiornaTitoloHud(livello);
    el.btnPausa.textContent = t('pausa');
    mostraOverlay('conto');
    misura();
    aggiornaHud();
    el.contoNumero.textContent = String(CONTO_ALLA_ROVESCIA);
    mostraComandi(false);
    el.palco.focus();
    annuncia(t('annuncio.inizio', nomeEsercizio(sessione.esercizio), CONTO_ALLA_ROVESCIA));
    avviaCiclo();
  }

  function iniziaEsercizio() {
    stato = 'in_corso';
    mostraOverlay(null);
    nascondiComandi();
    annuncia(t('annuncio.via'));
  }

  function impostaPausa(inPausa) {
    if (inPausa && stato === 'in_corso') {
      stato = 'pausa';
      mostraComandi(false);
      mostraOverlay('pausa');
      el.btnPausa.textContent = t('riprendi');
      el.btnRiprendi.focus();
      annuncia(t('annuncio.pausa'));
    } else if (!inPausa && stato === 'pausa') {
      stato = 'in_corso';
      mostraOverlay(null);
      el.btnPausa.textContent = t('pausa');
      el.palco.focus(); // lo Spazio deve continuare a funzionare dopo la ripresa
      nascondiComandi();
      ultimoTs = null; // niente salto di tempo dopo la pausa
      annuncia(t('annuncio.ripresa'));
    }
  }

  const alternaPausa = () => impostaPausa(stato === 'in_corso');

  function aggiorna(dt) {
    const s = sessione;
    if (stato === 'conto') {
      s.conto -= dt;
      if (s.conto <= 0) iniziaEsercizio();
      else el.contoNumero.textContent = String(Math.ceil(s.conto));
    } else if (stato === 'in_corso') {
      s.trascorso += dt;
      if (s.progressiva) s.velocita = Math.min(s.velocitaMax, 1 + Math.floor(s.trascorso / SALTO_PROGRESSIVO));
      if (s.lettere) avanzaLettera(dt);
      if (s.dimensioneVariabile) avanzaDimensione(dt);
      if (s.transizione) avanzaTransizione(dt);
      else {
        if (s.tracciato === 'saccadi') avanzaSaccadi(dt);
        else {
          s.fase += s.verso * velocitaDiFase(s.tracciato, geometria(), s.velocita) * dt; // la fase evita scatti se cambia la velocità
        }
        if (s.sequenza.length > 1) {
          s.tSegmento += dt;
          if (s.tSegmento >= s.durataSegmento) iniziaTransizione();
        }
      }
      if (s.trascorso >= s.durata) { s.trascorso = s.durata; terminaSessione(); return; }
      aggiornaHud();
    }
  }

  function avanzaSaccadi(dt) {
    const s = sessione;
    s.tSaccade += dt;
    if (s.tSaccade >= intervalloSaccadi(s.velocita)) {
      s.tSaccade = 0;
      s.punto = nuovoPunto(geometria(), s.punto);
    }
  }

  // Radianti di fase al secondo per avere la velocità angolare del livello su questo tracciato
  function velocitaDiFase(tracciato, g, livello) {
    return (velocitaAngolare(livello) * pxPerGrado()) / Math.max(1, lunghezzaDiFase(tracciato, g));
  }

  /* ---------- Misto: passaggi imprevedibili da un tracciato all'altro ---------- */

  const durataCasuale = (media) => media * (0.5 + Math.random()); // da metà a una volta e mezzo la media
  const versoCasuale = () => (Math.random() < 0.5 ? -1 : 1);
  const faseCasuale = () => Math.random() * 2 * Math.PI;

  function mescola(elenco) {
    const copia = [...elenco];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  // Prossimo tracciato: a giri, ognuno in ordine casuale. Così l'ordine resta imprevedibile ma nessun
  // tracciato scelto viene saltato, e non si ripete mai quello appena fatto.
  function prossimoIndice(s) {
    if (s.sequenza.length < 2) return s.indice;
    if (!s.borsa.length) s.borsa = mescola(s.sequenza.map((_, i) => i).filter((i) => i !== s.indice));
    return s.borsa.pop();
  }

  const dolce = (k) => k * k * (3 - 2 * k); // partenza e arrivo morbidi

  function posizioneAttuale(g) {
    const s = sessione;
    if (s.transizione) {
      const { da, a, t, durata } = s.transizione;
      const k = dolce(limita(t / durata, 0, 1));
      return { x: da.x + (a.x - da.x) * k, y: da.y + (a.y - da.y) * k };
    }
    return posizioneBersaglio(s.tracciato, g, s.fase, s.punto);
  }

  // Il bersaglio scivola dalla posizione attuale a un punto a caso del tracciato successivo,
  // senza salti, a una velocità paragonabile a quella dell'inseguimento
  function iniziaTransizione() {
    const s = sessione;
    const g = geometria();
    const da = posizioneAttuale(g);
    const indice = prossimoIndice(s);
    const prossimo = s.sequenza[indice];
    const fase = faseCasuale();
    const a = prossimo === 'saccadi' ? da : posizioneBersaglio(prossimo, g, fase, s.punto);
    const velocitaPx = 0.7 * velocitaAngolare(s.velocita) * pxPerGrado();
    const durata = limita(Math.hypot(a.x - da.x, a.y - da.y) / velocitaPx, 0.5, 3);
    s.transizione = { da, a, t: 0, durata, indice, fase, verso: versoCasuale() };
    aggiornaTitoloHud();
  }

  function avanzaTransizione(dt) {
    const s = sessione;
    s.transizione.t += dt;
    if (s.transizione.t < s.transizione.durata) return;
    const { a, indice, fase, verso } = s.transizione;
    s.indice = indice;
    s.tracciato = s.sequenza[indice];
    s.fase = fase;
    s.verso = verso;
    s.tSegmento = 0;
    s.durataSegmento = durataCasuale(s.cambio);
    s.tSaccade = 0;
    if (s.tracciato === 'saccadi') { // le saccadi ripartono dal punto in cui si trova il bersaglio
      const g = geometria();
      s.punto = { x: limita((a.x - g.cx) / g.mezzaL, -1, 1), y: limita((a.y - g.cy) / g.mezzaA, -1, 1) };
    }
    s.transizione = null;
    aggiornaTitoloHud();
  }

  /* ---------- Modalità lettere ---------- */

  // Le lettere della frase in maiuscolo; null = stacco tra una parola e l'altra (il bersaglio resta col solo punto).
  // Alla fine c'è uno stacco in più, così quando la frase ricomincia si capisce.
  // Grafemi = ciò che a schermo è un solo segno: una lettera accentata, un carattere cinese,
  // una sillaba devanagari con la sua vocale (es. "धी"). Spezzare i caratteri Unicode li romperebbe.
  function grafemi(testo) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return [...new Intl.Segmenter(locale(), { granularity: 'grapheme' }).segment(testo)].map((x) => x.segment);
    }
    return Array.from(testo);
  }
  const eLettera = (g) => /[\p{L}\p{N}]/u.test(g);

  function simboliFrase(frase) {
    const simboli = [];
    for (const g of grafemi(frase.toLocaleUpperCase(locale()))) {
      if (eLettera(g)) simboli.push(g);
      else if (simboli.length && simboli[simboli.length - 1] !== null) simboli.push(null);
    }
    if (simboli[simboli.length - 1] !== null) simboli.push(null);
    return simboli;
  }

  // Parole = gruppi di lettere separati da spazi o punteggiatura, come appaiono sul bersaglio
  function contaFrase(frase) {
    const simboli = simboliFrase(frase);
    return { lettere: simboli.filter((x) => x !== null).length, parole: simboli.filter((x) => x === null).length };
  }

  // Parte dal minimo, arriva al massimo a metà ciclo e torna al minimo: cambio fluido, senza scatti
  function avanzaDimensione(dt) {
    const s = sessione;
    s.tDimensione += dt;
    const k = (1 - Math.cos((2 * Math.PI * s.tDimensione) / PERIODO_DIMENSIONE)) / 2; // 0 → 1 → 0
    s.dimensione = s.dimensioneMin + (s.dimensioneMax - s.dimensioneMin) * k;
  }

  function avanzaLettera(dt) {
    const s = sessione;
    s.tLettera += dt;
    while (s.tLettera >= s.passoLettera) { s.tLettera -= s.passoLettera; s.indiceLettera += 1; }
  }

  // Confronto tollerante: maiuscole, accenti, spazi e punteggiatura non contano (in ogni alfabeto)
  const normalizza = (testo) => testo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');

  // Caratteri per tutti gli alfabeti dell'app: latino, cinese, devanagari
  const CARATTERI = 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Kohinoor Devanagari", "Nirmala UI", "Noto Sans Devanagari", sans-serif';

  function disegnaLettera(p, r) {
    const simbolo = sessione.simboli[sessione.indiceLettera % sessione.simboli.length];
    if (simbolo === null) return false;
    let corpo = Math.round(r * 1.25);
    ctx.font = `700 ${corpo}px ${CARATTERI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let m = ctx.measureText(simbolo);
    if (m.width > r * 1.5) { // segni larghi (cinese, sillabe devanagari): si rimpicciolisce per restare nel cerchio
      corpo = Math.floor((corpo * r * 1.5) / m.width);
      ctx.font = `700 ${corpo}px ${CARATTERI}`;
      m = ctx.measureText(simbolo);
    }
    ctx.fillStyle = colori.nucleo;
    ctx.fillText(simbolo, p.x, p.y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    return true;
  }

  /* ---------- Modalità bambino: il razzo ---------- */

  const COLORI_RAZZO = { corpo: '#f1f3f5', contorno: '#1b1f27', rosso: '#e5383b', vetro: '#4cc9f0', fiamma: '#ff6b00', nucleoFiamma: '#ffd60a' };
  const angoloPiuCorto = (da, a) => Math.atan2(Math.sin(a - da), Math.cos(a - da)); // differenza tra -π e π

  function disegnaStelle() {
    ctx.fillStyle = impostazioni.tema === 'dark' ? '#ffffff' : '#7d93b8';
    sessione.stelle.forEach((st) => {
      ctx.globalAlpha = st.a;
      ctx.beginPath();
      ctx.arc(st.x * larghezza, st.y * altezza, st.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // Il razzo guarda dove sta andando: ruota in modo fluido, e di scatto quando salta (saccadi)
  function aggiornaAngolo(p, dt) {
    const s = sessione;
    if (stato === 'in_corso' && s.ultimaPos && dt > 0) {
      const dx = p.x - s.ultimaPos.x;
      const dy = p.y - s.ultimaPos.y;
      const passo = Math.hypot(dx, dy);
      if (passo > 0.3) {
        const voluto = Math.atan2(dy, dx) + Math.PI / 2; // 0 = muso in alto
        if (passo > 120) s.angolo = voluto;
        else s.angolo += angoloPiuCorto(s.angolo, voluto) * (1 - Math.exp(-dt * 10));
      }
    }
    s.ultimaPos = { x: p.x, y: p.y };
  }

  function disegnaRazzo(p, dt) {
    const s = sessione;
    aggiornaAngolo(p, dt);
    if (stato === 'in_corso') s.tFiamma += dt;
    const L = s.dimensione;     // lunghezza del corpo
    const W = L * 0.46;         // larghezza
    const tremolio = movimentoRidotto.matches ? 0 : 0.1 * Math.sin(s.tFiamma * 38) + 0.05 * Math.sin(s.tFiamma * 23);
    const fiamma = L * (0.34 + tremolio);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(s.angolo);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, L * 0.045);
    ctx.strokeStyle = COLORI_RAZZO.contorno;

    const triangolo = (x1, y1, x2, y2, x3, y3, colore) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
      ctx.fillStyle = colore; ctx.fill();
    };
    const coda = L / 2;
    triangolo(-W * 0.32, coda, W * 0.32, coda, 0, coda + fiamma, COLORI_RAZZO.fiamma);
    triangolo(-W * 0.17, coda, W * 0.17, coda, 0, coda + fiamma * 0.6, COLORI_RAZZO.nucleoFiamma);
    // alette
    [-1, 1].forEach((lato) => {
      ctx.beginPath();
      ctx.moveTo(lato * W / 2, L * 0.12);
      ctx.lineTo(lato * W * 0.98, coda + L * 0.06);
      ctx.lineTo(lato * W / 2, coda - L * 0.04);
      ctx.closePath();
      ctx.fillStyle = COLORI_RAZZO.rosso; ctx.fill(); ctx.stroke();
    });
    // corpo
    const corpo = new Path2D();
    corpo.moveTo(0, -L / 2);
    corpo.quadraticCurveTo(W * 0.62, -L * 0.22, W / 2, -L * 0.1);
    corpo.lineTo(W / 2, coda);
    corpo.lineTo(-W / 2, coda);
    corpo.lineTo(-W / 2, -L * 0.1);
    corpo.quadraticCurveTo(-W * 0.62, -L * 0.22, 0, -L / 2);
    corpo.closePath();
    ctx.fillStyle = COLORI_RAZZO.corpo; ctx.fill(corpo);
    // punta rossa
    ctx.beginPath();
    ctx.moveTo(0, -L / 2);
    ctx.quadraticCurveTo(W * 0.62, -L * 0.22, W / 2, -L * 0.1);
    ctx.lineTo(-W / 2, -L * 0.1);
    ctx.quadraticCurveTo(-W * 0.62, -L * 0.22, 0, -L / 2);
    ctx.closePath();
    ctx.fillStyle = COLORI_RAZZO.rosso; ctx.fill();
    ctx.stroke(corpo);
    // oblò
    ctx.beginPath();
    ctx.arc(0, L * 0.1, W * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = COLORI_RAZZO.vetro; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function disegna(dt = 0) {
    ctx.clearRect(0, 0, larghezza, altezza);
    if (!sessione || ['riposo', 'indovina', 'idee'].includes(stato)) return;
    if (sessione.bambino) disegnaStelle();
    const p = posizioneAttuale(geometria());
    if (sessione.bambino) { disegnaRazzo(p, dt); return; }
    const r = sessione.dimensione / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = colori.bersaglio;
    ctx.fill();
    if (sessione.lettere && disegnaLettera(p, r)) return;
    ctx.beginPath(); // nucleo scuro: punto di fissazione
    ctx.arc(p.x, p.y, Math.max(2, r * 0.28), 0, Math.PI * 2);
    ctx.fillStyle = colori.nucleo;
    ctx.fill();
  }

  function ciclo(ts) {
    idCiclo = requestAnimationFrame(ciclo);
    const dt = ultimoTs === null ? 0 : limita((ts - ultimoTs) / 1000, 0, DT_MAX);
    ultimoTs = ts;
    aggiorna(dt);
    disegna(dt);
  }

  function avviaCiclo() {
    if (idCiclo !== null) return;
    ultimoTs = null;
    idCiclo = requestAnimationFrame(ciclo);
  }

  function fermaCiclo() {
    if (idCiclo !== null) cancelAnimationFrame(idCiclo);
    idCiclo = null;
  }

  /* ---------- Salvataggio ---------- */

  function leggiSessioni() {
    const lista = deposito.leggi(CHIAVI.sessioni, []);
    return Array.isArray(lista) ? lista.filter((x) => x && typeof x.durata === 'number') : [];
  }

  function salvaSessione(secondi) {
    const ora = new Date();
    const lista = leggiSessioni();
    lista.push({
      data: chiaveGiorno(ora),
      ora: ora.toISOString(),
      esercizio: sessione.esercizio,
      velocita: sessione.velocita,
      durata: Math.round(secondi),
      progressiva: sessione.progressiva,
      livello: sessione.livello,
      lettere: sessione.lettere,
      bambino: sessione.bambino,
    });
    ultimaOra = ora.toISOString();
    return deposito.scrivi(CHIAVI.sessioni, lista);
  }

  // Dopo l'indovinello / le idee si aggiorna la sessione appena salvata
  let ultimaOra = '';
  function aggiornaUltimaSessione(campi) {
    const lista = leggiSessioni();
    const voce = lista.find((x) => x.ora === ultimaOra);
    if (!voce) return;
    Object.assign(voce, campi);
    deposito.scrivi(CHIAVI.sessioni, lista);
  }
  const salvaEsitoFrase = (indovinata) => aggiornaUltimaSessione({ indovinata });

  /* ---------- Fine, stop e riposo ---------- */

  let messaggioLivello = ''; // esito dell'ultimo livello completato, mostrato durante e dopo il riposo

  function terminaSessione() {
    const durata = sessione.durata;
    const salvata = salvaSessione(durata);
    messaggioLivello = sessione.livello ? completaLivello(sessione.livello) : '';
    deposito.scrivi(CHIAVI.riposo, Date.now() + durata * 1000); // blocco provvisorio, vale anche durante l'indovinello
    aggiornaBlocco();
    if (sessione.lettere) avviaIndovinello(durata, salvata);
    else if (sessione.bambino) avviaIdee(durata, salvata);
    else avviaRiposo(durata, salvata);
  }

  let esitoFinale = '';    // esito della frase o delle idee, mostrato nel riposo
  let pendente = null;    // { durata, salvata } tra la fine dell'esercizio e l'inizio del riposo

  function avviaIndovinello(durata, salvata) {
    const frase = sessione.frase;
    const { parole, lettere } = contaFrase(frase);
    pendente = { durata, salvata };
    stato = 'indovina';
    fermaCiclo();
    ctx.clearRect(0, 0, larghezza, altezza);
    el.hud.hidden = true;
    mostraComandi(false);
    mostraOverlay('indovina');
    el.fraseAiuto.textContent = t('frase.aiuto', parole, lettere);
    el.rispostaFrase.value = '';
    el.rispostaFrase.focus();
    annuncia(t('frase.annuncio'));
  }

  // risposta = testo scritto, oppure null se si salta
  function concludiIndovinello(risposta) {
    if (stato !== 'indovina') return;
    const frase = sessione.frase;
    const indovinata = risposta === null ? null : normalizza(risposta) === normalizza(frase);
    salvaEsitoFrase(indovinata);
    esitoFinale = indovinata === true ? t('frase.giusta', frase)
      : indovinata === false ? t('frase.sbagliata', frase) : t('frase.saltata', frase);
    avviaRiposo(pendente.durata, pendente.salvata);
  }

  /* ---------- Modalità bambino: pensiero divergente ---------- */

  function avviaIdee(durata, salvata) {
    pendente = { durata, salvata };
    stato = 'idee';
    fermaCiclo();
    ctx.clearRect(0, 0, larghezza, altezza);
    el.hud.hidden = true;
    mostraComandi(false);
    mostraOverlay('idee');
    el.domandaIdee.textContent = sessione.domanda;
    el.elencoIdee.textContent = '';
    el.avvisoIdee.textContent = '';
    el.nuovaIdea.value = '';
    aggiornaContatoreIdee();
    el.nuovaIdea.focus();
    annuncia(t('idee.annuncio', sessione.domanda));
  }

  function aggiornaContatoreIdee() {
    const n = sessione.idee.length;
    el.contatoreIdee.textContent = t('idee.contatore', n);
  }

  // Le idee ripetute non contano: si premia la varietà, non la quantità
  function aggiungiIdea(testo) {
    if (stato !== 'idee') return;
    const idea = testo.trim().slice(0, 60);
    if (!idea) return;
    const s = sessione;
    if (s.idee.some((x) => normalizza(x) === normalizza(idea))) {
      el.avvisoIdee.textContent = t('idee.doppia');
      return;
    }
    if (s.idee.length >= MAX_IDEE) {
      el.avvisoIdee.textContent = t('idee.troppe');
      return;
    }
    s.idee.push(idea);
    const voce = document.createElement('li');
    voce.textContent = idea;
    el.elencoIdee.append(voce);
    el.avvisoIdee.textContent = '';
    el.nuovaIdea.value = '';
    aggiornaContatoreIdee();
  }

  // Per chi non sa ancora scrivere: l'adulto conta le idee dette a voce
  function aggiungiIdeaAVoce() {
    if (stato !== 'idee') return;
    if (sessione.idee.length >= MAX_IDEE) { el.avvisoIdee.textContent = t('idee.troppe'); return; }
    sessione.ideeVoce += 1;
    aggiungiIdea(t('idee.vocale', sessione.ideeVoce));
  }

  function concludiIdee() {
    if (stato !== 'idee') return;
    const n = sessione.idee.length;
    aggiornaUltimaSessione({ idee: n });
    esitoFinale = t('idee.esito', n);
    avviaRiposo(pendente.durata, pendente.salvata);
  }

  function avviaRiposo(durata, salvata) {
    stato = 'riposo';
    fermaCiclo();
    ctx.clearRect(0, 0, larghezza, altezza);
    el.hud.hidden = true;
    mostraComandi(false); // il cursore e i pulsanti del riposo devono essere visibili
    mostraOverlay('riposo');
    el.riposoTitolo.textContent = messaggioLivello ? `${t('riposo.titolo')} · ${messaggioLivello}` : t('riposo.titolo');
    el.riposoFrase.textContent = esitoFinale;
    el.riposoFrase.hidden = !esitoFinale;
    el.riposoTesto.textContent = t('riposo.testo') + (salvata ? '' : t('riposo.nonSalvata'));
    el.btnEsciRiposo.textContent = t('riposo.esci');
    fineRiposo = Date.now() + durata * 1000;
    deposito.scrivi(CHIAVI.riposo, fineRiposo); // il riposo vero parte ora
    aggiornaBlocco();
    aggiornaRiposo();
    clearInterval(idRiposo);
    idRiposo = setInterval(aggiornaRiposo, 250);
    el.btnEsciRiposo.focus();
    annuncia(t('riposo.annuncio', [messaggioLivello, esitoFinale].filter(Boolean).join(' '), durata / 60));
  }

  function aggiornaRiposo() {
    const rimanente = (fineRiposo - Date.now()) / 1000;
    el.riposoTempo.textContent = mmss(rimanente);
    if (rimanente > 0) return;
    clearInterval(idRiposo);
    idRiposo = null;
    el.riposoTitolo.textContent = t('riposo.finito');
    el.riposoTesto.textContent = t('riposo.finitoTesto');
    el.btnEsciRiposo.textContent = t('riposo.torna');
    annuncia(t('riposo.annuncioFine'));
  }

  function esciDaSessione(messaggio) {
    fermaCiclo();
    clearInterval(idRiposo);
    idRiposo = null;
    stato = 'fermo';
    sessione = null;
    el.palco.hidden = true;
    mostraOverlay(null);
    document.body.classList.remove('in-sessione');
    esciSchermoIntero();
    mostraEsito(messaggio);
    messaggioLivello = '';
    esitoFinale = '';
    pendente = null;
    if (!el.vistaProgressi.hidden) disegnaProgressi();
    if (!el.vistaPercorso.hidden) disegnaPercorso();
    aggiornaBlocco();
    focusDopoSessione();
  }

  function focusDopoSessione() {
    let bersaglio = document.querySelector('.tab[aria-current="page"]');
    if (!bloccato && !el.vistaAllenamento.hidden) bersaglio = el.btnAvvia;
    else if (!bloccato) bersaglio = el.percorsoElenco.querySelector('.livello--prossimo .btn-livello') || bersaglio;
    bersaglio.focus();
  }

  function mostraEsito(testo) {
    el.esito.hidden = !testo;
    el.esito.textContent = testo || '';
    if (testo) annuncia(testo);
  }

  // Esc / pulsante "Ferma": durante il riposo equivale a lasciare la schermata
  function fermaOEsci() {
    if (stato === 'in_corso' || stato === 'pausa') {
      const sec = Math.floor(sessione.trascorso);
      const salvata = sec >= SOGLIA_SALVATAGGIO && salvaSessione(sec);
      esciDaSessione(salvata
        ? t('esito.fermata', mmss(sec))
        : t('esito.breve'));
    } else if (stato === 'conto') {
      esciDaSessione(t('esito.annullata'));
    } else if (stato === 'idee') {
      concludiIdee(); // Esc = ho finito, il riposo parte comunque
    } else if (stato === 'indovina') {
      concludiIndovinello(null); // Esc = salto la risposta, il riposo parte comunque
    } else if (stato === 'riposo') {
      const finito = Date.now() >= fineRiposo;
      esciDaSessione([messaggioLivello, esitoFinale, finito ? t('esito.riposoConcluso') : ''].filter(Boolean).join(' '));
    }
  }

  /* ---------- Blocco durante il riposo ---------- */

  let bloccato = false; // vero finché dura il riposo: nessuna nuova sessione

  function aggiornaBlocco() {
    const fine = deposito.leggi(CHIAVI.riposo, 0);
    const rimanente = (fine - Date.now()) / 1000;
    const valido = rimanente > 0 && rimanente <= DURATE[DURATE.length - 1] * 60 + 5;
    bloccato = valido;
    el.btnAvvia.disabled = valido;
    el.percorsoElenco.querySelectorAll('.btn-livello').forEach((b) => {
      b.disabled = valido || b.dataset.bloccato === '1';
    });
    el.bloccoRiposo.hidden = !valido;
    if (valido) el.bloccoRiposoTesto.textContent = t('bloccoRiposo.testo', mmss(rimanente));
    else if (fine) deposito.rimuovi(CHIAVI.riposo);
  }

  /* ---------- Schermo intero ---------- */

  const schermoInteroDisponibile = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const elementoSchermoIntero = () => document.fullscreenElement || document.webkitFullscreenElement;

  function entraSchermoIntero() {
    const rich = el.palco.requestFullscreen || el.palco.webkitRequestFullscreen;
    if (rich && !elementoSchermoIntero()) Promise.resolve(rich.call(el.palco)).catch(() => {});
  }

  function esciSchermoIntero() {
    if (!elementoSchermoIntero()) return;
    uscitaSchermoInteroVolontaria = true;
    const esci = document.exitFullscreen || document.webkitExitFullscreen;
    Promise.resolve(esci.call(document)).catch(() => {});
  }

  function alternaSchermoIntero() {
    if (elementoSchermoIntero()) esciSchermoIntero();
    else entraSchermoIntero();
  }

  function alCambioSchermoIntero() {
    const attivo = !!elementoSchermoIntero();
    el.btnSchermoIntero.setAttribute('aria-pressed', String(attivo));
    el.btnSchermoIntero.textContent = attivo ? t('esciSchermoIntero') : t('schermoIntero');
    // Uscita da schermo intero con Esc (non richiesta da noi): Esc significa "ferma"
    if (!attivo && !uscitaSchermoInteroVolontaria && stato !== 'fermo') fermaOEsci();
    if (!attivo) uscitaSchermoInteroVolontaria = false;
  }

  /* ---------- Schermo pulito durante l'esercizio ---------- */

  const DURATA_COMANDI_VISIBILI = 3000; // ms dopo un tocco/clic

  let idHud = null;

  // Mentre l'esercizio è in corso non deve restare nessuna scritta sullo schermo
  function nascondiComandi() {
    clearTimeout(idHud);
    if (stato !== 'in_corso') return;
    if (el.hud.contains(document.activeElement)) el.palco.focus(); // il focus non deve tenerli visibili
    el.palco.classList.add('palco--pulito');
  }

  function mostraComandi(temporaneo) {
    clearTimeout(idHud);
    el.palco.classList.remove('palco--pulito');
    if (temporaneo) idHud = setTimeout(nascondiComandi, DURATA_COMANDI_VISIBILI);
  }

  // Un tocco o un clic sullo schermo richiama i comandi per qualche secondo
  function alTocco() {
    if (stato === 'in_corso') mostraComandi(true);
  }

  /* ================= Dialoghi e flusso di avvio ================= */

  function chiedi(dialogo) {
    return new Promise((risolvi) => {
      const alChiudi = () => {
        dialogo.removeEventListener('close', alChiudi);
        risolvi(dialogo.returnValue === 'ok');
      };
      dialogo.returnValue = '';
      dialogo.addEventListener('close', alChiudi);
      dialogo.showModal();
    });
  }

  let avvioInCorso = false;

  async function richiestaAvvio(livello = null) {
    if (avvioInCorso || bloccato || stato !== 'fermo') return;
    if (livello && !livelloSbloccato(livello, leggiCompletati())) return;
    if (!livello && impostazioni.esercizio === 'misto' && impostazioni.misto.length < 2) {
      mostraEsito(t('esito.mistoMinimo'));
      el.opzioniMisto.querySelector('input').focus();
      return;
    }
    avvioInCorso = true;
    try {
      if (!deposito.leggi(CHIAVI.avviso, false)) {
        if (!(await chiedi(el.dlgAvviso))) return;
        deposito.scrivi(CHIAVI.avviso, true);
      }
      if (movimentoRidotto.matches && !(await chiedi(el.dlgMovimento))) return;
      mostraEsito('');
      avviaSessione(livello); // lo schermo intero resta una scelta esplicita (pulsante o tasto F)
    } finally {
      avvioInCorso = false;
    }
  }

  /* ================= Progressi ================= */

  function ultimiGiorni(sessioni) {
    const giorni = [];
    for (let i = GIORNI_GRAFICO - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      giorni.push({ chiave: chiaveGiorno(d), etichetta: `${d.getDate()}/${d.getMonth() + 1}`, n: 0 });
    }
    const indice = new Map(giorni.map((g) => [g.chiave, g]));
    sessioni.forEach((s) => { const g = indice.get(s.data); if (g) g.n += 1; });
    return giorni;
  }

  function riempiTabella(sessioni) {
    const corpo = el.tabella.querySelector('tbody');
    corpo.textContent = '';
    sessioni.slice(-10).reverse().forEach((s) => {
      const riga = corpo.insertRow();
      const quando = new Date(s.ora);
      const data = isNaN(quando) ? s.data : quando.toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });
      const esercizio = (ESERCIZI.includes(s.esercizio) ? nomeEsercizio(s.esercizio) : s.esercizio)
        + (s.livello ? t('tab.liv', s.livello) : '')
        + (s.lettere ? t('tab.lettere', s.indovinata === true ? '✓' : s.indovinata === false ? '✗' : '–') : '')
        + (s.bambino ? t('tab.razzo', typeof s.idee === 'number' ? s.idee : null) : '');
      [data, esercizio, `${s.velocita}${s.progressiva ? t('tab.progressiva') : ''}`, mmss(s.durata)]
        .forEach((testo) => { riga.insertCell().textContent = testo; });
    });
    el.tabella.hidden = sessioni.length === 0;
    el.nessunaSessione.hidden = sessioni.length > 0;
  }

  function disegnaProgressi() {
    const sessioni = leggiSessioni();
    const totaleSec = sessioni.reduce((somma, s) => somma + s.durata, 0);
    el.totMinuti.textContent = (totaleSec / 60).toLocaleString(locale(), { maximumFractionDigits: 1 });
    el.totSessioni.textContent = String(sessioni.length);
    riempiTabella(sessioni);
    const giorni = ultimiGiorni(sessioni);
    el.grafico.setAttribute('aria-label', t('grafico.aria', giorni.map((g) => `${g.etichetta}: ${g.n}`).join(', ')));
    disegnaGrafico(giorni);
  }

  function disegnaGrafico(giorni) {
    const c = el.grafico;
    const L = c.clientWidth;
    const A = c.clientHeight;
    if (!L) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(L * dpr);
    c.height = Math.round(A * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L, A);
    g.font = `12px ${getComputedStyle(document.body).fontFamily}`;

    const sinistra = 32, destra = 8, sopra = 22, sotto = 30;
    const largUtile = L - sinistra - destra;
    const altUtile = A - sopra - sotto;
    const max = Math.max(1, ...giorni.map((d) => d.n));
    const passo = Math.max(1, Math.ceil(max / 5));
    const tetto = Math.ceil(max / passo) * passo;

    g.textBaseline = 'middle';
    g.textAlign = 'right';
    for (let v = 0; v <= tetto; v += passo) {
      const y = sopra + altUtile - (altUtile * v) / tetto;
      g.strokeStyle = colori.griglia;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(sinistra, y + 0.5); g.lineTo(L - destra, y + 0.5); g.stroke();
      g.fillStyle = colori.attenuato;
      g.fillText(String(v), sinistra - 6, y);
    }

    const passoX = largUtile / giorni.length;
    const largBarra = Math.min(passoX * 0.62, 40);
    const ogni = passoX < 30 ? 2 : 1; // etichette dei giorni più rade su schermi stretti
    giorni.forEach((d, i) => {
      const x = sinistra + passoX * i + (passoX - largBarra) / 2;
      const h = (altUtile * d.n) / tetto;
      if (h > 0) {
        const sfumatura = g.createLinearGradient(0, sopra + altUtile - h, 0, sopra + altUtile);
        sfumatura.addColorStop(0, colori.barra);
        sfumatura.addColorStop(1, colori.barra2);
        g.fillStyle = sfumatura;
        g.beginPath();
        g.roundRect(x, sopra + altUtile - h, largBarra, h, [Math.min(8, largBarra / 2), Math.min(8, largBarra / 2), 0, 0]);
        g.fill();
      }
      g.textAlign = 'center';
      if (d.n > 0) {
        g.fillStyle = colori.testo;
        g.textBaseline = 'bottom';
        g.fillText(String(d.n), x + largBarra / 2, sopra + altUtile - h - 3);
      }
      if ((giorni.length - 1 - i) % ogni === 0) {
        g.fillStyle = colori.attenuato;
        g.textBaseline = 'top';
        g.fillText(d.etichetta, x + largBarra / 2, sopra + altUtile + 8);
      }
    });
  }

  async function chiediCancellazione() {
    if (!(await chiedi(el.dlgCancella))) return;
    deposito.rimuovi(CHIAVI.sessioni);
    deposito.rimuovi(CHIAVI.percorso);
    disegnaProgressi();
    annuncia(t('annuncio.datiCancellati'));
  }

  /* ================= Percorso a livelli ================= */

  function leggiCompletati() {
    const salvato = deposito.leggi(CHIAVI.percorso, null);
    const lista = salvato && Array.isArray(salvato.completati) ? salvato.completati : [];
    return new Set(lista.filter((id) => LIVELLI.some((l) => l.id === id)));
  }

  // Il primo livello è sempre libero; gli altri si aprono completando il precedente
  const livelloSbloccato = (livello, completati) => livello.id === 1 || completati.has(livello.id - 1);

  // Segna il livello come completato e restituisce il messaggio da mostrare
  function completaLivello(id) {
    const fatti = leggiCompletati();
    const nuovo = !fatti.has(id);
    fatti.add(id);
    deposito.scrivi(CHIAVI.percorso, { completati: [...fatti].sort((a, b) => a - b) });
    let msg = t('livello.completato', id);
    const prossimo = LIVELLI.find((l) => l.id === id + 1);
    if (fatti.size === LIVELLI.length) msg += ` ${t('percorso.finito')}`;
    else if (nuovo && prossimo) msg += ` ${t('livello.sbloccato', prossimo.id, nomeLivello(prossimo))}`;
    return msg;
  }

  function descriviLivello(l) {
    const velocita = l.progressiva ? `1→${l.velocita}` : String(l.velocita);
    return t('livello.descrizione', nomeEsercizio(l.esercizio), velocita, l.dimensione, l.durata);
  }

  function creaScheda(l, fatti, prossimo) {
    const sbloccato = livelloSbloccato(l, fatti);
    const li = document.createElement('li');
    li.className = 'livello'
      + (fatti.has(l.id) ? ' livello--fatto' : '')
      + (!sbloccato ? ' livello--bloccato' : '')
      + (prossimo && prossimo.id === l.id ? ' livello--prossimo' : '');

    const campo = (tag, classe, testo) => {
      const e = document.createElement(tag);
      e.className = classe;
      e.textContent = testo;
      return e;
    };
    const btn = campo('button', 'btn btn--leggero btn-livello', !sbloccato ? t('livello.bloccato') : fatti.has(l.id) ? t('livello.rigioca') : t('livello.gioca'));
    btn.type = 'button';
    btn.dataset.livello = String(l.id);
    btn.dataset.bloccato = sbloccato ? '0' : '1';
    btn.setAttribute('aria-label', t('livello.aria', btn.textContent, l.id, nomeLivello(l)));
    btn.addEventListener('click', () => richiestaAvvio(l));

    const stato = fatti.has(l.id) ? t('livello.fatto') : sbloccato ? t('livello.daGiocare') : t('livello.completa', l.id - 1);
    li.append(campo('span', 'livello__num', t('livello', l.id)), campo('span', 'livello__nome', nomeLivello(l)),
      campo('p', 'livello__dati', descriviLivello(l)), campo('span', 'livello__stato', stato), btn);
    return li;
  }

  function disegnaPercorso() {
    const fatti = leggiCompletati();
    const prossimo = LIVELLI.find((l) => !fatti.has(l.id));
    el.percorsoConteggio.textContent = `${fatti.size} / ${LIVELLI.length}`;
    el.percorsoBarra.style.width = `${(100 * fatti.size) / LIVELLI.length}%`;
    el.percorsoElenco.textContent = '';
    t('mondi').slice(0, NUMERO_MONDI).forEach((mondo, m) => {
      const sezione = document.createElement('section');
      sezione.className = 'mondo';
      sezione.setAttribute('aria-labelledby', `mondo-${m}`);
      const titolo = document.createElement('h3');
      titolo.id = `mondo-${m}`;
      titolo.textContent = mondo.nome;
      const testo = document.createElement('p');
      testo.textContent = mondo.testo;
      const elenco = document.createElement('ul');
      elenco.className = 'livelli';
      LIVELLI.filter((l) => l.mondo === m).forEach((l) => elenco.append(creaScheda(l, fatti, prossimo)));
      sezione.append(titolo, testo, elenco);
      el.percorsoElenco.append(sezione);
    });
    aggiornaBlocco(); // applica subito l'eventuale blocco di riposo ai pulsanti
  }

  async function chiediAzzeraPercorso() {
    if (!(await chiedi(el.dlgAzzera))) return;
    deposito.rimuovi(CHIAVI.percorso);
    disegnaPercorso();
    annuncia(t('annuncio.percorsoAzzerato'));
  }

  /* ================= Viste ================= */

  const VISTE = { allenamento: el.vistaAllenamento, percorso: el.vistaPercorso, progressi: el.vistaProgressi };

  function mostraVista(nome) {
    Object.entries(VISTE).forEach(([chiave, sezione]) => { sezione.hidden = chiave !== nome; });
    el.tabs.forEach((t) => {
      if (t.dataset.vista === nome) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    if (nome === 'progressi') disegnaProgressi();
    if (nome === 'percorso') disegnaPercorso();
    try { history.replaceState(null, '', nome === 'allenamento' ? location.pathname + location.search : `#${nome}`); } catch { /* ignora */ }
  }

  /* ================= Anteprime animate degli esercizi ================= */

  // Nelle schede, il pallino dell'icona percorre il tracciato quando ci passi sopra col mouse (o col focus
  // da tastiera; su touch per qualche secondo dopo la scelta). I tracciati continui usano le stesse formule
  // dell'esercizio vero, ridotte alla misura dell'icona (32×32), così l'anteprima è fedele.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONE = {
    orizzontale: { mezzaL: 12, mezzaA: 12, periodo: 2.6 },
    verticale: { mezzaL: 12, mezzaA: 12, periodo: 2.6 },
    cerchio: { mezzaL: 10, mezzaA: 10, periodo: 3 },
    ellisse: { mezzaL: 12.5, mezzaA: 7, periodo: 3.2 },
    otto: { mezzaL: 12.5, mezzaA: 6.5, periodo: 3.8 },
    zigzag: { mezzaL: 12.5, mezzaA: 6.5, periodo: 7 },
  };
  const FASE_A_RIPOSO = 0.8;               // dove sta il pallino quando l'icona è ferma
  const SALTI_ICONA = [{ x: 7, y: 23 }, { x: 15, y: 9 }, { x: 23, y: 19 }, { x: 26.5, y: 8 }];
  const PAUSA_SALTO = 0.6;                 // secondi tra un salto e l'altro nell'icona delle saccadi
  const VELOCITA_MISTO = 14;               // unità dell'icona al secondo lungo il percorso del Misto
  const DURATA_ANTEPRIMA_TOCCO = 3.5;      // secondi di anteprima dopo la scelta su schermo touch

  const geometriaIcona = (tipo) => ({ cx: 16, cy: 16, mezzaL: ICONE[tipo].mezzaL, mezzaA: ICONE[tipo].mezzaA });

  // Percorso del Misto nell'icona: un giro del cerchio, poi lo zigzag, poi di nuovo all'inizio
  function percorsoMisto() {
    const punti = [];
    for (let i = 0; i <= 48; i++) {
      const f = -Math.PI / 2 + (i / 48) * 2 * Math.PI;
      punti.push({ x: 11.5 + 6 * Math.cos(f), y: 11.5 + 6 * Math.sin(f) });
    }
    [[15, 25], [18.5, 19.5], [22, 25], [25.5, 19.5], [15, 25], [11.5, 5.5]].forEach(([x, y]) => punti.push({ x, y }));
    const tratti = punti.slice(1).map((p, i) => Math.hypot(p.x - punti[i].x, p.y - punti[i].y));
    return { punti, tratti, totale: tratti.reduce((a, b) => a + b, 0) };
  }
  const MISTO_ICONA = percorsoMisto();

  function puntoSulPercorso(percorso, distanza) {
    let d = ((distanza % percorso.totale) + percorso.totale) % percorso.totale;
    for (let i = 0; i < percorso.tratti.length; i++) {
      if (d <= percorso.tratti[i]) {
        const a = percorso.punti[i], b = percorso.punti[i + 1], k = d / percorso.tratti[i];
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      d -= percorso.tratti[i];
    }
    return percorso.punti[0];
  }

  // Posizione del pallino nell'icona dopo t secondi di anteprima
  function posizioneIcona(tipo, t) {
    if (ICONE[tipo]) return posizioneBersaglio(tipo, geometriaIcona(tipo), FASE_A_RIPOSO + (2 * Math.PI * t) / ICONE[tipo].periodo, null);
    if (tipo === 'saccadi') return SALTI_ICONA[(SALTI_ICONA.length - 1 + Math.floor(t / PAUSA_SALTO)) % SALTI_ICONA.length];
    return puntoSulPercorso(MISTO_ICONA, VELOCITA_MISTO * t);
  }

  function elementoSvg(nome, attributi) {
    const e = document.createElementNS(SVG_NS, nome);
    Object.entries(attributi).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // Ridisegna il tracciato dell'icona con le formule vere e aggiunge il pallino che si muove
  function preparaIcona(svg, tipo) {
    if (ICONE[tipo]) {
      const g = geometriaIcona(tipo);
      const tratto = (da, a) => Array.from({ length: 145 }, (_, i) => posizioneBersaglio(tipo, g, da + (i / 144) * (a - da), null))
        .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');
      svg.textContent = '';
      if (tipo === 'zigzag') { // andata piena, ritorno (speculare) tenue: altrimenti in 32 px sembra una rete
        svg.append(elementoSvg('path', { d: tratto(Math.PI / 2, 3 * Math.PI / 2), class: 'ritorno' }));
        svg.append(elementoSvg('path', { d: tratto(-Math.PI / 2, Math.PI / 2) }));
      } else {
        svg.append(elementoSvg('path', { d: tratto(0, 2 * Math.PI) }));
      }
    } else if (tipo === 'saccadi') {
      svg.querySelectorAll('circle').forEach((c) => c.setAttribute('r', '1.7')); // i punti dove salta il pallino
    }
    const punto = elementoSvg('circle', { class: 'pieno punto', r: tipo === 'saccadi' ? '2.7' : '2.6' });
    svg.append(punto);
    return punto;
  }

  function preparaAnteprime() {
    el.form.querySelectorAll('.scheda').forEach((scheda) => {
      const radio = scheda.querySelector('input[name="esercizio"]');
      const svg = scheda.querySelector('.scheda__icona');
      const a = { tipo: radio.value, punto: null, id: null, inizio: 0, fine: 0, sopra: false };
      a.punto = preparaIcona(svg, a.tipo);

      const posiziona = (t) => {
        const p = posizioneIcona(a.tipo, t);
        a.punto.setAttribute('cx', p.x.toFixed(2));
        a.punto.setAttribute('cy', p.y.toFixed(2));
      };
      const ferma = () => {
        if (a.id !== null) cancelAnimationFrame(a.id);
        a.id = null;
        posiziona(0);
        scheda.classList.remove('scheda--anteprima');
      };
      const passo = (ora) => {
        posiziona((ora - a.inizio) / 1000);
        a.id = ora < a.fine ? requestAnimationFrame(passo) : null;
        if (a.id === null) ferma();
      };
      // secondi = durata, oppure Infinity finché il puntatore o il focus restano sulla scheda
      const avvia = (secondi) => {
        if (movimentoRidotto.matches) return;
        const ora = performance.now();
        a.fine = secondi === Infinity ? Infinity : Math.max(a.fine, ora + secondi * 1000);
        if (a.id !== null) return;
        a.inizio = ora;
        scheda.classList.add('scheda--anteprima');
        a.id = requestAnimationFrame(passo);
      };

      posiziona(0);
      scheda.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { a.sopra = true; avvia(Infinity); } });
      scheda.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { a.sopra = false; ferma(); } });
      radio.addEventListener('focus', () => { if (radio.matches(':focus-visible')) avvia(Infinity); });
      radio.addEventListener('blur', () => { if (!a.sopra) ferma(); });
      radio.addEventListener('change', () => { if (!a.sopra) avvia(DURATA_ANTEPRIMA_TOCCO); });
    });
  }

  /* ================= Lingua: applicazione dei testi ================= */

  function riempiLingue() {
    Object.entries(LINGUE).forEach(([codice, testi]) => {
      const opzione = document.createElement('option');
      opzione.value = codice;
      opzione.textContent = testi['meta.nome']; // ogni lingua col proprio nome, così la si riconosce
      opzione.lang = testi['meta.lang'];
      el.lingua.append(opzione);
    });
  }

  // Sostituisce tutti i testi della pagina: data-t (testo), data-t-html (con <strong>), data-t-attr (attributi)
  function applicaLingua() {
    document.documentElement.lang = t('meta.lang');
    document.title = t('meta.titolo');
    document.querySelector('meta[name="description"]').setAttribute('content', t('meta.descrizione'));
    document.querySelectorAll('[data-t]').forEach((e) => {
      const arg = e.dataset.tArg;
      e.textContent = arg === undefined ? t(e.dataset.t) : t(e.dataset.t, +arg, numero(+arg));
    });
    document.querySelectorAll('[data-t-html]').forEach((e) => { e.innerHTML = t(e.dataset.tHtml); });
    document.querySelectorAll('[data-t-attr]').forEach((e) => {
      e.dataset.tAttr.split(';').forEach((coppia) => {
        const [attributo, chiave] = coppia.split('=');
        e.setAttribute(attributo, t(chiave));
      });
    });
    el.lingua.value = impostazioni.lingua;
    applicaTema();
    aggiornaEtichette();
    aggiornaBlocco();
    if (!el.vistaPercorso.hidden) disegnaPercorso();
  }

  /* ================= Impostazioni: UI ================= */

  function mostraImpostazioni() {
    el.form.elements.esercizio.value = impostazioni.esercizio;
    el.velocita.value = impostazioni.velocita;
    el.dimensione.value = impostazioni.dimensione;
    el.dimensioneVariabile.checked = impostazioni.dimensioneVariabile;
    el.dimMin.value = impostazioni.dimMin;
    el.dimMax.value = impostazioni.dimMax;
    el.durata.value = String(impostazioni.durata);
    el.progressiva.checked = impostazioni.progressiva;
    el.cambio.value = String(impostazioni.cambio);
    el.lettere.checked = impostazioni.lettere;
    el.bambino.checked = impostazioni.bambino;
    el.passoLettere.value = String(impostazioni.passoLettere);
    el.distanza.value = String(impostazioni.distanza);
    // le opzioni facoltative si aprono da sole se ce n'è almeno una attiva
    el.opzioniFacoltative.open = impostazioni.opzioniAperte || contaOpzioniAttive() > 0;
    el.form.querySelectorAll('input[name=misto]').forEach((c) => { c.checked = impostazioni.misto.includes(c.value); });
    aggiornaEtichette();
  }

  const contaOpzioniAttive = () => ['dimensioneVariabile', 'progressiva', 'lettere', 'bambino'].filter((k) => impostazioni[k]).length;

  function aggiornaCalibrazione() {
    const pxCarta = CARTA.larghezza / cmPerPx();
    el.carta.value = Math.round(pxCarta);
    el.cartaRettangolo.style.width = `${pxCarta}px`;
    el.cartaRettangolo.style.height = `${(pxCarta * CARTA.altezza) / CARTA.larghezza}px`;
    const cm = Math.round(window.innerWidth * cmPerPx());
    el.larghezzaSchermo.textContent = impostazioni.cmPerPx
      ? t('calibra.fatta', numero(cm))
      : t('calibra.nonFatta', numero(cm));
    aggiornaRiempimento(el.carta);
  }

  // Gli slider su misura colorano la parte già percorsa: serve la posizione in percentuale
  function aggiornaRiempimento(slider) {
    const p = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--p', `${p}%`);
  }

  function aggiornaEtichette() {
    const attive = contaOpzioniAttive();
    el.opzioniAttive.textContent = attive ? t('opzioni.attive', attive) : '';
    aggiornaCalibrazione();
    el.opzioniMisto.hidden = impostazioni.esercizio !== 'misto';
    el.opzioniLettere.hidden = !impostazioni.lettere;
    el.lettere.disabled = impostazioni.bambino;   // lettere e bambino non si combinano
    el.bambino.disabled = impostazioni.lettere;
    el.velocitaVal.textContent = `${impostazioni.velocita} / 10 · ${numero(velocitaAngolare(impostazioni.velocita))}°/s`;
    el.dimensioneVal.textContent = `${impostazioni.dimensione} px`;
    el.anteprima.style.width = el.anteprima.style.height = `${impostazioni.dimensione}px`;
    el.campoDimensione.hidden = impostazioni.dimensioneVariabile;
    el.opzioniDimensione.hidden = !impostazioni.dimensioneVariabile;
    el.dimMin.value = impostazioni.dimMin;
    el.dimMax.value = impostazioni.dimMax;
    el.dimMinVal.textContent = `${impostazioni.dimMin} px`;
    el.dimMaxVal.textContent = `${impostazioni.dimMax} px`;
    el.anteprimaMin.style.width = el.anteprimaMin.style.height = `${impostazioni.dimMin}px`;
    el.anteprimaMax.style.width = el.anteprimaMax.style.height = `${impostazioni.dimMax}px`;
    el.etichettaVelocita.textContent = impostazioni.progressiva ? t('velocita.massima') : t('velocita');
    el.form.querySelectorAll('input[type="range"]').forEach(aggiornaRiempimento);
  }

  function alCambioImpostazioni(e) {
    // Il minimo non può superare il massimo: lo slider appena mosso trascina l'altro
    let dimMin = +el.dimMin.value;
    let dimMax = +el.dimMax.value;
    if (dimMin > dimMax) {
      if (e && e.target === el.dimMax) dimMin = dimMax;
      else dimMax = dimMin;
    }
    impostazioni = pulisciImpostazioni({
      ...impostazioni,
      esercizio: el.form.elements.esercizio.value,
      velocita: el.velocita.value,
      dimensione: el.dimensione.value,
      dimensioneVariabile: el.dimensioneVariabile.checked,
      dimMin,
      dimMax,
      durata: el.durata.value,
      progressiva: el.progressiva.checked,
      cambio: el.cambio.value,
      lettere: el.lettere.checked,
      bambino: el.bambino.checked,
      passoLettere: el.passoLettere.value,
      distanza: el.distanza.value,
      cmPerPx: e && e.target === el.carta ? CARTA.larghezza / +el.carta.value : impostazioni.cmPerPx,
      misto: [...el.form.querySelectorAll('input[name=misto]:checked')].map((c) => c.value),
    });
    aggiornaEtichette();
    salvaImpostazioni();
  }

  /* ================= Tastiera ================= */

  const CONTROLLI = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY']);
  let spazioConsumato = false;

  function alTasto(e) {
    if (document.querySelector('dialog[open]')) return; // i dialoghi gestiscono Esc da soli
    if (stato === 'fermo') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      fermaOEsci();
    } else if (e.code === 'Space' && !CONTROLLI.has(e.target.tagName)) {
      // sui pulsanti lo Spazio fa il suo lavoro nativo; altrove alterna la pausa
      e.preventDefault();
      if (!e.repeat) { spazioConsumato = true; alternaPausa(); }
    } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && stato !== 'riposo'
      && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      e.preventDefault();
      if (!e.repeat) alternaSchermoIntero();
    }
  }

  function alTastoRilasciato(e) {
    // evita che lo Spazio premuto altrove "clicchi" il pulsante che ha preso il focus nel frattempo
    if (e.code === 'Space' && spazioConsumato) { spazioConsumato = false; e.preventDefault(); }
  }

  /* ================= Avvio ================= */

  const movimentoRidotto = matchMedia('(prefers-reduced-motion: reduce)');

  function collega() {
    el.tabs.forEach((t) => t.addEventListener('click', () => mostraVista(t.dataset.vista)));
    el.lingua.addEventListener('change', () => {
      impostazioni.lingua = LINGUE[el.lingua.value] ? el.lingua.value : impostazioni.lingua;
      salvaImpostazioni();
      applicaLingua();
    });
    el.btnTema.addEventListener('click', () => {
      impostazioni.tema = impostazioni.tema === 'dark' ? 'light' : 'dark';
      salvaImpostazioni();
      applicaTema();
    });

    el.form.addEventListener('input', alCambioImpostazioni);
    el.form.addEventListener('change', alCambioImpostazioni);
    el.form.addEventListener('submit', (e) => { e.preventDefault(); richiestaAvvio(); });

    el.formIdee.addEventListener('submit', (e) => { e.preventDefault(); aggiungiIdea(el.nuovaIdea.value); el.nuovaIdea.focus(); });
    el.btnFattoIdee.addEventListener('click', concludiIdee);
    el.btnIdeaVoce.addEventListener('click', aggiungiIdeaAVoce);
    el.opzioniFacoltative.addEventListener('toggle', () => {
      impostazioni.opzioniAperte = el.opzioniFacoltative.open;
      salvaImpostazioni();
    });
    el.btnRipristinaCalibrazione.addEventListener('click', () => {
      impostazioni.cmPerPx = null;
      salvaImpostazioni();
      aggiornaEtichette();
    });
    el.formFrase.addEventListener('submit', (e) => { e.preventDefault(); concludiIndovinello(el.rispostaFrase.value); });
    el.btnSaltaFrase.addEventListener('click', () => concludiIndovinello(null));
    el.btnPausa.addEventListener('click', alternaPausa);
    el.btnRiprendi.addEventListener('click', () => impostaPausa(false));
    el.btnFerma.addEventListener('click', fermaOEsci);
    el.btnFermaPausa.addEventListener('click', fermaOEsci);
    el.btnEsciRiposo.addEventListener('click', fermaOEsci);
    el.btnCancella.addEventListener('click', chiediCancellazione);
    el.btnAzzeraPercorso.addEventListener('click', chiediAzzeraPercorso);

    if (schermoInteroDisponibile) {
      el.btnSchermoIntero.addEventListener('click', alternaSchermoIntero);
      document.addEventListener('fullscreenchange', alCambioSchermoIntero);
      document.addEventListener('webkitfullscreenchange', alCambioSchermoIntero);
    } else {
      el.btnSchermoIntero.hidden = true;
    }

    document.addEventListener('keydown', alTasto);
    document.addEventListener('keyup', alTastoRilasciato);
    el.palco.addEventListener('pointerdown', alTocco);

    // Se la scheda non è visibile il tempo non deve scorrere: pausa automatica
    document.addEventListener('visibilitychange', () => { if (document.hidden) impostaPausa(true); });

    new ResizeObserver(misura).observe(el.palco);
    window.addEventListener('resize', () => { if (!el.vistaProgressi.hidden) disegnaProgressi(); aggiornaCalibrazione(); });

    const mostraAvvisoMovimento = () => { el.avvisoMovimento.hidden = !movimentoRidotto.matches; };
    movimentoRidotto.addEventListener('change', mostraAvvisoMovimento);
    mostraAvvisoMovimento();
  }

  // Il pulsante e il QR compaiono solo con un indirizzo https valido; l'indirizzo viene sempre da DONATE_URL
  function preparaDonazione() {
    const attiva = /^https:\/\/\S+$/.test(DONATE_URL);
    document.querySelectorAll('.dona').forEach((blocco) => {
      blocco.hidden = !attiva;
      const link = blocco.querySelector('.dona__bottone');
      if (attiva) link.href = DONATE_URL;
      else link.removeAttribute('href');
    });
  }

  function inizializza() {
    riempiLingue();
    preparaDonazione();
    mostraImpostazioni();
    applicaLingua();
    collega();
    preparaAnteprime();
    aggiornaBlocco();
    setInterval(aggiornaBlocco, 1000);
    const vistaIniziale = location.hash.slice(1);
    if (VISTE[vistaIniziale]) mostraVista(vistaIniziale);
  }

  inizializza();
})();
