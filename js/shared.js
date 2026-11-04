/* Shared look: categories, paper palettes and deterministic per-note
   "handwriting" so every screen shows the same note identically.

   Categories are dynamic: the presenter can add, rename, recolour or
   remove them on the board. CATS is mutated in place so every module
   that captured the object sees the change immediately. */

const DEFAULT_CATEGORIES = [
  { key: "question",     label: "Question",     short: "Questions", action: "Ask a question",     emoji: "❓", hint: "What are you wondering?",        color: "#E6E600" },
  { key: "idea",         label: "Idea",         short: "Ideas",     action: "Give an idea",        emoji: "💡", hint: "What if we…",                    color: "#E60073" },
  { key: "appreciation", label: "Appreciation", short: "Thanks",    action: "Share appreciation",  emoji: "💗", hint: "Say thank you…",                 color: "#00E600" },
  { key: "resources",    label: "Resource",     short: "Resources", action: "Share a resource",    emoji: "📚", hint: "A link, tool or reading…",       color: "#00B4E6" },
  { key: "requests",     label: "Request",      short: "Requests",  action: "Make a request",      emoji: "🙏", hint: "What do you need help with?",    color: "#E67300" }
];

const MAX_CATEGORIES = 9;
const CATEGORY_COLOR_CYCLE = ["#8E44AD", "#16A085", "#E74C3C", "#2980B9", "#D35400", "#2C3E50"];

/* live category map: key → fully derived category */
const CATS = {};

/* Small translation helper: categories and notes keep their English
   source text in storage, and we translate only when painting. */
function sharedText(key, vars) {
  if (typeof window.t === "function") return window.t(key, vars);
  if (!vars) return key;
  return String(key).replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] == null ? match : String(vars[name]));
}

/* ── colour helpers ─────────────────────────────────────────── */
function normaliseHex(value) {
  let v = String(value || "").trim();
  if (/^#?[0-9a-f]{3}$/i.test(v)) {
    v = "#" + v.replace("#", "").split("").map(c => c + c).join("");
  }
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
}

function hexToRgb(hex) {
  const h = normaliseHex(hex) || "#E6E600";
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
}

function mixColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b), k = Math.max(0, Math.min(1, t));
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function pluralName(label) {
  const s = String(label || "").trim();
  if (!s) return "Notes";
  return /(s|x|z|ch|sh)$/i.test(s) ? s : s + "s";
}

function cleanText(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

/* ── note text links ────────────────────────────────────────────
   Notes may carry [a word](https://example.com) links so long URLs
   can stay behind the word itself. Bare http(s)/mailto URLs are
   linked too. Everything is built with DOM text nodes, never HTML. */
const NOTE_LINK_PATTERN = /\[([^\]\n]{1,180})\]\(\s*(https?:\/\/[^\s)]+|mailto:[^\s)]+)\s*\)|(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+)/gi;

function noteLinkHref(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^mailto:/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function trimLinkTail(value) {
  let out = String(value || "");
  while (/[.,!?;:]$/.test(out)) out = out.slice(0, -1);
  const opens = (out.match(/\(/g) || []).length;
  const closes = (out.match(/\)/g) || []).length;
  while (out.endsWith(")") && closes > opens) out = out.slice(0, -1);
  return out;
}

/* Visible text for exports, screen readers and search: link label only. */
function notePlainText(value) {
  return String(value == null ? "" : value).replace(
    /\[([^\]\n]{1,180})\]\(\s*(?:https?:\/\/|mailto:)[^\s)]+\s*\)/gi,
    "$1"
  );
}

/* Paint a note body, turning markdown links and bare URLs into anchors. */
function renderNoteText(node, value) {
  if (!node) return;
  node.replaceChildren();
  const source = String(value == null ? "" : value);
  const pattern = new RegExp(NOTE_LINK_PATTERN.source, NOTE_LINK_PATTERN.flags);
  let last = 0, match;
  while ((match = pattern.exec(source))) {
    const markdown = match[1] != null;
    const rawHref = markdown ? match[2] : match[3];
    const hrefText = markdown ? rawHref : trimLinkTail(rawHref);
    const href = noteLinkHref(hrefText);
    if (!href || !hrefText) continue;
    if (match.index > last) node.appendChild(document.createTextNode(source.slice(last, match.index)));
    const link = document.createElement("a");
    link.className = "note-link";
    link.href = href;
    link.textContent = markdown ? match[1] : hrefText;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.addEventListener("click", event => event.stopPropagation());
    link.addEventListener("pointerdown", event => event.stopPropagation());
    link.addEventListener("keydown", event => event.stopPropagation());
    node.appendChild(link);
    last = match.index + (markdown ? match[0].length : hrefText.length);
  }
  if (last < source.length) node.appendChild(document.createTextNode(source.slice(last)));
}

/* Derive paper shades, pile ink and the phone-card gradient from one base. */
function deriveCategory(raw, index) {
  const label = cleanText(raw.label, 32) || "Category";
  const color = normaliseHex(raw.color) || CATEGORY_COLOR_CYCLE[index % CATEGORY_COLOR_CYCLE.length];
  const tints = [.62, .54, .46];
  const variants = tints.map(t => [
    mixColor(color, "#FFFFFF", t),
    mixColor(color, "#FFFFFF", Math.max(.18, t - .09))
  ]);
  return {
    key: raw.key,
    label,
    short: cleanText(raw.short, 32) || pluralName(label),
    action: cleanText(raw.action, 48) || label,
    emoji: cleanText(raw.emoji, 4) || "📝",
    hint: cleanText(raw.hint, 80) || sharedText("Write your note…"),
    color,
    color2: mixColor(color, "#000000", .12),
    deep: mixColor(color, "#120C06", .66),
    variants
  };
}

function normalizeCategoryList(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_CATEGORIES;
  const seen = new Set(), out = [];
  source.slice(0, MAX_CATEGORIES).forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    let key = String(raw.key || "").toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!key) key = "category-" + (i + 1);
    const base = key;
    let n = 2;
    while (seen.has(key)) key = base + "-" + (n++);
    seen.add(key);
    out.push(deriveCategory({ ...raw, key }, i));
  });
  if (out.length) return out;
  return DEFAULT_CATEGORIES.map((raw, i) => deriveCategory({ ...raw }, i));
}

/* Replace CATS in place, preserving key order. */
function applyCategories(list) {
  const clean = normalizeCategoryList(list);
  Object.keys(CATS).forEach(key => { delete CATS[key]; });
  clean.forEach(c => { CATS[c.key] = c; });
  return clean;
}

function categoryList() { return Object.values(CATS); }
function categoryKeys() { return Object.keys(CATS); }

applyCategories(DEFAULT_CATEGORIES);

/* [css font-family, size multiplier] */
const HAND_FONTS = [
  ["'Caveat'", 1.16], ["'Kalam'", .90], ["'Patrick Hand'", 1.00], ["'Gochi Hand'", .94],
  ["'Shadows Into Light'", .98], ["'Nanum Pen Script'", 1.38], ["'Covered By Your Grace'", 1.16],
  ["'Reenie Beanie'", 1.32]
];
const INKS = ["#151b29", "#0f2358", "#0b1b4c", "#1d2028", "#152a63", "#231c38"];

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed) { let t = seed += 0x6D2B79F5; return () => { t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function noteLook(n) {
  const r = rnd(hash(n.id));
  const f = HAND_FONTS[Math.floor(r() * HAND_FONTS.length)];
  const first = CATS[categoryKeys()[0]];
  const variants = (CATS[n.category] || first)?.variants || [["#F5F59E", "#F4F486"]];
  const paper = variants[Math.floor(r() * variants.length)];
  const foldRoll = r();
  return {
    font: f[0], fontMul: f[1], ink: INKS[Math.floor(r() * INKS.length)],
    rot: (r() * 8.4 - 4.2).toFixed(2),
    jx: r() * 2 - 1, jy: r() * 2 - 1,
    fold: foldRoll < .28 ? "none" : foldRoll < .64 ? "r" : "l",
    foldScale: (.12 + r() * .07).toFixed(3),
    shade: (.78 + r() * .44).toFixed(2),
    paper: paper[0], paper2: paper[1]
  };
}

function noteAria(n) {
  const c = CATS[n.category];
  const author = String(n.author || n.name || "").trim();
  const label = sharedText(c ? c.label : "Note");
  const text = typeof notePlainText === "function" ? notePlainText(n.text) : n.text;
  return author
    ? sharedText("{label} by {author}: {text}", { label, author, text })
    : label + ": " + text;
}

/* Recolour an existing sheet after the presenter changes a category. */
function paintNote(el, n) {
  const L = noteLook(n);
  el.dataset.cat = n.category;
  el.style.setProperty("--paper", L.paper);
  el.style.setProperty("--paper2", L.paper2);
  el.setAttribute("aria-label", noteAria(n));
}

/* Builds one post-it element. */
function buildNote(n) {
  const L = noteLook(n);
  const author = String(n.author || n.name || "").trim();
  const el = document.createElement("div");
  el.className = "note fold-" + L.fold;
  el.dataset.id = n.id;
  el.dataset.cat = n.category;
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.setAttribute("aria-label", noteAria(n));
  el.style.setProperty("--paper", L.paper);
  el.style.setProperty("--paper2", L.paper2);
  el.style.setProperty("--ink", L.ink);
  el.style.setProperty("--font", L.font);
  el.style.setProperty("--fm", L.fontMul);
  el.style.setProperty("--shade", L.shade);
  el.style.setProperty("--r", L.rot + "deg");
  el.style.setProperty("--fold-scale", L.foldScale);

  const paper = document.createElement("span"); paper.className = "paper"; paper.setAttribute("aria-hidden", "true");
  const fold = document.createElement("span"); fold.className = "fold"; fold.setAttribute("aria-hidden", "true");
  const p = document.createElement("p"); p.className = "note-text";
  if (typeof renderNoteText === "function") renderNoteText(p, n.text);
  else p.textContent = n.text;
  el.append(paper, fold, p);
  if (author) {
    const sig = document.createElement("span");
    sig.className = "note-author";
    sig.textContent = "— " + author;
    el.appendChild(sig);
  }
  return el;
}
