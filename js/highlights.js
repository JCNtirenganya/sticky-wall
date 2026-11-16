/* AI highlights report for the presenter board.

   window.StickyHighlights.open(payload)
     Reads every note on the wall and writes a short report: themes,
     representative quotes and participation. When STICKY_CONFIG.HIGHLIGHTS_URL
     points at a Supabase Edge Function the report is written by the model it
     calls; otherwise a deterministic local extractor produces it, so the
     feature always works without a key.

   "Save as PDF" fills the print-only #print-sheet and opens the browser's
   print dialog, where "Save as PDF" produces a clean report.

   payload = {
     notes: [{ id, author|name, text, category, created_at }],
     categories: [{ key, label, color }],
     brand: { title, subtitle, logo },
     stats: { media, stream }
   }                                                                     */

(function () {
  const t = (key, vars) => typeof window.t === "function" ? window.t(key, vars) : key;
  const $ = id => document.getElementById(id);
  const dialog = $("highlights-dialog");
  const body = $("highlights-body");
  const sourceBadge = $("highlights-source");
  const saveBtn = $("highlights-pdf");
  const closeBtn = $("highlights-close");
  if (!dialog || !body) return;

  const STOP = new Set((
    "the a an and or but if then than that this these those you your yours we our ours i me my mine " +
    "is are was were be been being am do does did done have has had having to of in on at for from with " +
    "by about as into over after before between out up down off again very just too also so not no yes " +
    "it its it's they them their there here what which who whom whose when where why how all any both " +
    "each few more most other some such only own same can could should would will shall may might must " +
    "de la le les un une des du au aux et ou mais si alors que qui quoi dont où comment pourquoi quand " +
    "je tu il elle nous vous ils elles mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs " +
    "ce cet cette ces celui celle pour par dans sur avec sans sous entre chez est sont était étaient " +
    "être avoir ai as a avons avez ont plus moins très aussi bien tout tous toute toutes rien non oui " +
    "on se sa ne pas que qu c l d j m n s t y à è é ê ë î ï ô ö ù û ü ç"
  ).split(/\s+/).filter(Boolean));

  const clean = value => String(value == null ? "" : value).replace(/\r\n/g, "\n").trim();
  const plain = value => {
    const text = typeof window.notePlainText === "function"
      ? window.notePlainText(value)
      : clean(value);
    return clean(text);
  };
  const words = text => (plain(text).toLowerCase().match(/[a-zà-öø-ÿ0-9']+/gi) || [])
    .filter(word => word.length > 2 && !STOP.has(word));
  const dateValue = item => {
    const d = new Date(item?.created_at || "");
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const locale = () => typeof window.I18N?.locale === "function" ? window.I18N.locale() : undefined;
  const dateLabel = value => {
    const d = new Date(value || "");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
  };

  function catFor(payload, key) {
    const list = Array.isArray(payload?.categories) ? payload.categories : [];
    return list.find(cat => cat.key === key) || { key, label: key || "Note", color: "#f0d88c" };
  }

  function sortedNotes(payload) {
    return (Array.isArray(payload?.notes) ? payload.notes : []).slice().sort((a, b) =>
      String(a?.created_at || "").localeCompare(String(b?.created_at || ""))
    );
  }

  /* ── local extractor ──────────────────────────────────────── */
  function topWords(list, limit) {
    const counts = new Map();
    list.forEach(note => {
      new Set(words(note.text)).forEach(word => {
        counts.set(word, (counts.get(word) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, limit)
      .map(([word]) => word);
  }

  function localReport(payload) {
    const notes = sortedNotes(payload);
    const total = notes.length;
    const byCat = new Map();
    const authors = new Map();
    let anonymous = 0;
    let first = null;
    let last = null;

    notes.forEach(note => {
      const key = note.category || "note";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(note);

      const author = clean(note.author || note.name);
      if (author) authors.set(author, (authors.get(author) || 0) + 1);
      else anonymous += 1;

      const at = dateValue(note);
      if (at) {
        if (!first || at < first) first = at;
        if (!last || at > last) last = at;
      }
    });

    const themes = [...byCat.entries()]
      .map(([key, list]) => {
        const cat = catFor(payload, key);
        const wordsTop = topWords(list, 5);
        return {
          title: t(cat.label || cat.key || "Note"),
          color: cat.color || "#f0d88c",
          count: list.length,
          detail: wordsTop.length
            ? t("Recurring words: {words}.", { words: wordsTop.join(", ") })
            : t("Quiet, personal notes.")
        };
      })
      .sort((a, b) => b.count - a.count);

    const overallWords = topWords(notes, 6);
    const people = authors.size + (anonymous ? 1 : 0);
    const quotePool = notes
      .map(note => {
        const text = plain(note.text);
        const count = words(text).length;
        if (text.length < 16 || count < 3) return null;
        let score = Math.min(count, 30) + Math.min(text.length / 45, 4);
        if (/[?!]/.test(text)) score += 2.4;
        if (text.length <= 190) score += 1.2;
        return { note, text, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    /* One strong quote per category first, then fill by score. */
    const quotes = [];
    const seenCats = new Set();
    quotePool.forEach(candidate => {
      if (quotes.length >= 5 || seenCats.has(candidate.note.category)) return;
      seenCats.add(candidate.note.category);
      quotes.push(candidate);
    });
    quotePool.forEach(candidate => {
      if (quotes.length >= 5 || quotes.includes(candidate)) return;
      if (quotes.some(q => q.text.slice(0, 42) === candidate.text.slice(0, 42))) return;
      quotes.push(candidate);
    });

    const span = first && last
      ? (dateLabel(first) === dateLabel(last)
        ? dateLabel(first)
        : dateLabel(first) + " – " + dateLabel(last))
      : "";

    const summary = total === 0
      ? t("There are no notes on the wall yet.")
      : [
        total === 1
          ? t("One note came in from {people} contributor.", { people })
          : t("{n} notes came in from {people} contributors.", { n: total, people }),
        themes.length
          ? t("Most of the writing sits in {theme}.", { theme: themes[0].title })
          : "",
        overallWords.length
          ? t("The words that return most often are {words}.", { words: overallWords.join(", ") })
          : ""
      ].filter(Boolean).join(" ");

    const stats = [
      { label: t("Notes"), value: String(total) },
      { label: t("Contributors"), value: String(people) },
      { label: t("Categories"), value: String(themes.length) },
      { label: t("Days"), value: first && last ? String(new Set(notes.map(n => dateLabel(n.created_at)).filter(Boolean)).size) : "0" }
    ];

    const participation = [
      { label: t("Notes on the wall"), value: String(total) },
      { label: t("Named contributors"), value: String(authors.size) },
      { label: t("Anonymous notes"), value: String(anonymous) },
      { label: t("First note"), value: dateLabel(first) || t("Unknown") },
      { label: t("Last note"), value: dateLabel(last) || t("Unknown") },
      { label: t("Media on the wall"), value: String(Number(payload?.stats?.media) || 0) }
    ];

    return {
      source: "local",
      generatedAt: new Date().toISOString(),
      total,
      span,
      summary,
      stats,
      themes,
      quotes: quotes.map(candidate => {
        const cat = catFor(payload, candidate.note.category);
        return {
          text: candidate.text,
          author: clean(candidate.note.author || candidate.note.name) || t("Anonymous"),
          category: t(cat.label || cat.key || "Note"),
          color: cat.color || "#f0d88c"
        };
      }),
      participation
    };
  }

  /* ── optional model-written report ────────────────────────── */
  function normaliseRemote(data, local) {
    if (!data || typeof data !== "object") return local;
    const source = data.report && typeof data.report === "object" ? data.report : data;
    const asText = value => clean(value);
    const themes = Array.isArray(source.themes)
      ? source.themes.map(item => {
        if (typeof item === "string") return { title: item, detail: "", count: 0, color: "#f0d88c" };
        return {
          title: asText(item?.title || item?.theme),
          detail: asText(item?.detail || item?.summary),
          count: Number(item?.count) || 0,
          color: asText(item?.color) || "#f0d88c"
        };
      }).filter(item => item.title)
      : local.themes;
    const quotes = Array.isArray(source.quotes)
      ? source.quotes.map(item => {
        if (typeof item === "string") return { text: item, author: t("Anonymous"), category: "", color: "#f0d88c" };
        return {
          text: asText(item?.text || item?.quote),
          author: asText(item?.author) || t("Anonymous"),
          category: asText(item?.category),
          color: asText(item?.color) || "#f0d88c"
        };
      }).filter(item => item.text)
      : local.quotes;
    return {
      ...local,
      source: "ai",
      summary: asText(source.summary) || local.summary,
      themes: themes.slice(0, 6),
      quotes: quotes.slice(0, 5)
    };
  }

  async function requestRemote(payload, local) {
    const url = clean(window.STICKY_CONFIG?.HIGHLIGHTS_URL);
    if (!url) return local;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          notes: sortedNotes(payload).map(note => ({
            text: plain(note.text),
            author: clean(note.author || note.name),
            category: catFor(payload, note.category).label || note.category,
            created_at: note.created_at
          })),
          brand: payload?.brand || {},
          stats: payload?.stats || {}
        })
      });
      if (!response.ok) throw new Error("Highlights request failed");
      return normaliseRemote(await response.json(), local);
    } catch (error) {
      console.warn("Highlights request fell back to the local report", error);
      return local;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ── rendering ────────────────────────────────────────────── */
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  function section(title) {
    const box = el("section", "highlights-section");
    box.appendChild(el("h3", "highlights-section__title", title));
    return box;
  }

  function render(report) {
    body.replaceChildren();
    sourceBadge.hidden = false;
    sourceBadge.textContent = report.source === "ai" ? t("AI summary") : t("Local summary");
    sourceBadge.dataset.source = report.source;

    body.appendChild(el("p", "highlights-summary", report.summary));

    const stats = el("div", "highlights-stats");
    report.stats.forEach(stat => {
      const cell = el("div", "highlights-stat");
      cell.appendChild(el("b", null, stat.value));
      cell.appendChild(el("span", null, stat.label));
      stats.appendChild(cell);
    });
    body.appendChild(stats);

    if (report.themes.length) {
      const themes = section(t("Themes"));
      const list = el("ul", "highlights-themes");
      report.themes.forEach(theme => {
        const row = el("li", "highlights-theme");
        row.style.setProperty("--theme", theme.color);
        const head = el("div", "highlights-theme__head");
        head.appendChild(el("span", "highlights-theme__dot"));
        head.appendChild(el("b", null, theme.title));
        if (theme.count) head.appendChild(el("span", "highlights-theme__count", String(theme.count)));
        row.appendChild(head);
        if (theme.detail) row.appendChild(el("p", null, theme.detail));
        list.appendChild(row);
      });
      themes.appendChild(list);
      body.appendChild(themes);
    }

    if (report.quotes.length) {
      const quotes = section(t("In their words"));
      const list = el("div", "highlights-quotes");
      report.quotes.forEach(quote => {
        const card = el("blockquote", "highlights-quote");
        card.style.setProperty("--quote", quote.color);
        card.appendChild(el("p", null, quote.text));
        const foot = el("footer");
        foot.appendChild(el("b", null, "— " + quote.author));
        if (quote.category) foot.appendChild(el("span", null, quote.category));
        card.appendChild(foot);
        list.appendChild(card);
      });
      quotes.appendChild(list);
      body.appendChild(quotes);
    }

    const part = section(t("Participation"));
    const table = el("dl", "highlights-part");
    report.participation.forEach(item => {
      table.appendChild(el("dt", null, item.label));
      table.appendChild(el("dd", null, item.value));
    });
    part.appendChild(table);
    body.appendChild(part);

    const stamp = report.span ? t("{span} · written {date}", { span: report.span, date: dateLabel(report.generatedAt) }) : "";
    body.appendChild(el("p", "highlights-stamp", stamp));
  }

  function renderEmpty() {
    body.replaceChildren();
    sourceBadge.hidden = true;
    body.appendChild(el("div", "highlights-empty"));
    body.lastChild.appendChild(el("b", null, t("No notes to report yet.")));
    body.lastChild.appendChild(el("p", null, t("Notes appear here as soon as the wall receives one.")));
  }

  function renderLoading() {
    body.replaceChildren();
    sourceBadge.hidden = true;
    const loading = el("div", "highlights-loading");
    loading.appendChild(el("span", "highlights-loading__dot"));
    loading.appendChild(el("p", null, t("Reading the wall…")));
    body.appendChild(loading);
  }

  function printSheet(report, payload) {
    const sheet = $("print-sheet");
    if (!sheet) return;
    const brand = payload?.brand || {};
    sheet.replaceChildren();

    const head = el("header", "print-head");
    if (brand.logo) {
      const logo = document.createElement("img");
      logo.className = "print-logo";
      logo.src = brand.logo;
      logo.alt = "";
      head.appendChild(logo);
    }
    const copy = el("div", "print-copy");
    copy.appendChild(el("p", "print-kicker", t("Highlights report")));
    copy.appendChild(el("h1", "print-title", clean(brand.title) || t("Sticky Wall")));
    if (clean(brand.subtitle)) copy.appendChild(el("p", "print-sub", clean(brand.subtitle)));
    head.appendChild(copy);

    const meta = el("div", "print-meta");
    meta.appendChild(el("b", null, report.total === 1 ? t("1 note") : t("{n} notes", { n: report.total })));
    meta.appendChild(el("span", null, dateLabel(report.generatedAt)));
    head.appendChild(meta);
    sheet.appendChild(head);

    const summary = el("section", "report-section report-section--summary");
    summary.appendChild(el("h2", "report-title", t("Summary")));
    summary.appendChild(el("p", "report-summary", report.summary));
    if (report.span) summary.appendChild(el("p", "report-span", report.span));
    sheet.appendChild(summary);

    const stats = el("div", "report-stats");
    report.stats.forEach(stat => {
      const cell = el("div", "report-stat");
      cell.appendChild(el("b", null, stat.value));
      cell.appendChild(el("span", null, stat.label));
      stats.appendChild(cell);
    });
    sheet.appendChild(stats);

    if (report.themes.length) {
      const themes = el("section", "report-section");
      themes.appendChild(el("h2", "report-title", t("Themes")));
      report.themes.forEach(theme => {
        const row = el("div", "report-theme");
        row.style.setProperty("--theme", theme.color);
        const head = el("p", "report-theme__head");
        head.appendChild(el("span", "report-theme__dot"));
        head.appendChild(el("b", null, theme.title));
        if (theme.count) head.appendChild(el("span", "report-theme__count", String(theme.count)));
        row.appendChild(head);
        if (theme.detail) row.appendChild(el("p", "report-theme__detail", theme.detail));
        themes.appendChild(row);
      });
      sheet.appendChild(themes);
    }

    if (report.quotes.length) {
      const quotes = el("section", "report-section");
      quotes.appendChild(el("h2", "report-title", t("In their words")));
      report.quotes.forEach(quote => {
        const card = el("blockquote", "report-quote");
        card.style.setProperty("--quote", quote.color);
        card.appendChild(el("p", null, quote.text));
        const foot = el("footer");
        foot.appendChild(el("b", null, "— " + quote.author));
        if (quote.category) foot.appendChild(el("span", null, quote.category));
        card.appendChild(foot);
        quotes.appendChild(card);
      });
      sheet.appendChild(quotes);
    }

    const part = el("section", "report-section");
    part.appendChild(el("h2", "report-title", t("Participation")));
    const table = el("dl", "report-part");
    report.participation.forEach(item => {
      table.appendChild(el("dt", null, item.label));
      table.appendChild(el("dd", null, item.value));
    });
    part.appendChild(table);
    sheet.appendChild(part);

    const foot = el("p", "report-foot");
    foot.textContent = report.source === "ai"
      ? t("Highlights written from the notes on this wall.")
      : t("Local highlights extracted from the notes on this wall.");
    sheet.appendChild(foot);
  }

  async function savePDF(payload, report) {
    if (!report) return;
    if (typeof saveBtn?.setAttribute === "function") saveBtn.disabled = true;
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      printSheet(report, payload);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  let currentPayload = null;
  let currentReport = null;

  async function open(payload) {
    currentPayload = payload || { notes: [] };
    const notes = sortedNotes(currentPayload);
    if (!notes.length) {
      currentReport = null;
      renderEmpty();
    } else {
      renderLoading();
      const local = localReport(currentPayload);
      currentReport = await requestRemote(currentPayload, local);
      render(currentReport);
    }
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }

  closeBtn?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  saveBtn?.addEventListener("click", () => savePDF(currentPayload, currentReport));

  window.StickyHighlights = { open };
})();
