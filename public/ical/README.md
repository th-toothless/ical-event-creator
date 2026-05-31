# Rozpis → iCal

Statická webová aplikace, která z Excelu (`rozpis_*.xlsx`) vygeneruje `.ics` kalendář pro vybranou osobu.

## Použití

1. Otevři nasazenou stránku (GitHub Pages URL).
2. Nahraj `.xlsx` rozpis kliknutím na pole **Excel soubor (.xlsx)**.
   - Aplikace automaticky rozpozná listy pojmenované `01` až `12` (Leden–Prosinec).
3. Vyber měsíce, ze kterých chceš generovat kalendář.
   - Měsíce, které v souboru existují, jsou automaticky zaškrtnuté a aktivní. Chybějící měsíce jsou neaktivní.
   - Změnou výběru měsíce se aktualizuje i seznam osob a počet směn.
4. Vyber jméno z rozbalovacího seznamu.
5. (Volitelně) Doplň poznámku do pole **Poznámka** — text se přidá do popisu každé události v `.ics` souboru.
6. Klikni na **Stáhnout .ics**.
   - Pro každý vybraný měsíc se stáhne samostatný `.ics` soubor (např. `rozpis-jmeno-2026-01.ics`, `rozpis-jmeno-2026-02.ics`, …).
7. Importuj stažené `.ics` soubory do Google Kalendáře, Apple Kalendáře nebo Outlooku.

## Lokálně

Stačí otevřít `index.html` v prohlížeči, nebo:

```bash
python3 -m http.server -d public/ical 8000
```

## Nasazení

Nasazuje se přes GitHub Actions workflow `.github/workflows/deploy-pages.yml` při pushi do `main`.
