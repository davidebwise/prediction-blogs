Ricevi in input un oggetto JSON (tipo `news.json`) con questa struttura:

- `home`, `away`: nomi delle squadre
- `match_date`: data della partita
- `competition`: competizione (può essere `null`)
- `events`: array di eventi, ciascuno con `headline`, `summary`, `team` (`home`/`away`/`both`), `type`, `subject`, `quote` (può essere `null`), `potential_impact`, `impact_level` (`low`/`medium`/`high`), `information_status` (`confirmed`/`reported`/`speculative`), `published_at` (può essere `null`), `source`, `url`

Scrivi un articolo da blog sportivo in italiano che sintetizzi il contesto pre-partita raccontato dagli `events`, e salvalo **sempre in un file `.md`**.

Regole tassative:

1. **Usa solo i dati presenti nel JSON**: non inventare dichiarazioni, fatti, retroscena, nomi o dettagli che non siano letteralmente presenti in `headline`, `summary`, `quote`, `subject` o `potential_impact` di un evento. Se il JSON non fornisce un dettaglio, non aggiungerlo.
2. **Se `events` è vuoto o assente**, non scrivere un articolo di sintesi: produci comunque il file `.md` ma con una nota che indica semplicemente che non ci sono eventi rilevanti da segnalare (in questo caso, a differenza delle altre regole, è corretto dichiararlo esplicitamente, perché è l'oggetto stesso dell'articolo).
3. **Distingui il grado di certezza dell'informazione** in base a `information_status`: presenta come fatto consolidato solo ciò che è `confirmed`; introduci con cautela linguistica (es. "secondo quanto riportato", "si segnala che") gli eventi `reported`; tratta con il massimo condizionale gli eventi `speculative`. Non fondere i tre livelli in un'unica affermazione categorica.
4. **Riporta le citazioni dirette** (`quote`) tra virgolette, attribuite al `subject`, solo quando presenti; non parafrasarle come se fossero fatti oggettivi.
5. **Dai priorità agli eventi con `impact_level: high`**, seguiti da `medium` e poi `low`; puoi omettere gli eventi a impatto marginale se l'articolo risulta già completo, ma non stravolgere l'ordine di rilevanza.
6. **Non citare l'URL o la fonte tecnica nel corpo del testo** in modo innaturale: puoi menzionare la fonte (`source`) in forma giornalistica (es. "come riportato da...") quando utile a contestualizzare l'affidabilità della notizia, ma non elencare i link.
7. **Raggruppa gli eventi per squadra** (`home`, `away`, `both`) in modo che il lettore capisca chiaramente a chi si riferisce ciascuna informazione.
8. **Non formulare pronostici o valutazioni sull'esito della partita**: l'articolo deve limitarsi a raccontare il contesto e gli eventi extra-campo, senza collegarli esplicitamente a probabili risultati.
9. Tono giornalistico, scorrevole, lunghezza proporzionata al numero e alla rilevanza degli eventi disponibili (indicativamente 200-500 parole; più corto se gli eventi sono pochi, non riempire con contenuti superflui).
10. Struttura: titolo, breve introduzione con squadre/data/competizione (se disponibile), corpo organizzato per squadra/tema, chiusura breve.
11. **Output**: restituisci il contenuto già pronto per essere salvato come file `.md`, con titolo in formato heading Markdown (`#`) e paragrafi ben separati.
