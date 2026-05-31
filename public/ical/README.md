# Rozpis → iCal

Statická webová aplikace, která z Excelu (`rozpis_*.xlsx`) vygeneruje `.ics` kalendář pro vybranou osobu.

## Použití
1. Otevři nasazenou stránku (GitHub Pages URL).
2. Nahraj `.xlsx` rozpis.
3. Vyber jméno, případně doplň poznámku.
4. Stáhni `.ics` a importuj do Google / Apple / Outlook.

## Lokálně
Stačí otevřít `index.html` v prohlížeči, nebo:
```
python3 -m http.server -d public/ical 8000
```

## Nasazení
Nasazuje se přes GitHub Actions workflow `.github/workflows/deploy-pages.yml` při pushi do `main`.
