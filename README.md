# VINTAGEM

Fotografa un capo vintage: VINTAGEM lo identifica, lo data, ne stima il valore di rivendita e mostra i riscontri di mercato reali.

**PHOTO → AI ANALYSIS → VINTAGE INTELLIGENCE**

## Avvio

```bash
npm install
cp .env.example .env      # inserisci almeno una chiave AI
npm run build
npm start                 # http://localhost:8787
```

Sviluppo: `npm run dev` (ricostruisce il frontend e riavvia il server a ogni modifica).
Test: `npm test` (API, fasi, errori, dati vuoti: girano contro un finto provider locale, senza rete).

## Regola dei dati: real data or nothing

- Ogni campo non stabilito dall'analisi è `null` e l'interfaccia dice "Not determined". Il server converte in `null` anche risposte segnaposto come "unknown" o "n/a".
- La **stima** è la valutazione del modello AI per il pezzo nelle condizioni visibili. Il range compare solo se il modello ne restituisce uno.
- La **confidence** compare solo se il modello la fornisce, ed è etichettata come autovalutazione del modello, non come prova di autenticità.
- **Vintage Score: non esiste.** Nessun dato calibrato permette di calcolarlo onestamente, quindi c'è la sezione qualitativa *Assessment*.
- **Comparabili:** sono solo annunci reali da eBay (prezzi richiesti di annunci attivi, non venduti). Senza credenziali eBay compare lo stato vuoto "Not enough market data yet."
- **Le fasi dell'analisi sono reali.** "Scanning image" si chiude quando il modello inizia a rispondere. Le fasi successive avanzano quando la rispettiva chiave JSON arriva davvero nello stream. "Checking market data" gira solo se c'è una fonte collegata, altrimenti è indicata come non collegata. Nessuna fase avanza a tempo.

## Architettura

```
UI (React)  ──POST /api/analyze──▶  Analysis service  ──▶  AI provider (Claude | OpenAI | Gemini)
   ▲            (stream SSE:          server/analysis        server/providers
   │             phase / result /          │
   │             error)                    └──▶ Market source (eBay Browse API)
   │                                            server/market
IndexedDB (archivio sul dispositivo)
```

| Percorso | Ruolo |
|---|---|
| `server/index.js` | Server HTTP senza dipendenze: API, file statici, header di sicurezza, rate limit |
| `server/analysis/prompt.js` | Prompt e schema richiesto al modello |
| `server/analysis/schema.js` | Normalizzazione rigorosa della risposta |
| `server/analysis/service.js` | Orchestrazione: stream, fasi, mercato |
| `server/providers/*` | Un file per provider. Ognuno è un generatore che restituisce testo |
| `server/market/*` | Comparabili reali (eBay) e mediana |
| `src/` | App React: scanner, sequenza, perizia, archivio |

**Aggiungere un provider:** crea `server/providers/<nome>.js` con un `async function*` che restituisce i chunk di testo, poi registralo in `server/providers/index.js` e in `server/config.js`.

**API**

- `GET /api/config`: restituisce solo `{ analysis: { available }, market: { available } }`. Non espone chiavi, provider o modelli.
- `POST /api/analyze`: body `{ image: "data:image/jpeg;base64,…" }`. Risponde con uno stream di eventi: `phase` `{id, status}`, `result` (la perizia), `error` `{code, message}`.
- `GET /api/health`: health check.

**Sicurezza:** l'analisi avviene solo sul backend. Il browser invia la foto a `POST /api/analyze` e riceve lo stream di VINTAGEM, senza mai contattare un provider AI. `ANTHROPIC_API_KEY` viene letta solo da `server/config.js` (variabili d'ambiente) e usata solo in `server/providers/`. Non compare nel bundle client e nessuna risposta API la contiene: gli errori verso il browser sono messaggi fissi, mentre i dettagli tecnici restano nel log del server. Senza chiave l'utente vede "AI analysis is temporarily unavailable." e il log del server indica la variabile mancante.

**Archivio:** le perizie, con foto e miniatura, sono salvate in IndexedDB sul dispositivo dell'utente. La foto lascia il dispositivo solo per la richiesta di analisi.

## Deploy su Render

`render.yaml` è incluso: Web Service Node, build `npm install --include=dev && npm run build`, start `npm start`. Imposta `ANTHROPIC_API_KEY` (oppure un'altra chiave) e, se vuoi i comparabili, `EBAY_CLIENT_ID` e `EBAY_CLIENT_SECRET`.

## Font

Bodoni Moda e Geist, entrambi SIL Open Font License (`public/fonts/OFL-*.txt`), ospitati in locale e ridotti al set Latin.
