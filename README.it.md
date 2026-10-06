<div align="center">

<img src="docs/banner.png" alt="Helm: the control panel for Claude Code" width="100%">

**Il pannello di controllo di Claude Code.** Prepara ogni progetto con le skill giuste, mostra cosa è in uso e controlla i nuovi strumenti prima che tu li aggiunga.

[![CI](https://github.com/rlpb/helm/actions/workflows/ci.yml/badge.svg)](https://github.com/rlpb/helm/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/rlpb_)

[English](README.md) · Italiano

</div>

Ogni settimana escono nuovi plugin, skill e strumenti. Helm è il posto in Claude Code dove li vedi tutti, scegli quelli che servono a un progetto e ne controlli uno nuovo prima che entri.

## Cosa fa

- **Prepara un progetto.** Apri una cartella nuova e Helm chiede cosa stai costruendo. Propone gli strumenti adatti tra quelli già installati, e un solo tasto li accende solo per quella cartella. Annulla rimette la cartella esattamente com'era.
- **Controlla uno strumento.** Incolla un link GitHub, `owner/nome` o solo un nome. Helm legge il repository (licenza, se è archiviato, ultimo aggiornamento, stelle, e se contiene un plugin o una skill), dà un verdetto in parole semplici e installa solo dopo il tuo sì. Uno strumento aggiunto per un progetto viene poi proposto per tutti.
- **Vedi cosa è in uso.** La scheda **Map** disegna tutto ciò che è installato come un grafo vivo. Quando Claude usa una skill, il suo punto si accende e sfuma. Non costa token.
- **Tienila in salute.** *Tidy up* trova plugin con i file spariti, cartelle di skill rotte, skill senza descrizione e nomi doppi. *Update all* aggiorna tutti i plugin con un tasto. Nessuno dei due tocca le impostazioni di un progetto.
- **Avvia bene un repository.** Se è disponibile un connettore GitHub, una casella aggiunge al tuo primo prompt una base professionale per GitHub: scegli la licenza e le voci che vuoi (README, CI, `SECURITY.md`, Dependabot, protezione del ramo e altro), aggiungi le tue indicazioni, e resta memorizzato.

<div align="center">
<img src="docs/demo.gif" alt="Helm in quattro passi" width="820">
</div>

<div align="center">
<img src="docs/map.svg" alt="La scheda Map: un nodo per categoria con un punto per skill, che si accende quando Claude le usa" width="640">
</div>

## Installazione

Serve Claude Code **2.1.289 o successivo**.

```text
/plugin marketplace add rlpb/helm
/plugin install helm@helm
```

Poi scrivi `/helm`. In una cartella che Helm non conosce compare anche un avviso sopra il prompt: **Open** o **Not here** (ricordato per cartella).

## Come resta sicuro

- Esegue solo comandi `gh` e `claude plugin …`, costruiti da nomi semplici, e non installa nulla senza un sì.
- La configurazione di un progetto va nel file `.claude/settings.local.json` di quella cartella, mai nelle impostazioni globali. Annulla ripristina i valori precedenti chiave per chiave.
- *Tidy up* legge soltanto. L'unica correzione, togliere un plugin con i file spariti, richiede una seconda pressione.
- Helm non fa chiamate di rete proprie.

Vedi [SECURITY.md](SECURITY.md) per segnalare un problema e verificare un download.

## Verificare un download

Le release sono costruite dal workflow di release a partire da un commit con tag, con checksum SHA-256 e attestazione di provenienza:

```bash
sha256sum -c SHA256SUMS.txt
gh attestation verify helm-0.2.0.zip --repo rlpb/helm
```

## Supporto

Helm è gratuito, con licenza Apache 2.0. Niente è a pagamento e niente lo sarà. Se ti fa risparmiare tempo, un caffè aiuta a mandarlo avanti.

<div align="center">
<a href="https://ko-fi.com/rlpb_"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Sostieni su Ko-fi"></a>
</div>

## Licenza

Apache License 2.0. Riusalo, modificalo e distribuiscilo, anche a scopo commerciale; conserva la licenza e il file [NOTICE](NOTICE) e indica cosa hai cambiato. Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per aiutare.
