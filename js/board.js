(() => {
  const $ = id => document.getElementById(id);
  const t = (key, vars) => typeof window.t === "function" ? window.t(key, vars) : key;
  const board = $("board"), sheet = $("sheet"), focusBox = $("focus"), focusStage = $("focus-stage");
  const brand = $("brand"), brandTitle = $("brand-title"), brandSub = $("brand-sub"), brandLogo = $("brand-logo");
  const brandEdit = $("brand-edit"), eventDialog = $("event-dialog"), eventForm = $("event-form");
  const eventTitleInput = $("event-title"), eventSubInput = $("event-subtitle"), eventReset = $("event-reset"), eventCancel = $("event-cancel");
  const catEdit = $("cat-edit"), categoryDialog = $("category-dialog"), categoryForm = $("category-form");
  const categoryListEl = $("category-list"), categoryAdd = $("category-add"), categoryReset = $("category-reset"), categoryCancel = $("category-cancel");
  const status = $("status"), statusText = $("status-text");
  const focusMeta = $("focus-meta"), focusCat = $("focus-cat"), focusCount = $("focus-count");
  const pilesHost = $("piles"), pilesBack = $("piles-back"), qrCard = $("qr-card"), qrCode = $("qr-code");
  const extras = $("extras"), extrasPanel = $("extras-panel"), extrasToggle = $("extras-toggle");
  const extrasNotesOnly = $("extras-notes-only"), extrasShowAll = $("extras-show-all");
  const mediaWall = $("media-wall"), mediaGrid = $("media-grid"), mediaEmpty = $("media-empty");
  const mediaHideAll = $("media-hide-all"), mediaClose = $("media-close");
  const mediaStage = $("media-stage"), mediaStageBody = $("media-stage-body"), mediaStageCount = $("media-stage-count"), mediaStageAuto = $("media-stage-auto");
  const mediaLiveStrip = $("media-live-strip"), mediaLiveGrid = $("media-live-grid"), mediaLiveCount = $("media-live-count");
  const mediaDays = $("media-days");
  const moduleHome = $("module-home"), splitStage = $("split-stage"), splitPanes = $("split-panes"), splitLabel = $("split-label");
  const splitDialog = $("split-dialog"), splitOptions = $("split-options"), splitHint = $("split-hint");
  const streamWall = $("stream-wall"), streamGrid = $("stream-grid"), streamEmpty = $("stream-empty");
  const liveFloat = $("live-float"), liveFloatGrid = $("live-float-grid");
  const liveRequestDialog = $("live-request-dialog"), liveRequestList = $("live-request-list"), liveRequestEmpty = $("live-request-empty");
  const resetDialog = $("reset-dialog"), resetForm = $("reset-form"), resetPassphrase = $("reset-passphrase");
  const resetError = $("reset-error"), resetConfirm = $("reset-confirm");
  const statusLiveRequests = $("status-live-requests"), statusLiveCount = $("status-live-count");
  const liveRequestAlert = $("live-request-alert"), liveRequestAlertWho = $("live-request-alert-who"), liveRequestAlertSub = $("live-request-alert-sub");
  let liveAlertTitleBase = "", liveAlertDismissed = false, requestChimeCtx = null, requestChimeAt = 0;
  const C = window.STICKY_CONFIG || {};
  const notes = [], els = new Map();
  const media = [];
  const liveStreams = new Map();
  const liveRequests = new Map();
  const splitOrigins = new Map();
  let liveHost = null, moduleHomeOpen = true, activeModule = null, splitModules = [];
  /* Earlier builds could add sample rows; keep those out of a real wall. */
  const isSampleMedia = item => String(item?.author || "").trim().toLowerCase() === "sample";
  let cats = new Set(categoryKeys()), focusId = null, closeTimer = 0;
  let activeFilter = "all", pileView = false, pileSignature = "";
  let notesPresent = false, notesPresentSnapshot = null;
  let mediaPresent = false, mediaStageIndex = 0;
  /* manual presentation: full screen, but the slides only move on command */
  let presentationManual = false;
  let autoplayIdle = 0, autoplayStep = 0, autoplayLive = false, autoplayTouched = 0;
  let mediaAdvanceTimer = 0;

  /* ── presenter preferences (what the wall shows) ───────────── */
  const PREFS_KEY = "sticky_board_prefs";
  const QR_MARGIN = 8;
  const HIDDEN_KEY = "sticky_hidden_notes";
  const PREF_DEFAULTS = {
    columns: false,
    brand: true,
    qr: true,
    qrX: -1,
    qrY: -1,
    filters: true,
    gap: 12,
    bgColor: "",
    dashColor: "",
    bgImage: "",
    bgDim: 35,
    logo: "",
    logoSize: 100,
    autoplay: true,
    autoplayDelay: 10,
    autoplayDuration: 6,
    mediaAutoplay: true,
    mediaMute: true,
    mediaLoop: true,
    mediaMax: 12,
    mediaPhotoSeconds: 6,
    mediaVideoRate: 1
  };
  const PREF_NUMBERS = new Set(["gap", "bgDim", "logoSize", "autoplayDelay", "autoplayDuration", "mediaMax", "mediaPhotoSeconds", "mediaVideoRate", "qrX", "qrY"]);
  const PREF_STRINGS = new Set(["bgColor", "dashColor", "bgImage", "logo"]);
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
  prefs.mediaMax = Math.max(1, Math.min(24, prefs.mediaMax));
  prefs.mediaPhotoSeconds = Math.max(2, Math.min(60, prefs.mediaPhotoSeconds || 6));
  prefs.mediaVideoRate = Math.max(0.5, Math.min(2, prefs.mediaVideoRate || 1));
  prefs.bgColor = normaliseHex(prefs.bgColor) || "";
  prefs.dashColor = normaliseHex(prefs.dashColor) || "";
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
      else if (input.type === "color") input.value = normaliseHex(prefs[key]) || input.dataset.defaultColor || "#000000";
      else input.value = prefs[key];
      const out = extrasPanel.querySelector('output[data-for="' + key + '"]');
      if (out) out.textContent = String(prefs[key]);
    });
    extrasPanel.querySelectorAll("#extras-swatches button").forEach(btn => {
      btn.classList.toggle("act", (btn.dataset.wall || "") === (prefs.bgColor || ""));
    });
    extrasPanel.querySelectorAll("#extras-dash-swatches button").forEach(btn => {
      btn.classList.toggle("act", (btn.dataset.dash || "") === (prefs.dashColor || ""));
    });
  }

  function applyPrefs(relayout = true) {
    const hideClasses = {
      brand: "hide-brand",
      qr: "hide-qr",
      filters: "hide-filters"
    };
    Object.entries(hideClasses).forEach(([key, cls]) => {
      document.body.classList.toggle(cls, !prefs[key]);
    });
    if (!prefs.filters) $("filters")?.classList.remove("on");
    syncPrefInputs();
    applyQrPosition();
    if (relayout) layout();
  }
  applyPrefs(false);

  /* Dashboard paper: keep the ink readable on light or dark custom paper. */
  function dashInk(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return "56,38,23";
    const channel = value => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    return luminance < 0.42 ? "255,244,230" : "56,38,23";
  }

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

    const dash = normaliseHex(prefs.dashColor) || "";
    const ink = dash ? dashInk(dash) : "";
    [$("welcome-card"), $("dash-card")].forEach(card => {
      if (!card) return;
      if (dash) {
        card.style.setProperty("--dash-paper", dash);
        card.style.setProperty("--dash-ink-rgb", ink);
      } else {
        card.style.removeProperty("--dash-paper");
        card.style.removeProperty("--dash-ink-rgb");
      }
    });
    document.body.classList.toggle("dash-dark", ink === "255,244,230");
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

  /* The main header is the only header: its title stays the event name and its
     subtitle names whichever module is on screen — including the notes wall,
     which shows "Notes" rather than the event's date/venue line. */
  function brandSubtitle() {
    const cl = document.body.classList;
    if (cl.contains("split-mode")) return t("Split screen");
    if (cl.contains("show-dashboard")) return t("Dashboard");
    if (cl.contains("show-media")) return t("Event media");
    if (cl.contains("show-stream")) return t("Live stream");
    if (cl.contains("show-modules")) return t("Modules");
    return t("Notes");
  }

  function syncBrandSubtitle() {
    const subtitle = brandSubtitle();
    if (brandSub.textContent !== subtitle) brandSub.textContent = subtitle;
    brandSub.hidden = !subtitle;
  }

  function applyBrand() {
    const title = String(brandState.title || "").trim();
    const logo = String(prefs.logo || brandDefaults.logo || "").trim();
    brandTitle.textContent = title;
    brandTitle.hidden = !title;
    syncBrandSubtitle();
    brandLogo.hidden = !logo;
    if (logo) { brandLogo.src = logo; brandLogo.alt = brandDefaults.logoAlt; }
    brand.classList.toggle("brand-logo-only", !!logo && !title && !brandSub.textContent);
    brand.classList.toggle("hidden", !logo && !title && !brandSub.textContent);
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
  new MutationObserver(syncBrandSubtitle).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  /* ── share: read-only live view + iframe embed ─────────────── */
  function shareUrl(params) {
    const url = new URL("embed.html", location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    const lang = typeof I18N !== "undefined" && typeof I18N.lang === "function" ? I18N.lang() : "en";
    if (lang && lang !== "en") url.searchParams.set("lang", lang);
    return url.href;
  }

  let shareCurrentUrl = "";
  function openShareDialog() {
    const dialog = $("share-dialog");
    const urlInput = $("share-url"), embedInput = $("share-embed");
    if (!dialog || !urlInput || !embedInput) return;
    const title = String(brandState.title || "").trim();
    const url = shareUrl({ module: "notes", title });
    const heading = t("Live wall link");
    shareCurrentUrl = url;
    const headingNode = $("share-title"), leadNode = $("share-lead");
    if (headingNode) headingNode.textContent = heading;
    if (leadNode) leadNode.textContent = t("Anyone with this link or embed sees the results update live.");
    urlInput.value = url;
    embedInput.value = '<iframe src="' + url + '" width="100%" height="640" style="border:0;max-width:100%" loading="lazy" allowfullscreen title="' +
      (title || "Sticky Wall").replace(/"/g, "&quot;") + '"></iframe>';
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute("open", "");
    setTimeout(() => { urlInput.focus(); urlInput.select(); }, 60);
  }

  async function copyShareText(text, button) {
    if (!text) return false;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      try { ok = document.execCommand("copy"); } catch {}
      helper.remove();
    }
    if (button) {
      const label = button.textContent;
      button.textContent = ok ? t("Copied") : label;
      setTimeout(() => { button.textContent = label; }, 1600);
    }
    return ok;
  }

  $("extras-share-wall")?.addEventListener("click", () => openShareDialog("wall"));
  $("share-copy")?.addEventListener("click", () => copyShareText($("share-url")?.value, $("share-copy")));
  $("share-copy-embed")?.addEventListener("click", () => copyShareText($("share-embed")?.value, $("share-copy-embed")));
  $("share-open")?.addEventListener("click", () => {
    if (shareCurrentUrl) window.open(shareCurrentUrl, "_blank", "noopener");
  });

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

  /* ── dates: one day rail drives notes, media, and the dashboard ── */
  let dashDay = "all";
  const dayKeyOf = value => {
    const d = new Date(value || "");
    if (Number.isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const dayLocale = () => typeof window.I18N?.locale === "function" ? window.I18N.locale() : undefined;
  const dayLabelFor = value => {
    const d = new Date(value || "");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(dayLocale(), { weekday: "short", day: "numeric", month: "short" });
  };
  const timeLabelFor = value => {
    const d = new Date(value || "");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(dayLocale(), { hour: "2-digit", minute: "2-digit" });
  };
  const inDashDay = item => dashDay === "all" || dayKeyOf(item.created_at) === dashDay;
  const dayStamp = item => dashDay === "all"
    ? dayLabelFor(item.created_at) + " · " + timeLabelFor(item.created_at)
    : timeLabelFor(item.created_at);

  function dayBuckets(list) {
    const map = new Map();
    list.forEach(item => {
      const key = dayKeyOf(item.created_at);
      if (key && !map.has(key)) map.set(key, item.created_at);
    });
    return [...map.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  }

  function renderDayRail(host, list) {
    if (!host) return;
    const buckets = dayBuckets(list);
    if (dashDay !== "all" && !buckets.some(([key]) => key === dashDay)) dashDay = "all";
    if (!buckets.length) { host.hidden = true; host.replaceChildren(); return; }
    host.hidden = false;
    const pick = (key, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-chip" + (dashDay === key ? " is-active" : "");
      btn.textContent = label;
      btn.setAttribute("aria-pressed", dashDay === key ? "true" : "false");
      btn.addEventListener("click", () => {
        dashDay = key;
        if (dashboardOpen()) renderDashboard();
        renderMediaWall();
      });
      return btn;
    };
    host.replaceChildren(pick("all", t("All days")),
      ...buckets.map(([key, at]) => pick(key, dayLabelFor(at))));
  }

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
    status.classList.toggle("is-demo", Store.mode === "demo");
    document.body.classList.toggle("has-notes", total > 0);
    if (dashboardOpen()) renderDashboard();
    renderModuleCounts();
  }

  /* Transient status line: shows a message, then returns to the live count. */
  let statusFlashTimer = 0;
  function flashStatus(message) {
    if (!statusText) return;
    statusText.textContent = t(message);
    clearTimeout(statusFlashTimer);
    statusFlashTimer = setTimeout(updateStatus, 3200);
  }

  /* ── dashboard: the entry card and received-notes control ──── */
  const welcomeCard = $("welcome-card"), dashCard = $("dash-card");
  const dashTitle = $("dash-title"), dashCats = $("dash-cats");
  const dashCount = $("dash-count"), dashNotes = $("dash-notes"), dashRestore = $("dash-restore");
  const dashDays = $("dash-days");

  function renderDashboard() {
    if (!welcomeCard || !dashCard || !dashNotes) return;
    const total = notes.length;
    welcomeCard.hidden = total > 0;
    dashCard.hidden = total === 0;
    if (!total) { dashNotes.replaceChildren(); renderDayRail(dashDays, []); return; }

    renderDayRail(dashDays, notes);
    const dayNotes = notes.filter(inDashDay);

    const hiddenCount = notes.filter(n => hidden.has(n.id)).length;
    const alive = notes.filter(n => !hidden.has(n.id) && inDashDay(n)).length;
    dashTitle.textContent = total === 0
      ? t("You received 0 notes.")
      : total === 1 ? t("You received 1 note.") : t("You received {n} notes.", { n: total });

    dashCats.replaceChildren();
    categoryList().forEach(cat => {
      const all = dayNotes.filter(n => n.category === cat.key);
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

    dashNotes.replaceChildren(...dayNotes.map(n => {
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
      const when = document.createElement("time");
      when.className = "dash-note-time";
      when.dateTime = n.created_at || "";
      when.textContent = dayStamp(n);
      const text = document.createElement("p");
      if (typeof renderNoteText === "function") renderNoteText(text, n.text);
      else text.textContent = n.text;
      copy.append(head, when, text);

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
  }

  function setDashboard(open) {
    /* Opening a module also closes whichever module was open before it. */
    if (open) closeModulesExcept("dashboard");
    document.body.classList.toggle("show-dashboard", !!open);
    if (!open) return;
    closeFocus();
    setExtrasOpen(false);
    renderDashboard();
    renderModuleCounts();
    syncHiddenChrome();
    board.scrollTo({ top: 0, behavior: "auto" });
  }
  const openDashboard = () => setDashboard(true);
  const closeDashboard = () => setDashboard(false);
  const toggleDashboard = () => setDashboard(!dashboardOpen());

  /* ── presentation autoplay & one-by-one slides ─────────────── */
  const autoplaySeconds = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  };

  function clearAutoplay() {
    clearTimeout(autoplayIdle);
    clearInterval(autoplayStep);
    clearTimeout(mediaAdvanceTimer);
    autoplayIdle = 0;
    autoplayStep = 0;
    mediaAdvanceTimer = 0;
    autoplayLive = false;
  }

  /* Wait `autoplayDelay` seconds of quiet, then advance every `autoplayDuration`. */
  function armAutoplay() {
    clearAutoplay();
    if (presentationManual || !prefs.autoplay || (!notesPresent && !mediaPresent)) return;
    autoplayIdle = setTimeout(startAutoplay, autoplaySeconds(prefs.autoplayDelay, 10) * 1000);
  }

  function startAutoplay() {
    autoplayIdle = 0;
    if (presentationManual || !prefs.autoplay || (!notesPresent && !mediaPresent)) return;
    const every = Math.max(2, autoplaySeconds(prefs.autoplayDuration, 6)) * 1000;
    autoplayLive = true;
    if (mediaPresent) {
      scheduleMediaAdvance();
      return;
    }
    if (notesPresent) {
      step(1);
      autoplayStep = setInterval(() => step(1), every);
    }
  }

  /* Any real interaction pauses the slideshow and re-arms the idle countdown. */
  function touchAutoplay() {
    if (!notesPresent && !mediaPresent) return;
    if (!autoplayIdle && !autoplayLive) return;
    armAutoplay();
  }

  ["pointerdown", "wheel", "touchstart"].forEach(evt =>
    window.addEventListener(evt, () => touchAutoplay(), { passive: true, capture: true }));
  window.addEventListener("pointermove", () => {
    if (!notesPresent && !mediaPresent) return;
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

  /* Fullscreen is opt-in. The Full screen buttons (or Shift+F) ask for the
     browser's real fullscreen, which removes only the tabs, address bar and
     taskbar; the board keeps all of its own controls. */
  function toggleBoardFullscreen() {
    if (document.fullscreenElement) leaveFullscreen();
    else goFullscreen();
  }

  function syncFullscreenButtons() {
    const active = !!document.fullscreenElement;
    document.body.classList.toggle("is-fullscreen", active);
    document.querySelectorAll("#fullscreen-toggle, #module-fullscreen").forEach(button => {
      button.setAttribute("aria-pressed", active ? "true" : "false");
      const label = button.querySelector("[data-i18n]");
      if (label) {
        const key = active ? "Exit full screen" : "Full screen";
        label.dataset.i18n = key;
        label.textContent = t(key);
      }
      const titleKey = active ? "Exit full screen (Shift+F)" : "Full screen (Shift+F)";
      button.dataset.i18nTitle = titleKey;
      button.title = t(titleKey);
    });
  }

  /* Esc in fullscreen is swallowed by the browser, so mirror the exit here. */
  document.addEventListener("fullscreenchange", () => {
    syncFullscreenButtons();
    if (document.fullscreenElement) return;
    if (notesPresent) setNotesPresentation(false);
    if (mediaPresent) setMediaPresentation(false);
  });

  /* ── event media wall (phones upload, board shows) ─────────── */
  const mediaOpenNow = () => document.body.classList.contains("show-media");

  function mediaSorted() {
    return media.slice().sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
    );
  }

  function mediaVisible() {
    return mediaSorted().slice(-prefs.mediaMax).reverse();
  }

  function mediaCard(item) {
    const card = document.createElement("article");
    card.className = "media-card media-card--" + (item.kind === "video" ? "video" : "photo");
    card.dataset.media = item.id;

    const frame = document.createElement("div");
    frame.className = "media-card__frame";

    const previews = !!prefs.mediaAutoplay && mediaOpenNow();
    if (item.kind === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.muted = !!prefs.mediaMute;
      video.loop = !!prefs.mediaLoop;
      video.playsInline = true;
      video.preload = previews ? "auto" : "metadata";
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      if (previews) {
        video.autoplay = true;
        const started = video.play();
        if (started?.catch) started.catch(() => {});
      }
      const play = document.createElement("span");
      play.className = "media-card__play";
      play.textContent = "▶";
      video.addEventListener("play", () => play.classList.add("is-hidden"));
      video.addEventListener("pause", () => play.classList.remove("is-hidden"));
      if (!previews) play.classList.remove("is-hidden");
      video.addEventListener("click", () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      });
      frame.append(video, play);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.caption || t("Shared photo");
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => card.classList.add("is-broken"));
      frame.append(img);
    }

    const kind = document.createElement("span");
    kind.className = "media-card__kind";
    kind.textContent = item.kind === "video" ? t("Video") : t("Photo");

    const author = document.createElement("span");
    author.className = "media-card__author";
    author.textContent = item.author || t("Guest");
    author.title = item.author || t("Guest");

    const date = document.createElement("time");
    date.className = "media-card__date";
    date.dateTime = item.created_at || "";
    date.textContent = dayStamp(item);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "media-card__remove";
    remove.textContent = t("Remove");
    remove.title = t("Remove from wall");
    remove.setAttribute("aria-label", t("Remove from wall"));
    remove.addEventListener("click", () => {
      if (remove.dataset.armed !== "1") {
        remove.dataset.armed = "1";
        remove.textContent = t("Sure?");
        clearTimeout(remove._timer);
        remove._timer = setTimeout(() => {
          if (remove.dataset.armed === "1") {
            delete remove.dataset.armed;
            remove.textContent = t("Remove");
          }
        }, 3200);
        return;
      }
      delete remove.dataset.armed;
      clearTimeout(remove._timer);
      removeMediaItem(item, remove);
    });

    frame.append(kind, author, date, remove);
    card.append(frame);
    return card;
  }

  function renderMediaWall() {
    if (!mediaGrid) return;
    renderModuleCounts();
    if (mediaPresent) { renderMediaStage(); return; }
    renderDayRail(mediaDays, mediaSorted());
    const list = mediaVisible().filter(inDashDay);
    mediaGrid.replaceChildren(...list.map(mediaCard));
    updateMediaSummary(list.length);
    if (!list.length) {
      /* no cards to style — the empty note takes over */
      mediaGrid.style.removeProperty("--media-cols");
      mediaGrid.style.removeProperty("--media-gap");
    } else {
      /* album squeeze: more uploads → more, smaller square tiles */
      const n = list.length;
      const cols = Math.min(8, n, Math.max(1, Math.ceil(Math.sqrt(n * 1.6))));
      mediaGrid.style.setProperty("--media-cols", String(cols));
      mediaGrid.style.setProperty("--media-gap", n > 16 ? "5px" : n > 8 ? "7px" : "clamp(8px,1.2vw,16px)");
    }
  }

  function updateMediaSummary(storedCount) {
    const stored = Number.isFinite(storedCount) ? storedCount : mediaVisible().length;
    if (mediaEmpty) mediaEmpty.hidden = stored > 0 || liveStreams.size > 0;
  }

  /* ── live streams from phones (WebRTC) ─────────────────────── */
  const liveCount = () => liveStreams.size;

  function liveHostFor(placement) {
    if (placement === "media") return mediaLiveGrid;
    if (placement === "float") return liveFloatGrid;
    return streamGrid;
  }

  function renderLiveStrip() {
    if (!mediaLiveStrip) return;
    mediaLiveStrip.hidden = liveStreams.size === 0;
    if (mediaLiveCount) {
      mediaLiveCount.textContent = liveStreams.size
        ? t("{n} live", { n: liveStreams.size })
        : "";
    }
    if (streamEmpty) streamEmpty.hidden = liveStreams.size > 0;
    if (liveFloat) {
      const floating = [...liveStreams.values()].some(entry => entry.placement === "float");
      liveFloat.hidden = !floating;
    }
    renderLiveRequestChrome();
    updateMediaSummary();
    renderModuleCounts();
  }

  function paintLiveSound(entry) {
    if (!entry?.button) return;
    entry.button.textContent = entry.muted ? "🔇" : "🔊";
    entry.button.title = entry.muted ? t("Unmute") : t("Mute");
    entry.button.setAttribute("aria-label", entry.button.title);
    entry.button.setAttribute("aria-pressed", entry.muted ? "false" : "true");
  }

  function toggleLiveSound(streamId) {
    const entry = liveStreams.get(streamId);
    if (!entry) return;
    entry.muted = !entry.muted;
    entry.video.muted = entry.muted;
    paintLiveSound(entry);
  }

  function addLiveStream({ streamId, author, stream, placement, requestId }) {
    if (!stream) return;
    const where = ["stream", "media", "float", "split"].includes(placement) ? placement : "stream";
    const host = liveHostFor(where);
    if (!host) return;
    /* reconnects reuse the same id: replace the stale tile */
    removeLiveStream(streamId);

    const card = document.createElement("article");
    card.className = "media-live-card media-live-card--" + where;
    card.dataset.live = streamId;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
      const playing = video.play();
      if (playing?.catch) playing.catch(() => {});
    });
    video.addEventListener("click", () => toggleLiveSound(streamId));

    const badge = document.createElement("span");
    badge.className = "media-live-card__badge";
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, document.createTextNode(t("Live")));

    const name = document.createElement("span");
    name.className = "media-live-card__author";
    name.textContent = author || t("Guest");
    name.title = name.textContent;

    const sound = document.createElement("button");
    sound.type = "button";
    sound.className = "media-live-card__sound";
    sound.addEventListener("click", event => {
      event.stopPropagation();
      toggleLiveSound(streamId);
    });

    card.append(video, badge, name, sound);
    host.append(card);

    const entry = { el: card, video, button: sound, muted: true, author, placement: where, requestId };
    liveStreams.set(streamId, entry);
    paintLiveSound(entry);
    if (requestId) {
      liveRequests.delete(requestId);
      renderLiveRequests();
    }

    /* The presenter chose this placement when approving the request. */
    if (where === "split") {
      if (!splitActive() || !splitModules.includes("stream")) enterSplit(["stream", "media"]);
    } else if (where === "stream") {
      if (!splitActive()) openStreamWall();
    } else if (where === "media") {
      if (mediaPresent) setMediaPresentation(false);
      if (!splitActive() && !mediaOpenNow()) openMediaWall();
    } else if (where === "float") {
      if (liveFloat) liveFloat.hidden = false;
    }
    renderLiveStrip();
    const playing = video.play();
    if (playing?.catch) playing.catch(() => {});
  }

  function removeLiveStream(streamId) {
    const entry = liveStreams.get(streamId);
    if (!entry) return;
    liveStreams.delete(streamId);
    try {
      entry.video.pause();
      entry.video.srcObject = null;
    } catch {}
    entry.el.remove();
    renderLiveStrip();
  }

  function startLiveHost() {
    if (!window.StickyLive) return null;
    try {
      return StickyLive.host({
        onStream: item => addLiveStream(item),
        onEnd: streamId => removeLiveStream(streamId),
        onRequest: item => addLiveRequest(item),
        onReaction: item => playReaction(item),
        onCancel: requestId => {
          liveRequests.delete(requestId);
          renderLiveRequests();
        }
      });
    } catch (err) {
      console.warn("Live streaming is not available", err);
      return null;
    }
  }

  /* ── go-live requests: only the presenter allows a camera ──── */
  const livePlacementLabel = value => value === "media" ? t("Media wall")
    : value === "float" ? t("Floating window")
    : value === "split" ? t("Split with media")
    : t("Stream page");

  function playRequestChime() {
    const now = Date.now();
    if (now - requestChimeAt < 1600) return;
    requestChimeAt = now;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      requestChimeCtx = requestChimeCtx || new Ctx();
      if (requestChimeCtx.state === "suspended") requestChimeCtx.resume().catch(() => {});
      const start = requestChimeCtx.currentTime + .02;
      [0, .18].forEach((offset, index) => {
        const osc = requestChimeCtx.createOscillator();
        const gain = requestChimeCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(index ? 988 : 784, start + offset);
        gain.gain.setValueAtTime(0, start + offset);
        gain.gain.linearRampToValueAtTime(.16, start + offset + .02);
        gain.gain.exponentialRampToValueAtTime(.001, start + offset + .26);
        osc.connect(gain).connect(requestChimeCtx.destination);
        osc.start(start + offset);
        osc.stop(start + offset + .3);
      });
    } catch (err) { /* audio is a bonus; the banner still shows */ }
  }

  function syncLiveAlertTitle(count) {
    if (count > 0) {
      if (!liveAlertTitleBase) liveAlertTitleBase = document.title;
      document.title = "(" + count + ") " + t("Go-live requests") + " · " + liveAlertTitleBase;
    } else if (liveAlertTitleBase) {
      document.title = liveAlertTitleBase;
      liveAlertTitleBase = "";
    }
  }

  function renderLiveRequestAlert() {
    const n = liveRequests.size;
    if (!n) liveAlertDismissed = false;
    if (liveRequestAlert) {
      liveRequestAlert.hidden = n === 0 || liveAlertDismissed;
      if (n && !liveAlertDismissed) {
        const latest = [...liveRequests.values()].reduce((best, item) =>
          (item.at || 0) > (best.at || 0) ? item : best);
        if (liveRequestAlertWho) liveRequestAlertWho.textContent = latest.author || t("Guest");
        if (liveRequestAlertSub) {
          liveRequestAlertSub.textContent = n > 1
            ? t("{n} go-live requests", { n })
            : t("Asking to go live");
        }
      }
    }
    syncLiveAlertTitle(n && !liveAlertDismissed ? n : 0);
  }

  function renderLiveRequestChrome() {
    const n = liveRequests.size;
    if (statusLiveRequests) {
      statusLiveRequests.hidden = n === 0;
      if (statusLiveCount) statusLiveCount.textContent = String(n);
      statusLiveRequests.title = t("{n} go-live requests", { n });
    }
    const streamButton = $("stream-requests");
    const streamCount = $("stream-request-count");
    const emptyButton = $("stream-empty-requests");
    const extrasButton = $("extras-stream-requests");
    const extrasCount = $("extras-stream-request-count");
    if (streamButton) streamButton.hidden = n === 0;
    if (streamCount) streamCount.textContent = String(n);
    if (emptyButton) emptyButton.hidden = n === 0;
    if (extrasButton) extrasButton.classList.toggle("is-empty", n === 0);
    if (extrasCount) extrasCount.textContent = String(n);
    renderLiveRequestAlert();
  }

  function renderLiveRequests() {
    renderLiveRequestChrome();
    if (!liveRequestList) return;
    if (liveRequestEmpty) liveRequestEmpty.hidden = liveRequests.size > 0;
    const rows = [...liveRequests.values()].map(req => {
      const row = document.createElement("div");
      row.className = "live-request-row";
      row.dataset.request = req.requestId;

      const copy = document.createElement("div");
      copy.className = "live-request-row__copy";
      const who = document.createElement("b");
      who.textContent = req.author || t("Guest");
      const when = document.createElement("small");
      when.textContent = t("Asking to go live");
      copy.append(who, when);

      const pick = document.createElement("select");
      pick.className = "live-request-row__place";
      pick.setAttribute("aria-label", t("Place the live window"));
      ["stream", "split", "float", "media"].forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = livePlacementLabel(value);
        pick.append(option);
      });

      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "live-request-btn live-request-btn--primary live-request-row__allow";
      approve.textContent = t("Allow");
      approve.addEventListener("click", () => approveLiveRequest(req.requestId, pick.value));

      const deny = document.createElement("button");
      deny.type = "button";
      deny.className = "live-request-btn live-request-row__deny";
      deny.textContent = t("Deny");
      deny.addEventListener("click", () => denyLiveRequest(req.requestId));

      row.append(copy, pick, approve, deny);
      return row;
    });
    liveRequestList.replaceChildren(...rows);
  }

  function addLiveRequest({ requestId, author, at } = {}) {
    if (!requestId) return;
    if (liveRequests.has(requestId)) {
      const existing = liveRequests.get(requestId);
      if (author) existing.author = author;
      if (at) existing.at = at;
    } else {
      liveRequests.set(requestId, {
        requestId,
        author: author || t("Guest"),
        at: at || Date.now()
      });
      liveAlertDismissed = false;
      playRequestChime();
      flashStatus(t("{n} go-live requests", { n: liveRequests.size }));
    }
    renderLiveRequests();
  }

  function openLiveRequestDialog() {
    if (!liveRequestDialog) return;
    renderLiveRequests();
    if (liveRequestDialog.open) return;
    if (typeof liveRequestDialog.showModal === "function") liveRequestDialog.showModal();
    else liveRequestDialog.setAttribute("open", "");
  }

  function closeLiveRequestDialog() {
    if (!liveRequestDialog?.open) return;
    if (typeof liveRequestDialog.close === "function") liveRequestDialog.close();
    else liveRequestDialog.removeAttribute("open");
  }

  function approveLiveRequest(requestId, placement) {
    if (!requestId) return;
    const where = ["stream", "media", "float", "split"].includes(placement) ? placement : "stream";
    try { liveHost?.approve?.(requestId, where); } catch (err) { console.warn("Could not approve live request", err); }
    liveRequests.delete(requestId);
    renderLiveRequests();
    flashStatus(t("Live approved · {where}", { where: livePlacementLabel(where) }));
    if (where === "split") enterSplit(["stream", "media"]);
    else if (where === "media") { if (!splitActive()) openMediaWall(); }
    else if (where === "float") { if (liveFloat) liveFloat.hidden = false; }
    else if (!splitActive()) openStreamWall();
    closeLiveRequestDialog();
  }

  function denyLiveRequest(requestId) {
    if (!requestId) return;
    try { liveHost?.deny?.(requestId); } catch (err) { console.warn("Could not deny live request", err); }
    liveRequests.delete(requestId);
    renderLiveRequests();
    flashStatus(t("Live request denied"));
  }

  /* Full-screen album: one photo or video at a time, advanced by the same
     autoplay timing the notes use (start after / seconds per slide). */
  function mediaStageList() {
    /* arrival order, like the notes slideshow (the grid stays newest-first) */
    return mediaSorted().filter(inDashDay).slice(-prefs.mediaMax);
  }

  function renderMediaStage() {
    if (!mediaStageBody) return;
    const list = mediaStageList();
    if (!list.length) { setMediaPresentation(false); return; }
    if (mediaStageIndex >= list.length) mediaStageIndex = 0;
    if (mediaStageIndex < 0) mediaStageIndex = list.length - 1;
    const item = list[mediaStageIndex];

    mediaStageBody.replaceChildren();
    const frame = document.createElement("figure");
    frame.className = "media-stage__item media-stage__item--" + (item.kind === "video" ? "video" : "photo");

    if (item.kind === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.muted = !!prefs.mediaMute;
      video.loop = false;
      video.playsInline = true;
      video.preload = "auto";
      video.playbackRate = Math.max(0.5, Math.min(2, Number(prefs.mediaVideoRate) || 1));
      video.setAttribute("playsinline", "");
      const started = video.play();
      if (started?.catch) started.catch(() => {});
      video.addEventListener("click", () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      });
      video.addEventListener("playing", () => {
        clearTimeout(mediaAdvanceTimer);
        mediaAdvanceTimer = 0;
      });
      video.addEventListener("ended", () => {
        if (mediaPresent && !presentationManual && prefs.autoplay) stepMediaStage(1);
      });
      frame.append(video);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.caption || t("Shared photo");
      img.decoding = "async";
      frame.append(img);
    }

    const meta = document.createElement("figcaption");
    meta.className = "media-stage__meta";
    const author = document.createElement("b");
    author.textContent = item.author || t("Guest");
    const kind = document.createElement("span");
    kind.textContent = item.kind === "video" ? t("Video") : t("Photo");
    const when = document.createElement("time");
    when.textContent = dayStamp(item);
    meta.append(author, kind, when);
    mediaStageBody.append(frame, meta);

    if (mediaStageCount) {
      mediaStageCount.textContent = t("{i} of {n}", { i: mediaStageIndex + 1, n: list.length });
    }
    if (mediaStageAuto) mediaStageAuto.hidden = presentationManual || !prefs.autoplay;
    scheduleMediaAdvance();
  }

  function scheduleMediaAdvance() {
    clearTimeout(mediaAdvanceTimer);
    mediaAdvanceTimer = 0;
    if (!mediaPresent || presentationManual || !prefs.autoplay) return;
    const video = mediaStageBody?.querySelector("video");
    /* A playing video advances when it ends; a photo uses its own timer. */
    if (video && !video.paused) return;
    const secs = video
      ? Math.max(2, autoplaySeconds(prefs.autoplayDuration, 6))
      : Math.max(2, Number(prefs.mediaPhotoSeconds) || 6);
    mediaAdvanceTimer = setTimeout(() => stepMediaStage(1), secs * 1000);
  }

  function stepMediaStage(d) {
    const list = mediaStageList();
    if (!list.length) return;
    mediaStageIndex = (mediaStageIndex + d + list.length) % list.length;
    if (mediaPresent) renderMediaStage();
  }

  function setMediaPresentation(on, manual) {
    /* Full-screen means the whole screen: step out of a split first. */
    if (on && splitActive() && splitModules.includes("media")) {
      exitSplit(false);
      openMediaWall();
    }
    const shown = mediaOpenNow();
    on = !!on && shown;
    if (on && !mediaStageList().length) return;
    if (!on && !mediaPresent) { presentationManual = false; return; }
    const entering = on && !mediaPresent;
    mediaPresent = on;
    presentationManual = on ? !!manual : false;
    document.body.classList.toggle("present-media", mediaPresent);
    $("media-present")?.setAttribute("aria-pressed", mediaPresent && !presentationManual ? "true" : "false");
    $("media-present-manual")?.setAttribute("aria-pressed", mediaPresent && presentationManual ? "true" : "false");
    if (mediaStage) mediaStage.hidden = !mediaPresent;
    if (mediaPresent) {
      if (entering) mediaStageIndex = 0;
      mediaGrid?.querySelectorAll("video").forEach(video => video.pause());
      document.activeElement?.blur?.();
      goFullscreen();
      renderMediaStage();
      armAutoplay();
    } else {
      clearAutoplay();
      mediaStageBody?.replaceChildren();
      renderMediaWall();
      applyMediaPrefs();
      if (document.fullscreenElement) leaveFullscreen();
    }
  }

  function removeMediaLocal(id) {
    let changed = false;
    for (let i = media.length - 1; i >= 0; i--) {
      if (media[i].id === id) { media.splice(i, 1); changed = true; }
    }
    if (changed) renderMediaWall();
  }

  async function removeMediaItem(item, button) {
    if (button) {
      button.disabled = true;
      button.textContent = t("Removing…");
    }
    try {
      await Store.removeMedia(item);
      removeMediaLocal(item.id);
      if (button) {
        button.disabled = false;
        button.textContent = t("Remove");
      }
    } catch (err) {
      console.error("Could not remove media", err);
      if (button) {
        button.disabled = false;
        button.textContent = t("Could not remove");
        setTimeout(() => { button.textContent = t("Remove"); }, 2200);
      }
    }
  }

  async function hideAllMedia() {
    const ids = new Set(mediaVisible().map(item => item.id));
    if (!ids.size) return;
    try {
      await Promise.all([...ids].map(id => Store.hideMedia(id)));
      for (let i = media.length - 1; i >= 0; i--) {
        if (ids.has(media[i].id)) media.splice(i, 1);
      }
      renderMediaWall();
    } catch (err) {
      console.error("Could not hide media", err);
    }
  }

  function applyMediaPrefs() {
    if (!mediaGrid) return;
    const previews = !!prefs.mediaAutoplay && mediaOpenNow();
    const rate = Math.max(0.5, Math.min(2, Number(prefs.mediaVideoRate) || 1));
    mediaGrid.querySelectorAll("video").forEach(video => {
      video.muted = !!prefs.mediaMute;
      video.loop = !!prefs.mediaLoop;
      video.playbackRate = rate;
      if (previews) {
        const started = video.play();
        if (started?.catch) started.catch(() => {});
      } else {
        video.pause();
      }
    });
    mediaStageBody?.querySelectorAll("video").forEach(video => { video.playbackRate = rate; });
  }

  function openMediaWall() {
    if (!mediaWall) return;
    closeModulesExcept("media");
    if (focusId) closeFocus();
    activeModule = "media";
    document.body.dataset.module = "media";
    setExtrasOpen(false);
    mediaPresent = false;
    presentationManual = false;
    document.body.classList.remove("present-media");
    if (mediaStage) mediaStage.hidden = true;
    mediaWall.setAttribute("aria-hidden", "false");
    document.body.classList.add("show-media");
    renderMediaWall();
    mediaClose?.focus({ preventScroll: true });
  }

  function closeMediaWall() {
    if (!mediaWall) return;
    if (mediaPresent) setMediaPresentation(false);
    mediaWall.setAttribute("aria-hidden", "true");
    document.body.classList.remove("show-media");
    mediaGrid?.querySelectorAll("video").forEach(video => video.pause());
  }

  function toggleMediaWall() {
    if (mediaOpenNow()) closeMediaWall();
    else openMediaWall();
  }

  async function syncMedia() {
    try {
      const list = await Store.listMedia();
      const shown = (list || []).filter(item => !isSampleMedia(item));
      media.splice(0, media.length, ...shown);
    } catch (err) {
      console.warn("Could not load media. In live mode run supabase/migration-media.sql.", err);
    }
    renderMediaWall();
  }

  /* ── presenter modules: home, activation, split screen ─────── */
  const MODULE_META = {
    notes: { label: "Notes", icon: "📝", root: () => board },
    media: { label: "Media", icon: "🖼️", root: () => mediaWall },
    stream: { label: "Stream", icon: "📹", root: () => streamWall }
  };
  const MODULE_KEYS = ["notes", "media", "stream"];
  const moduleLabel = key => t(MODULE_META[key]?.label || "Notes");
  const streamWallOpenNow = () => document.body.classList.contains("show-stream");
  const splitActive = () => splitModules.length > 1 && !!splitStage && !splitStage.hidden;

  /* Counts of the modules that are not on screen: while one module fills the
     wall, the others still report how much content is waiting inside them. */
  const countHosts = [...document.querySelectorAll("[data-module-counts]")];

  function moduleCount(key) {
    if (key === "notes") return notes.length - notes.filter(n => hidden.has(n.id)).length;
    if (key === "media") return mediaVisible().length;
    if (key === "stream") return liveStreams.size;
    return 0;
  }

  function renderModuleCounts() {
    if (!countHosts.length) return;
    countHosts.forEach(host => {
      const skip = new Set((host.dataset.countsSkip || "").split(/\s+/).filter(Boolean));
      if (!skip.size) skip.add(host.closest(".stream-wall") ? "stream" : "media");
      const keys = MODULE_KEYS.filter(key => !skip.has(key));
      if (!keys.length) { host.replaceChildren(); return; }
      host.replaceChildren(...keys.map(key => {
        const n = moduleCount(key);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "module-count" + (n ? "" : " is-zero");
        chip.dataset.module = key;
        chip.title = t("Open {module}", { module: moduleLabel(key) });
        chip.setAttribute("aria-label", t("Open {module}", { module: moduleLabel(key) }));
        const label = document.createElement("span");
        label.className = "module-count__label";
        label.textContent = moduleLabel(key);
        const num = document.createElement("b");
        num.className = "module-count__n";
        num.textContent = String(n);
        chip.append(label, num);
        return chip;
      }));
    });
  }

  /* Only one module is visible at a time: every open* entry point closes the
     others first, so switching modules never leaves the old one underneath. */
  function closeModulesExcept(...keep) {
    const kept = new Set(keep);
    if (splitActive() && !kept.has("split")) exitSplit(false);
    if (notesPresent && !kept.has("notes")) setNotesPresentation(false);
    if (mediaOpenNow() && !kept.has("media")) closeMediaWall();
    if (streamWallOpenNow() && !kept.has("stream")) closeStreamWall();
    if (dashboardOpen() && !kept.has("dashboard")) closeDashboard();
    if (moduleHomeOpen && !kept.has("home")) closeModuleHome();
  }

  function closeAllModules() {
    closeModulesExcept();
    closeFocus();
  }

  function openModuleHome() {
    if (splitActive()) exitSplit(false);
    closeAllModules();
    moduleHomeOpen = true;
    activeModule = null;
    delete document.body.dataset.module;
    if (moduleHome) {
      moduleHome.hidden = false;
      moduleHome.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("show-modules");
    setExtrasOpen(false);
  }

  function closeModuleHome() {
    moduleHomeOpen = false;
    if (moduleHome) {
      moduleHome.hidden = true;
      moduleHome.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("show-modules");
  }

  function activateModule(name) {
    if (!MODULE_META[name]) return;
    if (splitActive()) exitSplit(false);
    closeModuleHome();
    closeAllModules();
    activeModule = name;
    if (name === "media") openMediaWall();
    else if (name === "stream") openStreamWall();
    else { layout(); updateStatus(); }
    document.body.dataset.module = name;
    setExtrasOpen(false);
    renderModuleCounts();
  }

  function openStreamWall() {
    if (!streamWall || streamWallOpenNow()) return;
    closeModulesExcept("stream");
    closeFocus();
    activeModule = "stream";
    document.body.dataset.module = "stream";
    streamWall.setAttribute("aria-hidden", "false");
    document.body.classList.add("show-stream");
    renderLiveStrip();
    $("stream-close")?.focus?.({ preventScroll: true });
  }

  function closeStreamWall() {
    if (!streamWall) return;
    setStreamPresentation(false);
    streamWall.setAttribute("aria-hidden", "true");
    document.body.classList.remove("show-stream");
  }

  function setStreamPresentation(on) {
    /* Full-screen stream leaves a split so it can cover the whole screen. */
    if (on && splitActive() && splitModules.includes("stream")) {
      exitSplit(false);
      openStreamWall();
    }
    document.body.classList.toggle("present-stream", !!on);
    $("stream-present")?.setAttribute("aria-pressed", on ? "true" : "false");
    if (on) { goFullscreen(); updateStreamGrid(); }
    else if (document.fullscreenElement) leaveFullscreen();
  }

  function updateStreamGrid() {
    if (!streamGrid) return;
    const n = streamGrid.children.length;
    streamGrid.dataset.count = String(n);
    if (n) streamGrid.style.setProperty("--stream-cols", String(Math.min(3, n)));
    else streamGrid.style.removeProperty("--stream-cols");
  }

  function enterSplit(list) {
    if (!splitStage || !splitPanes) return;
    const picked = [...new Set(list || [])].filter(key => MODULE_META[key]);
    if (picked.length < 2) return;
    if (splitActive()) exitSplit(false);
    closeModuleHome();
    closeAllModules();
    splitOrigins.clear();
    splitPanes.replaceChildren();
    splitModules = picked;
    splitModules.forEach(key => {
      const root = MODULE_META[key].root();
      if (!root) return;
      splitOrigins.set(key, {
        parent: root.parentNode,
        next: root.nextSibling,
        ariaHidden: root.getAttribute("aria-hidden")
      });
      const pane = document.createElement("section");
      pane.className = "split-pane split-pane--" + key;
      pane.dataset.module = key;
      pane.setAttribute("aria-label", moduleLabel(key));
      pane.append(root);
      splitPanes.append(pane);
      root.setAttribute("aria-hidden", "false");
    });
    splitStage.hidden = false;
    splitPanes.dataset.count = String(splitModules.length);
    splitLabel.textContent = splitModules.map(moduleLabel).join(" · ");
    document.body.classList.add("split-mode");
    activeModule = null;
    updateStreamGrid();
    renderMediaWall();
    renderLiveStrip();
    layout();
    setExtrasOpen(false);
    goFullscreen();
  }

  function exitSplit(showHome = true) {
    if (!splitActive()) return;
    const wasFullscreen = !!document.fullscreenElement;
    splitModules.forEach(key => {
      const root = MODULE_META[key]?.root();
      const origin = splitOrigins.get(key);
      if (!root) return;
      if (origin?.parent) {
        const before = origin.next && origin.next.parentNode === origin.parent ? origin.next : null;
        origin.parent.insertBefore(root, before);
      } else {
        document.body.append(root);
      }
      /* restore the accessibility state each module had before the split */
      if (origin?.ariaHidden == null) root.removeAttribute("aria-hidden");
      else root.setAttribute("aria-hidden", origin.ariaHidden);
    });
    splitOrigins.clear();
    splitPanes.replaceChildren();
    splitStage.hidden = true;
    document.body.classList.remove("split-mode");
    splitModules = [];
    activeModule = null;
    delete document.body.dataset.module;
    if (wasFullscreen) leaveFullscreen();
    if (showHome) openModuleHome();
    else { closeAllModules(); layout(); }
  }

  function openSplitDialog() {
    if (!splitDialog) return;
    if (splitHint) splitHint.textContent = "";
    const chosen = splitActive() ? splitModules : (activeModule ? [activeModule, "media"] : ["notes", "media"]);
    splitOptions?.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = chosen.includes(input.value);
    });
    setExtrasOpen(false);
    if (!splitDialog.open) {
      if (typeof splitDialog.showModal === "function") splitDialog.showModal();
      else splitDialog.setAttribute("open", "");
    }
  }

  function closeSplitDialog() {
    if (!splitDialog?.open) return;
    if (typeof splitDialog.close === "function") splitDialog.close();
    else splitDialog.removeAttribute("open");
  }

  /* ── participant reactions on any displayed wall ───────────── */
  function reactionLayer() {
    let layer = document.getElementById("reaction-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "reaction-layer";
      layer.className = "reaction-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.append(layer);
    }
    return layer;
  }

  function playReaction(item) {
    if (!item?.emoji) return;
    const layer = reactionLayer();
    /* a busy room should still feel lively without flooding the screen */
    if (layer.childElementCount > 90) return;
    const emoji = String(item.emoji).slice(0, 12);
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const burst = document.createElement("span");
    burst.className = "reaction-burst";
    burst.textContent = emoji;
    burst.style.setProperty("--reaction-x", (34 + Math.random() * 32).toFixed(1) + "%");
    burst.style.setProperty("--reaction-y", (34 + Math.random() * 26).toFixed(1) + "%");
    layer.append(burst);
    setTimeout(() => burst.remove(), quiet ? 900 : 1600);

    const count = quiet ? 3 : 13;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("span");
      dot.className = "reaction-particle";
      dot.textContent = emoji;
      dot.style.setProperty("--x", (6 + Math.random() * 88).toFixed(1) + "%");
      dot.style.setProperty("--delay", (Math.random() * (quiet ? 0.2 : 0.65)).toFixed(2) + "s");
      dot.style.setProperty("--size", (1.1 + Math.random() * (quiet ? 0.5 : 1.35)).toFixed(2));
      dot.style.setProperty("--rotate", (Math.random() * 70 - 35).toFixed(0) + "deg");
      dot.style.setProperty("--drift", (Math.random() * 80 - 40).toFixed(0) + "px");
      layer.append(dot);
      setTimeout(() => dot.remove(), quiet ? 1600 : 2600);
    }
  }

  /* ── exports: notes-only JPEG + highlights report ─────────── */
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

  function openWallHighlights() {
    if (typeof window.StickyHighlights?.open !== "function") return;
    setExtrasOpen(false);
    window.StickyHighlights.open({
      ...exportPayload(exportableNotes()),
      stats: { media: mediaVisible().length, stream: liveStreams.size }
    });
  }

  $("extras-download-jpeg")?.addEventListener("click", downloadWallJPEG);
  $("dash-download-jpeg")?.addEventListener("click", downloadWallJPEG);
  $("extras-highlights")?.addEventListener("click", openWallHighlights);
  $("dash-highlights")?.addEventListener("click", openWallHighlights);

  /* ── media wall controls ───────────────────────────────────── */
  $("extras-media-open")?.addEventListener("click", () => { setExtrasOpen(false); openMediaWall(); });
  $("extras-media-close")?.addEventListener("click", () => { setExtrasOpen(false); closeMediaWall(); });
  $("extras-media-present")?.addEventListener("click", () => {
    setExtrasOpen(false);
    openMediaWall();
    setMediaPresentation(true);
  });
  mediaClose?.addEventListener("click", closeMediaWall);
  $("media-present")?.addEventListener("click", () => {
    if (mediaPresent && !presentationManual) setMediaPresentation(false);
    else setMediaPresentation(true);
  });
  $("media-present-manual")?.addEventListener("click", () => {
    if (mediaPresent && presentationManual) setMediaPresentation(false);
    else setMediaPresentation(true, true);
  });
  $("media-stage-prev")?.addEventListener("click", () => stepMediaStage(-1));
  $("media-stage-next")?.addEventListener("click", () => stepMediaStage(1));
  $("media-stage-exit")?.addEventListener("click", () => setMediaPresentation(false));
  mediaHideAll?.addEventListener("click", event => armButton(event.currentTarget, t("Confirm hide all"), hideAllMedia));
  mediaWall?.addEventListener("click", event => {
    if (event.target === mediaWall) closeMediaWall();
  });

  /* ── module home, split screen, stream, reactions, requests ── */
  moduleHome?.querySelectorAll(".module-card[data-module]").forEach(button => {
    button.addEventListener("click", () => activateModule(button.dataset.module));
  });
  /* Every other-module count is a shortcut into that module. */
  document.addEventListener("click", event => {
    const chip = event.target.closest?.(".module-count[data-module]");
    if (!chip) return;
    event.preventDefault();
    activateModule(chip.dataset.module);
  });
  $("extras-home")?.addEventListener("click", () => { setExtrasOpen(false); openModuleHome(); });
  $("extras-split")?.addEventListener("click", openSplitDialog);
  $("extras-stream-wall")?.addEventListener("click", () => { setExtrasOpen(false); activateModule("stream"); });
  $("split-cancel")?.addEventListener("click", closeSplitDialog);
  $("split-exit")?.addEventListener("click", () => exitSplit(true));
  $("split-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const picked = [...(splitOptions?.querySelectorAll('input[type="checkbox"]:checked') || [])].map(input => input.value);
    if (picked.length < 2) {
      if (splitHint) splitHint.textContent = t("Pick at least two modules.");
      return;
    }
    if (splitHint) splitHint.textContent = "";
    closeSplitDialog();
    enterSplit(picked);
  });
  $("stream-close")?.addEventListener("click", closeStreamWall);
  $("stream-present")?.addEventListener("click", () => {
    setStreamPresentation(!document.body.classList.contains("present-stream"));
  });
  $("stream-empty-media")?.addEventListener("click", () => openMediaWall());
  $("stream-requests")?.addEventListener("click", openLiveRequestDialog);
  $("stream-empty-requests")?.addEventListener("click", openLiveRequestDialog);
  $("extras-stream-requests")?.addEventListener("click", () => { setExtrasOpen(false); openLiveRequestDialog(); });
  $("status-live-requests")?.addEventListener("click", openLiveRequestDialog);
  $("live-request-alert-review")?.addEventListener("click", () => {
    liveAlertDismissed = true;
    renderLiveRequestAlert();
    openLiveRequestDialog();
  });
  $("live-request-alert-close")?.addEventListener("click", () => {
    liveAlertDismissed = true;
    renderLiveRequestAlert();
  });
  $("live-request-close")?.addEventListener("click", closeLiveRequestDialog);
  $("live-float-close")?.addEventListener("click", () => { if (liveFloat) liveFloat.hidden = true; });

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

  /* Presenter-only reset: Supabase checks the passphrase inside a
     SECURITY DEFINER function, so the board never holds a powerful key. */
  function showResetError(message) {
    if (!resetError) return;
    resetError.textContent = message;
    resetError.hidden = false;
  }

  function openResetDialog() {
    if (!resetDialog) return;
    setExtrasOpen(false);
    if (resetError) { resetError.hidden = true; resetError.textContent = ""; }
    if (resetPassphrase) {
      resetPassphrase.value = "";
      resetPassphrase.required = Store.mode !== "demo";
      resetPassphrase.disabled = false;
    }
    if (resetConfirm) resetConfirm.disabled = false;
    if (typeof resetDialog.showModal === "function") {
      if (!resetDialog.open) resetDialog.showModal();
    } else resetDialog.setAttribute("open", "");
    setTimeout(() => resetPassphrase?.focus(), 60);
  }

  async function clearAllSubmissions(event) {
    event?.preventDefault();
    if (!resetDialog || !resetConfirm) return;
    const passphrase = String(resetPassphrase?.value || "");
    if (Store.mode !== "demo" && !passphrase) {
      showResetError(t("Enter the presenter passphrase."));
      resetPassphrase?.focus();
      return;
    }
    resetConfirm.disabled = true;
    if (resetPassphrase) resetPassphrase.disabled = true;
    const label = resetConfirm.textContent;
    resetConfirm.textContent = t("Clearing…");
    if (resetError) { resetError.hidden = true; resetError.textContent = ""; }
    try {
      await Store.clearSubmissions(passphrase);
      if (mediaPresent) setMediaPresentation(false);
      closeFocus();
      hidden.clear();
      saveHidden();
      await Promise.allSettled([syncNotes(), syncMedia()]);
      setDashboard(false);
      showNotesWall();
      renderDashboard();
      updateStatus();
      resetDialog.close();
      flashStatus("All submissions cleared");
    } catch (err) {
      console.error("Could not clear submissions", err);
      const message = String(err?.message || "");
      if (/incorrect passphrase/i.test(message)) showResetError(t("Wrong passphrase. Try again."));
      else if (/too many attempts/i.test(message)) showResetError(t("Too many attempts. Try again later."));
      else if (/not configured|does not exist|schema cache/i.test(message)) showResetError(t("Presenter reset is not set up yet."));
      else showResetError(t("Could not clear submissions. Try again."));
    } finally {
      resetConfirm.disabled = false;
      if (resetPassphrase) resetPassphrase.disabled = false;
      resetConfirm.textContent = label;
    }
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
    /* In a split pane the global brand is hidden, so notes use the pane. */
    const inSplit = splitActive();
    const brandShown = !inSplit && !!(brand && !brand.classList.contains("hidden") && prefs.brand);
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
    if (focusId === id) { focusId = null; document.body.classList.remove("reading"); focusStage.replaceChildren(); }
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
    updateFocusMeta();
    fitNote(el);
    requestAnimationFrame(() => fitNote(el));
    requestAnimationFrame(() => requestAnimationFrame(() => fitNote(el)));
  }

  function closeFocus() {
    if (!focusId) return;
    focusId = null;
    document.body.classList.remove("reading");
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
    focusCat.textContent = t(CATS[nt.category]?.label || "Note") +
      (typeof noteDateLabel === "function" && noteDateLabel(nt.created_at) ? " · " + noteDateLabel(nt.created_at) : "");
    focusCount.textContent = t("{i} of {n}", { i: i < 0 ? 1 : i + 1, n: Math.max(1, list.length) });
    focusMeta.style.setProperty("--focus-dot", CATS[nt.category]?.color || "#fff4e6");
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
  const EXTRAS_TOGGLES = ["extras-toggle", "media-controls", "stream-controls", "split-controls"];
  function setExtrasOpen(open) {
    if (!extras) return;
    extras.classList.toggle("open", !!open);
    EXTRAS_TOGGLES.forEach(id => $(id)?.setAttribute("aria-expanded", open ? "true" : "false"));
  }

  /* Every module has its own Extras button, all driving the same dock. */
  EXTRAS_TOGGLES.forEach(id => {
    $(id)?.addEventListener("click", e => {
      e.stopPropagation();
      setExtrasOpen(!extras.classList.contains("open"));
    });
  });

  /* The opt-in Full screen control in the dock and on the module home. */
  ["fullscreen-toggle", "module-fullscreen"].forEach(id => {
    $(id)?.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      toggleBoardFullscreen();
    });
  });
  syncFullscreenButtons();

  $("extras-close")?.addEventListener("click", () => setExtrasOpen(false));

  /* Per-card defaults: reset just the settings that belong to that module,
     leaving the rest of the wall untouched. */
  const EXTRAS_DEFAULTS = {
    notes: ["columns", "gap", "dashColor"],
    look: ["brand", "qr", "qrX", "qrY", "filters", "bgColor", "bgImage", "bgDim", "logo", "logoSize"],
    presentation: ["autoplay", "autoplayDelay", "autoplayDuration"],
    media: ["mediaAutoplay", "mediaMute", "mediaLoop", "mediaMax", "mediaPhotoSeconds", "mediaVideoRate"]
  };

  function resetExtrasDefaults(module, button) {
    const keys = EXTRAS_DEFAULTS[module];
    if (!keys) return;
    keys.forEach(key => { prefs[key] = PREF_DEFAULTS[key]; });
    savePrefs();
    applyPrefs(true);
    if (module === "look" || module === "notes") applyLook();
    if (module === "media") { applyMediaPrefs(); renderMediaWall(); }

    if (button) {
      if (!button.dataset.label) button.dataset.label = button.textContent;
      button.textContent = t("Done");
      button.classList.add("is-done");
      clearTimeout(button._doneTimer);
      button._doneTimer = setTimeout(() => {
        button.textContent = button.dataset.label || t("Defaults");
        button.classList.remove("is-done");
      }, 1400);
    }
  }

  [["notes", "extras-defaults-notes"],
   ["look", "extras-defaults-look"],
   ["presentation", "extras-defaults-presentation"],
   ["media", "extras-defaults-media"]].forEach(([module, id]) => {
    $(id)?.addEventListener("click", e => resetExtrasDefaults(module, e.currentTarget));
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
    else if (key === "bgDim" || key === "bgColor" || key === "dashColor") applyLook();
    else if (key === "logoSize") { applyLook(); layout(); }
    else if (key === "autoplay" || key === "autoplayDelay" || key === "autoplayDuration") syncPrefInputs();
    else if (String(key).startsWith("media")) {
      applyMediaPrefs();
      if (mediaPresent) renderMediaStage();
      else renderMediaWall();
      syncPrefInputs();
    }
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

  /* Notes controls can be used from any module: show the notes wall first. */
  const showNotesWall = () => {
    if (moduleHomeOpen || activeModule !== "notes" || splitActive() || mediaOpenNow() || streamWallOpenNow()) {
      activateModule("notes");
    }
  };
  $("extras-notes-wall")?.addEventListener("click", () => {
    setExtrasOpen(false);
    showNotesWall();
  });
  $("extras-dashboard")?.addEventListener("click", () => {
    setExtrasOpen(false);
    showNotesWall();
    openDashboard();
  });
  $("extras-event-title")?.addEventListener("click", () => {
    setExtrasOpen(false);
    openEventEditor();
  });
  $("extras-categories")?.addEventListener("click", () => {
    setExtrasOpen(false);
    openCategoryEditor();
  });
  $("dash-back")?.addEventListener("click", closeDashboard);
  $("extras-reset-view")?.addEventListener("click", () => {
    showNotesWall();
    resetView();
  });
  $("dash-reset")?.addEventListener("click", resetView);
  $("extras-restore")?.addEventListener("click", () => {
    showNotesWall();
    restoreAll();
  });
  $("dash-restore")?.addEventListener("click", restoreAll);
  $("extras-clear")?.addEventListener("click", e => {
    armButton(e.currentTarget, t("Confirm clear"), () => { showNotesWall(); clearWall(); });
  });
  $("dash-clear")?.addEventListener("click", e => armButton(e.currentTarget, t("Confirm clear"), clearWall));

  $("extras-reset-submissions")?.addEventListener("click", openResetDialog);
  $("reset-cancel")?.addEventListener("click", () => resetDialog?.close());
  resetDialog?.addEventListener("click", e => { if (e.target === resetDialog) resetDialog.close(); });
  resetForm?.addEventListener("submit", clearAllSubmissions);

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
  $("extras-dash-swatches")?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-dash]");
    if (!btn) return;
    prefs.dashColor = normaliseHex(btn.dataset.dash) || "";
    savePrefs();
    applyLook();
  });

  $("extras-bg-color-reset")?.addEventListener("click", () => {
    prefs.bgColor = "";
    savePrefs();
    applyLook();
  });
  $("extras-dash-color-reset")?.addEventListener("click", () => {
    prefs.dashColor = "";
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
    if (entering) closeModulesExcept("notes");
    notesPresent = on;
    presentationManual = on ? !!manual : false;
    if (entering) {
      notesPresentSnapshot = {
        brand: prefs.brand,
        qr: prefs.qr,
        filters: prefs.filters
      };
      ["brand", "qr", "filters"].forEach(key => { prefs[key] = false; });
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

  extrasNotesOnly?.addEventListener("click", () => { showNotesWall(); setNotesPresentation(true); });
  $("extras-notes-manual")?.addEventListener("click", () => {
    showNotesWall();
    if (notesPresent && presentationManual) setNotesPresentation(false);
    else setNotesPresentation(true, true);
  });

  extrasShowAll?.addEventListener("click", () => {
    showNotesWall();
    setNotesPresentation(false);
    ["brand", "qr", "filters"].forEach(key => { prefs[key] = true; });
    savePrefs();
    applyPrefs(true);
    setExtrasOpen(false);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest("#extras")) setExtrasOpen(false);
  });

  /* ── keyboard (moderator at the laptop) ────────────────────── */
  document.addEventListener("keydown", e => {
    if (eventDialog?.open || categoryDialog?.open || splitDialog?.open || liveRequestDialog?.open || /^(input|textarea|select)$/i.test(e.target.tagName || "")) return;
    /* let Space/Enter activate a focused button or note natively */
    if ((e.key === " " || e.key === "Enter") && e.target.closest?.("button, .note")) return;
    const k = e.key.toLowerCase();
    touchAutoplay();

    /* Shift+F is the global Full screen shortcut, including module home. */
    if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && k === "f") {
      e.preventDefault();
      toggleBoardFullscreen();
      return;
    }

    if (moduleHomeOpen) {
      if (/^[1-3]$/.test(k)) { e.preventDefault(); activateModule(MODULE_KEYS[Number(k) - 1]); }
      else if (k === "v") { e.preventDefault(); activateModule("media"); }
      return;
    }

    /* Esc always dismisses Extras before it leaves the module underneath. */
    if (k === "escape" && extras?.classList.contains("open")) {
      e.preventDefault();
      setExtrasOpen(false);
      return;
    }

    /* The Extras shortcuts stay available in every module, not only Notes. */
    if (k === "h") {
      e.preventDefault();
      if (notesPresent) setNotesPresentation(false);
      if (mediaPresent) setMediaPresentation(false);
      if (document.body.classList.contains("present-stream")) setStreamPresentation(false);
      if (dashboardOpen()) closeDashboard();
      if (focusId) closeFocus();
      setExtrasOpen(!extras?.classList.contains("open"));
      return;
    }
    if (k === "w") { e.preventDefault(); showNotesWall(); setExtrasOpen(false); return; }
    if (k === "d") {
      e.preventDefault();
      if (dashboardOpen()) closeDashboard();
      else { showNotesWall(); openDashboard(); }
      setExtrasOpen(false);
      return;
    }
    if (k === "e") { e.preventDefault(); setExtrasOpen(false); openEventEditor(); return; }
    if (k === "c") { e.preventDefault(); setExtrasOpen(false); openCategoryEditor(); return; }
    if (k === "v") {
      e.preventDefault();
      if (mediaOpenNow()) closeMediaWall();
      else openMediaWall();
      return;
    }

    if (splitActive()) {
      if (k === "escape") { e.preventDefault(); exitSplit(true); }
      else if (k === "f" && splitModules.includes("media")) {
        e.preventDefault();
        if (mediaPresent && !presentationManual) setMediaPresentation(false);
        else setMediaPresentation(true);
      }
      else if (k === "f" && splitModules.includes("stream")) {
        e.preventDefault();
        setStreamPresentation(!document.body.classList.contains("present-stream"));
      }
      return;
    }

    if (streamWallOpenNow()) {
      if (k === "escape") {
        e.preventDefault();
        if (document.body.classList.contains("present-stream")) setStreamPresentation(false);
        else closeStreamWall();
      }
      else if (k === "f") { e.preventDefault(); setStreamPresentation(!document.body.classList.contains("present-stream")); }
      else if (k === "v") { e.preventDefault(); openMediaWall(); }
      return;
    }

    if (mediaOpenNow()) {
      if (mediaPresent) {
        if (k === "escape" || k === "f") { e.preventDefault(); setMediaPresentation(false); }
        else if (k === "v") { e.preventDefault(); closeMediaWall(); }
        else if (k === "m") {
          if (presentationManual) setMediaPresentation(false);
          else setMediaPresentation(true, true);
        }
        else if (k === "arrowright" || k === "arrowdown" || k === " " || k === "pagedown") { e.preventDefault(); stepMediaStage(1); }
        else if (k === "arrowleft" || k === "arrowup" || k === "pageup") { e.preventDefault(); stepMediaStage(-1); }
        return;
      }
      if (k === "escape" || k === "v") { e.preventDefault(); closeMediaWall(); }
      else if (k === "f") { e.preventDefault(); setMediaPresentation(true); }
      else if (k === "m") { e.preventDefault(); setMediaPresentation(true, true); }
      return;
    }
    if (k === "v") { e.preventDefault(); openMediaWall(); return; }
    if (dashboardOpen()) {
      if (k === "escape" || k === "d") closeDashboard();
      else if (k === "h") setExtrasOpen(!extras?.classList.contains("open"));
      return;
    }
    if (k === "escape") {
      if (notesPresent) setNotesPresentation(false);
      else if (focusId) closeFocus();
      else { closeFocus(); setExtrasOpen(false); }
    }
    else if (k === "d") toggleDashboard();
    else if (k === "x" && focusId) hideNote(focusId);
    else if (k === "arrowright" || k === "arrowdown" || k === " ") { e.preventDefault(); step(1); }
    else if (k === "arrowleft" || k === "arrowup") { e.preventDefault(); step(-1); }
    else if (k === "e" && !focusId) openEventEditor();
    else if (k === "c" && !focusId) openCategoryEditor();
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
    else if (/^[1-9]$/.test(k)) {
      const cat = categoryList()[Number(k) - 1];
      if (cat) setFilter(cat.key);
    }
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

  /* phone QR */
  let qrDrag = null, qrDragReady = false;

  function qrLimits() {
    return {
      x: Math.max(0, window.innerWidth - qrCard.offsetWidth - QR_MARGIN * 2),
      y: Math.max(0, window.innerHeight - qrCard.offsetHeight - QR_MARGIN * 2)
    };
  }

  /* The card floats at the top right until the presenter moves it.
     Positions are saved as fractions of the free space, so they survive
     a resize or a switch into full screen. */
  function applyQrPosition() {
    if (!qrCard) return;
    if (!(prefs.qrX >= 0) || !(prefs.qrY >= 0)) {
      qrCard.style.left = "";
      qrCard.style.top = "";
      qrCard.style.right = "";
      return;
    }
    const max = qrLimits();
    const x = Math.min(1, Math.max(0, prefs.qrX));
    const y = Math.min(1, Math.max(0, prefs.qrY));
    qrCard.style.left = (QR_MARGIN + x * max.x) + "px";
    qrCard.style.top = (QR_MARGIN + y * max.y) + "px";
    qrCard.style.right = "auto";
  }

  function saveQrPosition() {
    const max = qrLimits();
    const left = Number.parseFloat(qrCard.style.left);
    const top = Number.parseFloat(qrCard.style.top);
    prefs.qrX = max.x > 0 ? Math.min(1, Math.max(0, (left - QR_MARGIN) / max.x)) : 0;
    prefs.qrY = max.y > 0 ? Math.min(1, Math.max(0, (top - QR_MARGIN) / max.y)) : 0;
    savePrefs();
  }

  function setupQrDrag() {
    if (qrDragReady || !qrCard) return;
    qrDragReady = true;

    qrCard.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const style = getComputedStyle(qrCard);
      const rect = qrCard.getBoundingClientRect();
      const left = Number.parseFloat(style.left);
      const top = Number.parseFloat(style.top);
      qrDrag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: Number.isFinite(left) ? left : rect.left,
        top: Number.isFinite(top) ? top : rect.top,
        max: qrLimits(),
        moved: false
      };
      try { qrCard.setPointerCapture(e.pointerId); } catch {}
    });

    qrCard.addEventListener("pointermove", e => {
      if (!qrDrag || e.pointerId !== qrDrag.id) return;
      const dx = e.clientX - qrDrag.x;
      const dy = e.clientY - qrDrag.y;
      if (!qrDrag.moved) {
        if (Math.abs(dx) + Math.abs(dy) < 4) return;
        qrDrag.moved = true;
        qrCard.classList.add("is-dragging");
      }
      e.preventDefault();
      const left = Math.min(Math.max(qrDrag.left + dx, QR_MARGIN), QR_MARGIN + qrDrag.max.x);
      const top = Math.min(Math.max(qrDrag.top + dy, QR_MARGIN), QR_MARGIN + qrDrag.max.y);
      qrCard.style.left = left + "px";
      qrCard.style.top = top + "px";
      qrCard.style.right = "auto";
    });

    const endDrag = e => {
      if (!qrDrag || (e.pointerId !== undefined && e.pointerId !== qrDrag.id)) return;
      const moved = qrDrag.moved;
      const id = qrDrag.id;
      qrDrag = null;
      qrCard.classList.remove("is-dragging");
      try { qrCard.releasePointerCapture(id); } catch {}
      if (moved) saveQrPosition();
    };
    qrCard.addEventListener("pointerup", endDrag);
    qrCard.addEventListener("pointercancel", endDrag);

    /* Double-click returns the card to its original corner. */
    qrCard.addEventListener("dblclick", () => {
      prefs.qrX = -1;
      prefs.qrY = -1;
      savePrefs();
      applyQrPosition();
    });

    window.addEventListener("resize", () => { if (!qrDrag) applyQrPosition(); });

    /* The card changes width in split screen, so keep a saved position
       inside the viewport without saving a new fraction. */
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => { if (!qrDrag) applyQrPosition(); }).observe(qrCard);
    }
  }

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
      setupQrDrag();
      applyQrPosition();
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

  /* The wall comes first with its controls visible. ?module=notes|media|stream
     opens a module straight away. */
  const bootModuleParam = new URLSearchParams(location.search).get("module");
  const bootModuleTarget = MODULE_KEYS.includes(bootModuleParam) ? bootModuleParam : "notes";
  activateModule(bootModuleTarget);

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

    await syncMedia();
    Store.subscribeMedia({
      onAdd: item => {
        if (!item?.id) return;
        if (isSampleMedia(item)) return;
        if (!media.some(m => m.id === item.id)) {
          media.push(item);
          /* live album: a new upload takes over the full-screen show */
          if (mediaPresent && !presentationManual) mediaStageIndex = Math.max(0, mediaStageList().length - 1);
        }
        renderMediaWall();
      },
      onUpdate: item => {
        if (isSampleMedia(item)) return;
        const i = media.findIndex(m => m.id === item.id);
        if (i >= 0) media[i] = item;
        else media.push(item);
        renderMediaWall();
      },
      onRemove: id => removeMediaLocal(id),
      resync: syncMedia
    });

    liveHost = startLiveHost();
    if (bootModuleTarget) activateModule(bootModuleTarget);
    window.addEventListener("pagehide", () => liveHost?.stop());
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
