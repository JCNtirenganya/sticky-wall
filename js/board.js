(() => {
  const $ = id => document.getElementById(id);
  const t = (key, vars) => typeof window.t === "function" ? window.t(key, vars) : key;
  const board = $("board"), sheet = $("sheet"), focusBox = $("focus"), focusStage = $("focus-stage"), avatar = $("avatar");
  const brand = $("brand"), brandTitle = $("brand-title"), brandSub = $("brand-sub"), brandLogo = $("brand-logo");
  const brandEdit = $("brand-edit"), eventDialog = $("event-dialog"), eventForm = $("event-form");
  const eventTitleInput = $("event-title"), eventSubInput = $("event-subtitle"), eventReset = $("event-reset"), eventCancel = $("event-cancel");
  const catEdit = $("cat-edit"), categoryDialog = $("category-dialog"), categoryForm = $("category-form");
  const categoryListEl = $("category-list"), categoryAdd = $("category-add"), categoryReset = $("category-reset"), categoryCancel = $("category-cancel");
  const status = $("status"), statusText = $("status-text"), statusMode = $("status-mode"), emptyHint = $("empty-hint");
  const focusMeta = $("focus-meta"), focusCat = $("focus-cat"), focusCount = $("focus-count");
  const pilesHost = $("piles"), pilesBack = $("piles-back"), qrCard = $("qr-card"), qrCode = $("qr-code");
  const extras = $("extras"), extrasPanel = $("extras-panel"), extrasToggle = $("extras-toggle");
  const extrasNotesOnly = $("extras-notes-only"), extrasShowAll = $("extras-show-all");
  const pollRoom = $("poll-room"), pollGrid = $("poll-grid"), pollFilters = $("poll-filters");
  const pollEmpty = $("poll-empty"), pollSummary = $("poll-summary");
  const pollDialog = $("poll-dialog"), pollForm = $("poll-form"), pollDialogTitle = $("poll-dialog-title");
  const pollQuestion = $("poll-question"), pollDescription = $("poll-description");
  const pollTypeSelect = $("poll-type"), pollCategory = $("poll-category"), pollCategoryList = $("poll-category-list");
  const pollOptionsWrap = $("poll-options-wrap"), pollOptions = $("poll-options"), pollAddOption = $("poll-add-option");
  const pollMaxWrap = $("poll-max-wrap"), pollMax = $("poll-max"), pollMaxOut = $("poll-max-out");
  const pollStatusSelect = $("poll-status"), pollResultsSelect = $("poll-results");
  const pollSave = $("poll-save"), pollCancel = $("poll-cancel");
  const raceBox = $("poll-race"), raceStage = $("race-stage"), raceTitle = $("race-title"), raceSub = $("race-sub");
  const raceProgress = $("race-progress"), raceClock = $("race-clock"), raceLive = $("race-live");
  const racePlay = $("race-play"), raceReplay = $("race-replay"), raceClose = $("race-close");
  const C = window.STICKY_CONFIG || {};
  const notes = [], els = new Map();
  const polls = [], votes = [];
  let cats = new Set(categoryKeys()), focusId = null, moodTimer = 0, closeTimer = 0;
  let activeFilter = "all", pileView = false, pileSignature = "";
  let pollFilter = "all", pollEditing = null, pollStatusTimer = 0;
  let notesPresent = false, notesPresentSnapshot = null;
  let pollsPresent = false, pollStageMode = false, pollStageIndex = 0;
  /* manual presentation: full screen, but the slides only move on command */
  let presentationManual = false;
  let autoplayIdle = 0, autoplayStep = 0, autoplayLive = false, autoplayTouched = 0;
  let racePollId = null, raceData = null, raceIndex = 0, raceClockValue = 0;
  let racePlaying = false, raceSpeed = 1, raceRaf = 0, raceLastTick = 0;
  const raceRows = new Map();

  /* ── presenter preferences (what the wall shows) ───────────── */
  const PREFS_KEY = "sticky_board_prefs";
  const HIDDEN_KEY = "sticky_hidden_notes";
  const PREF_DEFAULTS = {
    columns: false,
    brand: true,
    mascot: true,
    qr: true,
    status: true,
    filters: true,
    gap: 12,
    bgColor: "",
    bgImage: "",
    bgDim: 35,
    logo: "",
    logoSize: 100,
    autoplay: true,
    autoplayDelay: 10,
    autoplayDuration: 6
  };
  const PREF_NUMBERS = new Set(["gap", "bgDim", "logoSize", "autoplayDelay", "autoplayDuration"]);
  const PREF_STRINGS = new Set(["bgColor", "bgImage", "logo"]);
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      const out = { ...PREF_DEFAULTS };
      if (!saved || typeof saved !== "object") return out;
      Object.keys(PREF_DEFAULTS).forEach(key => {
        if (PREF_NUMBERS.has(key) && Number.isFinite(Number(saved[key]))) out[key] = Number(saved[key]);
        else if (PREF_STRINGS.has(key) && typeof saved[key] === "string") out[key] = saved[key];
        else if (!PREF_NUMBERS.has(key) && !PREF_STRINGS.has(key) && typeof saved[key] === "boolean") out[key] = saved[key];
      });
      return out;
    } catch { return { ...PREF_DEFAULTS }; }
  }
  let prefs = loadPrefs();
  prefs.gap = Math.max(0, Math.min(40, prefs.gap));
  prefs.bgDim = Math.max(0, Math.min(85, prefs.bgDim));
  prefs.logoSize = Math.max(50, Math.min(180, prefs.logoSize));
  prefs.autoplayDelay = Math.max(0, Math.min(120, prefs.autoplayDelay));
  prefs.autoplayDuration = Math.max(2, Math.min(120, prefs.autoplayDuration));
  prefs.bgColor = normaliseHex(prefs.bgColor) || "";
  prefs.bgImage = String(prefs.bgImage || "");

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); return true; }
    catch { return false; }
  }

  function syncPrefInputs() {
    if (!extrasPanel) return;
    extrasPanel.querySelectorAll("input[data-extra]").forEach(input => {
      const key = input.dataset.extra;
      if (!(key in prefs)) return;
      if (input.type === "checkbox") input.checked = !!prefs[key];
      else if (input.type === "color") input.value = prefs.bgColor || "#000000";
      else input.value = prefs[key];
      const out = extrasPanel.querySelector('output[data-for="' + key + '"]');
      if (out) out.textContent = String(prefs[key]);
    });
    extrasPanel.querySelectorAll("#extras-swatches button").forEach(btn => {
      btn.classList.toggle("act", (btn.dataset.wall || "") === (prefs.bgColor || ""));
    });
  }

  function applyPrefs(relayout = true) {
    const hideClasses = {
      brand: "hide-brand",
      mascot: "hide-mascot",
      qr: "hide-qr",
      status: "hide-status",
      filters: "hide-filters"
    };
    Object.entries(hideClasses).forEach(([key, cls]) => {
      document.body.classList.toggle(cls, !prefs[key]);
    });
    if (!prefs.filters) $("filters")?.classList.remove("on");
    syncPrefInputs();
    if (relayout) layout();
  }
  applyPrefs(false);

  /* Presenter look: wall tint, optional background image, logo. */
  function applyLook() {
    const rgb = prefs.bgColor ? hexToRgb(prefs.bgColor) : null;
    board.style.setProperty("--wall-tint", rgb
      ? "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",.62)"
      : "transparent");

    const wallImage = $("wall-image");
    if (wallImage) {
      if (prefs.bgImage) {
        wallImage.style.backgroundImage = "url(" + JSON.stringify(prefs.bgImage) + ")";
        wallImage.classList.add("on");
      } else {
        wallImage.style.backgroundImage = "";
        wallImage.classList.remove("on");
      }
      wallImage.style.setProperty("--wall-dim", (prefs.bgDim / 100).toFixed(2));
    }

    const logo = String(prefs.logo || brandDefaults.logo || "").trim();
    if (brandLogo) {
      brandLogo.hidden = !logo;
      if (logo) { brandLogo.src = logo; brandLogo.alt = brandDefaults.logoAlt; }
    }
    document.documentElement.style.setProperty("--logo-scale", (prefs.logoSize / 100).toFixed(2));
    syncPrefInputs();
  }

  /* Hidden notes are a local, non-destructive moderation layer. */
  function loadHidden() {
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch { return new Set(); }
  }
  const hidden = loadHidden();
  function saveHidden() {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])); } catch {}
  }

  /* ── event branding (config defaults + presenter override) ─── */
  const BRAND_KEY = "sticky_event_brand";
  const brandDefaults = {
    title: C.EVENT_TITLE !== undefined ? C.EVENT_TITLE : "Sticky Wall",
    subtitle: C.EVENT_SUBTITLE !== undefined ? C.EVENT_SUBTITLE : "Notes from the room",
    logo: C.EVENT_LOGO !== undefined ? C.EVENT_LOGO : "assets/sanokip-cbc-light.png",
    logoAlt: C.EVENT_LOGO_ALT || "Sanokip CBC"
  };
  function storedBrand() {
    try {
      const v = JSON.parse(localStorage.getItem(BRAND_KEY) || "null");
      return v && typeof v === "object" ? v : null;
    } catch { return null; }
  }
  let brandState = { ...brandDefaults, ...(storedBrand() || {}) };

  function applyBrand() {
    const title = String(brandState.title || "").trim();
    const subtitle = String(brandState.subtitle || "").trim();
    const logo = String(prefs.logo || brandDefaults.logo || "").trim();
    brandTitle.textContent = title;
    brandTitle.hidden = !title;
    brandSub.textContent = subtitle;
    brandSub.hidden = !subtitle;
    brandLogo.hidden = !logo;
    if (logo) { brandLogo.src = logo; brandLogo.alt = brandDefaults.logoAlt; }
    brand.classList.toggle("brand-logo-only", !!logo && !title && !subtitle);
    brand.classList.toggle("hidden", !logo && !title && !subtitle);
    document.title = title ? t("{title} · Board", { title }) : t("Board");
  }

  function openEventEditor() {
    eventTitleInput.value = String(brandState.title || "");
    eventSubInput.value = String(brandState.subtitle || "");
    if (typeof eventDialog.showModal === "function") {
      if (!eventDialog.open) eventDialog.showModal();
    } else eventDialog.setAttribute("open", "");
    requestAnimationFrame(() => { eventTitleInput.focus(); eventTitleInput.select(); });
  }

  brandEdit.addEventListener("click", e => { e.stopPropagation(); openEventEditor(); });
  eventForm.addEventListener("submit", e => {
    e.preventDefault();
    brandState = {
      ...brandState,
      title: eventTitleInput.value.trim(),
      subtitle: eventSubInput.value.trim()
    };
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify({ title: brandState.title, subtitle: brandState.subtitle }));
    } catch {}
    applyBrand();
    layout();
    eventDialog.close();
  });
  eventReset.addEventListener("click", () => {
    try { localStorage.removeItem(BRAND_KEY); } catch {}
    brandState = { ...brandDefaults };
    applyBrand();
    layout();
    eventDialog.close();
  });
  eventCancel.addEventListener("click", () => eventDialog.close());
  eventDialog.addEventListener("click", e => { if (e.target === eventDialog) eventDialog.close(); });
  applyBrand();
  applyLook();

  /* ── categories: presenter editor ──────────────────────────── */
  function uniqueKey(label, used) {
    let base = String(label || "").toLowerCase().normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";
    let key = base, n = 2;
    while (used.has(key)) key = base + "-" + (n++);
    used.add(key);
    return key;
  }

  function makeEditorRow(cat) {
    const row = document.createElement("div");
    row.className = "cat-row";
    row.dataset.key = cat.key || "";
    row.style.setProperty("--swatch", cat.color || "#E6E600");

    const color = document.createElement("input");
    color.type = "color";
    color.className = "cat-swatch";
    color.value = normaliseHex(cat.color) || "#E6E600";
    color.setAttribute("aria-label", t("Category colour"));
    color.addEventListener("input", () => row.style.setProperty("--swatch", color.value));

    const emoji = document.createElement("input");
    emoji.type = "text";
    emoji.className = "cat-emoji";
    emoji.maxLength = 4;
    emoji.value = cat.emoji || "📝";
    emoji.setAttribute("aria-label", t("Category emoji"));

    const name = document.createElement("input");
    name.type = "text";
    name.className = "cat-name";
    name.maxLength = 32;
    name.value = cat.label || "";
    name.placeholder = t("Category name");
    name.setAttribute("aria-label", t("Category name"));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cat-remove";
    remove.textContent = "×";
    remove.title = t("Remove category");
    remove.setAttribute("aria-label", t("Remove this category"));
    remove.addEventListener("click", () => {
      if (categoryListEl.querySelectorAll(".cat-row").length <= 1) return;
      row.remove();
      refreshEditorState();
    });

    row.append(color, emoji, name, remove);
    return row;
  }

  function refreshEditorState() {
    const rows = [...categoryListEl.querySelectorAll(".cat-row")];
    const onlyOne = rows.length <= 1;
    rows.forEach(row => {
      const btn = row.querySelector(".cat-remove");
      if (btn) {
        btn.disabled = onlyOne;
        btn.setAttribute("aria-disabled", onlyOne ? "true" : "false");
      }
    });
    if (categoryAdd) {
      categoryAdd.disabled = rows.length >= MAX_CATEGORIES;
      categoryAdd.textContent = rows.length >= MAX_CATEGORIES
        ? t("Maximum {n} categories", { n: MAX_CATEGORIES })
        : t("+ Add category");
    }
  }

  function renderEditor(list) {
    categoryListEl.replaceChildren(...normalizeCategoryList(list).map(makeEditorRow));
    refreshEditorState();
  }

  function openCategoryEditor() {
    renderEditor(categoryList());
    if (typeof categoryDialog.showModal === "function") {
      if (!categoryDialog.open) categoryDialog.showModal();
    } else categoryDialog.setAttribute("open", "");
    categoryDialog.querySelector(".cat-name")?.focus();
  }

  function repaintNotes() {
    notes.forEach(n => {
      const el = els.get(n.id);
      if (el) paintNote(el, n);
    });
  }

  function ensureKnownCategories(persist) {
    const keys = categoryKeys();
    if (!keys.length) return [];
    const known = new Set(keys), first = keys[0], unknown = new Set();
    notes.forEach(n => {
      if (!known.has(n.category)) {
        unknown.add(n.category);
        n.category = first;
        const el = els.get(n.id);
        if (el) paintNote(el, n);
      }
    });
    if (unknown.size && persist) Store.reassign([...unknown], first).catch(console.error);
    return [...unknown];
  }

  function applyCategoryUpdate(list) {
    applyCategories(list);
    if (activeFilter !== "all" && !CATS[activeFilter]) activeFilter = "all";
    cats = activeFilter === "all" ? new Set(categoryKeys()) : new Set([activeFilter]);
    ensureKnownCategories(false);
    repaintNotes();
    buildFilters();
    buildPiles(true);
    layout();
  }

  function saveCategoryEditor() {
    const oldByKey = new Map(categoryList().map(c => [c.key, c]));
    const rows = [...categoryListEl.querySelectorAll(".cat-row")];
    if (!rows.length) return;

    const used = new Set();
    const draft = rows.map(row => {
      const old = oldByKey.get(row.dataset.key);
      const label = row.querySelector(".cat-name").value.trim().slice(0, 32) || "Category";
      /* Keep the row's original key whenever possible — including rows
         restored with "Use defaults", whose key is not in the current
         list yet. Only genuinely new rows get a key from their label. */
      const carried = row.dataset.key && !used.has(row.dataset.key) ? row.dataset.key : null;
      const key = carried || (old && !used.has(old.key) ? old.key : uniqueKey(label, used));
      used.add(key);
      const renamed = !old || old.label !== label;
      return {
        key,
        label,
        short: renamed ? pluralName(label) : old.short,
        action: renamed ? label : old.action,
        emoji: row.querySelector(".cat-emoji").value.trim().slice(0, 4) || "📝",
        hint: old ? old.hint : "Write your note…",
        color: row.querySelector(".cat-swatch").value
      };
    });

    const oldKeys = categoryKeys();
    applyCategories(draft);
    const newKeys = new Set(categoryKeys());
    const removed = oldKeys.filter(k => !newKeys.has(k));
    const fallback = categoryKeys()[0];

    if (removed.length && fallback) {
      const gone = new Set(removed);
      notes.forEach(n => {
        if (gone.has(n.category)) {
          n.category = fallback;
          const el = els.get(n.id);
          if (el) paintNote(el, n);
        }
      });
    }

    if (activeFilter !== "all" && !CATS[activeFilter]) activeFilter = "all";
    cats = activeFilter === "all" ? new Set(categoryKeys()) : new Set([activeFilter]);
    if (focusId) updateFocusMeta();
    repaintNotes();
    buildFilters();
    buildPiles(true);
    setFilter(activeFilter, { scroll: false });

    categoryDialog.close();
    Store.saveCategories(categoryList(), { removed, fallback }).catch(err => {
      console.error("Categories could not be saved", err);
      statusText.textContent = t("Categories changed on this screen only");
    });
  }

  catEdit.addEventListener("click", e => { e.stopPropagation(); openCategoryEditor(); });
  categoryAdd.addEventListener("click", () => {
    const rows = categoryListEl.querySelectorAll(".cat-row").length;
    if (rows >= MAX_CATEGORIES) return;
    const color = CATEGORY_COLOR_CYCLE[rows % CATEGORY_COLOR_CYCLE.length];
    const row = makeEditorRow({ label: "New category", emoji: "📝", color });
    categoryListEl.appendChild(row);
    refreshEditorState();
    const input = row.querySelector(".cat-name");
    input.focus();
    input.select();
  });
  categoryReset.addEventListener("click", () => {
    renderEditor(normalizeCategoryList(DEFAULT_CATEGORIES));
  });
  categoryCancel.addEventListener("click", () => categoryDialog.close());
  categoryForm.addEventListener("submit", e => {
    e.preventDefault();
    saveCategoryEditor();
  });
  categoryDialog.addEventListener("click", e => { if (e.target === categoryDialog) categoryDialog.close(); });

  /* ── visibility + status ───────────────────────────────────── */
  const vis = () => notes.filter(n => !hidden.has(n.id) && cats.has(n.category));
  const plural = n => n === 1 ? t("1 note") : t("{n} notes", { n });
  const dashboardOpen = () => document.body.classList.contains("show-dashboard");

  function syncHiddenChrome() {
    const hiddenCount = notes.filter(n => hidden.has(n.id)).length;
    const badge = $("extras-hidden-count");
    if (badge) badge.textContent = String(hiddenCount);
    const restore = $("extras-restore");
    if (restore) {
      restore.classList.toggle("is-empty", hiddenCount === 0);
      restore.disabled = hiddenCount === 0;
    }
    return hiddenCount;
  }

  function updateStatus() {
    const total = notes.length;
    const hiddenCount = syncHiddenChrome();
    const alive = total - hiddenCount;
    const shown = vis().length;
    statusText.textContent = pileView
      ? plural(alive) + t(" · grouped")
      : activeFilter === "all"
        ? (hiddenCount ? plural(shown) + " · " + t("{n} hidden", { n: hiddenCount }) : plural(total))
        : t("{shown} of {alive}", { shown, alive });
    statusMode.textContent = Store.mode === "demo" ? t("demo") : t("live");
    status.classList.toggle("is-demo", Store.mode === "demo");
    syncPollBadge();
    emptyHint.hidden = Store.mode !== "demo";
    document.body.classList.toggle("has-notes", total > 0);
    if (dashboardOpen()) renderDashboard();
  }

  /* ── dashboard: the entry card and received-notes control ──── */
  const welcomeCard = $("welcome-card"), dashCard = $("dash-card");
  const dashTitle = $("dash-title"), dashLead = $("dash-lead"), dashCats = $("dash-cats");
  const dashCount = $("dash-count"), dashNotes = $("dash-notes"), dashRestore = $("dash-restore");

  function renderDashboard() {
    if (!welcomeCard || !dashCard || !dashNotes) return;
    const total = notes.length;
    welcomeCard.hidden = total > 0;
    dashCard.hidden = total === 0;
    if (!total) { dashNotes.replaceChildren(); return; }

    const hiddenCount = notes.filter(n => hidden.has(n.id)).length;
    const alive = total - hiddenCount;
    dashTitle.textContent = total === 0
      ? t("You received 0 notes.")
      : total === 1 ? t("You received 1 note.") : t("You received {n} notes.", { n: total });
    dashLead.textContent = hiddenCount
      ? t("{alive} on the wall · {hidden} hidden. Restore anything you want back.", { alive, hidden: hiddenCount })
      : t("Everything received is on the wall.");

    dashCats.replaceChildren();
    categoryList().forEach(cat => {
      const all = notes.filter(n => n.category === cat.key);
      if (!all.length) return;
      const shown = all.filter(n => !hidden.has(n.id)).length;
      const chip = document.createElement("span");
      chip.className = "dash-chip";
      chip.style.setProperty("--chip", cat.color);
      const dot = document.createElement("span");
      dot.className = "dash-chip-dot";
      chip.append(dot, document.createTextNode(t(cat.short) + " · " + shown));
      dashCats.appendChild(chip);
    });

    dashCount.textContent = t("{n} on the wall", { n: alive }) +
      (hiddenCount ? t(" · {n} hidden", { n: hiddenCount }) : "");

    dashNotes.replaceChildren(...notes.map(n => {
      const isHidden = hidden.has(n.id);
      const li = document.createElement("li");
      li.className = "dash-note" + (isHidden ? " is-hidden" : "");
      li.dataset.id = n.id;

      const dot = document.createElement("span");
      dot.className = "dash-note-dot";
      dot.style.setProperty("--chip", CATS[n.category]?.color || "#f0c46b");

      const copy = document.createElement("div");
      copy.className = "dash-note-copy";
      const head = document.createElement("b");
      head.textContent = (String(n.author || "").trim() || t("Anonymous")) +
        " · " + t(CATS[n.category]?.short || "Note");
      const text = document.createElement("p");
      if (typeof renderNoteText === "function") renderNoteText(text, n.text);
      else text.textContent = n.text;
      copy.append(head, text);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dash-note-act";
      btn.dataset.act = isHidden ? "restore" : "hide";
      btn.dataset.id = n.id;
      btn.textContent = isHidden ? t("Restore") : t("Hide");
      li.append(dot, copy, btn);
      return li;
    }));

    if (dashRestore) {
      dashRestore.hidden = hiddenCount === 0;
      dashRestore.textContent = hiddenCount
        ? t("Restore {n} hidden", { n: hiddenCount })
        : t("Restore hidden");
    }
    renderDashPolls();
  }

  function setDashboard(open) {
    document.body.classList.toggle("show-dashboard", !!open);
    if (!open) return;
    closePollRoom();
    setNotesPresentation(false);
    closeFocus();
    setExtrasOpen(false);
    renderDashboard();
    syncHiddenChrome();
    board.scrollTo({ top: 0, behavior: "auto" });
  }
  const openDashboard = () => setDashboard(true);
  const closeDashboard = () => setDashboard(false);
  const toggleDashboard = () => setDashboard(!dashboardOpen());

  /* ── polls: presenter room, editor and live statistics ────── */
  const POLL_FILTERS = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "draft", label: "Draft" },
    { key: "closed", label: "Closed" }
  ];
  let pollSyncWarned = false;

  const pollNode = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const pollRoomOpenNow = () => document.body.classList.contains("show-polls");
  const pollSorted = () => polls.slice().sort((a, b) =>
    (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at)));
  const pollPositionNext = () => polls.reduce((max, p) => Math.max(max, Number(p.position) || 0), 0) + 1;
  const pollOpenCount = () => polls.filter(p => p.status === "open").length;
  const pollResponseTotal = () => polls.reduce((sum, p) => sum + pollStats(p, votes).total, 0);

  function pollWhen(value) {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return t("just now");
    if (diff < 3600000) return t("{n}m ago", { n: Math.max(1, Math.floor(diff / 60000)) });
    if (diff < 86400000) return t("{n}h ago", { n: Math.floor(diff / 3600000) });
    return date.toLocaleDateString(window.I18N?.locale?.() || undefined, { day: "numeric", month: "short" });
  }

  function flashPollStatus(message) {
    if (!statusText) return;
    statusText.textContent = t(message);
    clearTimeout(pollStatusTimer);
    pollStatusTimer = setTimeout(updateStatus, 3200);
  }

  function syncPollBadge() {
    const badge = $("status-poll-count");
    if (badge) badge.textContent = polls.length === 1 ? t("1 poll") : t("{n} polls", { n: polls.length });
    const button = $("status-polls");
    if (button) {
      button.classList.toggle("has-open", pollOpenCount() > 0);
      button.setAttribute("aria-label", t("Open the poll room. {n} polls, {m} open.", {
        n: polls.length,
        m: pollOpenCount()
      }));
    }
  }

  function upsertPollLocal(raw) {
    const poll = normalisePoll(raw);
    const i = polls.findIndex(p => p.id === poll.id);
    if (i >= 0) polls[i] = poll;
    else polls.push(poll);
  }

  function removePollLocal(id) {
    const i = polls.findIndex(p => p.id === id);
    if (i >= 0) polls.splice(i, 1);
    for (let j = votes.length - 1; j >= 0; j--) if (votes[j].poll_id === id) votes.splice(j, 1);
  }

  function upsertVoteLocal(raw) {
    const vote = normalisePollVote(raw);
    if (!vote.poll_id || !vote.voter_key) return;
    const i = votes.findIndex(v => v.id === vote.id || (v.poll_id === vote.poll_id && v.voter_key === vote.voter_key));
    if (i >= 0) votes[i] = vote;
    else votes.push(vote);
  }

  function removeVoteLocal(raw) {
    const vote = normalisePollVote(raw);
    for (let i = votes.length - 1; i >= 0; i--) {
      if (votes[i].id === vote.id || (votes[i].poll_id === vote.poll_id && votes[i].voter_key === vote.voter_key)) {
        votes.splice(i, 1);
      }
    }
  }

  function resetVotesLocal(pollId) {
    for (let i = votes.length - 1; i >= 0; i--) if (votes[i].poll_id === pollId) votes.splice(i, 1);
  }

  function renderPollChrome() {
    syncPollBadge();
    const sampleLabel = document.querySelector("#poll-samples span");
    if (sampleLabel) {
      const more = polls.some(p => String(p.id).startsWith("sample-"));
      const key = more ? "More samples" : "Sample polls";
      if (sampleLabel.dataset.i18n !== key) {
        sampleLabel.dataset.i18n = key;
        sampleLabel.textContent = t(key);
      }
    }
    renderDashPolls();
    if (pollRoomOpenNow()) renderPollRoom();
    if (raceOpenNow()) refreshRaceLive();
  }

  function pollStatsNode(poll, stats) {
    const box = pollNode("div", "poll-stats");
    if (!stats.total) {
      box.append(pollNode("p", "poll-none", t("No answers yet.")));
      return box;
    }

    if (poll.type === "text") {
      const list = pollNode("div", "poll-texts");
      stats.texts.slice(0, 6).forEach(vote => {
        const item = pollNode("div", "poll-text");
        item.append(pollNode("p", null, vote.text));
        item.append(pollNode("small", null,
          (vote.author || t("Anonymous")) + (vote.updated_at ? " · " + pollWhen(vote.updated_at) : "")));
        list.append(item);
      });
      if (stats.texts.length > 6) {
        list.append(pollNode("p", "poll-more", t("+ {n} more answers", { n: stats.texts.length - 6 })));
      }
      box.append(list);
      return box;
    }

    const chart = typeof pollHandChart === "function" ? pollHandChart(poll, stats) : null;
    if (chart) {
      box.append(chart);
      return box;
    }

    if (poll.type === "rating") {
      const wrap = pollNode("div", "poll-rating");
      const average = pollNode("div", "poll-rating__avg");
      average.append(pollNode("b", null, stats.rating.avg.toFixed(1)), pollNode("span", null, t(" / 5")));
      const full = Math.max(0, Math.min(5, Math.round(stats.rating.avg)));
      const stars = pollNode("div", "poll-rating__stars", "★".repeat(full) + "☆".repeat(5 - full));
      stars.setAttribute("aria-label", t("{n} out of 5", { n: stats.rating.avg.toFixed(1) }));
      const dist = pollNode("div", "poll-rating__dist");
      [5, 4, 3, 2, 1].forEach(score => {
        const count = stats.rating.counts[score - 1] || 0;
        const pct = pollPct(count, stats.rating.total);
        const row = pollNode("div", "poll-dist-row");
        row.append(pollNode("span", "poll-dist-label", score + "★"));
        const track = pollNode("div", "poll-bar__track");
        const fill = pollNode("span", "poll-bar__fill");
        fill.style.width = pct + "%";
        track.append(fill);
        row.append(track, pollNode("span", "poll-dist-num", String(count)));
        dist.append(row);
      });
      wrap.append(average, stars, dist);
      box.append(wrap);
      return box;
    }

    stats.options.forEach(option => {
      const row = pollNode("div", "poll-bar");
      const top = pollNode("div", "poll-bar__top");
      top.append(
        pollNode("span", "poll-bar__label", option.label),
        pollNode("span", "poll-bar__num", option.count + " · " + option.pct + "%")
      );
      const track = pollNode("div", "poll-bar__track");
      const fill = pollNode("span", "poll-bar__fill");
      fill.style.width = option.pct + "%";
      track.append(fill);
      row.append(top, track);
      box.append(row);
    });
    return box;
  }

  function pollCard(poll) {
    const stats = pollStats(poll, votes);
    const type = pollType(poll.type);
    const status = pollStatus(poll);
    const card = pollNode("article", "poll-card");
    card.dataset.poll = poll.id;
    card.style.setProperty("--pc", pollCategoryColor(poll.category));

    const head = pollNode("header", "poll-card__head");
    head.append(
      pollNode("span", "poll-chip", t(poll.category)),
      pollNode("span", "poll-type", type.emoji + " " + type.label),
      pollNode("span", "poll-status poll-status--" + status.key, status.label)
    );

    const question = pollNode("h3", "poll-card__q", poll.question);
    const description = poll.description ? pollNode("p", "poll-card__desc", poll.description) : null;

    const meta = pollNode("div", "poll-card__meta");
    meta.append(pollNode("span", null, stats.total === 1 ? t("1 response") : t("{n} responses", { n: stats.total })));
    if (stats.lastAt) {
      meta.append(pollNode("span", null, "·"), pollNode("span", null, t("updated {when}", { when: pollWhen(stats.lastAt) })));
    }
    meta.append(pollNode("span", null, "·"), pollNode("span", null, type.short));

    const actions = pollNode("footer", "poll-card__actions");
    const action = (act, label, cls) => {
      const button = pollNode("button", "poll-act" + (cls ? " " + cls : ""), label);
      button.type = "button";
      button.dataset.pollAct = act;
      actions.append(button);
      return button;
    };
    action("edit", t("Edit"));
    action("race", t("Chart race"));
    action("duplicate", t("Duplicate"));
    action("toggle", poll.status === "open" ? t("Close poll") : t("Open poll"));
    action("reset", t("Reset votes"));
    action("delete", t("Delete"), "poll-act--danger");

    card.append(head, question);
    if (description) card.append(description);
    card.append(meta, pollStatsNode(poll, stats), actions);
    return card;
  }

  function renderPollRoom() {
    if (!pollRoom) return;
    const open = pollOpenCount();
    const total = pollResponseTotal();
    if (pollSummary) {
      pollSummary.textContent = polls.length
        ? (polls.length === 1 ? t("1 poll") : t("{n} polls", { n: polls.length })) + " · " +
          t("{n} open", { n: open }) + " · " +
          (total === 1 ? t("1 response") : t("{n} responses", { n: total }))
        : t("No polls yet.");
    }

    if (pollFilters) {
      pollFilters.replaceChildren(...POLL_FILTERS.map(filter => {
        const count = filter.key === "all" ? polls.length : polls.filter(p => p.status === filter.key).length;
        const button = pollNode("button", "poll-filter" + (pollFilter === filter.key ? " act" : ""), t(filter.label));
        button.type = "button";
        button.dataset.pollFilter = filter.key;
        button.append(pollNode("span", "poll-filter__count", String(count)));
        return button;
      }));
    }

    const list = pollSorted().filter(p => pollFilter === "all" || p.status === pollFilter);
    if (pollEmpty) pollEmpty.hidden = list.length > 0;
    if (pollGrid) {
      pollGrid.hidden = list.length === 0;
      pollGrid.replaceChildren(...list.map(pollCard));
      if (pollStageMode) renderPollStage();
    }
  }

  function renderDashPolls() {
    const host = $("dash-polls"), list = $("dash-poll-list");
    if (!host || !list) return;
    host.hidden = polls.length === 0;
    if (!polls.length) { list.replaceChildren(); return; }

    const visible = pollSorted().slice(0, 4);
    list.replaceChildren(...visible.map(poll => {
      const stats = pollStats(poll, votes);
      const button = pollNode("button", "dash-poll");
      button.type = "button";
      button.dataset.poll = poll.id;
      button.style.setProperty("--chip", pollCategoryColor(poll.category));
      const top = pollNode("span", "dash-poll__top");
      top.append(
        pollNode("span", "dash-poll__chip", t(poll.category)),
        pollNode("span", "poll-status poll-status--" + poll.status, pollStatus(poll).label)
      );
      button.append(
        top,
        pollNode("b", "dash-poll__q", poll.question),
        pollNode("small", "dash-poll__meta",
          (stats.total === 1 ? t("1 response") : t("{n} responses", { n: stats.total })) + " · " + pollType(poll.type).short)
      );
      button.addEventListener("click", openPollRoom);
      return button;
    }));

    if (polls.length > visible.length) {
      const more = pollNode("button", "dash-poll dash-poll--more", t("+ {n} more polls", { n: polls.length - visible.length }));
      more.type = "button";
      more.addEventListener("click", openPollRoom);
      list.append(more);
    }
  }

  /* ── presentation autoplay & one-by-one poll slides ────────── */
  const pollStageList = () => pollSorted().filter(p => pollFilter === "all" || p.status === pollFilter);

  function renderPollStage() {
    if (!pollStageMode) return;
    const list = pollStageList();
    if (!list.length) return;
    if (pollStageIndex >= list.length) pollStageIndex = 0;
    if (pollStageIndex < 0) pollStageIndex = list.length - 1;
    const id = list[pollStageIndex].id;
    pollGrid?.querySelectorAll(".poll-card").forEach(card => {
      card.classList.toggle("is-stage", card.dataset.poll === id);
    });
    const current = pollGrid?.querySelector(".poll-card.is-stage");
    if (current) current.scrollTop = 0;
  }

  function setPollStageMode(on) {
    pollStageMode = !!on && pollsPresent;
    document.body.classList.toggle("present-polls-one", pollStageMode);
    $("poll-present-one")?.setAttribute("aria-pressed", pollStageMode ? "true" : "false");
    if (pollStageMode) renderPollStage();
    else pollGrid?.querySelectorAll(".poll-card.is-stage").forEach(card => card.classList.remove("is-stage"));
  }

  function stepPollStage(d) {
    const list = pollStageList();
    if (!list.length) return;
    pollStageIndex = (pollStageIndex + d + list.length) % list.length;
    renderPollStage();
  }

  const autoplaySeconds = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  };

  function clearAutoplay() {
    clearTimeout(autoplayIdle);
    clearInterval(autoplayStep);
    autoplayIdle = 0;
    autoplayStep = 0;
    autoplayLive = false;
  }

  /* Wait `autoplayDelay` seconds of quiet, then advance every `autoplayDuration`. */
  function armAutoplay() {
    clearAutoplay();
    if (presentationManual || !prefs.autoplay || (!notesPresent && !pollsPresent)) return;
    autoplayIdle = setTimeout(startAutoplay, autoplaySeconds(prefs.autoplayDelay, 10) * 1000);
  }

  function startAutoplay() {
    autoplayIdle = 0;
    if (presentationManual || !prefs.autoplay || (!notesPresent && !pollsPresent)) return;
    const every = Math.max(2, autoplaySeconds(prefs.autoplayDuration, 6)) * 1000;
    autoplayLive = true;
    if (notesPresent) {
      step(1);
      autoplayStep = setInterval(() => step(1), every);
      return;
    }
    if (!pollsPresent) return;
    if (!pollStageMode) {
      pollStageIndex = 0;
      setPollStageMode(true);
    }
    renderPollStage();
    autoplayStep = setInterval(() => stepPollStage(1), every);
  }

  /* Any real interaction pauses the slideshow and re-arms the idle countdown. */
  function touchAutoplay() {
    if (!notesPresent && !pollsPresent) return;
    if (!autoplayIdle && !autoplayLive) return;
    armAutoplay();
  }

  ["pointerdown", "wheel", "touchstart"].forEach(evt =>
    window.addEventListener(evt, () => touchAutoplay(), { passive: true, capture: true }));
  window.addEventListener("pointermove", () => {
    if (!notesPresent && !pollsPresent) return;
    if (!autoplayIdle && !autoplayLive) return;
    const now = Date.now();
    if (now - autoplayTouched < 400) return;
    autoplayTouched = now;
    touchAutoplay();
  }, { passive: true, capture: true });

  /* True fullscreen: the browser chrome and the OS taskbar go away too.
     Falls back gracefully to the CSS viewport-filling mode when the
     browser refuses (or when the page is not focused). */
  function goFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || typeof el.requestFullscreen !== "function") return;
    /* Browsers only allow this from a real click/key press; checking first
       avoids a console warning when the page tries outside a gesture. */
    if (navigator.userActivation && navigator.userActivation.isActive === false) return;
    try {
      const pending = el.requestFullscreen({ navigationUI: "hide" });
      if (pending?.catch) pending.catch(() => {});
    } catch {}
  }

  function leaveFullscreen() {
    if (!document.fullscreenElement || typeof document.exitFullscreen !== "function") return;
    try {
      const pending = document.exitFullscreen();
      if (pending?.catch) pending.catch(() => {});
    } catch {}
  }

  /* Esc in fullscreen is swallowed by the browser, so mirror the exit here. */
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) return;
    if (notesPresent) setNotesPresentation(false);
    if (pollsPresent) setPollsPresentation(false);
  });

  /* Full-screen results view: all poll cards, or one slide at a time.
     `manual` keeps the slides still (or switches a running show to manual). */
  function setPollsPresentation(on, mode, manual) {
    const was = pollsPresent;
    pollsPresent = !!on && pollRoomOpenNow();
    if (pollsPresent) presentationManual = !!manual;
    document.body.classList.toggle("present-polls", pollsPresent);
    $("poll-present")?.setAttribute("aria-pressed", pollsPresent ? "true" : "false");
    $("poll-present-manual")?.setAttribute("aria-pressed", pollsPresent && presentationManual ? "true" : "false");
    if (pollsPresent) {
      if (!was) pollStageIndex = 0;
      setExtrasOpen(false);
      document.activeElement?.blur?.();
      goFullscreen();
      setPollStageMode(mode === "one");
      pollGrid?.scrollTo({ top: 0, behavior: "auto" });
      armAutoplay();
    } else {
      presentationManual = false;
      clearAutoplay();
      setPollStageMode(false);
      if (was) leaveFullscreen();
    }
  }

  function openPollRoom() {
    if (!pollRoom) return;
    closeFocus();
    setDashboard(false);
    setExtrasOpen(false);
    setNotesPresentation(false);
    document.body.classList.add("show-polls");
    pollRoom.setAttribute("aria-hidden", "false");
    pollFilter = "all";
    setPollsPresentation(false);
    renderPollRoom();
    $("poll-close")?.focus({ preventScroll: true });
  }

  function closePollRoom() {
    if (!pollRoom) return;
    if (pollRoom.contains(document.activeElement)) document.activeElement.blur();
    setPollsPresentation(false);
    document.body.classList.remove("show-polls");
    pollRoom.setAttribute("aria-hidden", "true");
  }

  function togglePollRoom() {
    if (pollRoomOpenNow()) closePollRoom();
    else openPollRoom();
  }

  async function persistPoll(raw) {
    try {
      const saved = await Store.savePoll(normalisePoll(raw));
      upsertPollLocal(saved);
      renderPollChrome();
      return saved;
    } catch (err) {
      console.error("Poll could not be saved", err);
      flashPollStatus("Poll could not be saved");
      return null;
    }
  }

  async function togglePollStatus(poll) {
    const next = poll.status === "open" ? "closed" : "open";
    const saved = await persistPoll({ ...poll, status: next, updated_at: new Date().toISOString() });
    if (saved) flashPollStatus(next === "open" ? "Poll is live on phones" : "Poll closed");
  }

  async function duplicatePoll(poll) {
    const copy = normalisePoll({
      ...poll,
      id: pollUid("poll"),
      question: poll.question + " " + t("(copy)"),
      status: "draft",
      position: pollPositionNext(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    const saved = await persistPoll(copy);
    if (saved) flashPollStatus("Poll duplicated as a draft");
  }

  async function resetPollVotes(poll) {
    try {
      await Store.resetVotes(poll.id);
      resetVotesLocal(poll.id);
      renderPollChrome();
      flashPollStatus("Votes cleared");
    } catch (err) {
      console.error("Votes could not be reset", err);
      flashPollStatus("Could not clear votes");
    }
  }

  async function deletePoll(poll) {
    try {
      await Store.deletePoll(poll.id);
      removePollLocal(poll.id);
      renderPollChrome();
      flashPollStatus("Poll deleted");
    } catch (err) {
      console.error("Poll could not be deleted", err);
      flashPollStatus("Could not delete poll");
    }
  }

  function initPollEditor() {
    if (pollTypeSelect && !pollTypeSelect.options.length) {
      POLL_TYPE_KEYS.forEach(key => pollTypeSelect.add(new Option(t(POLL_TYPES[key].label), key)));
    }
    if (pollStatusSelect && !pollStatusSelect.options.length) {
      Object.keys(POLL_STATUSES).forEach(key => pollStatusSelect.add(new Option(t(POLL_STATUSES[key].label), key)));
    }
    if (pollResultsSelect && !pollResultsSelect.options.length) {
      Object.keys(POLL_RESULTS).forEach(key => pollResultsSelect.add(new Option(t(POLL_RESULTS[key].label), key)));
    }
  }

  function fillPollCategories() {
    if (!pollCategoryList) return;
    const names = [...new Set([...DEFAULT_POLL_CATEGORIES, ...polls.map(p => p.category)])]
      .map(name => String(name || "").trim()).filter(Boolean);
    pollCategoryList.replaceChildren(...names.map(name => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    }));
  }

  function pollOptionRow(option) {
    const raw = typeof option === "string" ? { label: option } : (option || {});
    const row = pollNode("div", "poll-option-row");

    const mediaButton = pollNode("button", "poll-option-media");
    mediaButton.type = "button";
    mediaButton.title = t("Add icon or image");
    mediaButton.setAttribute("aria-label", t("Add icon or image"));
    const preview = pollNode("span", "poll-option-media__preview");
    mediaButton.append(preview);

    const label = document.createElement("input");
    label.type = "text";
    label.className = "poll-option-label";
    label.maxLength = MAX_POLL_OPTION;
    label.value = raw.label || "";
    label.placeholder = t("Option");
    label.setAttribute("aria-label", t("Poll option"));

    const media = document.createElement("input");
    media.type = "text";
    media.className = "poll-option-media-input";
    media.value = raw.media || "";
    media.placeholder = t("Emoji or image URL");
    media.setAttribute("aria-label", t("Option icon or image"));
    media.autocomplete = "off";

    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "image/*";
    upload.hidden = true;

    function paintPreview() {
      const value = media.value.trim();
      preview.replaceChildren();
      preview.classList.toggle("has-media", !!value);
      const kind = typeof pollMediaKind === "function" ? pollMediaKind(value) : "";
      if (kind === "image") {
        const img = document.createElement("img");
        img.src = value;
        img.alt = "";
        img.addEventListener("error", () => {
          preview.replaceChildren(document.createTextNode("🖼"));
          preview.classList.remove("has-media");
        });
        preview.append(img);
      } else if (value) {
        preview.textContent = value.slice(0, 4);
      } else {
        preview.textContent = "🖼";
      }
    }

    mediaButton.addEventListener("click", () => upload.click());
    upload.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const data = await readImageFile(file, 128, "image/png", .92);
        media.value = data;
        paintPreview();
      } catch (err) {
        console.error("Could not read option icon", err);
        flashPollStatus("Could not read that image");
      }
    });
    media.addEventListener("input", paintPreview);
    paintPreview();

    const remove = pollNode("button", "poll-option-remove", "×");
    remove.type = "button";
    remove.title = t("Remove option");
    remove.setAttribute("aria-label", t("Remove this option"));
    remove.addEventListener("click", () => {
      if (pollOptions.querySelectorAll(".poll-option-row").length <= 2) return;
      row.remove();
      syncPollEditorFields();
    });
    row.append(mediaButton, label, media, remove, upload);
    return row;
  }

  function syncPollEditorFields() {
    if (!pollOptions) return;
    const meta = pollType(pollTypeSelect?.value);
    const rows = [...pollOptions.querySelectorAll(".poll-option-row")];
    const count = rows.length;
    if (pollOptionsWrap) pollOptionsWrap.hidden = !meta.hasOptions;
    if (pollAddOption) {
      pollAddOption.disabled = count >= MAX_POLL_OPTIONS;
      pollAddOption.textContent = count >= MAX_POLL_OPTIONS
        ? t("Maximum {n} options", { n: MAX_POLL_OPTIONS })
        : t("+ Add option");
    }
    rows.forEach(row => {
      const button = row.querySelector(".poll-option-remove");
      if (button) button.disabled = count <= 2;
    });
    if (pollMaxWrap) pollMaxWrap.hidden = !meta.multiple;
    if (pollMax) {
      const max = Math.max(2, Math.min(MAX_POLL_OPTIONS, count || 2));
      pollMax.max = String(max);
      const value = Math.max(2, Math.min(max, Number(pollMax.value) || max));
      pollMax.value = String(value);
      if (pollMaxOut) pollMaxOut.textContent = String(value);
    }
  }

  function setPollOptions(options) {
    if (!pollOptions) return;
    const fallback = [
      { label: t("Option {n}", { n: 1 }), media: "" },
      { label: t("Option {n}", { n: 2 }), media: "" }
    ];
    const list = Array.isArray(options) && options.length ? options : fallback;
    pollOptions.replaceChildren(...list.map(pollOptionRow));
    syncPollEditorFields();
  }

  function openPollEditor(poll) {
    initPollEditor();
    pollEditing = poll ? normalisePoll(poll) : null;
    fillPollCategories();
    if (pollDialogTitle) pollDialogTitle.textContent = pollEditing ? t("Edit poll") : t("New poll");
    if (pollSave) pollSave.textContent = pollEditing ? t("Save changes") : t("Create poll");
    if (pollQuestion) pollQuestion.value = pollEditing?.question || "";
    if (pollDescription) pollDescription.value = pollEditing?.description || "";
    if (pollTypeSelect) pollTypeSelect.value = pollEditing?.type || "single";
    if (pollCategory) pollCategory.value = pollEditing?.category || "Feedback";
    if (pollStatusSelect) pollStatusSelect.value = pollEditing?.status || "open";
    if (pollResultsSelect) pollResultsSelect.value = pollEditing?.results || "after";
    if (pollMax) pollMax.value = String(pollEditing?.maxChoices || 2);
    setPollOptions(pollEditing?.options?.length
      ? pollEditing.options.map(option => ({ label: option.label, media: option.media || "" }))
      : [
        { label: t("Option {n}", { n: 1 }), media: "" },
        { label: t("Option {n}", { n: 2 }), media: "" }
      ]);
    syncPollEditorFields();

    if (typeof pollDialog.showModal === "function") {
      if (!pollDialog.open) pollDialog.showModal();
    } else pollDialog.setAttribute("open", "");
    requestAnimationFrame(() => {
      pollQuestion?.focus();
      pollQuestion?.select();
    });
  }

  async function savePollEditor(event) {
    event.preventDefault();
    const question = String(pollQuestion?.value || "").trim();
    if (!question) { pollQuestion?.focus(); return; }
    const type = pollTypeSelect?.value || "single";
    const meta = pollType(type);
    const options = meta.hasOptions
      ? [...(pollOptions?.querySelectorAll(".poll-option-row") || [])].map(row => ({
        label: String(row.querySelector(".poll-option-label")?.value || "").trim(),
        media: String(row.querySelector(".poll-option-media-input")?.value || "").trim()
      })).filter(option => option.label)
      : [];
    if (meta.hasOptions && options.length < 2) {
      flashPollStatus("Add at least two options");
      return;
    }

    const base = pollEditing || {};
    const raw = {
      ...base,
      id: base.id || pollUid("poll"),
      created_at: base.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      question,
      description: String(pollDescription?.value || "").trim(),
      type,
      category: String(pollCategory?.value || "").trim() || "Feedback",
      options: meta.hasOptions ? options : [],
      maxChoices: meta.multiple ? Number(pollMax?.value) || options.length : 1,
      status: pollStatusSelect?.value || "open",
      results: pollResultsSelect?.value || "after",
      position: Number.isFinite(Number(base.position)) ? Number(base.position) : pollPositionNext()
    };

    if (pollSave) pollSave.disabled = true;
    const saved = await persistPoll(raw);
    if (pollSave) pollSave.disabled = false;
    if (saved) {
      pollEditing = null;
      pollDialog.close();
    }
  }

  async function syncPolls() {
    try {
      const [freshPolls, freshVotes] = await Promise.all([Store.listPolls(), Store.listVotes()]);
      polls.splice(0, polls.length, ...normalisePolls(freshPolls));
      votes.splice(0, votes.length, ...normalisePollVotes(freshVotes));
      pollSyncWarned = false;
    } catch (err) {
      if (!pollSyncWarned) {
        console.warn("Could not load polls. In live mode run supabase/migration-polls.sql.", err);
        pollSyncWarned = true;
      }
    }
    renderPollChrome();
  }

  /* ── live bar-chart race (presenter) ───────────────────────── */
  const raceOpenNow = () => document.body.classList.contains("show-race");
  const racePoll = () => polls.find(p => p.id === racePollId) || null;
  const raceFrames = () => raceData?.frames || [];

  function raceElapsed(at) {
    const first = raceFrames().find(frame => frame.at)?.at;
    if (!at || !first) return "0:00";
    const ms = new Date(at).getTime() - new Date(first).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "0:00";
    const seconds = Math.round(ms / 1000);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function buildRaceStage() {
    if (!raceStage) return;
    raceStage.replaceChildren();
    raceRows.clear();

    if (!raceData || raceData.kind === "text") {
      const empty = pollNode("div", "race-empty");
      empty.append(
        pollNode("span", "race-empty__icon", "✍"),
        pollNode("h3", null, t("Written answers, not a race")),
        pollNode("p", null, t("This poll collects open answers. The results are shown as a handwritten list."))
      );
      raceStage.append(empty);
      return;
    }

    if (!raceData.entries.length) {
      const empty = pollNode("div", "race-empty");
      empty.append(
        pollNode("span", "race-empty__icon", "⏳"),
        pollNode("h3", null, t("Waiting for the first answer")),
        pollNode("p", null, t("As phones answer, the bars will start moving."))
      );
      raceStage.append(empty);
      return;
    }

    raceStage.style.setProperty("--n", String(raceData.entries.length));
    raceData.entries.forEach((entry, index) => {
      const row = pollNode("div", "race-row");
      row.dataset.option = entry.id;
      row.style.setProperty("--c", typeof handChartColor === "function"
        ? handChartColor(entry.id || entry.label)
        : pollCategoryColor(entry.label));
      row.style.setProperty("--rank", String(index));
      row.style.setProperty("--pct", "0");

      const rank = pollNode("span", "race-rank", String(index + 1));
      const media = (typeof pollMediaNode === "function" ? pollMediaNode(entry.media) : null)
        || pollNode("span", "hc-media race-media race-media--empty", "");
      media.classList.add("race-media");
      const label = pollNode("span", "race-label", entry.label);
      const track = pollNode("span", "race-track");
      const fill = pollNode("span", "race-fill");
      fill.append(pollNode("span", "race-hatch"));
      track.append(fill);
      const count = pollNode("span", "race-count", "0");

      row.append(rank, media, label, track, count);
      raceStage.append(row);
      raceRows.set(entry.id, { row, rank, count });
    });
  }

  function raceRenderFrame() {
    if (!raceData) return;
    const frames = raceFrames();
    if (!frames.length) return;
    const index = Math.max(0, Math.min(frames.length - 1, Math.round(raceIndex)));
    const frame = frames[index];
    const counts = frame.counts || [];
    const max = Math.max(1, ...counts);

    const order = raceData.entries
      .map((entry, i) => ({ entry, i, count: Number(counts[i]) || 0 }))
      .sort((a, b) => (b.count - a.count) || (a.i - b.i));
    const rankOf = new Map(order.map((item, rank) => [item.entry.id, rank]));

    raceData.entries.forEach((entry, i) => {
      const ref = raceRows.get(entry.id);
      if (!ref) return;
      const count = Number(counts[i]) || 0;
      const rank = rankOf.get(entry.id) || 0;
      ref.row.style.setProperty("--rank", String(rank));
      ref.row.style.setProperty("--pct", String(Math.round((count / max) * 100)));
      ref.rank.textContent = String(rank + 1);
      ref.count.textContent = String(count);
    });

    if (raceClock) raceClock.textContent = raceElapsed(frame.at);
    if (raceProgress) {
      raceProgress.value = String(frames.length > 1 ? Math.round((index / (frames.length - 1)) * 100) : 100);
    }
    if (raceLive) raceLive.classList.toggle("is-live", index >= frames.length - 1);

    const poll = racePoll();
    if (raceSub && poll) {
      const answers = frame.total === 1 ? t("1 answer") : t("{n} answers", { n: frame.total });
      raceSub.textContent = t(poll.category) + " · " + pollType(poll.type).label + " · " + answers;
    }
  }

  function updateRaceControls() {
    if (racePlay) {
      racePlay.textContent = racePlaying ? t("Pause") : t("Play");
      racePlay.dataset.playing = racePlaying ? "1" : "0";
    }
    raceBox?.querySelectorAll("[data-race-speed]").forEach(button => {
      button.classList.toggle("act", Number(button.dataset.raceSpeed) === raceSpeed);
    });
  }

  function raceTick(now) {
    if (!raceOpenNow() || !racePlaying) return;
    const frames = raceFrames().length || 1;
    const dt = Math.max(0, now - raceLastTick);
    raceLastTick = now;
    const perFrame = Math.max(70, 8200 / Math.max(1, frames - 1)) / raceSpeed;
    raceClockValue += dt / perFrame;
    if (raceClockValue >= frames - 1) {
      raceClockValue = frames - 1;
      racePlaying = false;
    }
    const next = Math.round(raceClockValue);
    if (next !== raceIndex) {
      raceIndex = next;
      raceRenderFrame();
    } else if (raceProgress) {
      raceProgress.value = String(frames > 1 ? Math.round((raceClockValue / (frames - 1)) * 100) : 100);
    }
    if (racePlaying) raceRaf = requestAnimationFrame(raceTick);
    else { raceRenderFrame(); updateRaceControls(); }
  }

  function startRace(play) {
    cancelAnimationFrame(raceRaf);
    racePlaying = !!play && raceFrames().length > 1;
    raceClockValue = raceIndex;
    raceLastTick = performance.now();
    updateRaceControls();
    if (racePlaying) raceRaf = requestAnimationFrame(raceTick);
  }

  function openPollRace(poll) {
    if (!raceBox) return;
    if (!poll) {
      flashPollStatus("Create a poll first");
      return;
    }
    if (raceOpenNow()) closePollRace();
    setPollsPresentation(false);
    racePollId = poll.id;
    raceSpeed = 1;
    raceIndex = 0;
    raceClockValue = 0;
    raceData = pollRaceSeries(poll, votes);
    document.body.classList.add("show-race");
    raceBox.setAttribute("aria-hidden", "false");
    if (raceTitle) raceTitle.textContent = poll.question;
    buildRaceStage();
    raceRenderFrame();
    startRace(true);
    racePlay?.focus({ preventScroll: true });
  }

  function closePollRace() {
    if (!raceBox) return;
    cancelAnimationFrame(raceRaf);
    racePlaying = false;
    racePollId = null;
    raceData = null;
    raceRows.clear();
    document.body.classList.remove("show-race");
    raceBox.setAttribute("aria-hidden", "true");
  }

  function refreshRaceLive() {
    if (!raceOpenNow()) return;
    const poll = racePoll();
    if (!poll) { closePollRace(); return; }
    const atEnd = !raceData || raceIndex >= raceFrames().length - 1;
    raceData = pollRaceSeries(poll, votes);
    buildRaceStage();
    raceIndex = atEnd
      ? Math.max(0, raceFrames().length - 1)
      : Math.min(raceIndex, Math.max(0, raceFrames().length - 1));
    raceClockValue = raceIndex;
    if (raceTitle) raceTitle.textContent = poll.question;
    raceRenderFrame();
    if (racePlaying) startRace(true);
  }

  function toggleRacePlay() {
    if (!raceData || raceFrames().length < 2) return;
    if (racePlaying) {
      racePlaying = false;
      cancelAnimationFrame(raceRaf);
      updateRaceControls();
      return;
    }
    if (raceIndex >= raceFrames().length - 1) {
      raceIndex = 0;
      raceClockValue = 0;
      raceRenderFrame();
    }
    startRace(true);
  }

  function replayRace() {
    if (!raceData) return;
    raceIndex = 0;
    raceClockValue = 0;
    raceRenderFrame();
    startRace(true);
  }

  /* ── exports: PDF summary + notes-only JPEG ───────────────── */
  function exportCategories() {
    return categoryList().map(cat => ({ key: cat.key, label: cat.label, color: cat.color }));
  }

  function exportPayload(list) {
    return {
      notes: (list || []).map(note => ({
        id: note.id,
        text: note.text,
        author: note.author || note.name || "",
        category: note.category,
        created_at: note.created_at
      })),
      categories: exportCategories(),
      brand: {
        title: String(brandState.title || brandDefaults.title || "").trim(),
        subtitle: String(brandState.subtitle || "").trim(),
        logo: String(prefs.logo || brandDefaults.logo || "").trim()
      },
      wall: {
        color: prefs.bgColor || "",
        image: prefs.bgImage || "",
        dim: Number(prefs.bgDim) || 0
      }
    };
  }

  const exportableNotes = () => notes.filter(note => CATS[note.category] && String(note.text || "").trim());

  async function downloadWallJPEG() {
    if (typeof window.StickyExport?.downloadJPEG !== "function") return;
    await window.StickyExport.downloadJPEG(exportPayload(vis()));
  }

  async function downloadWallPDF() {
    if (typeof window.StickyExport?.downloadPDF !== "function") return;
    await window.StickyExport.downloadPDF(exportPayload(exportableNotes()));
  }

  $("extras-download-jpeg")?.addEventListener("click", downloadWallJPEG);
  $("dash-download-jpeg")?.addEventListener("click", downloadWallJPEG);
  $("extras-download-pdf")?.addEventListener("click", downloadWallPDF);
  $("dash-download-pdf")?.addEventListener("click", downloadWallPDF);

  /* ── race controls ─────────────────────────────────────────── */
  $("poll-race-open")?.addEventListener("click", () => {
    const poll = pollSorted().find(p => p.status === "open") || pollSorted()[0];
    if (!poll) { flashPollStatus("Create a poll first"); return; }
    openPollRace(poll);
  });
  raceClose?.addEventListener("click", closePollRace);
  racePlay?.addEventListener("click", toggleRacePlay);
  raceReplay?.addEventListener("click", replayRace);
  raceProgress?.addEventListener("input", () => {
    if (!raceData) return;
    const frames = raceFrames().length;
    if (!frames) return;
    racePlaying = false;
    cancelAnimationFrame(raceRaf);
    raceIndex = Math.round((Number(raceProgress.value) / 100) * Math.max(0, frames - 1));
    raceClockValue = raceIndex;
    raceRenderFrame();
    updateRaceControls();
  });
  raceBox?.querySelectorAll("[data-race-speed]").forEach(button => {
    button.addEventListener("click", () => {
      raceSpeed = Number(button.dataset.raceSpeed) || 1;
      updateRaceControls();
      if (racePlaying) startRace(true);
    });
  });
  raceBox?.addEventListener("click", event => {
    if (event.target === raceBox) closePollRace();
  });

  $("poll-close")?.addEventListener("click", closePollRoom);
  $("poll-new")?.addEventListener("click", () => openPollEditor(null));
  $("poll-samples")?.addEventListener("click", () => seedSamplePolls());
  $("extras-demo-notes")?.addEventListener("click", () => seedNotes());
  $("extras-demo-polls")?.addEventListener("click", () => seedSamplePolls());
  $("extras-demo-reset")?.addEventListener("click", event =>
    armButton(event.currentTarget, t("Confirm reset"), () => seedSamplePolls({ reset: true })));
  $("poll-present")?.addEventListener("click", () => setPollsPresentation(!pollsPresent, "all"));
  $("poll-present-one")?.addEventListener("click", () => {
    if (pollsPresent && pollStageMode) setPollsPresentation(false);
    else setPollsPresentation(true, "one");
  });
  $("poll-present-manual")?.addEventListener("click", () => {
    if (pollsPresent && presentationManual) setPollsPresentation(false);
    else setPollsPresentation(true, "one", true);
  });
  $("poll-empty-new")?.addEventListener("click", () => openPollEditor(null));
  $("poll-empty-samples")?.addEventListener("click", () => seedSamplePolls());
  $("extras-poll-room")?.addEventListener("click", openPollRoom);
  $("extras-poll-new")?.addEventListener("click", () => { setExtrasOpen(false); openPollEditor(null); });
  $("extras-poll-present")?.addEventListener("click", () => {
    setExtrasOpen(false);
    if (!pollRoomOpenNow()) openPollRoom();
    setPollsPresentation(true, "all");
  });
  $("extras-poll-present-one")?.addEventListener("click", () => {
    setExtrasOpen(false);
    if (!pollRoomOpenNow()) openPollRoom();
    setPollsPresentation(true, "one");
  });
  $("extras-poll-present-manual")?.addEventListener("click", () => {
    setExtrasOpen(false);
    if (!pollRoomOpenNow()) openPollRoom();
    setPollsPresentation(true, "one", true);
  });
  $("dash-poll-new")?.addEventListener("click", event => { event.stopPropagation(); openPollEditor(null); });
  $("status-polls")?.addEventListener("click", event => { event.stopPropagation(); openPollRoom(); });

  pollFilters?.addEventListener("click", event => {
    const button = event.target.closest("button[data-poll-filter]");
    if (!button) return;
    pollFilter = button.dataset.pollFilter || "all";
    renderPollRoom();
  });

  pollGrid?.addEventListener("click", event => {
    const button = event.target.closest("button[data-poll-act]");
    if (!button) return;
    const card = button.closest("[data-poll]");
    const poll = polls.find(p => p.id === card?.dataset.poll);
    if (!poll) return;
    const act = button.dataset.pollAct;
    if (act === "edit") openPollEditor(poll);
    else if (act === "race") openPollRace(poll);
    else if (act === "duplicate") duplicatePoll(poll);
    else if (act === "toggle") togglePollStatus(poll);
    else if (act === "reset") armButton(button, t("Confirm reset"), () => resetPollVotes(poll));
    else if (act === "delete") armButton(button, t("Confirm delete"), () => deletePoll(poll));
  });

  pollTypeSelect?.addEventListener("change", syncPollEditorFields);
  pollOptions?.addEventListener("input", syncPollEditorFields);
  pollAddOption?.addEventListener("click", () => {
    if (!pollOptions) return;
    const count = pollOptions.querySelectorAll(".poll-option-row").length;
    if (count >= MAX_POLL_OPTIONS) return;
    pollOptions.append(pollOptionRow(t("Option {n}", { n: count + 1 })));
    syncPollEditorFields();
    pollOptions.lastElementChild?.querySelector("input")?.focus();
  });
  pollMax?.addEventListener("input", () => {
    if (pollMaxOut) pollMaxOut.textContent = pollMax.value;
  });
  pollCancel?.addEventListener("click", () => pollDialog.close());
  pollDialog?.addEventListener("click", event => { if (event.target === pollDialog) pollDialog.close(); });
  pollForm?.addEventListener("submit", savePollEditor);

  function hideNote(id) {
    const nt = notes.find(n => n.id === id);
    if (!nt || hidden.has(id)) return;
    hidden.add(id);
    saveHidden();
    if (focusId === id) closeFocus();
    layout();
    if (!notes.some(n => !hidden.has(n.id))) openDashboard();
    else renderDashboard();
  }

  function restoreNote(id) {
    if (!hidden.delete(id)) return;
    saveHidden();
    layout();
    renderDashboard();
  }

  function restoreAll() {
    if (!hidden.size) return;
    hidden.clear();
    saveHidden();
    layout();
    renderDashboard();
  }

  function resetView() {
    setDashboard(false);
    closeFocus();
    setExtrasOpen(false);
    activeFilter = "all";
    cats = new Set(categoryKeys());
    buildFilters();
    layout();
    board.scrollTo({ top: 0, behavior: "smooth" });
    updateStatus();
  }

  async function clearWall() {
    closeFocus();
    if (Store.mode === "demo") {
      try { Store.clear(); } catch (err) { console.error("Could not clear notes", err); }
      notes.splice(0, notes.length);
      els.forEach(el => el.remove());
      els.clear();
      hidden.clear();
      saveHidden();
      activeFilter = "all";
      cats = new Set(categoryKeys());
      buildFilters();
      buildPiles(true);
      layout();
      setDashboard(false);
      renderDashboard();
      updateStatus();
      return;
    }
    /* Live data cannot be deleted from the presenter screen: hide every
       current note locally instead, so the wall can be reset safely. */
    notes.forEach(n => hidden.add(n.id));
    saveHidden();
    layout();
    renderDashboard();
    updateStatus();
  }

  const armedTimers = new WeakMap();
  function armButton(btn, label, action) {
    if (!btn) return;
    if (btn.dataset.armed === "1") {
      clearTimeout(armedTimers.get(btn));
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.armedLabel || btn.textContent;
      delete btn.dataset.armedLabel;
      action();
      return;
    }
    btn.dataset.armed = "1";
    btn.dataset.armedLabel = btn.textContent;
    btn.textContent = label;
    clearTimeout(armedTimers.get(btn));
    armedTimers.set(btn, setTimeout(() => {
      delete btn.dataset.armed;
      if (btn.dataset.armedLabel) btn.textContent = btn.dataset.armedLabel;
      delete btn.dataset.armedLabel;
    }, 4200));
  }

  /* ── fit handwriting inside a sheet ─────────────────────────── */
  function fits(p) {
    return p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1;
  }

  function fitNote(el, size) {
    const p = el.querySelector(".note-text");
    if (!p) return;
    const s = size || el.clientWidth || 200;
    const fm = parseFloat(el.style.getPropertyValue("--fm")) || 1;
    const focus = el.classList.contains("focus-note");
    const floor = focus ? 16 : 9;
    let fs = Math.min(s * (focus ? .118 : .168) * fm, focus ? 78 : 58);

    /* The sheet animates width/height; measure at the target size so a
       mid-transition box cannot produce a font that overflows later. */
    const prevTransition = el.style.transition;
    el.style.transition = "none";
    el.getBoundingClientRect();

    p.style.fontSize = fs.toFixed(2) + "px";

    /* Shrink in measured steps: wrapping changes the line count, so a
       single ratio is not enough. The loop settles within a few passes. */
    for (let i = 0; i < 14 && !fits(p); i++) {
      const sh = p.scrollHeight || 1, ch = p.clientHeight || 1;
      const sw = p.scrollWidth || 1, cw = p.clientWidth || 1;
      const ratio = Math.min(ch / sh, cw / sw);
      if (!isFinite(ratio) || ratio <= 0) break;
      const step = Math.max(.82, Math.min(.98, Math.pow(Math.min(ratio, .99), .62) * .99));
      fs = Math.max(floor, fs * step);
      p.style.fontSize = fs.toFixed(2) + "px";
      if (fs === floor) break;
    }

    el.style.transition = prevTransition;
  }

  function refitAll() {
    els.forEach(el => delete el.dataset.fitS);
    layout();
    if (focusId && focusStage.firstElementChild) fitNote(focusStage.firstElementChild);
  }

  /* ── layout: fill the whole screen, then pile ──────────────── */
  const MIN_TILE = 140, MAX_TILE = 320, PAD_X = 16, PAD_BOTTOM = 14, BLOCK_GAP = 18;

  function boardFrame() {
    const W = board.clientWidth || 1, H = board.clientHeight || 1;
    const brandShown = !!(brand && !brand.classList.contains("hidden") && prefs.brand);
    const brandBottom = brandShown ? brand.getBoundingClientRect().bottom : 0;
    const padTop = brandShown ? Math.max(64, brandBottom + 14) : 18;
    return {
      W, H, padTop, padBottom: PAD_BOTTOM,
      availW: Math.max(220, W - PAD_X * 2),
      availH: Math.max(180, H - padTop - PAD_BOTTOM)
    };
  }

  /* One fixed cell size for the whole wall, derived from the full-screen
     capacity. Cells are separated by a real pixel gap so notes never
     overlap; the cell never grows for a short list, so notes stay on a
     regular grid and land in arrival order instead of spreading out. */
  function gridMetrics(f) {
    const gap = Math.max(0, Number(prefs.gap) || 0);
    const maxCols = Math.max(1, Math.floor((f.availW + gap) / (MIN_TILE + gap)));
    const maxRows = Math.max(1, Math.floor((f.availH + gap) / (MIN_TILE + gap)));
    const size = Math.max(MIN_TILE, Math.min(MAX_TILE,
      (f.availW - (maxCols - 1) * gap) / maxCols,
      (f.availH - (maxRows - 1) * gap) / maxRows));
    const stepX = size + gap, stepY = size + gap;
    const blockW = maxCols * size + (maxCols - 1) * gap;
    const blockH = maxRows * size + (maxRows - 1) * gap;
    return {
      maxCols, maxRows, capacity: maxCols * maxRows,
      size, stepX, stepY, gap, blockW, blockH,
      x0: PAD_X + Math.max(0, (f.availW - blockW) / 2),
      y0: f.padTop + Math.max(0, (f.availH - blockH) / 2)
    };
  }

  /* Column-major: fill column one top to bottom, then column two.
     Once a whole screen is full, start a new block below it. */
  function regularPlan(n, m) {
    const cells = [];
    const perBlock = m.capacity;
    for (let i = 0; i < n; i++) {
      const within = i % perBlock;
      cells.push({
        col: Math.floor(within / m.maxRows),
        row: within % m.maxRows,
        block: Math.floor(i / perBlock)
      });
    }
    return cells;
  }

  /* Optional presenter layout: every category starts a new column.
     If that needs more columns than the wall has, return null so the
     caller falls back to regular packing instead of piling early. */
  function categoryColumnPlan(list, m) {
    const groups = categoryList()
      .map(cat => list.filter(n => n.category === cat.key))
      .filter(group => group.length);
    const columnsNeeded = groups.reduce((sum, group) => sum + Math.ceil(group.length / m.maxRows), 0);
    if (columnsNeeded > m.maxCols) return null;

    const cells = [];
    let col = 0;
    groups.forEach(group => {
      let row = 0;
      group.forEach(note => {
        cells.push({ note, col, row });
        row++;
        if (row >= m.maxRows) { row = 0; col++; }
      });
      if (row > 0) col++;
    });
    return cells.length === list.length ? cells : null;
  }

  function pileSizes() {
    const n = Math.max(1, categoryKeys().length);
    const W = board.clientWidth || window.innerWidth || 1;
    const H = board.clientHeight || window.innerHeight || 1;
    const gap = Math.max(10, Math.min(34, W * .02));
    /* 2px of slack absorbs sub-pixel rounding so a narrow screen keeps the
       intended row count instead of dropping one pile onto a new row. */
    const availW = W - (W < 700 ? 26 : 50);
    const availH = Math.max(260, H - 140);
    let rows = 1;
    let perRow = n;
    let size = (availW - (n - 1) * gap) / n;
    if (size < 108 && n > 3) {
      rows = 2;
      perRow = Math.ceil(n / rows);
      size = (availW - (perRow - 1) * gap) / perRow;
      size = Math.min(size, (availH - gap) / rows);
    }
    size = Math.max(86, Math.min(size, availH * .62, 240));
    pilesHost.style.setProperty("--pile-size", size.toFixed(1) + "px");
    pilesHost.style.setProperty("--pile-gap", gap.toFixed(1) + "px");
  }

  function buildPiles(force) {
    if (!pilesHost) return;
    const signature = categoryList().map(c => [c.key, c.label, c.short, c.color, c.color2, c.deep].join("|")).join("||");
    if (!force && signature === pileSignature && pilesHost.childElementCount) return;
    pileSignature = signature;
    pilesHost.replaceChildren();
    categoryList().forEach((cat, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pile";
      b.dataset.cat = cat.key;
      b.style.setProperty("--pile", cat.color);
      b.style.setProperty("--pile2", cat.color2);
      b.style.setProperty("--pile-deep", cat.deep);
      b.style.setProperty("--pi", idx);

      const stack = document.createElement("span");
      stack.className = "pile-stack";
      stack.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 5; i++) {
        const paper = document.createElement("span");
        paper.className = "pile-sheet";
        paper.style.setProperty("--i", i);
        paper.style.zIndex = String(10 - i);
        stack.appendChild(paper);
      }

      const label = document.createElement("span");
      label.className = "pile-label";
      const kicker = document.createElement("span");
      kicker.className = "pile-kicker";
      kicker.textContent = t(cat.short);
      const count = document.createElement("span");
      count.className = "pile-count";
      const word = document.createElement("span");
      word.className = "pile-word";
      const open = document.createElement("span");
      open.className = "pile-open";
      open.textContent = t("Open pile");
      label.append(kicker, count, word, open);

      b.append(stack, label);
      b.addEventListener("click", () => setFilter(cat.key));
      pilesHost.appendChild(b);
    });
    pileSizes();
  }

  function renderPiles() {
    if (!pilesHost) return;
    buildPiles(false);
    /* buildPiles() is a no-op when the category signature is unchanged,
       so recompute the pile size here on every layout. Otherwise piles
       keep the size from the previous viewport after a resize or an
       orientation change and can overflow a narrower screen. */
    pileSizes();
    pilesHost.querySelectorAll(".pile").forEach(b => {
      const key = b.dataset.cat;
      const count = notes.filter(n => n.category === key && !hidden.has(n.id)).length;
      b.querySelector(".pile-count").textContent = String(count);
      b.querySelector(".pile-word").textContent = count === 1 ? t("note") : t("notes");
      const cat = CATS[key];
      b.setAttribute("aria-label", t(cat.short) + ": " + plural(count) + ". " + t("Show these notes."));
    });
  }

  function pulsePile(cat) {
    const b = pilesHost?.querySelector('.pile[data-cat="' + cat + '"]');
    if (!b) return;
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
    setTimeout(() => b.classList.remove("bump"), 700);
  }

  function layout() {
    const f = boardFrame();
    const { padTop, padBottom, H } = f;
    const list = vis();
    const total = notes.filter(n => !hidden.has(n.id)).length;
    const n = list.length;
    const m = gridMetrics(f);
    const { size, stepX, stepY, capacity } = m;
    pileView = activeFilter === "all" && total > capacity;
    if (pileView && focusId) closeFocus();

    renderPiles();
    pilesBack.hidden = !(total > capacity && activeFilter !== "all");

    if (!n) {
      notes.forEach(nt => els.get(nt.id)?.classList.add("gone"));
      pilesHost.hidden = true;
      sheet.style.height = H + "px";
      updateStatus();
      return;
    }

    if (pileView) {
      notes.forEach(nt => els.get(nt.id)?.classList.add("gone"));
      pilesHost.hidden = false;
      sheet.style.height = H + "px";
      board.scrollTo({ top: 0, behavior: "auto" });
      updateStatus();
      return;
    }

    pilesHost.hidden = true;

    /* Column-first placement on a fixed grid. When a filtered category
       holds more notes than the screen, extra rows continue below the
       fold and the wall scrolls instead of piling early. */
    const overflow = n > capacity;
    const columnMode = prefs.columns && activeFilter === "all" && !overflow;
    const plan = (columnMode ? categoryColumnPlan(list, m) : null) || regularPlan(n, m);

    let lastBlock = 0, lastRow = 0;
    plan.forEach(cell => {
      const block = cell.block || 0;
      if (block > lastBlock) { lastBlock = block; lastRow = cell.row; }
      else if (block === lastBlock && cell.row > lastRow) lastRow = cell.row;
    });
    const gridBottom = m.y0 + lastBlock * (m.blockH + BLOCK_GAP) + lastRow * stepY + size;
    const sheetH = Math.max(H, gridBottom + padBottom);
    sheet.style.height = sheetH + "px";

    plan.forEach((cell, order) => {
      const nt = cell.note || list[order];
      const el = els.get(nt.id);
      if (!el) return;
      const block = cell.block || 0;
      el.classList.remove("gone");
      el.style.setProperty("--s", size + "px");
      el.style.setProperty("--x", (m.x0 + cell.col * stepX).toFixed(1) + "px");
      el.style.setProperty("--y", (m.y0 + block * (m.blockH + BLOCK_GAP) + cell.row * stepY).toFixed(1) + "px");
      el.style.zIndex = order + 1;
      if (el.dataset.fitS !== String(Math.round(size))) {
        fitNote(el, size);
        el.dataset.fitS = String(Math.round(size));
      }
    });

    notes.filter(nt => hidden.has(nt.id) || !cats.has(nt.category)).forEach(nt => els.get(nt.id)?.classList.add("gone"));
    updateStatus();
  }

  /* ── notes ─────────────────────────────────────────────────── */
  function addNote(nt, animate, quiet) {
    if (!nt || els.has(nt.id)) return;
    if (!CATS[nt.category]) nt = { ...nt, category: categoryKeys()[0] };
    notes.push(nt);
    notes.sort((a, b) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);
    const el = buildNote(nt);
    if (animate) { el.classList.add("new"); setTimeout(() => el.classList.remove("new"), 1100); }
    el.addEventListener("click", e => { e.stopPropagation(); openFocus(nt.id); });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFocus(nt.id); }
    });
    els.set(nt.id, el);
    sheet.appendChild(el);
    if (quiet) return;
    layout();

    if (animate && cats.has(nt.category) && !hidden.has(nt.id) && !dashboardOpen()) {
      if (!focusId) {
        if (!pileView && board.scrollHeight > board.clientHeight + 4) {
          board.scrollTo({ top: board.scrollHeight, behavior: "smooth" });
        }
        react(nt.category);
        if (pileView) pulsePile(nt.category);
      } else {
        updateFocusMeta();
      }
    }
  }

  function updateNote(nt) {
    const i = notes.findIndex(n => n.id === nt.id);
    if (i < 0) return;
    if (!CATS[nt.category]) nt = { ...nt, category: categoryKeys()[0] };
    notes[i] = { ...notes[i], ...nt };
    const el = els.get(nt.id);
    if (el) paintNote(el, notes[i]);
    layout();
    if (focusId === nt.id) openFocus(nt.id);
  }

  function reassignNotes(from, to) {
    if (!to) return;
    const set = new Set(from || []);
    let touched = false;
    notes.forEach(n => {
      if (set.has(n.category)) {
        n.category = to;
        touched = true;
        const el = els.get(n.id);
        if (el) paintNote(el, n);
      }
    });
    if (touched) {
      if (focusId) updateFocusMeta();
      layout();
    }
  }

  function removeNote(id) {
    const i = notes.findIndex(n => n.id === id);
    if (i < 0) return;
    notes.splice(i, 1);
    els.get(id)?.remove();
    els.delete(id);
    if (hidden.delete(id)) saveHidden();
    if (focusId === id) { focusId = null; document.body.classList.remove("reading"); setMood("idle", true); focusStage.replaceChildren(); }
    layout();
  }

  /* Reconcile with storage after a resync: drop notes that vanished
     elsewhere and add the ones that arrived while we were disconnected. */
  async function syncNotes() {
    let fresh = [];
    try { fresh = await Store.list(); } catch (err) { console.error(err); return; }
    const ids = new Set(fresh.map(n => n.id));
    notes.slice().forEach(n => {
      if (ids.has(n.id)) return;
      const i = notes.indexOf(n);
      if (i >= 0) notes.splice(i, 1);
      els.get(n.id)?.remove();
      els.delete(n.id);
      hidden.delete(n.id);
    });
    const known = new Set(notes.map(n => n.id));
    fresh.forEach(n => { if (!known.has(n.id)) addNote(n, false, true); });
    ensureKnownCategories(false);
    saveHidden();
    layout();
    updateStatus();
  }

  /* ── reading mode ──────────────────────────────────────────── */
  function moodFor(category) {
    const known = { question: "question", idea: "idea", appreciation: "appreciation", resources: "idea", requests: "question" };
    return known[category] || "idle";
  }

  function openFocus(id) {
    const nt = notes.find(n => n.id === id);
    if (!nt) return;
    clearTimeout(closeTimer);
    focusId = id;
    focusStage.replaceChildren();
    const el = buildNote(nt);
    el.classList.add("focus-note");
    focusStage.appendChild(el);
    document.body.classList.add("reading");
    setMood(moodFor(nt.category), true);
    updateFocusMeta();
    fitNote(el);
    requestAnimationFrame(() => fitNote(el));
    requestAnimationFrame(() => requestAnimationFrame(() => fitNote(el)));
  }

  function closeFocus() {
    if (!focusId) return;
    focusId = null;
    document.body.classList.remove("reading");
    setMood("idle", true);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!document.body.classList.contains("reading")) focusStage.replaceChildren();
    }, 420);
  }

  function step(d) {
    /* Piles stay in place on the wall (and return when presentation ends),
       but they must not stop the notes-only slideshow: presentation opens
       the notes one by one in arrival order even while the wall is piled. */
    if (pileView && !notesPresent) return;
    const l = vis();
    if (!l.length) return;
    const i = l.findIndex(n => n.id === focusId);
    openFocus(l[(i < 0 ? (d > 0 ? 0 : l.length - 1) : (i + d + l.length) % l.length)].id);
  }

  function updateFocusMeta() {
    if (!focusId) return;
    const nt = notes.find(n => n.id === focusId);
    if (!nt) return;
    const list = vis(), i = list.findIndex(n => n.id === focusId);
    focusCat.textContent = t(CATS[nt.category]?.label || "Note");
    focusCount.textContent = t("{i} of {n}", { i: i < 0 ? 1 : i + 1, n: Math.max(1, list.length) });
    focusMeta.style.setProperty("--focus-dot", CATS[nt.category]?.color || "#fff4e6");
  }

  /* ── Bun's mood ────────────────────────────────────────────── */
  function setMood(m, pop) {
    if (!avatar || avatar.dataset.mood === m) return;
    avatar.dataset.mood = m;
    if (pop) {
      avatar.classList.remove("mood-pop");
      void avatar.offsetWidth;
      avatar.classList.add("mood-pop");
    }
  }
  function react(category) {
    if (focusId) return;
    clearTimeout(moodTimer);
    setMood(moodFor(category), true);
    moodTimer = setTimeout(() => { if (!focusId) setMood("idle", true); }, 4200);
  }

  document.addEventListener("click", e => {
    if (focusId && !e.target.closest(".note") && !e.target.closest("#filters") && !e.target.closest(".focus-btn")) closeFocus();
  });
  $("prev").addEventListener("click", e => { e.stopPropagation(); step(-1); });
  $("next").addEventListener("click", e => { e.stopPropagation(); step(1); });
  $("focus-hide")?.addEventListener("click", e => {
    e.stopPropagation();
    if (focusId) hideNote(focusId);
  });

  /* ── hidden filters ────────────────────────────────────────── */
  const fbar = $("filters");

  function buildFilters() {
    fbar.replaceChildren();
    const all = document.createElement("button");
    all.type = "button";
    all.dataset.f = "all";
    all.style.setProperty("--dot", "#fff4e6");
    const allDot = document.createElement("span"); allDot.className = "dot";
    all.append(allDot, document.createTextNode(t("All")));
    fbar.appendChild(all);

    categoryList().forEach((cat, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.f = cat.key;
      b.style.setProperty("--dot", cat.color);
      b.title = t("Filter: {name} ({n})", { name: t(cat.short), n: idx + 1 });
      const dot = document.createElement("span"); dot.className = "dot";
      b.append(dot, document.createTextNode(t(cat.short)));
      fbar.appendChild(b);
    });

    const keys = document.createElement("span");
    keys.className = "keys";
    keys.textContent = "F";
    fbar.appendChild(keys);

    fbar.querySelectorAll("button").forEach(b => b.classList.toggle("act", b.dataset.f === activeFilter));
  }

  function setFilter(f, opts = {}) {
    if (f !== "all" && !CATS[f]) f = "all";
    activeFilter = f;
    cats = f === "all" ? new Set(categoryKeys()) : new Set([f]);
    fbar.querySelectorAll("button").forEach(b => b.classList.toggle("act", b.dataset.f === f));
    const focused = notes.find(n => n.id === focusId);
    if (focusId && !cats.has(focused?.category)) closeFocus();
    layout();
    if (opts.scroll !== false) board.scrollTo({ top: 0, behavior: "smooth" });
    updateStatus();
  }
  fbar.addEventListener("click", e => {
    const btn = e.target.closest("button[data-f]");
    if (btn) setFilter(btn.dataset.f);
  });
  pilesBack?.addEventListener("click", () => setFilter("all"));
  let tap = 0;
  $("hot").addEventListener("pointerdown", () => {
    const t = Date.now();
    if (t - tap < 400) fbar.classList.toggle("on");
    tap = t;
  });

  /* ── presenter extras dock ─────────────────────────────────── */
  function setExtrasOpen(open) {
    if (!extras) return;
    extras.classList.toggle("open", !!open);
    extrasToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    $("poll-controls")?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  extrasToggle?.addEventListener("click", e => {
    e.stopPropagation();
    setExtrasOpen(!extras.classList.contains("open"));
  });

  /* The Poll Room uses the same dock, so its own button opens it too. */
  $("poll-controls")?.addEventListener("click", e => {
    e.stopPropagation();
    setExtrasOpen(!extras.classList.contains("open"));
  });

  function handleExtraInput(input) {
    const key = input?.dataset?.extra;
    if (!key || !(key in prefs)) return;
    if (input.type === "checkbox") prefs[key] = input.checked;
    else if (input.type === "color") prefs[key] = normaliseHex(input.value) || "";
    else if (input.type === "range") {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      prefs[key] = value;
    } else prefs[key] = input.value;
    savePrefs();

    if (key === "gap") { syncPrefInputs(); layout(); }
    else if (key === "bgDim" || key === "bgColor") applyLook();
    else if (key === "logoSize") { applyLook(); layout(); }
    else if (key === "autoplay" || key === "autoplayDelay" || key === "autoplayDuration") syncPrefInputs();
    else applyPrefs(true);
  }

  extrasPanel?.addEventListener("input", e => {
    const input = e.target.closest("input[data-extra]");
    if (input && (input.type === "range" || input.type === "color")) handleExtraInput(input);
  });
  extrasPanel?.addEventListener("change", e => {
    const input = e.target.closest("input[data-extra]");
    if (input && input.type === "checkbox") handleExtraInput(input);
  });

  /* Resize an uploaded image before storing it, so the wall keeps working
     inside the localStorage budget. */
  function readImageFile(file, maxDim, type, quality) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || "")) { reject(new Error("Not an image")); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("Read failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Invalid image"));
        img.onload = () => {
          const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas unavailable")); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try { resolve(canvas.toDataURL(type, quality)); }
          catch (err) { reject(err); }
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function absoluteImageUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    try {
      const url = new URL(value, location.href);
      if (!/^(https?:|data:image\/|blob:)/i.test(url.href)) return null;
      return url.href;
    } catch { return null; }
  }

  function applyImageFile(file, key, maxDim, type, quality, tooLarge) {
    readImageFile(file, maxDim, type, quality).then(data => {
      const before = prefs[key];
      prefs[key] = data;
      if (!savePrefs()) {
        prefs[key] = before;
        statusText.textContent = t(tooLarge);
        return;
      }
      applyLook();
      layout();
    }).catch(err => {
      console.error("Could not load image", err);
      statusText.textContent = t("Could not read that image");
    });
  }

  $("extras-dashboard")?.addEventListener("click", () => openDashboard());
  $("extras-event-title")?.addEventListener("click", () => {
    setExtrasOpen(false);
    openEventEditor();
  });
  $("extras-categories")?.addEventListener("click", () => {
    setExtrasOpen(false);
    openCategoryEditor();
  });
  $("dash-back")?.addEventListener("click", closeDashboard);
  $("extras-reset-view")?.addEventListener("click", resetView);
  $("dash-reset")?.addEventListener("click", resetView);
  $("extras-restore")?.addEventListener("click", restoreAll);
  $("dash-restore")?.addEventListener("click", restoreAll);
  $("extras-clear")?.addEventListener("click", e => armButton(e.currentTarget, t("Confirm clear"), clearWall));
  $("dash-clear")?.addEventListener("click", e => armButton(e.currentTarget, t("Confirm clear"), clearWall));

  dashNotes?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    e.stopPropagation();
    if (btn.dataset.act === "restore") restoreNote(btn.dataset.id);
    else hideNote(btn.dataset.id);
  });

  $("empty")?.addEventListener("click", e => {
    if (e.target === e.currentTarget && dashboardOpen()) closeDashboard();
  });

  $("extras-swatches")?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-wall]");
    if (!btn) return;
    prefs.bgColor = normaliseHex(btn.dataset.wall) || "";
    savePrefs();
    applyLook();
  });
  $("extras-bg-color-reset")?.addEventListener("click", () => {
    prefs.bgColor = "";
    savePrefs();
    applyLook();
  });

  $("extras-bg-upload")?.addEventListener("click", () => $("extras-bg-file")?.click());
  $("extras-bg-file")?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) applyImageFile(file, "bgImage", 2200, "image/jpeg", .82, "That image is too large to save — try a smaller file.");
  });
  $("extras-bg-clear")?.addEventListener("click", () => {
    prefs.bgImage = "";
    savePrefs();
    applyLook();
  });
  $("extras-bg-url-set")?.addEventListener("click", () => {
    const input = $("extras-bg-url");
    const url = absoluteImageUrl(input?.value);
    if (!url) { statusText.textContent = t("That does not look like an image URL"); return; }
    prefs.bgImage = url;
    savePrefs();
    applyLook();
    if (input) input.value = "";
  });
  $("extras-bg-url")?.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("extras-bg-url-set")?.click(); }
  });

  $("extras-logo-upload")?.addEventListener("click", () => $("extras-logo-file")?.click());
  $("extras-logo-file")?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) applyImageFile(file, "logo", 512, "image/png", 1, "That logo is too large to save — try a smaller file.");
  });
  $("extras-logo-reset")?.addEventListener("click", () => {
    prefs.logo = "";
    savePrefs();
    applyLook();
    layout();
  });
  $("extras-logo-url-set")?.addEventListener("click", () => {
    const input = $("extras-logo-url");
    const url = absoluteImageUrl(input?.value);
    if (!url) { statusText.textContent = t("That does not look like an image URL"); return; }
    prefs.logo = url;
    savePrefs();
    applyLook();
    layout();
    if (input) input.value = "";
  });
  $("extras-logo-url")?.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("extras-logo-url-set")?.click(); }
  });

  /* Notes-only presentation: the wall fills the screen, with no chrome at all.
     Escape (or H) restores whichever extras were visible before. */
  function setNotesPresentation(on, manual) {
    on = !!on;
    if (!on && !notesPresent) { presentationManual = false; return; }
    const entering = on && !notesPresent;
    notesPresent = on;
    presentationManual = on ? !!manual : false;
    if (entering) {
      notesPresentSnapshot = {
        brand: prefs.brand,
        mascot: prefs.mascot,
        qr: prefs.qr,
        status: prefs.status,
        filters: prefs.filters
      };
      ["brand", "mascot", "qr", "status", "filters"].forEach(key => { prefs[key] = false; });
    } else if (!on && notesPresentSnapshot) {
      Object.assign(prefs, notesPresentSnapshot);
      notesPresentSnapshot = null;
    }
    document.body.classList.toggle("present-notes", notesPresent);
    $("extras-notes-manual")?.setAttribute("aria-pressed", notesPresent && presentationManual ? "true" : "false");
    savePrefs();
    applyPrefs(true);
    if (notesPresent) {
      closeFocus();
      document.activeElement?.blur?.();
      goFullscreen();
      setExtrasOpen(false);
      armAutoplay();
    } else {
      clearAutoplay();
      closeFocus();
      leaveFullscreen();
    }
  }

  extrasNotesOnly?.addEventListener("click", () => setNotesPresentation(true));
  $("extras-notes-manual")?.addEventListener("click", () => {
    if (notesPresent && presentationManual) setNotesPresentation(false);
    else setNotesPresentation(true, true);
  });

  extrasShowAll?.addEventListener("click", () => {
    setNotesPresentation(false);
    ["brand", "mascot", "qr", "status", "filters"].forEach(key => { prefs[key] = true; });
    savePrefs();
    applyPrefs(true);
    setExtrasOpen(false);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest("#extras")) setExtrasOpen(false);
  });

  /* ── keyboard (moderator at the laptop) ────────────────────── */
  document.addEventListener("keydown", e => {
    if (eventDialog?.open || categoryDialog?.open || pollDialog?.open || /^(input|textarea|select)$/i.test(e.target.tagName || "")) return;
    /* let Space/Enter activate a focused button or note natively */
    if ((e.key === " " || e.key === "Enter") && e.target.closest?.("button, .note")) return;
    const k = e.key.toLowerCase();
    touchAutoplay();
    if (raceOpenNow()) {
      if (k === "escape") { e.preventDefault(); closePollRace(); }
      else if (k === "r") { e.preventDefault(); replayRace(); }
      return;
    }
    if (pollRoomOpenNow()) {
      if (k === "escape") {
        if (pollsPresent) setPollsPresentation(false);
        else if (extras?.classList.contains("open")) setExtrasOpen(false);
        else closePollRoom();
      }
      else if (k === "p") closePollRoom();
      else if (k === "f") setPollsPresentation(!pollsPresent, "all");
      else if (k === "o") {
        if (pollsPresent && pollStageMode) setPollsPresentation(false);
        else setPollsPresentation(true, "one");
      }
      else if (k === "m") {
        if (pollsPresent && presentationManual) setPollsPresentation(false);
        else setPollsPresentation(true, "one", true);
      }
      else if (pollsPresent && (k === "arrowright" || k === "arrowdown" || k === " " || k === "pagedown")) { e.preventDefault(); stepPollStage(1); }
      else if (pollsPresent && (k === "arrowleft" || k === "arrowup" || k === "pageup")) { e.preventDefault(); stepPollStage(-1); }
      else if (k === "n") openPollEditor(null);
      else if (k === "s") seedSamplePolls();
      else if (k === "h") {
        if (pollsPresent) { setPollsPresentation(false); setExtrasOpen(true); }
        else setExtrasOpen(!extras?.classList.contains("open"));
      }
      else if (k === "e") openEventEditor();
      else if (k === "c") openCategoryEditor();
      else if (k === "d") openDashboard();
      else if (k === "r") {
        const poll = pollSorted().find(p => p.status === "open") || pollSorted()[0];
        if (poll) openPollRace(poll);
      }
      return;
    }
    if (dashboardOpen()) {
      if (k === "escape" || k === "d") closeDashboard();
      else if (k === "h") setExtrasOpen(!extras?.classList.contains("open"));
      return;
    }
    if (k === "escape") {
      if (notesPresent) setNotesPresentation(false);
      else if (focusId) closeFocus();
      else { closeFocus(); setExtrasOpen(false); closePollRoom(); }
    }
    else if (k === "d") toggleDashboard();
    else if (k === "x" && focusId) hideNote(focusId);
    else if (k === "arrowright" || k === "arrowdown" || k === " ") { e.preventDefault(); step(1); }
    else if (k === "arrowleft" || k === "arrowup") { e.preventDefault(); step(-1); }
    else if (k === "e" && !focusId) openEventEditor();
    else if (k === "c" && !focusId) openCategoryEditor();
    else if (k === "p" && !focusId) openPollRoom();
    else if (k === "n" && !focusId) openPollEditor(null);
    else if (k === "h" && !focusId) {
      if (notesPresent) { setNotesPresentation(false); setExtrasOpen(true); }
      else setExtrasOpen(!extras?.classList.contains("open"));
    }
    else if (k === "m" && !focusId) {
      if (notesPresent && presentationManual) setNotesPresentation(false);
      else setNotesPresentation(true, true);
    }
    else if (k === "f") {
      if (!prefs.filters) {
        prefs.filters = true;
        savePrefs();
        applyPrefs(false);
        fbar.classList.add("on");
      } else fbar.classList.toggle("on");
    }
    else if (/^[0-9]$/.test(k)) {
      if (k === "0") setFilter("all");
      else {
        const cat = categoryList()[Number(k) - 1];
        if (cat) setFilter(cat.key);
      }
    }
    else if (k === "s" && Store.mode === "demo") seed();
  });

  /* hide cursor when idle */
  let it;
  const wake = () => {
    document.body.classList.remove("idle");
    clearTimeout(it);
    it = setTimeout(() => document.body.classList.add("idle"), 2500);
  };
  document.addEventListener("mousemove", wake); wake();

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });
  window.addEventListener("orientationchange", () => setTimeout(layout, 220));

  /* ── ambient dust ──────────────────────────────────────────── */
  function makeDust() {
    const ambient = $("ambient");
    if (!ambient) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = quiet ? 7 : 18;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const d = document.createElement("span");
      d.className = "mote";
      const r = rnd(hash("dust" + i))();
      d.style.setProperty("--mx", (4 + r * 92).toFixed(1) + "%");
      d.style.setProperty("--my", (18 + rnd(hash("m" + i))() * 76).toFixed(1) + "%");
      d.style.setProperty("--ms", (1.1 + rnd(hash("s" + i))() * 2.1).toFixed(2) + "px");
      d.style.setProperty("--md", (15 + rnd(hash("d" + i))() * 17).toFixed(1) + "s");
      d.style.setProperty("--mdelay", (-rnd(hash("e" + i))() * 24).toFixed(1) + "s");
      d.style.setProperty("--mox", (rnd(hash("x" + i))() * 70 - 35).toFixed(0) + "px");
      d.style.setProperty("--mo", (.12 + rnd(hash("o" + i))() * .24).toFixed(2));
      frag.appendChild(d);
    }
    ambient.replaceChildren(frag);
  }

  /* demo helpers: sample content loads in rounds, so the buttons and the
     S shortcut keep adding material instead of replacing the wall */
  let seedingSamples = false;
  const samplePollRound = () => polls.reduce((max, poll) => {
    if (!String(poll.id).startsWith("sample-")) return max;
    const match = /^sample-b(\d+)-/.exec(poll.id);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, -1) + 1;

  async function seedSamplePolls(options) {
    if (seedingSamples) return;
    if (Store.mode !== "demo") {
      flashPollStatus("Sample polls are only available in demo mode");
      return;
    }
    const reset = !!(options && options.reset === true);
    seedingSamples = true;
    const buttons = [...document.querySelectorAll("#poll-samples, #poll-empty-samples, #extras-demo-polls, #extras-demo-reset")];
    buttons.forEach(button => { button.disabled = true; });
    try {
      if (reset) {
        const existing = polls.filter(p => p.id.startsWith("sample-")).map(p => p.id);
        for (const id of existing) await Store.deletePoll(id);
      }
      const round = reset ? 0 : samplePollRound();
      const set = pollSampleSet(Date.now(), round);
      for (const poll of set.polls) await Store.savePoll(poll);
      for (const vote of set.votes) await Store.submitVote(vote);
      pollFilter = "all";
      await syncPolls();
      flashPollStatus(reset
        ? t("{n} sample polls loaded", { n: set.polls.length })
        : t("{n} more sample polls added", { n: set.polls.length }));
    } catch (err) {
      console.error("Sample polls could not be loaded", err);
      flashPollStatus("Could not load sample polls");
    } finally {
      seedingSamples = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  /* Two rounds of hand-written notes: every load adds a different batch. */
  const SAMPLE_NOTE_SETS = [
    [
      ["Amina", "question", "How do we make sure the maps stay useful after the event?"],
      ["Tunde", "idea", "A map of every coffee washing station in Rwanda!"],
      ["Lerato", "appreciation", "Thank you for bringing this community together 💚"],
      ["Sofia", "question", "Which open data sources can we trust?"],
      ["Kwame", "idea", "Mapathon every first Saturday"],
      ["Nadia", "appreciation", "Loved the demo."],
      ["Ibrahim", "idea", "Use drones to map Kigali's hills and then publish everything openly for schools to use in geography lessons"],
      ["Chen", "question", "Three things we could map next:\n1. bus stops\n2. water points\n3. school routes"],
      ["Maya", "appreciation", "The coffee was excellent ☕"],
      ["Zola", "resources", "OpenStreetMap has a great beginner guide [here](https://learnosm.org)."],
      ["Kofi", "requests", "Could someone help me export the map as a PDF?"],
      ["Nia", "resources", "The community toolkit is in the shared folder."]
    ],
    [
      ["Ayo", "idea", "A shared calendar for every mapping meetup."],
      ["Fatima", "question", "Who can host the next training in Kigali?"],
      ["Peter", "appreciation", "The live results screen made the room cheer."],
      ["Grace", "resources", "The school data set is available [here](https://data.humdata.org/dataset/?q=Rwanda+schools)."],
      ["Samuel", "requests", "Please add a French version of the poster."],
      ["Aisha", "idea", "A school map challenge with a small prize."],
      ["Diego", "question", "Can we map the new bus routes before Friday?"],
      ["Lina", "appreciation", "Great facilitation today, thank you!"],
      ["Musa", "idea", "Print QR codes for every table."],
      ["Chidi", "resources", "The open data portal is [here](https://data.gov.rw)."],
      ["Elena", "requests", "Could we get a quiet room for the afternoon session?"],
      ["Yara", "question", "What should we map after the roads?"]
    ]
  ];
  let noteSampleRound = 0;

  function seedNotes() {
    if (Store.mode !== "demo") return;
    const keys = categoryKeys(), fallback = keys[0];
    const set = SAMPLE_NOTE_SETS[noteSampleRound % SAMPLE_NOTE_SETS.length];
    noteSampleRound++;
    set.forEach(([name, category, text], i) => setTimeout(() => {
      Store.add({ name, category: CATS[category] ? category : fallback, text });
    }, i * 240));
    flashPollStatus(t("{n} sample notes added", { n: set.length }));
  }

  /* Kept for the S shortcut and the old call sites. */
  function seed() {
    seedNotes();
  }


  /* ── phone QR ──────────────────────────────────────────────── */
  function setupQR() {
    if (!qrCard || !qrCode) return;
    if (typeof qrcode !== "function") { qrCard.hidden = true; return; }

    let url = String(C.MOBILE_URL || "").trim();
    try {
      url = url ? new URL(url, location.href).href : new URL("index.html", location.href).href;
    } catch {
      url = url || "index.html";
    }

    try {
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      qrCode.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      qrCard.title = t("Open {url}", { url });
    } catch (err) {
      console.error("QR code failed", err);
      qrCard.hidden = true;
    }
  }

  /* ── boot ──────────────────────────────────────────────────── */
  setupQR();
  makeDust();
  buildFilters();
  buildPiles(true);
  updateStatus();

  (async () => {
    try {
      const saved = await Store.getCategories();
      applyCategories(saved);
    } catch (err) {
      console.error("Could not load categories", err);
    }
    if (activeFilter !== "all" && !CATS[activeFilter]) activeFilter = "all";
    cats = activeFilter === "all" ? new Set(categoryKeys()) : new Set([activeFilter]);
    buildFilters();
    buildPiles(true);

    let loaded = [];
    try {
      loaded = await Store.list();
    } catch (err) {
      console.error(err);
    }
    loaded.forEach(n => addNote(n, false, true));
    ensureKnownCategories(true);
    let pruned = false;
    [...hidden].forEach(id => {
      if (!notes.some(n => n.id === id)) { hidden.delete(id); pruned = true; }
    });
    if (pruned) saveHidden();
    layout();
    updateStatus();
    renderDashboard();
    if (notes.length && !notes.some(n => !hidden.has(n.id))) openDashboard();

    Store.subscribe({
      onAdd: n => addNote(n, true),
      onRemove: removeNote,
      onUpdate: updateNote,
      onReassign: reassignNotes,
      resync: syncNotes
    });

    Store.subscribeCategories(list => applyCategoryUpdate(list));

    await syncPolls();
    Store.subscribePolls({
      onPoll: poll => { upsertPollLocal(poll); renderPollChrome(); },
      onDelete: id => { removePollLocal(id); renderPollChrome(); },
      onVote: vote => { upsertVoteLocal(vote); renderPollChrome(); },
      onVoteDelete: vote => { removeVoteLocal(vote); renderPollChrome(); },
      onResetVotes: id => { resetVotesLocal(id); renderPollChrome(); },
      resync: syncPolls
    });
  })();

  if (document.fonts?.ready) {
    /* Fonts can arrive after the first layout. Re-fit once they settle —
       and again on every later batch, in case a face was not registered
       when `ready` first resolved. */
    document.fonts.ready.then(refitAll);
    document.fonts.addEventListener?.("loadingdone", refitAll);
  }
  window.addEventListener("load", () => setTimeout(refitAll, 60));
})();
