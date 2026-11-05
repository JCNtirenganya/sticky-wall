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

/* ── chart types and styles ─────────────────────────────────────
   The presenter picks a type (bars, columns, donut, line, cloud) and a
   style (hand-drawn or clean). Both renderers share the same data and
   the same .hc shell, so charts stay legible on the board and on phones. */

const CLEAN_CHART_COLORS = [
  "#2563EB", "#16A34A", "#F59E0B", "#DC2626",
  "#7C3AED", "#0891B2", "#DB2777", "#65A30D"
];

const CHART_TYPES = ["auto", "bars", "columns", "donut", "line", "cloud"];
const CHART_STYLES = ["hand", "clean"];

function chartColor(value, index, style) {
  if (style === "clean") {
    const n = Math.abs(Number(index) || 0);
    return CLEAN_CHART_COLORS[n % CLEAN_CHART_COLORS.length];
  }
  return handChartColor(value);
}

function chartOptions(poll, stats) {
  if (poll && poll.type === "rating" && stats && stats.rating) {
    return [5, 4, 3, 2, 1].map(score => {
      const count = stats.rating.counts[score - 1] || 0;
      return {
        id: "rate-" + score,
        label: score + "★",
        media: "",
        count,
        pct: stats.rating.total ? Math.round((count / stats.rating.total) * 100) : 0
      };
    });
  }
  return (stats && stats.options) || [];
}

function chartTotal(poll, stats) {
  if (poll && poll.type === "rating" && stats && stats.rating) return stats.rating.total;
  return (stats && stats.total) || 0;
}

function chartRoot(type, style, poll, stats) {
  const root = handChartEl("div", "hc hc--" + type + (style === "clean" ? " hc--clean" : " hc--hand"));
  root.append(handChartHead(poll, stats));
  root.classList.add("hc--" + style);
  return root;
}

function cleanBarRail(option, index, total, style) {
  const count = Math.max(0, Number(option.count) || 0);
  const pct = total ? Math.round((count / total) * 100) : 0;
  const rail = handChartEl("div", "hc-rail hc-rail--clean");
  rail.style.setProperty("--pct", String(Math.max(0, Math.min(100, pct))));
  const track = handChartEl("span", "hc-rail__bar-track");
  const fill = handChartEl("span", "hc-rail__bar-fill");
  fill.style.width = pct + "%";
  fill.style.background = chartColor(option.id || option.label || index, index, style);
  track.append(fill);
  rail.append(track);
  return rail;
}

function chartBarRow(option, index, total, style) {
  if (style !== "clean") return handBarRow(option, index, total);
  const count = Math.max(0, Number(option.count) || 0);
  const pct = total ? Math.round((count / total) * 100) : 0;
  const row = handChartEl("div", "hc-row hc-row--clean");
  row.style.setProperty("--pct", String(Math.max(0, Math.min(100, pct))));
  const top = handChartEl("div", "hc-row__top");
  const name = handChartEl("span", "hc-row__name");
  const media = pollMediaNode(option.media);
  if (media) name.append(media);
  name.append(handChartEl("span", "hc-row__label", option.label));
  const value = handChartEl("span", "hc-row__value");
  value.append(handChartEl("b", null, String(count)), handChartEl("small", null, pct + "%"));
  top.append(name, value);
  row.append(top, cleanBarRail(option, index, total, style));
  return row;
}

function pollBarsChart(poll, stats, style) {
  const root = chartRoot("bars", style, poll, stats);
  const rows = handChartEl("div", "hc__rows");
  chartOptions(poll, stats).forEach((option, i) =>
    rows.append(chartBarRow(option, i, chartTotal(poll, stats), style)));
  root.append(rows);

  if (poll && poll.type === "rating") {
    const avg = Number(stats.rating && stats.rating.avg || 0);
    const foot = handChartEl("p", "hc__scribble");
    foot.append(handChartEl("span", "hc__arrow", "★"),
      document.createTextNode(handChartText("Average {n} out of 5", { n: avg.toFixed(1) })));
    root.append(foot);
  } else if (style === "hand") {
    const footer = handChartEl("p", "hc__scribble");
    footer.append(handChartEl("span", "hc__arrow", "↳"),
      document.createTextNode(handChartText("Every answer adds a little ink.")));
    root.append(footer);
  }
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", (poll && poll.question ? poll.question + ". " : "") +
    chartOptions(poll, stats).map(option => option.label + ": " + option.count).join(", "));
  return root;
}

function pollColumnsChart(poll, stats, style) {
  const total = chartTotal(poll, stats);
  const options = chartOptions(poll, stats);
  const root = chartRoot("columns", style, poll, stats);
  const cols = handChartEl("div", "hc__cols");
  const max = options.reduce((m, o) => Math.max(m, Number(o.count) || 0), 0) || 1;

  options.forEach((option, index) => {
    const count = Math.max(0, Number(option.count) || 0);
    const pct = total ? Math.round((count / total) * 100) : 0;
    const col = handChartEl("div", "hc-col");
    col.style.setProperty("--c", chartColor(option.id || option.label || index, index, style));
    col.style.setProperty("--h", String(Math.round((count / max) * 100)));
    col.style.setProperty("--i", String(index));

    const value = handChartEl("span", "hc-col__value");
    value.append(handChartEl("b", null, String(count)), handChartEl("small", null, pct + "%"));
    const track = handChartEl("span", "hc-col__track");
    const fill = handChartEl("span", "hc-col__fill");
    const label = handChartEl("span", "hc-col__label");
    const media = pollMediaNode(option.media, "hc-media--col");
    if (media) label.append(media);
    label.append(document.createTextNode(option.label));
    track.append(fill);
    col.append(value, track, label);
    cols.append(col);
  });

  root.append(cols);
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", (poll && poll.question ? poll.question + ". " : "") +
    options.map(option => option.label + ": " + option.count).join(", "));
  return root;
}

function pollDonutChart(poll, stats, style) {
  const total = chartTotal(poll, stats);
  const options = chartOptions(poll, stats);
  const root = chartRoot("donut", style, poll, stats);
  const wrap = handChartEl("div", "hc__donut");
  const svg = handChartSvg("svg", {
    viewBox: "0 0 42 42",
    class: "hc-donut",
    "aria-hidden": "true"
  });
  const group = handChartSvg("g", { transform: "rotate(-90 21 21)" });
  group.append(handChartSvg("circle", {
    cx: 21, cy: 21, r: 15.9155, fill: "none",
    "stroke-width": 5.4, class: "hc-donut__ring"
  }));

  let offset = 0;
  const live = options.filter(option => (Number(option.count) || 0) > 0);
  live.forEach((option, index) => {
    const pct = total ? ((Number(option.count) || 0) / total) * 100 : 0;
    if (pct <= 0) return;
    group.append(handChartSvg("circle", {
      cx: 21, cy: 21, r: 15.9155, fill: "none",
      stroke: chartColor(option.id || option.label || index, options.indexOf(option), style),
      "stroke-width": 5.4,
      "stroke-dasharray": pct.toFixed(3) + " " + (100 - pct).toFixed(3),
      "stroke-dashoffset": (-offset).toFixed(3),
      pathLength: 100,
      class: "hc-donut__seg"
    }));
    offset += pct;
  });
  svg.append(group);

  const center = handChartEl("div", "hc-donut__center");
  center.append(
    handChartEl("b", null, String(total)),
    handChartEl("span", null, total === 1 ? handChartText("1 response") : handChartText("{n} responses", { n: total }))
  );
  wrap.append(svg, center);
  root.append(wrap);

  const legend = handChartEl("div", "hc__legend");
  options.forEach((option, index) => {
    const row = handChartEl("div", "hc-legend-row");
    const dot = handChartEl("span", "hc-legend-dot");
    dot.style.background = chartColor(option.id || option.label || index, index, style);
    const label = handChartEl("span", "hc-legend-label", option.label);
    const num = handChartEl("span", "hc-legend-num",
      option.count + " · " + (total ? Math.round((Number(option.count) || 0) / total * 100) : 0) + "%");
    row.append(dot, label, num);
    legend.append(row);
  });
  root.append(legend);
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", (poll && poll.question ? poll.question + ". " : "") +
    options.map(option => option.label + ": " + option.count).join(", "));
  return root;
}

function pollLineChart(poll, stats, style) {
  const total = chartTotal(poll, stats);
  const options = chartOptions(poll, stats);
  const root = chartRoot("line", style, poll, stats);
  const responses = (stats.responses || []).slice().sort((a, b) =>
    String(a.updated_at || a.created_at || "").localeCompare(String(b.updated_at || b.created_at || "")));

  const counts = options.map(() => 0);
  const points = options.map(() => []);
  responses.forEach((vote, index) => {
    if (poll && poll.type === "rating") {
      const score = Number(vote.rating) || 0;
      const at = options.findIndex(o => o.label === score + "★");
      if (at >= 0) counts[at]++;
    } else {
      const ids = new Set(vote.choice_ids || []);
      options.forEach((option, i) => { if (ids.has(option.id)) counts[i]++; });
    }
    counts.forEach((count, i) => points[i].push(count));
  });

  const width = 100, height = 56, padX = 3, padY = 5;
  const maxX = Math.max(1, responses.length - 1);
  const maxY = Math.max(1, ...points.flat());
  const svg = handChartSvg("svg", {
    viewBox: "0 0 " + width + " " + (height + 6),
    class: "hc-line",
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  });

  [0, 0.5, 1].forEach(frac => {
    const y = padY + (1 - frac) * (height - padY * 2);
    svg.append(handChartSvg("line", {
      x1: padX, y1: y, x2: width - padX, y2: y, class: "hc-line__grid"
    }));
  });

  options.forEach((option, i) => {
    const pts = points[i];
    if (!pts.length) return;
    const color = chartColor(option.id || option.label || i, i, style);
    const coords = pts.map((value, index) => {
      const x = padX + (index / maxX) * (width - padX * 2);
      const y = height - padY - (value / maxY) * (height - padY * 2);
      return [x, y];
    });
    const d = coords.map(([x, y], index) => (index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2)).join(" ");
    if (style !== "clean") {
      svg.append(handChartSvg("path", {
        d, class: "hc-line__crayon", stroke: color
      }));
    }
    svg.append(handChartSvg("path", { d, class: "hc-line__ink", stroke: color }));
    const last = coords[coords.length - 1];
    svg.append(handChartSvg("circle", {
      cx: last[0], cy: last[1], r: style === "clean" ? 1.35 : 1.7,
      fill: color, class: "hc-line__dot"
    }));
  });

  root.append(svg);

  const legend = handChartEl("div", "hc__legend hc__legend--line");
  options.forEach((option, index) => {
    const row = handChartEl("span", "hc-legend-chip");
    const dot = handChartEl("span", "hc-legend-dot");
    dot.style.background = chartColor(option.id || option.label || index, index, style);
    row.append(dot, handChartEl("span", "hc-legend-label", option.label));
    legend.append(row);
  });
  root.append(legend);
  if (!responses.length) root.append(handChartEl("p", "hc__scribble", handChartText("No answers yet.")));
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", (poll && poll.question ? poll.question + ". " : "") +
    handChartText("Trend across {n} responses", { n: total }));
  return root;
}

const CLOUD_STOPWORDS = new Set(("the a an and or but if then than that this these those of to in on for with " +
  "is are was were be been being it its as at by from we you they he she i our your their my me us them " +
  "not no yes do does did can could should would will just so very too also more most much many some any " +
  "about into over under up down out off again once here there when where why how what which who whom " +
  "ni na mu ku kwa ya yo we cyane cyangwa ariko kandi ntibyo niba nkuko kuri muri").split(" "));

function cloudWords(poll, stats) {
  if (poll && poll.type === "text") {
    const counts = new Map();
    (stats.texts || []).forEach(vote => {
      const words = String(vote.text || "").toLowerCase()
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
        .split(/\s+/);
      words.forEach(word => {
        const clean = word.replace(/^['’-]+|['’-]+$/g, "");
        if (clean.length < 3 || CLOUD_STOPWORDS.has(clean) || /^\d+$/.test(clean)) return;
        counts.set(clean, (counts.get(clean) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 28)
      .map(([label, count]) => ({ label, count }));
  }
  return chartOptions(poll, stats)
    .filter(option => (Number(option.count) || 0) > 0)
    .map(option => ({ label: option.label, count: Number(option.count) || 0 }));
}

function pollWordCloud(poll, stats, style) {
  const root = chartRoot("cloud", style, poll, stats);
  const words = cloudWords(poll, stats);
  const cloud = handChartEl("div", "hc-cloud");
  const max = words.reduce((m, word) => Math.max(m, word.count), 0) || 1;
  const min = words.reduce((m, word) => Math.min(m, word.count), max);

  words.forEach((word, index) => {
    const weight = max === min ? 0.5 : (word.count - min) / (max - min);
    const size = Math.round(13 + weight * 23);
    const span = handChartEl("span", "hc-cloud__word", word.label);
    span.style.fontSize = size + "px";
    span.style.setProperty("--c", chartColor(word.label, index, style));
    const rnd = handChartRnd(handChartSeed(word.label));
    span.style.setProperty("--r", (rnd() * 10 - 5).toFixed(2) + "deg");
    span.style.setProperty("--o", (0.72 + rnd() * 0.28).toFixed(2));
    span.title = word.label + ": " + word.count;
    cloud.append(span);
  });

  if (!words.length) cloud.append(handChartEl("p", "hc__scribble", handChartText("No answers yet.")));
  root.append(cloud);
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", (poll && poll.question ? poll.question + ". " : "") +
    words.slice(0, 10).map(word => word.label).join(", "));
  return root;
}

/* Main entry point. Returns null for open-text polls unless the presenter
   explicitly asks for a word cloud; those keep the handwritten answer list. */
function pollChart(poll, stats, opts) {
  if (!poll || !stats) return null;
  const options = opts || {};
  const style = CHART_STYLES.includes(options.style) ? options.style : "hand";
  let type = CHART_TYPES.includes(options.type) ? options.type : "auto";
  if (type === "auto") type = poll.type === "text" ? "list" : "bars";

  if (type === "cloud") return pollWordCloud(poll, stats, style);
  if (type === "list") return null;
  if (poll.type === "text") return null;
  if (!stats.total) return null;
  if (type === "columns") return pollColumnsChart(poll, stats, style);
  if (type === "donut") return pollDonutChart(poll, stats, style);
  if (type === "line") return pollLineChart(poll, stats, style);
  return pollBarsChart(poll, stats, style);
}

/* Backwards-compatible entry point used by the phone page. */
function pollHandChart(poll, stats) {
  if (!poll || !stats || !stats.total) return null;
  if (poll.type === "text") return null;
  if (poll.type === "rating") return pollHandRating(poll, stats);
  return pollHandBars(poll, stats);
}
