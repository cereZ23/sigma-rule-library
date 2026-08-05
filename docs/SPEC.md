# Prompt — Sigma Rule Library su GitHub Pages

## Ruolo

Agisci come un senior frontend engineer, software architect e detection engineer con esperienza in:

* Astro
* TypeScript
* Tailwind CSS
* GitHub Pages
* GitHub Actions
* YAML
* Sigma rules
* MITRE ATT&CK
* static site generation
* indicizzazione e ricerca client-side

Devi progettare e implementare un sito web statico chiamato provvisoriamente **Sigma Rule Library**.

Il risultato deve essere una libreria pubblica e navigabile delle regole Sigma presenti nel repository ufficiale:

* `https://github.com/SigmaHQ/sigma`

Come riferimento funzionale e visivo usa:

* `https://detectionskills.io/library`
* `https://github.com/CDESpace/Detection-Skills`

Usa Detection Skills solamente come ispirazione per UX, navigazione e organizzazione dei contenuti. Non copiare codice, testi, loghi, branding o componenti proprietari.

---

# 1. Obiettivo del progetto

Creare una GitHub Pages moderna e veloce che permetta a detection engineer, SOC analyst, threat hunter e security engineer di:

1. cercare rapidamente una Sigma rule;
2. filtrare le regole per piattaforma, log source, livello, status, autore e MITRE ATT&CK;
3. aprire una pagina dedicata per ogni regola;
4. leggere la detection logic in modo comprensibile;
5. visualizzare il file YAML originale;
6. copiare o scaricare la regola;
7. aprire la regola originale su GitHub;
8. condividere un link permanente alla regola;
9. vedere statistiche aggregate sulla copertura del catalogo;
10. aggiornare automaticamente il catalogo quando cambia il repository SigmaHQ.

Il sito deve funzionare completamente senza backend.

---

# 2. Stack tecnologico

Utilizza questo stack:

* **Astro** con output statico;
* **TypeScript** in modalità strict;
* **Tailwind CSS**;
* componenti Astro, evitando framework client-side pesanti;
* JavaScript client-side solo per ricerca, filtri e interazioni;
* package `yaml` o equivalente affidabile per il parsing;
* **Pagefind** oppure un indice JSON ottimizzato per la ricerca;
* GitHub Actions per build, sincronizzazione e deploy;
* GitHub Pages come hosting.

Non utilizzare:

* database;
* API backend proprietarie;
* server Node persistente;
* autenticazione;
* servizi SaaS obbligatori;
* dipendenze inutilmente pesanti.

Il progetto deve poter essere eseguito con:

```bash
npm install
npm run dev
npm run build
npm run preview
```

---

# 3. Sorgente dei dati

La sorgente principale è:

```text
https://github.com/SigmaHQ/sigma
```

Durante la build, recupera le regole dalle seguenti directory, quando presenti:

```text
rules/
rules-threat-hunting/
rules-emerging-threats/
rules-compliance/
rules-placeholder/
```

Non includere normalmente:

```text
deprecated/
unsupported/
rules-dfir/
```

Prevedi però una configurazione che consenta di abilitarle in futuro.

Esempio:

```ts
export const sigmaSources = {
  standard: true,
  threatHunting: true,
  emergingThreats: true,
  compliance: true,
  placeholder: true,
  dfir: false,
  deprecated: false,
  unsupported: false
};
```

Il recupero delle regole deve avvenire preferibilmente tramite shallow clone:

```bash
git clone --depth 1 https://github.com/SigmaHQ/sigma.git .cache/sigma
```

Non effettuare migliaia di chiamate individuali alle GitHub API.

Memorizza nel catalogo anche:

* commit SHA della sorgente;
* data dell’ultima sincronizzazione;
* branch utilizzato;
* path originale del file;
* URL del file su GitHub;
* URL raw del file.

---

# 4. Parsing delle Sigma rule

Scansiona ricorsivamente tutti i file `.yml` e `.yaml`.

Per ogni regola estrai, quando disponibili:

```yaml
title:
id:
related:
status:
description:
references:
author:
date:
modified:
tags:
logsource:
detection:
fields:
falsepositives:
level:
scope:
license:
```

Aggiungi inoltre i seguenti campi calcolati:

```ts
interface SigmaRule {
  slug: string;
  title: string;
  id?: string;
  description?: string;
  status?: string;
  level?: string;
  author: string[];
  date?: string;
  modified?: string;

  ruleType: string;
  repositorySection: string;

  logsource: {
    category?: string;
    product?: string;
    service?: string;
    definition?: string;
  };

  mitreTactics: string[];
  mitreTechniques: string[];
  mitreSubTechniques: string[];

  tags: string[];
  references: string[];
  falsePositives: string[];
  fields: string[];

  detection: unknown;
  rawYaml: string;

  sourcePath: string;
  githubUrl: string;
  rawUrl: string;
  sourceCommit: string;

  searchText: string;
}
```

## Gestione degli errori

Il parser deve:

* continuare la build anche quando una singola regola è malformata;
* registrare chiaramente file e motivo dell’errore;
* produrre un report JSON delle regole non importate;
* evitare che un file corrotto blocchi tutto il sito;
* rilevare eventuali ID duplicati;
* rilevare slug duplicati;
* gestire campi che possono essere stringhe oppure array;
* evitare interpretazioni pericolose o inconsistenti delle date YAML.

Genera:

```text
src/generated/rules.json
src/generated/stats.json
src/generated/import-errors.json
src/generated/source-metadata.json
```

---

# 5. Generazione degli slug

Ogni regola deve avere un URL stabile.

Utilizza preferibilmente l’UUID Sigma:

```text
/rules/<sigma-rule-id>/
```

Quando l’ID non è disponibile:

```text
/rules/<slug-del-titolo>-<hash-breve-del-path>/
```

Non utilizzare solamente il titolo, perché potrebbero esistere titoli simili o duplicati.

---

# 6. Struttura del sito

Implementa almeno queste pagine:

```text
/
├── index
├── library
├── rules/[slug]
├── mitre
├── statistics
├── about
└── 404
```

## Homepage

La homepage deve contenere:

* nome del progetto;
* breve spiegazione;
* barra di ricerca principale;
* numero totale di regole;
* numero di piattaforme;
* numero di tecniche MITRE ATT&CK;
* data dell’ultimo aggiornamento;
* collegamento alla libreria;
* collegamento al repository SigmaHQ;
* categorie principali;
* regole aggiornate più recentemente.

Esempio di testo introduttivo:

> Explore, search and understand community-maintained Sigma detection rules.

Non dichiarare che il progetto è ufficialmente affiliato a SigmaHQ.

---

# 7. Pagina Library

La pagina `/library` deve ricordare l’esperienza di navigazione di Detection Skills, ma deve essere ottimizzata per migliaia di regole.

## Barra di ricerca

La ricerca deve considerare:

* titolo;
* descrizione;
* ID;
* autore;
* tag;
* MITRE technique ID;
* MITRE tactic;
* product;
* service;
* category;
* path;
* detection values;
* false positives.

La ricerca deve:

* essere case-insensitive;
* supportare parole parziali;
* aggiornare i risultati senza ricaricare la pagina;
* mantenere filtri e query nell’URL;
* permettere la condivisione di una ricerca;
* utilizzare debounce;
* mostrare il numero dei risultati.

Esempio:

```text
/library?q=powershell&product=windows&level=high
```

## Filtri

Implementa filtri combinabili per:

* rule type;
* repository section;
* product;
* service;
* logsource category;
* status;
* level;
* MITRE tactic;
* MITRE technique;
* author;
* anno di creazione;
* anno di modifica.

Valori indicativi per `level`:

```text
informational
low
medium
high
critical
unknown
```

Valori indicativi per `status`:

```text
stable
test
experimental
deprecated
unsupported
unknown
```

Aggiungi:

* pulsante “Clear filters”;
* conteggio accanto a ogni filtro;
* possibilità di comprimere i gruppi di filtri;
* layout mobile con pannello filtri apribile;
* ordinamento.

## Ordinamento

Supporta:

```text
Title A–Z
Recently modified
Recently created
Severity
Author
Repository path
```

## Card delle regole

Ogni card deve mostrare:

* titolo;
* descrizione abbreviata;
* level;
* status;
* product;
* service o category;
* MITRE ATT&CK technique;
* autore;
* data di modifica;
* sezione del repository.

Usa badge coerenti e leggibili.

Non renderizzare tutte le migliaia di card contemporaneamente. Usa paginazione, progressive rendering o una strategia equivalente.

---

# 8. Pagina dettaglio della regola

Ogni regola deve avere una pagina statica dedicata.

## Header

Mostra:

* titolo;
* descrizione;
* level;
* status;
* rule type;
* Sigma ID;
* autore;
* data;
* ultima modifica;
* repository section.

## Azioni

Inserisci questi pulsanti:

* **Copy YAML**
* **Download YAML**
* **View on GitHub**
* **Open raw file**
* **Share**
* **Copy rule ID**

Il pulsante Share deve usare Web Share API quando disponibile e, in alternativa, copiare il link.

## Log source

Mostra chiaramente:

* product;
* service;
* category;
* definition.

## MITRE ATT&CK

Mostra:

* tactic;
* technique;
* sub-technique;
* identificativo, ad esempio `T1059.001`;
* link alla pagina MITRE ATT&CK corrispondente.

Distingui i tag ATT&CK dagli altri tag Sigma.

## Detection logic

Visualizza la detection logic in due modalità.

### Structured view

Mostra:

* selections;
* filters;
* condition;
* timeframe, se presente;
* correlation, se presente.

Usa blocchi leggibili, indentazione e syntax highlighting.

### Raw YAML

Mostra il file YAML completo con:

* syntax highlighting;
* numeri di riga;
* pulsante Copy;
* pulsante Download;
* scroll orizzontale;
* corretta visualizzazione su mobile.

Non modificare o normalizzare il contenuto mostrato nella modalità Raw YAML.

## False positives

Mostra una sezione dedicata ai falsi positivi.

Quando il campo è vuoto o contiene valori generici, mostra comunque il contenuto originale senza inventare informazioni.

## References

Mostra tutti i riferimenti come link esterni sicuri:

```html
target="_blank"
rel="noopener noreferrer"
```

## Related rules

Quando disponibile, usa il campo `related` per mostrare:

* rule ID;
* relationship type;
* link interno alla regola correlata, se presente nel catalogo.

Aggiungi inoltre una sezione “Similar rules”, calcolata usando:

* stessa MITRE technique;
* stesso product;
* stesso logsource;
* tag condivisi.

Non è necessario usare AI o embeddings.

---

# 9. Pagina MITRE ATT&CK

Crea una pagina `/mitre` con una vista aggregata della copertura ATT&CK.

Mostra:

* tattiche;
* tecniche;
* sottotecniche;
* numero di regole per tecnica;
* collegamento alle regole associate.

Per l’MVP è sufficiente una vista a griglia o tabella.

La visualizzazione deve evidenziare:

* tecniche senza regole;
* tecniche con una sola regola;
* tecniche con più regole.

Non dichiarare una copertura completa di MITRE ATT&CK se il dataset non la dimostra.

---

# 10. Pagina Statistics

Genera statistiche durante la build.

Mostra almeno:

* numero totale delle regole;
* distribuzione per level;
* distribuzione per status;
* distribuzione per product;
* distribuzione per logsource category;
* distribuzione per repository section;
* principali autori;
* principali MITRE techniques;
* regole create per anno;
* regole modificate per anno;
* numero di file non importati;
* commit SigmaHQ utilizzato.

I grafici devono essere accessibili e non devono impedire la lettura dei dati in formato testuale o tabellare.

---

# 11. Design e UX

Il design deve essere:

* professionale;
* minimale;
* orientato alla cybersecurity;
* leggibile;
* moderno ma non decorativo;
* responsive;
* accessibile;
* utilizzabile sia in dark mode sia in light mode.

## Indicazioni visive

Usa:

* typography pulita;
* ampio spazio tra le sezioni;
* card con bordi discreti;
* badge per status, level e log source;
* font monospace per YAML, ID e detection logic;
* header sticky;
* breadcrumb nelle pagine delle regole;
* navigazione da tastiera;
* focus state chiaramente visibile.

Evita:

* animazioni invasive;
* gradienti eccessivi;
* dashboard troppo dense;
* icone puramente decorative;
* imitazioni del branding SigmaHQ;
* copia esatta del design di Detection Skills.

---

# 12. Accessibilità

Rispetta almeno WCAG 2.1 AA.

Implementa:

* HTML semantico;
* corretti heading level;
* label per input e filtri;
* contrasto sufficiente;
* navigazione da tastiera;
* skip link;
* `aria-live` per il numero dei risultati;
* focus management per il pannello filtri mobile;
* supporto a `prefers-reduced-motion`;
* testi alternativi appropriati;
* grafici accompagnati da tabelle o dati testuali.

---

# 13. SEO e metadata

Genera per ogni pagina:

* title;
* meta description;
* canonical URL;
* Open Graph metadata;
* Twitter Card metadata;
* JSON-LD appropriato;
* sitemap;
* robots.txt.

La pagina di una regola deve avere un titolo simile a:

```text
Suspicious PowerShell Download — Sigma Rule Library
```

La descrizione SEO deve derivare dalla descrizione Sigma senza inventare contenuti.

---

# 14. GitHub Pages

Il sito deve funzionare sia come:

```text
https://username.github.io/
```

sia come project page:

```text
https://username.github.io/repository-name/
```

Gestisci correttamente:

* `site`;
* `base`;
* asset path;
* link interni;
* sitemap;
* canonical URL.

Usa variabili configurabili:

```env
PUBLIC_SITE_URL=https://username.github.io
PUBLIC_BASE_PATH=/sigma-rule-library
PUBLIC_GITHUB_REPOSITORY=username/sigma-rule-library
```

Non inserire path assoluti hardcoded che interrompano il sito su GitHub Pages.

---

# 15. GitHub Actions

Crea almeno due workflow.

## Deploy

File:

```text
.github/workflows/deploy.yml
```

Trigger:

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
```

Fasi:

1. checkout;
2. setup Node;
3. install dipendenze con lockfile;
4. recupero repository SigmaHQ;
5. parsing;
6. validazione;
7. build;
8. upload Pages artifact;
9. deploy GitHub Pages.

Usa le GitHub Actions ufficiali per Pages.

## Aggiornamento automatico

File:

```text
.github/workflows/sync-sigma.yml
```

Trigger:

```yaml
on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:
```

Il workflow deve:

1. controllare il commit più recente di SigmaHQ;
2. confrontarlo con quello usato nell’ultima build;
3. eseguire build e deploy solamente quando necessario;
4. consentire comunque l’esecuzione manuale;
5. mostrare nel job summary quante regole sono state importate;
6. mostrare errori, duplicati e statistiche principali.

Non è obbligatorio effettuare commit automatici dei file generati. È preferibile generarli durante la build.

---

# 16. Sicurezza

Il sito tratta contenuti YAML provenienti da un repository esterno.

Applica queste misure:

* non eseguire mai codice contenuto nelle regole;
* tratta YAML e Markdown come dati non fidati;
* non usare `innerHTML` con contenuti non sanitizzati;
* valida gli URL esterni;
* consenti solamente protocolli `https:` e, quando necessario, `http:`;
* impedisci link `javascript:`;
* applica escaping a titolo, descrizione, autore e detection values;
* usa dipendenze aggiornate e minimali;
* configura Dependabot;
* aggiungi una Content Security Policy compatibile con GitHub Pages;
* non richiedere GitHub token con permessi di scrittura;
* usa permessi GitHub Actions minimi;
* non inviare dati utente a servizi esterni;
* non caricare analytics di terze parti nell’MVP.

---

# 17. Licenza e attribuzione

Aggiungi nel footer e nella pagina About:

* collegamento al repository SigmaHQ;
* indicazione che le regole appartengono ai rispettivi autori;
* riferimento alla licenza applicata dal repository SigmaHQ;
* commit sorgente utilizzato;
* data dell’ultimo aggiornamento;
* disclaimer che il sito non è affiliato o approvato ufficialmente da SigmaHQ.

Esempio:

> Sigma Rule Library is an independent community interface for exploring rules from the SigmaHQ repository. It is not affiliated with or endorsed by SigmaHQ.

Verifica la licenza direttamente dal repository sorgente e non sostituirla con una licenza scelta arbitrariamente.

Il codice del sito deve avere una licenza separata chiaramente indicata.

---

# 18. Struttura consigliata del repository

```text
sigma-rule-library/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml
│   │   └── sync-sigma.yml
│   └── dependabot.yml
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── images/
├── scripts/
│   ├── fetch-sigma.ts
│   ├── parse-sigma.ts
│   ├── build-search-index.ts
│   ├── generate-stats.ts
│   └── validate-generated-data.ts
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── SearchBar.astro
│   │   ├── FilterPanel.astro
│   │   ├── RuleCard.astro
│   │   ├── RuleMetadata.astro
│   │   ├── MitreBadges.astro
│   │   ├── LogsourceBadges.astro
│   │   ├── DetectionViewer.astro
│   │   ├── YamlViewer.astro
│   │   ├── CopyButton.astro
│   │   └── StatisticsChart.astro
│   ├── generated/
│   │   ├── rules.json
│   │   ├── stats.json
│   │   ├── import-errors.json
│   │   └── source-metadata.json
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── lib/
│   │   ├── sigma.ts
│   │   ├── search.ts
│   │   ├── filters.ts
│   │   ├── mitre.ts
│   │   ├── urls.ts
│   │   └── security.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── library.astro
│   │   ├── mitre.astro
│   │   ├── statistics.astro
│   │   ├── about.astro
│   │   ├── 404.astro
│   │   └── rules/
│   │       └── [slug].astro
│   └── styles/
│       └── global.css
├── tests/
│   ├── parser.test.ts
│   ├── filters.test.ts
│   ├── slug.test.ts
│   └── urls.test.ts
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

---

# 19. Testing

Implementa test automatici almeno per:

* parsing di una regola completa;
* parsing di una regola con campi mancanti;
* autore come stringa o array;
* false positives come stringa o array;
* detection annidata;
* tag MITRE ATT&CK;
* slug generation;
* ID duplicati;
* YAML non valido;
* URL non sicuri;
* filtri combinati;
* ricerca per technique ID;
* corretta gestione del base path GitHub Pages.

Aggiungi anche una build smoke test.

La CI deve fallire quando:

* il progetto TypeScript non compila;
* la build Astro fallisce;
* i file generati non rispettano lo schema;
* non viene importata nessuna regola;
* la percentuale di errori di parsing supera una soglia configurabile.

La CI non deve fallire per un singolo file Sigma malformato.

---

# 20. README

Scrivi un README completo contenente:

* descrizione del progetto;
* screenshot placeholder;
* funzionalità;
* architettura;
* requisiti;
* avvio locale;
* build;
* configurazione GitHub Pages;
* sincronizzazione con SigmaHQ;
* struttura dei dati;
* troubleshooting;
* sicurezza;
* licenze;
* attribuzione;
* modalità di contribuzione.

Includi comandi realmente funzionanti.

---

# 21. Requisiti MVP

La prima versione deve includere obbligatoriamente:

* import automatico delle Sigma rules;
* parser robusto;
* pagina Library;
* ricerca;
* filtri principali;
* pagina statica per ogni regola;
* visualizzazione metadata;
* visualizzazione detection;
* Raw YAML;
* copia YAML;
* download YAML;
* link GitHub;
* filtri MITRE ATT&CK;
* statistiche di base;
* dark mode;
* responsive design;
* GitHub Pages deployment;
* aggiornamento schedulato;
* test essenziali;
* README.

Non implementare nella prima versione:

* autenticazione;
* commenti;
* votazioni;
* salvataggio preferiti lato server;
* database;
* editor Sigma completo;
* esecuzione delle regole;
* connessione diretta a SIEM;
* conversione server-side;
* funzionalità AI;
* telemetria invasiva.

---

# 22. Funzionalità successive

Predisponi l’architettura, senza implementarle necessariamente nell’MVP, per:

* confronto fra due regole;
* cronologia delle modifiche;
* conversione tramite pySigma;
* export per Splunk, Elasticsearch, OpenSearch, Sentinel e Loki;
* preferiti tramite `localStorage`;
* raccolte personalizzate;
* URL con filtri salvati;
* feed delle nuove regole;
* pagina per autore;
* pagina per product;
* pagina per log source;
* visualizzazione ATT&CK Navigator;
* confronto della copertura fra release;
* modalità embedded;
* API JSON statica del catalogo.

---

# 23. Metodo di implementazione

Procedi in questo ordine:

1. analizza i repository di riferimento;
2. inizializza Astro e TypeScript;
3. configura GitHub Pages e base path;
4. realizza fetch e parser Sigma;
5. definisci gli schema TypeScript;
6. genera catalogo e statistiche;
7. crea layout e componenti;
8. implementa Library e filtri;
9. genera le pagine delle regole;
10. implementa Raw YAML, Copy e Download;
11. implementa MITRE e Statistics;
12. aggiungi test;
13. configura GitHub Actions;
14. completa README e documentazione;
15. esegui build finale e correggi tutti gli errori.

Non limitarti a generare mockup o pseudocodice.

Crea file realmente funzionanti.

Quando devi prendere una decisione non specificata:

* scegli la soluzione più semplice;
* privilegia static generation;
* limita JavaScript lato client;
* evita dipendenze superflue;
* documenta la scelta nel README.

---

# 24. Definition of Done

Il progetto è completo quando:

* `npm install` termina correttamente;
* `npm test` termina correttamente;
* `npm run build` termina correttamente;
* il catalogo contiene le regole Sigma importate;
* ogni regola valida ha una pagina;
* ricerca e filtri funzionano;
* i link funzionano con il base path di GitHub Pages;
* Copy YAML e Download YAML funzionano;
* il sito è utilizzabile da mobile;
* dark e light mode funzionano;
* gli errori di parsing sono consultabili;
* la sorgente Sigma e il commit sono visibili;
* GitHub Actions pubblica correttamente il sito;
* non è necessario alcun backend;
* non sono presenti errori evidenti nella console;
* non sono presenti segreti nel repository;
* il README permette a un nuovo sviluppatore di eseguire il progetto senza informazioni aggiuntive.

Al termine mostra:

1. struttura dei file creati;
2. principali decisioni architetturali;
3. comandi per avviare il progetto;
4. comandi per eseguire test e build;
5. istruzioni per abilitare GitHub Pages;
6. funzionalità completate;
7. eventuali limitazioni ancora presenti.

