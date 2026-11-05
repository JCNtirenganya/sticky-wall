/* Read-only live results page.
   Query parameters:
     module = notes | polls | poll      (default: notes)
     id     = poll id when module=poll
     lang   = en | rw | fr
     theme  = dark | light              (default: dark)
     style  = hand | clean              (default: hand)
     type   = auto | bars | columns | donut | line | cloud  (default: auto)
     title  = optional heading override
     limit  = max polls or notes to show (default: 24) */
(function () {
  const C = window.STICKY_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const module = (params.get("module") || "notes").toLowerCase();
  const pollId = params.get("id") || "";
  const style = params.get("style") === "clean" ? "clean" : "hand";
  const type = ["auto", "bars", "columns", "donut", "line", "cloud"].includes(params.get("type"))
    ? params.get("type") : "auto";
  const theme = params.get("theme") === "light" ? "light" : "dark";
  const limit = Math.max(1, Math.min(60, Number(params.get("limit")) || 24));
  const title = params.get("title") || (module === "notes" ? (C.EVENT_TITLE || "Sticky Wall") : t("Live results"));

  const main = document.getElementById("embed-main");
  const titleEl = document.getElementById("embed-title");
  const kickerEl = document.getElementById("embed-kicker");
  const countEl = document.getElementById("embed-count");
  const footHint = document.getElementById("embed-foot-hint");
  const statusEl = document.getElementById("embed-status");

  document.body.classList.add("embed--" + theme);
  titleEl.textContent = title;
  kickerEl.textContent = t("Live results");
  footHint.textContent = t("Updates live");
  document.title = title + " · " + t("Live results");

  let notes = [];
  let polls = [];
  let votes = [];
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
        el("span", "embed-note__author", note.author_name || t("Anonymous")),
        el("span", "embed-note__cat", t(note.category || "Note"))
      );
      card.append(foot);
      grid.append(card);
    });
    main.replaceChildren(grid);
    setStatus(notes.length === 1 ? t("1 note") : t("{n} notes", { n: notes.length }));
  }

  /* ── polls ─────────────────────────────────────────────────── */
  function visiblePolls() {
    let list = polls.filter(p => p.status !== "draft");
    if (module === "poll" && pollId) list = list.filter(p => p.id === pollId);
    return list.slice(0, limit);
  }

  function renderPolls() {
    const list = visiblePolls();
    if (!list.length) {
      empty(t("Waiting for the first poll…"));
      setStatus(t("0 polls"));
      return;
    }
    const grid = el("div", "embed-polls");
    let responses = 0;
    list.forEach(poll => {
      const stats = pollStats(poll, votes);
      responses += stats.total;
      const card = el("article", "embed-poll");
      const head = el("header", "embed-poll__head");
      const chip = el("span", "embed-poll__chip", t(poll.category || "Poll"));
      chip.style.setProperty("--chip", pollCategoryColor(poll.category));
      head.append(chip, el("span", "embed-poll__status", pollStatus(poll).label));
      card.append(head, el("h2", "embed-poll__q", poll.question));
      if (poll.description) card.append(el("p", "embed-poll__desc", poll.description));

      const chartHost = el("div", "embed-poll__chart");
      const chart = typeof pollChart === "function"
        ? pollChart(poll, stats, { type, style })
        : null;
      if (chart) {
        chartHost.append(chart);
      } else if (poll.type === "text") {
        const texts = el("div", "embed-texts");
        (stats.texts || []).slice(0, 8).forEach(vote => {
          const row = el("div", "embed-text", vote.text);
          row.append(el("small", null, vote.author || t("Anonymous")));
          texts.append(row);
        });
        if (!stats.texts || !stats.texts.length) texts.append(el("p", "embed-empty", t("No answers yet.")));
        chartHost.append(texts);
      } else {
        chartHost.append(el("p", "embed-empty", t("No answers yet.")));
      }
      card.append(chartHost);
      grid.append(card);
    });
    main.replaceChildren(grid);
    const pollLabel = list.length === 1 ? t("1 poll") : t("{n} polls", { n: list.length });
    const answerLabel = responses === 1 ? t("1 response") : t("{n} responses", { n: responses });
    setStatus(pollLabel + " · " + answerLabel);
  }

  function render() {
    if (module === "polls" || module === "poll") renderPolls();
    else renderNotes();
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
    render();
  }

  async function loadPolls() {
    [polls, votes] = await Promise.all([Store.listPolls(), Store.listVotes()]);
    polls.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
    render();
  }

  async function start() {
    try {
      cats = await Store.getCategories();
      if (typeof applyCategories === "function") applyCategories(cats);
    } catch (err) {
      console.warn("Categories unavailable", err);
    }

    if (module === "polls" || module === "poll") {
      await loadPolls();
      Store.subscribePolls({
        onPoll(poll) {
          if (!poll) return;
          upsert(polls, poll, "id");
          polls.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
          render();
        },
        onDelete(id) {
          polls = polls.filter(p => p.id !== id);
          votes = votes.filter(v => v.poll_id !== id);
          render();
        },
        onVote(vote) {
          if (!vote) return;
          upsert(votes, vote, "id");
          render();
        },
        onVoteDelete(vote) {
          if (!vote) return;
          votes = votes.filter(v => v.id !== vote.id &&
            !(v.poll_id === vote.poll_id && v.voter_key === vote.voter_key));
          render();
        },
        onResetVotes(id) {
          votes = votes.filter(v => v.poll_id !== id);
          render();
        },
        resync() { loadPolls().catch(err => console.warn(err)); }
      });
    } else {
      await loadNotes();
      Store.subscribe({
        onAdd(note) { upsert(notes, note, "id"); render(); },
        onRemove(id) { notes = notes.filter(n => n.id !== id); render(); },
        onUpdate(note) { if (note) { upsert(notes, note, "id"); render(); } },
        onReassign() { loadNotes().catch(err => console.warn(err)); },
        resync() { loadNotes().catch(err => console.warn(err)); }
      });
    }
  }

  start().catch(err => {
    console.error("Embed could not start", err);
    empty(t("Could not load live results."));
    setStatus(t("Offline"), true);
  });
})();
