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
- **Controlla uno strumento, o un intero elenco.** Incolla un link GitHub, `owner/nome`, un nome o un testo intero pieno di questi. Helm legge ogni repository (licenza, se è archiviato, ultimo aggiornamento, stelle, e se contiene un plugin o una skill), lo scansiona, dà un verdetto in parole semplici per ogni riga e installa solo ciò che spunti. Le modifiche valgono subito quando Claude Code lo permette. Uno strumento aggiunto per un progetto viene poi proposto per tutti.
- **Vedi cosa è in uso qui.** In cima alla pagina **Project** compare solo ciò che Claude ha usato in questa cartella, per categoria, con quante volte e quando. Una skill appena usata è accesa. Non costa token.
- **Tieni i limiti sott'occhio.** Una riga discreta sopra il prompt mostra i limiti delle 5 ore e della settimana e il contesto come piccole barre, più la skill che Claude sta usando, con un puntino di sicurezza e il tasto **Open Helm**. I valori seguono la sessione mentre lavora.
- **Parla la tua lingua.** 16 lingue, di default quella del computer, cambiabile dal pannello.
- **Controlla prima di fidarti.** [SkillSpector](https://github.com/NVIDIA/SkillSpector) di NVIDIA scansiona ogni skill e plugin che hai, e ogni strumento nuovo prima che si possa installare, cercando prompt injection, furto di dati e codice rischioso. Se la scansione dice "non installare", il tasto Installa sparisce. È solo analisi statica: nessun modello, nessuna chiave, niente esce dal computer. Helm lo tiene aggiornato.
- **Tienila in salute, e saperlo.** La sezione **Stato** della scheda Globale dice solo ciò che ha davvero controllato. Salute guarda file rotti, doppioni, strumenti che fanno lo stesso lavoro e skill mai usate (dopo due settimane di osservazione). Aggiornamenti legge l'esito di ogni plugin. Sicurezza è verde solo se ogni strumento è stato scansionato e nessuno è segnalato. Togliere un plugin funziona qualunque sia lo scope in cui è installato. Niente di questo tocca le impostazioni di un progetto. Sotto, ogni strumento e skill è raccolto per categoria: premi un nome per vedere cos'è e cosa fa.
- **Avvia bene un repository.** Se è disponibile un connettore GitHub, una casella aggiunge al tuo primo prompt una base professionale per GitHub: scegli la licenza e le voci che vuoi (README, CI, `SECURITY.md`, Dependabot, protezione del ramo e altro), aggiungi le tue indicazioni, e resta memorizzato.

<div align="center">
<img src="docs/demo.gif" alt="Helm in quattro passi" width="820">
</div>

<div align="center">
<img src="docs/screenshot-project.png" alt="La pagina Project: ciò che Claude ha usato in questa cartella per categoria, poi i passi di impostazione" width="560">
</div>

## Installazione

Serve Claude Code **2.1.289 o successivo**.

```text
/plugin marketplace add rlpb/helm
/plugin install helm@helm
```

Poi scrivi `/helm`. In una cartella che Helm non conosce compare anche un avviso sopra il prompt: **Open** o **Not here** (ricordato per cartella). In una chat già avviata propone invece di leggere la cartella e suggerire gli strumenti.

## Come resta sicuro

- Esegue solo comandi `gh`, `claude plugin …`, `skillspector` e `uv tool …`, costruiti da nomi semplici, e non installa nulla senza un sì.
- La configurazione di un progetto va nel file `.claude/settings.local.json` di quella cartella, mai nelle impostazioni globali. Annulla ripristina i valori precedenti chiave per chiave.
- Il controllo di salute legge soltanto. L'unica correzione, togliere un plugin con i file spariti, richiede una seconda pressione; se il comando non riesce, Helm modifica da sé il registro dei plugin dopo averne salvato una copia accanto (`installed_plugins.json.helm-backup`).
- Helm non fa chiamate di rete proprie.

Vedi [SECURITY.md](SECURITY.md) per segnalare un problema e verificare un download.

## Verificare un download

Le release sono costruite dal workflow di release a partire da un commit con tag, con checksum SHA-256 e attestazione di provenienza:

```bash
sha256sum -c SHA256SUMS.txt
gh attestation verify helm-0.12.3.zip --repo rlpb/helm
```

## Supporto

Helm è gratuito, con licenza Apache 2.0. Niente è a pagamento e niente lo sarà. Se ti fa risparmiare tempo, un caffè aiuta a mandarlo avanti.

<div align="center">
<a href="https://ko-fi.com/rlpb_"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Sostieni su Ko-fi"></a>
</div>

## Licenza

Apache License 2.0. Riusalo, modificalo e distribuiscilo, anche a scopo commerciale; conserva la licenza e il file [NOTICE](NOTICE) e indica cosa hai cambiato. Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per aiutare.
