/* Rozpis → iCal generator. Pure browser, no build step. */
(() => {
  const $ = (id) => document.getElementById(id);
  const fileInput = $("file");
  const personSel = $("person");
  const noteEl = $("note");
  const goBtn = $("go");
  const statusEl = $("status");

  const MONTH_SHEETS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const NAME_COL = 36;       // column with person names ("Podpis")
  const DAY_ROW = 6;         // row index with day numbers "1." "2." ...
  const FIRST_NAME_ROW = 9;  // names start here
  const DATE_ROW = 5;        // sheet's month date lives at col 1 row 5
  const DATE_COL = 1;

  let workbook = null;
  /** Map<name, Array<{year,month,day,code}>> */
  let perPerson = new Map();

  // ---------- helpers ----------

  const setStatus = (msg, cls = "muted") => { statusEl.className = cls; statusEl.textContent = msg; };

  /** Normalize a shift code: strip leading marker letters (T, C, S, *) and uppercase.
   *  Returns one of "CD","D","N","G" or null. */
  function normalizeCode(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;
    // Strip a single leading marker letter when followed by another letter,
    // so Tn→N, Cn→N, Tcd→CD, Sr stays Sr (then rejected).
    if (/^[TCS*][a-zA-Z]/.test(s)) s = s.slice(1);
    s = s.toUpperCase();
    if (s === "CD" || s === "D" || s === "N" || s === "G") return s;
    return null;
  }

  function sheetToAOA(sheet) {
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  }

  /** Get JS Date year/month from the sheet's date cell. */
  function readSheetYearMonth(aoa, fallbackMonthIdx) {
    const cell = aoa[DATE_ROW] && aoa[DATE_ROW][DATE_COL];
    if (cell instanceof Date) {
      return { year: cell.getFullYear(), month: cell.getMonth() + 1 };
    }
    if (typeof cell === "number") {
      // Excel serial date
      const d = XLSX.SSF ? XLSX.SSF.parse_date_code(cell) : null;
      if (d) return { year: d.y, month: d.m };
    }
    if (typeof cell === "string") {
      const m = cell.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return { year: +m[1], month: +m[2] };
    }
    // fallback: current year, month from sheet name index
    return { year: new Date().getFullYear(), month: fallbackMonthIdx + 1 };
  }

  /** Find column indices that correspond to day-of-month numbers in DAY_ROW. */
  function dayColumns(aoa) {
    const row = aoa[DAY_ROW] || [];
    const cols = [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v == null) continue;
      const m = String(v).match(/^(\d{1,2})\.?$/);
      if (m) {
        const n = +m[1];
        if (n >= 1 && n <= 31) cols.push({ col: c, day: n });
      }
    }
    return cols;
  }

  function parseWorkbook(wb) {
    perPerson = new Map();
    for (let i = 0; i < MONTH_SHEETS.length; i++) {
      const name = MONTH_SHEETS[i];
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      const aoa = sheetToAOA(sheet);
      const { year, month } = readSheetYearMonth(aoa, i);
      const cols = dayColumns(aoa);
      if (!cols.length) continue;

      // Days table: first set of columns whose day numbers start at 1 belong to this month.
      // Some sheets have a leading "last day of previous month" cell — filter those by
      // only keeping the longest ascending-from-1 run.
      let startIdx = cols.findIndex(c => c.day === 1);
      if (startIdx < 0) startIdx = 0;
      const monthCols = [];
      let expected = 1;
      for (let k = startIdx; k < cols.length; k++) {
        if (cols[k].day === expected) {
          monthCols.push(cols[k]);
          expected++;
        } else break;
      }

      for (let r = FIRST_NAME_ROW; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row) continue;
        const rawName = row[NAME_COL];
        if (rawName == null) continue;
        const nm = String(rawName).trim();
        if (!nm) continue;
        if (/^\d+$/.test(nm)) continue;            // skip "0" placeholders
        if (/^(podpis|kom hod|velín|velin|p2|celkem)$/i.test(nm)) continue;
        if (/^(neobsazené|volne velin|xxxx)/i.test(nm)) continue;

        for (const { col, day } of monthCols) {
          const code = normalizeCode(row[col]);
          if (!code) continue;
          if (!perPerson.has(nm)) perPerson.set(nm, []);
          perPerson.get(nm).push({ year, month, day, code });
        }
      }
    }
  }

  function populatePersonDropdown() {
    const names = [...perPerson.keys()].sort((a, b) => a.localeCompare(b, "cs"));
    personSel.innerHTML = "";
    if (!names.length) {
      personSel.innerHTML = '<option>— žádná jména nenalezena —</option>';
      personSel.disabled = true;
      goBtn.disabled = true;
      return;
    }
    for (const n of names) {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = `${n} (${perPerson.get(n).length} směn)`;
      personSel.appendChild(opt);
    }
    personSel.disabled = false;
    goBtn.disabled = false;
  }

  // ---------- iCal building ----------

  function pad(n) { return String(n).padStart(2, "0"); }

  /** Local floating datetime → "YYYYMMDDTHHMMSS" with TZID=Europe/Prague. */
  function fmtLocal(y, m, d, hh, mm) {
    return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
  }

  function addDays(y, m, d, n) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function shiftTimes(code, y, m, d) {
    // returns {start:{y,m,d,hh,mm}, end:{...}}
    const s = { y, m, d, hh: 7, mm: 0 };
    let e;
    if (code === "CD") {
      const n = addDays(y, m, d, 1);
      e = { y: n.y, m: n.m, d: n.d, hh: 7, mm: 0 };
    } else if (code === "D") {
      e = { y, m, d, hh: 19, mm: 0 };
    } else if (code === "N") {
      s.hh = 19;
      const n = addDays(y, m, d, 1);
      e = { y: n.y, m: n.m, d: n.d, hh: 7, mm: 0 };
    } else if (code === "G") {
      e = { y, m, d, hh: 17, mm: 0 };
    }
    return { start: s, end: e };
  }

  const TITLES = {
    CD: "Služba 24h (CD)",
    D:  "Denní (D)",
    N:  "Noční (N)",
    G:  "Garáž (G)",
  };

  function escapeICS(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function foldLine(line) {
    // RFC5545: lines >75 octets are folded
    if (line.length <= 75) return line;
    const parts = [];
    let i = 0;
    while (i < line.length) {
      parts.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
      i += 74;
    }
    return parts.join("\r\n");
  }

  function buildICS(events, person, note) {
    const now = new Date();
    const dtstamp =
      `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Lovable//Rozpis iCal//CS",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Rozpis ${escapeICS(person)}`,
      "X-WR-TIMEZONE:Europe/Prague",
      // Minimal Europe/Prague VTIMEZONE
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Prague",
      "BEGIN:STANDARD",
      "DTSTART:19701025T030000",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0100",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "TZNAME:CET",
      "END:STANDARD",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700329T020000",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "TZNAME:CEST",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
    ];

    for (const ev of events) {
      const { start, end } = shiftTimes(ev.code, ev.year, ev.month, ev.day);
      const uid = `rozpis-${escapeICS(person)}-${ev.year}${pad(ev.month)}${pad(ev.day)}-${ev.code}@lovable`;
      const summary = TITLES[ev.code] || ev.code;
      const desc = note && note.trim()
        ? `${summary}\n${note.trim()}`
        : summary;
      lines.push(
        "BEGIN:VEVENT",
        foldLine(`UID:${uid}`),
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=Europe/Prague:${fmtLocal(start.y,start.m,start.d,start.hh,start.mm)}`,
        `DTEND;TZID=Europe/Prague:${fmtLocal(end.y,end.m,end.d,end.hh,end.mm)}`,
        foldLine(`SUMMARY:${escapeICS(summary)}`),
        foldLine(`DESCRIPTION:${escapeICS(desc)}`),
        "END:VEVENT",
      );
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function downloadICS(text, filename) {
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFilename(s) {
    return s.replace(/[^a-z0-9\-_.]+/gi, "_");
  }

  // ---------- events ----------

  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      setStatus("Načítám…");
      const buf = await f.arrayBuffer();
      workbook = XLSX.read(buf, { type: "array", cellDates: true });
      parseWorkbook(workbook);
      populatePersonDropdown();
      const total = [...perPerson.values()].reduce((a, v) => a + v.length, 0);
      setStatus(`Načteno ${perPerson.size} osob, ${total} směn.`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Chyba při čtení souboru: " + (err.message || err), "err");
    }
  });

  goBtn.addEventListener("click", () => {
    const person = personSel.value;
    const events = perPerson.get(person) || [];
    if (!events.length) { setStatus("Pro tuto osobu nejsou žádné směny.", "err"); return; }
    const year = events[0].year;
    const ics = buildICS(events, person, noteEl.value);
    downloadICS(ics, `rozpis-${safeFilename(person)}-${year}.ics`);
    setStatus(`Hotovo — ${events.length} událostí.`, "ok");
  });
})();
