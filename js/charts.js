/* Friendly, hand-drawn result charts shared by the presenter board and the
   phone page. Everything is plain DOM + inline SVG: no chart library, no
   build step, and the same chart looks the same on both screens.

   The wobbly bars, crayon hatching and handwritten labels are deterministic
   (seeded from the option id) so a chart does not jump around on re-render. */

const HAND_CHART_COLORS = [
  "#E4572E", "#F2A541", "#4C9F70", "#2E86AB",
  "#8E5AA8", "#D1495B", "#3A7D44", "#C97B1E"
];

const HC_NS = "http://www.w3.org/2000/svg";
let handChartSerial = 0;

function handChartText(key, vars) {
  if (typeof window.t === "function") return window.t(key, vars);
  if (!vars) return key;
  return String(key).replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] == null ? match : String(vars[name]));
}

function handChartSeed(value) {
  const s = String(value == null ? "" : value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function handChartRnd(seed) {
  let t = (seed >>> 0) + 0x6D2B79F5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function handChartColor(seed) {
  return HAND_CHART_COLORS[handChartSeed(seed) % HAND_CHART_COLORS.length];
}

function handChartEl(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function handChartSvg(tag, attrs) {
  const node = document.createElementNS(HC_NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

/* A closed band with slightly wobbly top and bottom edges. The viewBox is
   always 0 0 120 18; CSS stretches it to the rail. */
function handBandPath(seed) {
  const rnd = handChartRnd(seed);
  const steps = 6;
  const top = [], bottom = [];
  for (let i = 0; i <= steps; i++) {
    top.push({ x: (i / steps) * 120, y: 2.6 + rnd() * 2.6 });
    bottom.push({ x: (i / steps) * 120, y: 12.6 + rnd() * 2.8 });
  }
  let d = "M" + top[0].x.toFixed(1) + " " + top[0].y.toFixed(1);
  for (let i = 1; i <= steps; i++) {
    const prev = top[i - 1], next = top[i];
    const cx = (prev.x + next.x) / 2;
    d += " Q" + cx.toFixed(1) + " " + (prev.y - 1.2 + rnd() * 2.4).toFixed(1) +
      " " + next.x.toFixed(1) + " " + next.y.toFixed(1);
  }
  d += " L120 " + bottom[steps].y.toFixed(1);
  for (let i = steps; i >= 1; i--) {
    const prev = bottom[i], next = bottom[i - 1];
    const cx = (prev.x + next.x) / 2;
    d += " Q" + cx.toFixed(1) + " " + (prev.y + 1.2 - rnd() * 2.4).toFixed(1) +
      " " + next.x.toFixed(1) + " " + next.y.toFixed(1);
  }
  return d + " Z";
}

/* Paint an option's icon if it has one, otherwise return null. */
function pollMediaNode(value, className) {
  const media = String(value == null ? "" : value).trim();
  if (!media) return null;
  const kind = typeof pollMediaKind === "function" ? pollMediaKind(media) : "";
  const node = document.createElement("span");
  node.className = "hc-media" + (className ? " " + className : "");
  if (kind === "image") {
    const img = document.createElement("img");
    img.src = media;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      node.classList.add("is-missing");
      node.textContent = "🖼";
    });
    node.classList.add("hc-media--image");
    node.append(img);
  } else {
    node.classList.add("hc-media--text");
    node.textContent = media.slice(0, 8);
  }
  node.setAttribute("aria-hidden", "true");
  return node;
}

function handChartHead(poll, stats) {
  const head = handChartEl("div", "hc__head");
  const stamp = handChartEl("span", "hc__stamp");
  const doodle = handChartEl("span", "hc__doodle", "✎");
  doodle.setAttribute("aria-hidden", "true");
  stamp.append(doodle, document.createTextNode(handChartText("Live results")));
  const total = stats.total === 1
    ? handChartText("1 response")
    : handChartText("{n} responses", { n: stats.total });
  head.append(stamp, handChartEl("span", "hc__total", total));
  return head;
}

function handChartRail(option, index) {
  const rail = handChartEl("div", "hc-rail");
  const seed = handChartSeed(option.id || option.label || index);
  const band = handBandPath(seed);
  const patternId = "hcHatch" + (++handChartSerial);

  const track = handChartSvg("svg", {
    class: "hc-rail__track",
    viewBox: "0 0 120 18",
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  });
  track.append(handChartSvg("path", { d: band, class: "hc-rail__ghost" }));
  const guide = handChartSvg("path", {
    d: "M2 9.6 C 26 8.4, 48 10.8, 72 9.2 S 104 10.2, 118 9.4",
    class: "hc-rail__guide"
  });
  track.append(guide);

  const clip = handChartEl("span", "hc-fillclip");
  const fill = handChartSvg("svg", {
    class: "hc-rail__fill",
    viewBox: "0 0 120 18",
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  });
  const defs = handChartSvg("defs");
  const pattern = handChartSvg("pattern", {
    id: patternId,
    width: 7,
    height: 7,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(-20)"
  });
  pattern.append(handChartSvg("line", {
    x1: 0, y1: 0, x2: 0, y2: 7,
    stroke: "rgba(255,255,255,.38)",
    "stroke-width": 1.35
  }));
  defs.append(pattern);
  fill.append(defs);
  fill.append(handChartSvg("path", { d: band, class: "hc-rail__crayon" }));
  fill.append(handChartSvg("path", { d: band, class: "hc-rail__ink", fill: "url(#" + patternId + ")" }));
  clip.append(fill);
  rail.append(track, clip);
  return rail;
}

function handBarRow(option, index, total) {
  const count = Math.max(0, Number(option.count) || 0);
  const pct = total ? Math.round((count / total) * 100) : 0;
  const row = handChartEl("div", "hc-row");
  row.style.setProperty("--pct", String(Math.max(0, Math.min(100, pct))));
  row.style.setProperty("--c", handChartColor(option.id || option.label || index));
  row.style.setProperty("--i", String(index));

  const top = handChartEl("div", "hc-row__top");
  const name = handChartEl("span", "hc-row__name");
  const media = pollMediaNode(option.media);
  if (media) name.append(media);
  name.append(handChartEl("span", "hc-row__label", option.label));
  const value = handChartEl("span", "hc-row__value");
  value.append(handChartEl("b", null, String(count)), handChartEl("small", null, pct + "%"));
  top.append(name, value);

  row.append(top, handChartRail(option, index));
  return row;
}

function pollHandBars(poll, stats) {
  const root = handChartEl("div", "hc hc--bars");
  root.append(handChartHead(poll, stats));
  const rows = handChartEl("div", "hc__rows");
  (stats.options || []).forEach((option, i) => rows.append(handBarRow(option, i, stats.total)));
  root.append(rows);

  const footer = handChartEl("p", "hc__scribble");
  footer.append(
    handChartEl("span", "hc__arrow", "↳"),
    document.createTextNode(handChartText("Every answer adds a little ink."))
  );
  root.append(footer);

  root.setAttribute("role", "img");
  root.setAttribute("aria-label",
    (poll?.question ? poll.question + ". " : "") +
    (stats.options || []).map(option => option.label + ": " + option.count).join(", "));
  return root;
}

function pollHandRating(poll, stats) {
  const root = handChartEl("div", "hc hc--rating");
  root.append(handChartHead(poll, stats));

  const summary = handChartEl("div", "hc__rating");
  const average = handChartEl("div", "hc__average");
  average.append(
    handChartEl("b", null, Number(stats.rating.avg || 0).toFixed(1)),
    handChartEl("span", null, handChartText(" / 5"))
  );
  const stars = Math.max(0, Math.min(5, Math.round(stats.rating.avg || 0)));
  const starRow = handChartEl("span", "hc__stars",
    "★".repeat(stars) + "☆".repeat(5 - stars));
  starRow.setAttribute("aria-hidden", "true");
  average.append(starRow);

  const scores = [5, 4, 3, 2, 1].map(score => {
    const count = stats.rating.counts[score - 1] || 0;
    return {
      id: "rate-" + score,
      label: score + "★",
      media: "",
      count,
      pct: stats.rating.total ? Math.round((count / stats.rating.total) * 100) : 0
    };
  });

  const rows = handChartEl("div", "hc__rows hc__rows--rating");
  scores.forEach((option, i) => rows.append(handBarRow(option, i, stats.rating.total)));
  summary.append(average, rows);
  root.append(summary);

  root.setAttribute("role", "img");
  root.setAttribute("aria-label",
    (poll?.question ? poll.question + ". " : "") +
    handChartText("Average {n} out of 5", { n: Number(stats.rating.avg || 0).toFixed(1) }));
  return root;
}

/* Main entry point. Returns null for open-text polls, which keep their
   handwritten answer list instead of a chart. */
function pollHandChart(poll, stats) {
  if (!poll || !stats || !stats.total) return null;
  if (poll.type === "text") return null;
  if (poll.type === "rating") return pollHandRating(poll, stats);
  return pollHandBars(poll, stats);
}
