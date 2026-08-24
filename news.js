const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Cerca informazioni qualitative pre-match non normalmente disponibili
 * nelle API sportive tradizionali.
 */
async function getPreMatchContext({
  home,
  away,
  date,
  competition,
  language = "it",
}) {
  if (!home?.trim() || !away?.trim()) {
    throw new Error("home e away sono obbligatori");
  }

  /*   
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date deve essere nel formato YYYY-MM-DD");
  }
 */
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    tools: [
      {
        type: "web_search",
      },
    ],
    // max_output_tokens: 6000,
    reasoning: { effort: "low" },
    tool_choice: "required",
    input: `
Analizza esclusivamente il contesto qualitativo pre-match della partita:

Casa: ${home}
Trasferta: ${away}
Data: ${date}


OBIETTIVO

Cerca notizie, dichiarazioni ed eventi rilevanti che normalmente NON sono
presenti nelle API sportive strutturate.

Cerca notizie pre-match.
Se trovi una qualsiasi delle seguenti categorie, riportala.
NON cercare individualmente ogni categoria.

- dichiarazioni pre-partita di allenatori, giocatori e dirigenti;
- conferenze stampa e interviste;
- dichiarazioni su motivazione, pressione, obiettivi o approccio alla gara;
- tensioni interne nello spogliatoio;
- polemiche tra squadra, società, arbitri o federazione;
- contestazioni o iniziative particolari dei tifosi;
- problemi societari, finanziari o organizzativi;
- problemi di viaggio, ritardi o difficoltà logistiche;
- cambio recente di allenatore o modifiche nello staff;
- stanchezza o difficoltà dovute al calendario, se dichiarate da fonti;
- rotazioni o priorità suggerite da dichiarazioni pubbliche;
- eventi personali, disciplinari o extracampo rilevanti;
- condizioni del campo o del meteo discusse pubblicamente;
- qualsiasi evento straordinario che possa influenzare concentrazione,
  motivazione, morale o preparazione della squadra.

ESCLUDI:

- probabili formazioni;
- formazioni ufficiali;
- infortuni;
- squalifiche;
- indisponibili;
- statistiche;
- quote;
- pronostici;
- precedenti;
- classifica;
- risultati;
- cronaca live;
- notizie post-partita;
- informazioni generiche prive di impatto concreto;
- annunci di calendario, biglietteria, vendita ticket, trasporti pubblici,
  orari di apertura cancelli, illuminazioni promozionali, fan festival o
  qualsiasi altra iniziativa di marketing/organizzazione dell'evento: NON
  sono "problemi di viaggio o difficoltà logistiche" solo perché parlano di
  logistica. Includi la logistica SOLO se descrive un disagio o imprevisto
  concreto per la squadra (es. volo cancellato, ritardo che accorcia la
  preparazione, hotel inadeguato), mai un annuncio promozionale o
  organizzativo neutro.

REGOLE:

1. Usa solo contenuti pubblicati prima dell'inizio della partita.
2. Verifica che la notizia riguardi questa specifica partita o il periodo
   immediatamente precedente.
3. Considera esclusivamente notizie pubblicate nelle 1-2 settimane
   precedenti alla data "${date}". Scarta articoli più vecchi, anche se
   pertinenti, salvo che riguardino un evento straordinario ancora attuale
   (es. cambio allenatore, crisi societaria in corso).
4. Non inventare collegamenti o conseguenze.
5. Distingui chiaramente fatti, dichiarazioni dirette e interpretazioni.
6. Deduplica articoli che riportano lo stesso evento.
7. Scarta articoli puramente SEO o privi di informazione sostanziale.
8. Restituisci massimo 10 eventi realmente rilevanti.
9. Un array vuoto è un risultato BUONO e atteso, non un fallimento: se dopo
   una ricerca approfondita non trovi eventi realmente qualitativi (non
   logistici/promozionali), restituisci "events": []. Non riempire l'array
   con annunci generici solo per non restituirlo vuoto: è preferibile un
   array vuoto a un evento fuori tema.

Restituisci esclusivamente JSON valido nella lingua "${language}":

{
  "home": "${home}",
  "away": "${away}",
  "match_date": "${date}",
  "competition": ${JSON.stringify(competition ?? null)},
  "events": [
    {
      "headline": "Titolo sintetico dell'evento",
      "summary": "Descrizione fattuale e sintetica",
      "team": "home | away | both",
      "type": "statement | motivation | internal_tension | club_issue | fan_event | logistics | coaching_change | fatigue | tactical_hint | disciplinary | weather_pitch | other",
      "subject": "Persona o organizzazione coinvolta",
      "quote": "Breve dichiarazione diretta oppure null",
      "potential_impact": "Possibile rilevanza pre-match, senza formulare pronostici",
      "impact_level": "low | medium | high",
      "information_status": "confirmed | reported | speculative",
      "published_at": "ISO-8601 oppure null",
      "source": "Nome della fonte",
      "url": "URL completo"
    }
  ]
}
`,
  });

  if (response.status === "incomplete") {
    throw new Error(
      `Risposta incompleta dal modello (motivo: ${response.incomplete_details?.reason}). Aumenta max_output_tokens.`,
    );
  }

  try {
    return JSON.parse(response.output_text);
  } catch {
    throw new Error(
      `Il modello non ha restituito JSON valido: ${response.output_text}`,
    );
  }
}

module.exports = {
  getPreMatchContext,
};
