/* Read-only live notes page.
   Query parameters:
     module = notes                    (kept for old links)
     lang   = en | fr
     theme  = dark | light              (default: dark)
     title  = optional heading override
     limit  = max notes to show (default: 24) */
(function () {
  const C = window.STICKY_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const theme = params.get("theme") === "light" ? "light" : "dark";
  const limit = Math.max(1, Math.min(60, Number(params.get("limit")) || 24));
  const title = params.get("title") || C.EVENT_TITLE || "Sticky Wall";

  const main = document.getElementById("embed-main");
  const titleEl = document.getElementById("embed-title");
  const kickerEl = document.getElementById("embed-kicker");
  const countEl = document.getElementById("embed-count");
  const footHint = document.getElementById("embed-foot-hint");

  document.body.classList.add("embed--" + theme);
  titleEl.textContent = title;
  kickerEl.textContent = t("Live notes");
  footHint.textContent = t("Updates live");
  document.title = title + " · " + t("Live notes");

  let notes = [];
  let cats = [];

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  function setStatus(text, offline) {
    countEl.textContent = text;
    document.body.classList.toggle("embed--offline", !!offline);
  }

  function empty(message) {
    main.replaceChildren(el("p", "embed-empty", message));
  }

  /* ── notes ─────────────────────────────────────────────────── */
  const PAPER = ["#F7F3C6", "#FBE9B7", "#F5D9C8", "#DDEBC8", "#CFE3EE", "#E9D8F0"];

  function noteColor(note) {
    const cat = cats.find(c => c.key === note.category);
    return cat ? (cat.color || "#E6E600") : "#E6E600";
  }

  function notePaper(note) {
    let h = 0;
    for (const ch of String(note.id || note.text || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PAPER[h % PAPER.length];
  }

  function renderNotes() {
    if (!notes.length) {
      empty(t("Waiting for the first note…"));
      setStatus(t("0 notes"));
      return;
    }
    const grid = el("div", "embed-notes");
    notes.slice(-limit).reverse().forEach(note => {
      const card = el("article", "embed-note");
      card.style.setProperty("--note-color", noteColor(note));
      card.style.setProperty("--note-paper", notePaper(note));
      let h = 0;
      for (const ch of String(note.id || "")) h = (h * 17 + ch.charCodeAt(0)) % 5;
      card.style.setProperty("--note-rot", ((h - 2) * 0.55).toFixed(2) + "deg");
      card.append(el("p", "embed-note__text", note.text || ""));
      const foot = el("footer", "embed-note__foot");
      foot.append(
        el("span", "embed-note__author", note.author || note.author_name || t("Anonymous")),
        el("span", "embed-note__cat", t(note.category || "Note"))
      );
      card.append(foot);
      grid.append(card);
    });
    main.replaceChildren(grid);
    setStatus(notes.length === 1 ? t("1 note") : t("{n} notes", { n: notes.length }));
  }

  function upsert(list, item, key) {
    const i = list.findIndex(x => x[key] === item[key]);
    if (i >= 0) list[i] = item;
    else list.push(item);
    return i >= 0;
  }

  /* ── data ──────────────────────────────────────────────────── */
  async function loadNotes() {
    notes = await Store.list();
    notes.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    renderNotes();
  }

  async function start() {
    try {
      cats = await Store.getCategories();
      if (typeof applyCategories === "function") applyCategories(cats);
    } catch (err) {
      console.warn("Categories unavailable", err);
    }

    await loadNotes();
    Store.subscribe({
      onAdd(note) { upsert(notes, note, "id"); renderNotes(); },
      onRemove(id) { notes = notes.filter(n => n.id !== id); renderNotes(); },
      onUpdate(note) { if (note) { upsert(notes, note, "id"); renderNotes(); } },
      onReassign() { loadNotes().catch(err => console.warn(err)); },
      resync() { loadNotes().catch(err => console.warn(err)); }
    });
  }

  start().catch(err => {
    console.error("Embed could not start", err);
    empty(t("Could not load live results."));
    setStatus(t("Offline"), true);
  });
})();
