# Eye Gym

**Eye Gym** è una webapp gratuita di esercizi occhi su schermo: inseguimento visivo e saccadi. Il nome «Gym» indica solo che si tratta di esercizi: l'app non rafforza i muscoli degli occhi, non migliora la vista, non cura e non sostituisce una visita ortottica o oculistica. Se compaiono vertigini, nausea, mal di testa o peggioramento della vista, fermati e rivolgiti a uno specialista.

**Sito pubblico: <https://eniandreiacob-max.github.io/eye-gym/>**

Otto esercizi (orizzontale, verticale, cerchio, ellisse, otto, saccadi, zigzag e un misto imprevedibile), percorso a livelli, modalità lettere e modalità bambino, 6 lingue. HTML, CSS e JavaScript puri: nessun build, nessuna dipendenza, nessun cookie, nessun analytics, nessun dato che esce dal tuo browser (vedi la [pagina privacy](https://eniandreiacob-max.github.io/eye-gym/privacy.html)). Licenza [MIT](LICENSE).

## Come avviarla in locale

Doppio clic su `index.html`, oppure da terminale nella cartella del progetto:

```bash
python3 -m http.server 8000
```

e poi apri <http://localhost:8000>.

## Pubblicazione e aggiornamenti

Il sito è servito da **GitHub Pages** dal branch `main` (cartella radice) del repository [`eniandreiacob-max/eye-gym`](https://github.com/eniandreiacob-max/eye-gym). Non c'è nessun build: i file del repository sono il sito.

**Aggiornare il sito:** modifica i file, controlla in locale, poi:

```bash
git add -A
git commit -m "Descrizione della modifica"
git push
```

Dopo qualche decina di secondi GitHub Pages ripubblica da solo. Lo stato si vede con `gh run list --limit 3` oppure nella scheda *Actions* del repository.

**Controllare il sito pubblicato** (da `tests/`, serve `npm install`, vedi la sezione Test):

```bash
node pubblico.mjs
```

Tutti i percorsi sono relativi, quindi il sito funziona così com'è anche in una sottocartella (`/eye-gym/`). Se cambi il nome del repository o l'utente, aggiorna l'indirizzo in `index.html` (canonical, `og:url`, `og:image`, `twitter:image`), `privacy.html` (canonical), `sitemap.xml`, `robots.txt`, `404.html` e nei link del footer, poi rigenera il QR se serve.

File di servizio del sito: `favicon.svg`, `og-image.png` (anteprima per i social, 1200×630, generata da `tools/genera-og.mjs`), `robots.txt` (consente tutto), `sitemap.xml`, `404.html` (autonoma, funziona da qualsiasi indirizzo), `.nojekyll`. Le cartelle `tests/` e `tools/` sono solo per sviluppo; pubblicate insieme al resto, non fanno parte dell'app.

## Lingue

L'app è in **6 lingue**: italiano più le 5 lingue più parlate al mondo, cioè **inglese, cinese (mandarino, caratteri semplificati), hindi, spagnolo e francese**.

- Alla prima apertura usa la lingua del browser, se è tra queste (anche nelle varianti, per esempio messicano → spagnolo, Taiwan → cinese); altrimenti parte in inglese.
- Si cambia in qualsiasi momento dal menu in alto, dove ogni lingua compare col proprio nome. La scelta viene ricordata.
- Le frasi della modalità lettere e le domande della modalità bambino non sono traduzioni: sono proverbi e domande originali di ogni lingua. In cinese e in hindi il bersaglio mostra un segno intero alla volta (un carattere, oppure una sillaba devanagari come "धी"), e nelle risposte e nelle idee contano solo lettere e numeri, in qualunque alfabeto.
- Date e numeri seguono il formato della lingua scelta (10,5°/s in italiano, 10.5°/s in inglese).
- Tutti i testi stanno in `testi.js`. Per aggiungere una lingua basta copiare un blocco, tradurlo e aggiungerne il codice: il test `tests/lingue.mjs` controlla che non manchi nessuna chiave e che non resti nessun testo nella lingua sbagliata.

## Donazione volontaria

Eye Gym è gratuita e resta gratuita. Nel **piè di pagina** e nella **schermata di riposo** a fine sessione c'è un pulsante discreto **Dona con PayPal**, accompagnato da un **QR code** (su schermi piccoli, come il telefono, resta solo il pulsante). La donazione è volontaria e non sblocca nulla: nessun contatore, nessun messaggio che spinga a donare, nessuna promessa sulla salute. Non compare mai durante l'esercizio, il conto alla rovescia o la pausa, e non è mai un popup.

- Il pulsante apre il link in una nuova scheda (`rel="noopener noreferrer"`), verso PayPal, un servizio esterno con le sue regole.
- Il QR è il file vettoriale `qr-donazione.svg`: correzione errori M, margine di 4 moduli, scuro su bianco; anche nel tema scuro sta su un riquadro bianco, perché molti lettori non leggono un QR chiaro su scuro. Nessuno script o servizio esterno lo produce: è un normale file del sito.
- Il link sta in una sola costante, `DONATE_URL`, in cima ad `app.js`. Se è vuoto o non è un indirizzo `https://`, pulsante e QR spariscono insieme.

**Cambiare il link di donazione**

1. Modifica `DONATE_URL` in cima ad `app.js`.
2. Rigenera il QR (serve Node; il pacchetto [`qrcode`](https://www.npmjs.com/package/qrcode), licenza MIT, si usa solo in questa fase e non finisce nel sito):

```bash
cd tools && npm install && npm run qr
```

Lo script legge `DONATE_URL` direttamente da `app.js`, controlla che sia un indirizzo `https://` valido e riscrive `qr-donazione.svg`. Per sicurezza, il test `tests/donazione.mjs` decodifica il file con una libreria di lettura (jsQR) e verifica che il contenuto sia identico a `DONATE_URL`.

## Come si usa

1. Scegli l'esercizio, la velocità (parti da 3), la dimensione del bersaglio e la durata (2, 3, 5 o 10 minuti) nell'**Allenamento libero**, oppure gioca un livello del **Percorso** (vedi sotto).
2. Siediti a **50–70 cm** dallo schermo, testa ferma: si muovono solo gli occhi.
3. Premi **Inizia la sessione**. Dopo un conto alla rovescia di 3 secondi parte il bersaglio.
4. A fine sessione parte da solo un **riposo** della stessa durata: guarda lontano o chiudi gli occhi. Finché il riposo non è finito il pulsante di avvio resta bloccato (anche se esci dalla schermata di riposo o ricarichi la pagina).

**Schermo pulito:** mentre l'esercizio è in corso spariscono tutte le scritte e i pulsanti (e il cursore): resta solo il bersaglio. Il conto alla rovescia iniziale e la pausa mostrano invece testo e comandi. Per richiamare i comandi per 3 secondi basta un tocco o un clic sullo schermo; con la tastiera `Tab` li mostra finché il focus è su di loro.

Tasti durante la sessione: `Spazio` pausa/riprendi, `Esc` ferma, `F` schermo intero.
Se esci dallo schermo intero con `Esc`, la sessione viene fermata (stesso effetto di `Esc` fuori dallo schermo intero).

## Esercizi

Ogni scheda ha un'icona col disegno del tracciato. **Passandoci sopra col mouse** (o col focus da tastiera) il pallino dell'icona si muove come farà il bersaglio: i tracciati sono calcolati con le stesse formule dell'esercizio vero. Su telefono e tablet l'anteprima parte per qualche secondo quando scegli l'esercizio; se il dispositivo chiede di ridurre i movimenti, le icone restano ferme.

| Esercizio | Cosa fa il bersaglio | Cosa esercita |
|---|---|---|
| Orizzontale | oscillazione sinusoidale destra-sinistra | fluidità dell'inseguimento laterale |
| Verticale | oscillazione sinusoidale su-giù | fluidità dell'inseguimento verticale |
| Cerchio | percorso circolare continuo | passaggio tra tutte le direzioni |
| Ellisse | ovale più largo che alto (altezza al massimo il 55% della larghezza) | movimento circolare con ampiezze diverse in orizzontale e in verticale |
| Otto | percorso a otto (infinito), proporzione 2:1 | cambi di direzione e incrocio al centro |
| Zigzag | passata orizzontale lenta con inversioni verticali nette (6 per passata), a velocità costante pari al picco dell'orizzontale | cambi rapidi su-giù mentre lo sguardo avanza |
| Saccadi | salta in una posizione casuale a intervalli regolari, sempre ad almeno il 40% del lato corto dell'area rispetto alla posizione precedente | rapidità e precisione dei salti dello sguardo |

**Misto (combina le direzioni, in modo imprevedibile).** L'ottavo esercizio unisce più tracciati nella stessa sessione: scegli quali (orizzontale, verticale, diagonale `/`, diagonale `\`, cerchio, ellisse, otto, zigzag, saccadi; almeno due) e ogni quanto cambiare in media (10, 20 o 30 secondi). Per non dare punti di riferimento, tutto è casuale: il tracciato successivo (a giri: in ogni giro i tracciati scelti escono tutti, in ordine casuale e mai lo stesso due volte di fila), la durata di ognuno (da metà a una volta e mezzo la media scelta), il punto del percorso da cui riparte e il verso (orario o antiorario, avanti o indietro). Tra un tracciato e l'altro il bersaglio scivola senza salti; il titolo in alto, se lo richiami, mostra già il tracciato in arrivo. Il Misto è disponibile nell'allenamento libero (non nei livelli del percorso).

## Velocità in gradi e calibrazione dello schermo

La velocità va da 1 a 10 ed è misurata in **gradi al secondo dello sguardo**, non in pixel: nel punto più veloce di ogni tracciato il bersaglio va da 5,5°/s (livello 1) a 28°/s (livello 10), passando per 10,5°/s al livello 3. Così lo stesso livello è uguale su un telefono, un tablet o un monitor grande, e anche il livello 10 resta sotto il limite oltre il quale l'occhio non riesce più a inseguire in modo fluido. Nelle saccadi l'intervallo tra i salti scende da circa 3 s a 0,8 s.

Nel blocco richiudibile **Schermo e distanza**:

- **Distanza** dagli occhi allo schermo: 40 cm (tablet), 50, 60 (predefinita) o 70 cm.
- **Calibra lo schermo**: appoggi una carta di credito o la tessera sanitaria sul rettangolo e muovi lo slider finché hanno la stessa larghezza (zoom del browser al 100%). Senza calibrazione si usa una stima della dimensione dei pixel, che su molti schermi può sbagliare anche del 20–30%. **Usa la stima** annulla la calibrazione.
- Il percorso non va oltre **±20° dal centro**: su schermi grandi o molto vicini il bersaglio non arriva fino ai bordi, perché più in là servirebbe girare la testa.
Il movimento si basa sul tempo reale (delta-time tra un frame e l'altro), quindi non dipende dalla frequenza di aggiornamento dello schermo.

**Modalità progressiva:** parte dal livello 1 e sale di un livello ogni 30 secondi fino alla velocità scelta con lo slider.

## Opzioni facoltative

Modalità progressiva, dimensione variabile, lettere e modalità bambino stanno in un blocco richiudibile, **Opzioni facoltative**, chiuso di default; il titolo dice quante opzioni sono attive e il blocco si riapre da solo se ce n'è almeno una.

## Dimensione variabile (facoltativa)

Spuntando **Dimensione variabile** nell'Allenamento libero, lo slider della dimensione viene sostituito da un **intervallo**: scegli la dimensione **minima** e la **massima** (da 12 a 80 px, di default 16–48) e durante l'esercizio il bersaglio si ingrandisce e si rimpicciolisce lentamente tra i due valori. Parte dal minimo, arriva al massimo dopo 5 secondi e torna al minimo a 10 (un ciclo ogni 10 secondi); il cambio è graduale e resta fermo durante la pausa.

- La minima non può superare la massima: se sposti uno slider oltre l'altro, l'altro lo segue. Con minima = massima la dimensione resta fissa.
- Un'anteprima mostra i due diametri a confronto.
- Il bersaglio resta sempre dentro lo schermo, a 12 px dal bordo, anche alla dimensione massima.
- Con la modalità lettere attiva il diametro non scende mai sotto i 48 px, con la modalità bambino sotto i 64 px (se l'intervallo è tutto sotto il minimo, il bersaglio resta fisso a quel minimo).
- Non è prevista nei livelli del percorso.

## Modalità bambino (facoltativa)

Nell'**Allenamento libero**, spuntando **Modalità bambino: segui il razzo**, il bersaglio diventa un **razzo** con la fiamma che si anima, sullo sfondo di stelle. Il razzo **punta dove sta andando**: ruota in modo fluido seguendo il percorso e, nelle saccadi, si gira di scatto verso il nuovo punto. Funziona con tutti gli esercizi, anche Misto e dimensione variabile.

**Pensiero divergente.** Alla fine dell'esercizio compare una domanda creativa a caso, senza risposte giuste o sbagliate, per esempio "Dove sta andando il razzo?", "Cosa porta nella stiva?" o "In quanti modi diversi si può usare un razzo?". Il bambino scrive (o fa scrivere) le sue idee una alla volta, oppure le dice a voce e l'adulto preme **+1 idea detta a voce**; **le idee ripetute non contano**, perché si premia la varietà e non la quantità, e un contatore lo incoraggia. Poi parte il riposo, che mostra quante idee diverse sono state inventate. Si può terminare in qualunque momento con "Ho finito" o con `Esc`.

- Se il dispositivo chiede di ridurre i movimenti, la fiamma non tremola.
- Il razzo è almeno 64 px, altrimenti non si riconosce. Non si combina con la modalità lettere (le due opzioni si escludono a vicenda).
- Come negli altri esercizi, durante il movimento spariscono tutte le scritte.
- Nei progressi la sessione compare con "+ razzo (N idee)". Si salva solo il numero di idee, non il testo.
- È pensata per essere usata con un adulto vicino. Valgono le stesse avvertenze di tutta l'app.
- Non è prevista nei livelli del percorso.

## Modalità lettere (facoltativa)

Nell'**Allenamento libero**, spuntando **Lettere sul bersaglio**, il punto diventa un bersaglio con una lettera dentro che cambia ogni 1, 1,5 o 2 secondi (a scelta). Le lettere formano una frase italiana scelta a caso tra 16 proverbi e detti; tra una parola e l'altra il bersaglio mostra solo il punto, e la frase ricomincia in loop fino a fine sessione.

- Alla fine dell'esercizio compare **Indovina la frase**: ti dice quante parole e lettere ha, tu la scrivi (maiuscole, accenti e spazi non contano) e poi parte il riposo. Puoi anche **saltare** (con il pulsante o con `Esc`).
- Il riposo obbligatorio parte comunque a fine esercizio: il blocco delle nuove sessioni è attivo già durante l'indovinello e il conto del riposo riparte dopo la risposta. L'esito (con la frase giusta) è mostrato nella schermata di riposo.
- In questa modalità il bersaglio è di almeno 48 px, altrimenti le lettere non si leggono.
- Funziona con tutti gli esercizi, anche Misto. Non è prevista nei livelli del percorso.
- Nei progressi la sessione compare con "+ lettere ✓" (indovinata), "✗" (sbagliata) o "–" (saltata o fermata prima).
- Fermare la sessione con `Esc` prima della fine non apre l'indovinello.

## Percorso a livelli

La scheda **Percorso** propone 15 livelli in 4 mondi, dal facile al difficile, con esercizio, velocità, dimensione del bersaglio e durata già impostati:

| Mondo | Livelli | Difficoltà |
|---|---|---|
| 1 · Primi passi | 1–4 | bersaglio grande (48–56 px), velocità 1–2, 2 minuti |
| 2 · Ritmo | 5–8 | tutti i tracciati, velocità 2–3, bersaglio 40–48 px |
| 3 · Precisione | 9–12 | bersaglio 28–40 px, velocità 4 e prime salite progressive |
| 4 · Maestria | 13–15 | bersaglio 22–26 px, velocità fino a 7, 5 minuti |

- Si parte dal livello 1; ogni livello si sblocca completando il precedente.
- Un livello conta come completato solo se la sessione arriva fino in fondo: se la fermi prima, non si sblocca nulla (la durata fatta viene comunque salvata nei progressi).
- I livelli completati si possono rigiocare. Dopo ogni sessione resta valido il riposo obbligatorio.
- I livelli non cambiano le impostazioni dell'allenamento libero.
- I livelli "progressivi" (velocità `1→N`) partono dal livello 1 e salgono ogni 30 secondi fino a N.
- **Ricomincia il percorso da capo** azzera solo i livelli; **Cancella i dati dei progressi** azzera sessioni e percorso.

## Progressi

Ogni sessione completata (o fermata dopo almeno 10 secondi) viene salvata nel `localStorage` del browser con data, esercizio, velocità e durata completata.
La scheda **Progressi** mostra il totale dei minuti e delle sessioni, il grafico a barre degli ultimi 14 giorni e le ultime 10 sessioni.
Il pulsante **Cancella i dati dei progressi** elimina le sessioni salvate e i livelli completati (le impostazioni restano).
I dati stanno solo in questo browser su questo dispositivo.

## Avvertenze

- Se compaiono **vertigini, nausea, mal di testa o peggioramento della vista**, fermati.
- In caso di sintomi persistenti rivolgiti a un **ortottista o a un oculista**.
- L'app **non cura e non corregge** miopia o altri difetti della vista, e non sostituisce una visita: è solo un esercizio per il movimento degli occhi.
- L'avviso completo compare prima della prima sessione.
- Se il dispositivo ha attivo "riduci movimento" (`prefers-reduced-motion`), l'app lo segnala e parte solo dopo conferma.

## Struttura

- `index.html`: struttura, dialoghi, schermata di sessione (i testi sono segnati con `data-t` e sostituiti nella lingua scelta)
- `privacy.html`, `pagine.js`: pagina privacy (6 lingue, riusa `testi.js`)
- `404.html`, `robots.txt`, `sitemap.xml`, `favicon.svg`, `og-image.png`, `LICENSE`, `.nojekyll`: file di servizio del sito
- `qr-donazione.svg`: QR code della donazione, generato da `tools/genera-qr.mjs`
- `tools/`: script di sviluppo (`genera-qr.mjs`, `genera-og.mjs`), non fanno parte del sito
- `testi.js`: tutti i testi dell'interfaccia nelle 6 lingue, comprese frasi e domande
- `style.css`: temi scuro (predefinito) e chiaro, layout responsive
- `app.js`: movimento, sessioni, riposo, salvataggio, grafico (canvas, nessuna libreria)
- `tests/`: test automatici, solo per sviluppo (vedi sotto)

## Test (solo per sviluppo)

L'app non ha dipendenze. I test usano [Playwright](https://playwright.dev) con Chromium e servono solo a chi modifica il codice:

```bash
cd tests && npm install && npm run installa-browser
```

```bash
cd tests && npm test
```

`npm test` avvia da solo un piccolo server locale ed esegue tutti i file (circa 15 minuti, grazie a un orologio simulato che accelera le sessioni). Si può lanciarne uno solo, per esempio `npm test velocita`. I file:

- `suite.mjs`: tutti gli esercizi, pausa e stop, riposo e blocco, progressi, percorso, Misto casuale, schermo pulito, zigzag, lettere, opzioni facoltative, tema e layout.
- `lingue.mjs`: le 6 lingue complete e senza testi rimasti in un'altra lingua, scelta automatica dal browser, cambio al volo, lettere e risposte in cinese e hindi.
- `velocita.mjs`: velocità in gradi uguale su schermi diversi, calibrazione con la carta, distanza e limite di ±20°.
- `accessibilita.mjs`: axe-core (WCAG 2.1 AA e buone pratiche) su tutte le schermate in tema scuro e chiaro, anche in cinese e hindi, più uso da tastiera e anello di focus.
- `sottocartella.mjs`: imita GitHub Pages (sito in `/eye-gym/`, 404 vera) e verifica percorsi relativi, meta tag, esercizi, riposo, donazione e QR.
- `pubblico.mjs`: gli stessi controlli sul sito realmente pubblicato (`node pubblico.mjs [indirizzo]`).
- `donazione.mjs`: pulsante e QR solo nel footer e nel riposo (mai durante l'esercizio), QR decodificato e identico a `DONATE_URL`, tutto nascosto se il link è vuoto, nessuna risorsa esterna.
- `anteprime.mjs`: anteprime animate delle icone (mouse, tastiera, touch, riduci movimento) e pallino sempre sul tracciato disegnato.
- `bordi.mjs`, `dimensione.mjs`, `bambino.mjs`: bersaglio fino ai bordi, dimensione variabile con intervallo, modalità razzo e idee.

## Idee per sviluppi futuri

- Tracciamento dello sguardo con la webcam, **solo locale e opzionale** (nessun video inviato fuori dal dispositivo), per misurare quanto lo sguardo segue il bersaglio. Non implementato.
- Esercizi in più: convergenza (bersaglio che si avvicina e si allontana), inseguimento con distrattori, saccadi guidate da lettere o numeri.
- Percorsi e programmi settimanali con promemoria.
- Esportazione e importazione dei progressi in un file.
- Andamento nel tempo nei progressi: frasi indovinate, idee del razzo, livello raggiunto.
- Un "Mondo 5" del percorso con zigzag, ellisse, Misto, lettere e razzo.
- Compito di attenzione: il bersaglio cambia colore o forma e si risponde con un tasto, con tempo di reazione registrato.
- Suoni opzionali a fine sessione e fine riposo.
- Installazione come PWA per uso offline su tablet.
