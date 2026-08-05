Ricevi in input un oggetto JSON generato da un sistema di previsione calcistica. La struttura contiene:

- `match`: dati oggettivi dell'incontro (id, date, home/away con nome e allenatore, competition, friendly)
- `legend`, `weights`: spiegazioni tecniche del modello (da ignorare completamente)
- `notes`: annotazioni tecniche sul modello (da ignorare completamente)
- `1x2`, `overUnder25`, `btts`: per ciascun mercato, un insieme di `signals` (ognuno con `value`, `reliability`, `reason`), uno `score` e delle `probabilities`

Scrivi un articolo da blog sportivo in italiano il cui **focus centrale è il pronostico sui tre mercati (1X2, Over/Under 2.5, BTTS)**, non la partita in generale. L'articolo deve presentare la tua opinione/previsione su ciascuno dei tre mercati, motivata dai dati oggettivi disponibili, non semplicemente un resoconto del contesto della partita.

Regole tassative:

1. **Non citare mai** i campi calcolati dal modello: `score`, `probabilities`, `value`, `reliability`, `weights`, `legend`. Non riportare percentuali, punteggi numerici o formulazioni che siano l'output diretto del modello. La previsione che scrivi deve essere una tua valutazione discorsiva costruita ragionando sui dati oggettivi, non una parafrasi dei numeri già calcolati dal sistema.
2. **Usa solo dati oggettivi** presenti nei campi `reason` dei singoli segnali (es. media gol segnati/subiti nelle ultime 5 partite, quote di mercato riportate come fatto informativo se disponibili, posizione in classifica, formazione/marcatori in forma inclusi o esclusi dalla lista convocati, infortunati) e nei campi di `match` (squadre, allenatori, competizione, data). Su questi dati oggettivi costruisci il ragionamento che porta al pronostico per ciascun mercato.
   - Quando il segnale `lineup` cita nomi di giocatori (es. marcatori in forma presenti o assenti dalla lista convocati, infortunati ancora inclusi), **cita i nomi dei giocatori** nell'articolo se pertinenti al pronostico del mercato in questione. Non citarli se non aggiungono nulla al ragionamento o se il dato è ambiguo/incompleto.
3. **Se un dato è assente, nullo, o un segnale ha `value: null` / `reliability: 0` / un `reason` che indica dato mancante (es. "non disponibile", "non quotato")**: ometti del tutto quell'informazione e, se necessario, quel mercato. Non menzionare che manca, non scrivere frasi tipo "i dati non sono disponibili": salta l'argomento come se non esistesse. Se per un intero mercato non restano dati oggettivi sufficienti, ometti il pronostico su quel mercato senza segnalarlo.
4. **Non inventare nulla**: usa esclusivamente i dati effettivamente presenti nel JSON fornito. Non aggiungere statistiche, dichiarazioni, aneddoti, nomi di giocatori, infortuni, precedenti storici o qualunque altro dettaglio che non sia letteralmente ricavabile dai campi ammessi (`match` e i `reason` con dati validi). Se non ci sono abbastanza dati per argomentare un pronostico, scrivi un articolo più corto ma non colmare i vuoti con contenuti inventati.
5. Non menzionare mai il fatto che i dati provengono da un JSON, da un modello, da segnali, pesi o algoritmi di previsione: scrivi come un giornalista/pronosticatore sportivo che espone la propria analisi.
6. Struttura l'articolo con: titolo accattivante orientato al pronostico, breve introduzione con squadre/competizione/data, una sezione per ciascuno dei tre mercati (1X2, Over/Under 2.5, BTTS) in cui esponi il tuo pronostico argomentandolo con i dati oggettivi pertinenti, e una chiusura che riassume la tua view complessiva sulla partita.
7. Tono giornalistico da pronosticatore sportivo, scorrevole, lunghezza 300-500 parole.
