/* Wall exports for the presenter board.

   window.StickyExport.downloadJPEG(payload)
     Draws only the notes view — wall background + notes, no UI — on a
     high-resolution canvas and saves it as a .jpg.

   window.StickyExport.downloadPDF(payload)
     Fills the print-only #print-sheet with every note in natural arrival
     order (oldest first), the event title and the event logo, then opens
     the browser print dialog. "Save as PDF" produces the summary.

   payload = {
     notes: [{ id, author|name, text, category, created_at }],
     categories: [{ key, label, color }],
     brand: { title, subtitle, logo },
     wall: { color, image, dim }
   }                                                                     */

(function () {
  const t = (key, vars) => typeof window.t === "function" ? window.t(key, vars) : key;
  const $ = id => document.getElementById(id);

  const BASE_CELL = 300;
  const GAP = 34;
  const PAD = 54;
  const MAX_DIM = 9000;

  function clean(value) {
    return String(value == null ? "" : value).replace(/\r\n/g, "\n").trim();
  }

  function sortedNotes(list) {
    return (Array.isArray(list) ? list : []).slice().sort((a, b) => {
      const at = String(a?.created_at || "");
      const bt = String(b?.created_at || "");
      return at.localeCompare(bt) || String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  function catFor(payload, key) {
    const list = Array.isArray(payload?.categories) ? payload.categories : [];
    return list.find(c => c.key === key) || { key, label: key || "Note", color: "#f0d88c" };
  }

  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /* ── text helpers ─────────────────────────────────────────── */
  function wrapLines(ctx, text, maxWidth) {
    const words = clean(text).replace(/\s+/g, " ").split(" ").filter(Boolean);
    const lines = [];
    let line = "";

    const pushWord = word => {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
        return;
      }
      lines.push(line);
      line = word;
    };

    words.forEach(word => {
      if (ctx.measureText(word).width <= maxWidth) { pushWord(word); return; }
      /* Very long token (URL, unbroken word): split by characters. */
      let chunk = "";
      [...word].forEach(ch => {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          if (line) { lines.push(line); line = ""; }
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      });
      if (chunk) pushWord(chunk);
    });

    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function fitText(ctx, text, maxWidth, maxHeight, startSize, minSize, family) {
    let size = Math.max(minSize, startSize);
    for (; size >= minSize; size -= 1) {
      ctx.font = "500 " + size + "px " + family + ", cursive";
      const lines = wrapLines(ctx, text, maxWidth);
      const lh = size * 1.06;
      if (lines.length * lh <= maxHeight) return { size, lines, lh };
    }

    ctx.font = "500 " + minSize + "px " + family + ", cursive";
    const lh = minSize * 1.06;
    const maxLines = Math.max(1, Math.floor(maxHeight / lh));
    let lines = wrapLines(ctx, text, maxWidth);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1] || "";
      while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return { size: minSize, lines, lh };
  }

  /* ── canvas: notes-only JPEG ──────────────────────────────── */
  function gridFor(count) {
    const n = Math.max(1, count);
    const cols = n <= 2 ? 1 : n <= 6 ? 2 : n <= 12 ? 3 : n <= 20 ? 4 : 5;
    return { cols, rows: Math.ceil(n / cols) };
  }

  function paintWall(ctx, width, height, wall) {
    const image = wall?.image;
    const color = String(wall?.color || "").trim();
    const dim = Math.max(0, Math.min(90, Number(wall?.dim) || 0));

    if (!color && !image) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#2d2119");
      grad.addColorStop(.55, "#1d1611");
      grad.addColorStop(1, "#120e0b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * .5, height * .12, 0, width * .5, height * .12, height * .8);
      glow.addColorStop(0, "rgba(255,214,150,.13)");
      glow.addColorStop(1, "rgba(255,214,150,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    ctx.fillStyle = color || "#16110d";
    ctx.fillRect(0, 0, width, height);
    if (image) {
      return loadImage(image).then(img => {
        if (!img) return;
        const scale = Math.max(width / img.width, height / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        if (dim) {
          ctx.fillStyle = "rgba(0,0,0," + (dim / 100) + ")";
          ctx.fillRect(0, 0, width, height);
        }
      });
    }
    return Promise.resolve();
  }

  function paintNote(ctx, note, payload, x, y, size, index) {
    const look = typeof noteLook === "function"
      ? noteLook(note)
      : { font: "'Caveat'", fontMul: 1, ink: "#151b29", rot: "0", paper: "#F5F59E", paper2: "#F4F486", fold: "r", foldScale: .15 };
    const author = String(note.author || note.name || "").trim();
    const pad = size * .09;
    const innerW = size - pad * 2;
    const innerH = size - pad * 2;
    const authorH = author ? size * .085 : 0;
    const textH = innerH - authorH;
    const rot = Math.max(-3.6, Math.min(3.6, parseFloat(look.rot) || 0)) * Math.PI / 180;
    const cx = x + size / 2, cy = y + size / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    /* paper shadow */
    ctx.save();
    ctx.shadowColor = "rgba(6,3,1,.42)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 7;
    const paper = ctx.createLinearGradient(x, y, x + size, y + size);
    paper.addColorStop(0, look.paper || "#F5F59E");
    paper.addColorStop(1, look.paper2 || look.paper || "#F4F486");
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, size, size);
    ctx.restore();

    /* faint edge */
    ctx.strokeStyle = "rgba(20,12,4,.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);

    /* fold */
    if (look.fold !== "none") {
      const f = size * Math.max(.1, Math.min(.25, parseFloat(look.foldScale) || .15));
      ctx.beginPath();
      if (look.fold === "l") {
        ctx.moveTo(x, y);
        ctx.lineTo(x + f, y);
        ctx.lineTo(x, y + f);
      } else {
        ctx.moveTo(x + size, y);
        ctx.lineTo(x + size - f, y);
        ctx.lineTo(x + size, y + f);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,.34)";
      ctx.fill();
      ctx.strokeStyle = "rgba(20,12,4,.08)";
      ctx.stroke();
    }

    /* tiny category dot, still part of the note */
    const cat = catFor(payload, note.category);
    ctx.beginPath();
    ctx.arc(x + size - pad * .72, y + pad * .62, size * .022, 0, Math.PI * 2);
    ctx.fillStyle = cat.color || "#f0d88c";
    ctx.fill();

    /* text */
    const family = look.font || "'Caveat'";
    const start = size * .105 * (look.fontMul || 1);
    const min = size * .058 * Math.max(.85, Math.min(1.2, look.fontMul || 1));
    const text = clean(typeof notePlainText === "function" ? notePlainText(note.text) : note.text);
    const fitted = fitText(ctx, text, innerW, textH, start, min, family);
    const wobble = typeof hash === "function" ? hash(note.id || String(index)) : index;
    ctx.fillStyle = look.ink || "#151b29";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = "500 " + fitted.size + "px " + family + ", cursive";
    fitted.lines.forEach((line, i) => {
      const jump = ((wobble >> (i % 8)) & 3) - 1.5;
      ctx.fillText(line, x + pad + jump, y + pad + i * fitted.lh);
    });

    /* author signature */
    if (author) {
      ctx.fillStyle = look.ink || "#151b29";
      ctx.globalAlpha = .72;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.font = "600 " + (size * .058 * Math.max(.9, look.fontMul || 1)) + "px " + family + ", cursive";
      ctx.fillText("— " + author, x + size - pad, y + size - pad * .72);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  async function renderCanvas(payload) {
    const notes = sortedNotes(payload?.notes);
    const { cols, rows } = gridFor(notes.length);
    const width = PAD * 2 + cols * BASE_CELL + (cols - 1) * GAP;
    const height = PAD * 2 + rows * BASE_CELL + (rows - 1) * GAP;
    const scale = Math.max(1.5, Math.min(3, MAX_DIM / Math.max(width, height)));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.scale(scale, scale);

    await paintWall(ctx, width, height, payload?.wall || {});

    notes.forEach((note, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PAD + col * (BASE_CELL + GAP);
      const y = PAD + row * (BASE_CELL + GAP);
      paintNote(ctx, note, payload, x, y, BASE_CELL, i);
    });

    return canvas;
  }

  function fileName(payload, ext) {
    const title = clean(payload?.brand?.title) || "sticky-wall";
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "sticky-wall";
    const date = new Date().toISOString().slice(0, 10);
    return slug + "-notes-" + date + "." + ext;
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadJPEG(payload) {
    if (!payload?.notes?.length) {
      notify(t("Nothing to export yet"));
      return false;
    }
    notify(t("Preparing image…"));
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await renderCanvas(payload);
      const blob = await new Promise((resolve, reject) => {
        try {
          canvas.toBlob(b => b ? resolve(b) : reject(new Error("Empty image")), "image/jpeg", 0.93);
        } catch (err) { reject(err); }
      });
      saveBlob(blob, fileName(payload, "jpg"));
      notify(t("Image saved"));
      return true;
    } catch (err) {
      console.error("Could not export the wall image", err);
      notify(t("Could not save the image"));
      return false;
    }
  }

  /* ── print sheet: PDF ─────────────────────────────────────── */
  function element(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildPrintSheet(payload) {
    const sheet = $("print-sheet");
    if (!sheet) return 0;
    const notes = sortedNotes(payload?.notes);
    const brand = payload?.brand || {};
    sheet.replaceChildren();

    const head = element("header", "print-head");
    if (brand.logo) {
      const logo = document.createElement("img");
      logo.className = "print-logo";
      logo.src = brand.logo;
      logo.alt = "";
      head.appendChild(logo);
    }
    const copy = element("div", "print-copy");
    copy.appendChild(element("p", "print-kicker", t("Wall summary")));
    copy.appendChild(element("h1", "print-title", clean(brand.title) || t("Sticky Wall")));
    if (clean(brand.subtitle)) copy.appendChild(element("p", "print-sub", clean(brand.subtitle)));
    head.appendChild(copy);

    const meta = element("div", "print-meta");
    meta.appendChild(element("b", null, notes.length === 1 ? t("1 note") : t("{n} notes", { n: notes.length })));
    meta.appendChild(element("span", null, new Date().toLocaleDateString()));
    head.appendChild(meta);
    sheet.appendChild(head);

    sheet.appendChild(element("p", "print-section-title", t("All notes in arrival order")));

    if (!notes.length) {
      sheet.appendChild(element("p", "print-empty", t("No notes to show.")));
      return 0;
    }

    const grid = element("div", "print-grid");
    notes.forEach((note, i) => {
      const cat = catFor(payload, note.category);
      const card = element("article", "print-note");
      card.style.setProperty("--pc", cat.color || "#f0d88c");
      card.style.setProperty("--tint", typeof mixColor === "function"
        ? mixColor(cat.color || "#f0d88c", "#FFFFFF", .74)
        : "#fff8dc");

      const top = element("div", "print-note__top");
      top.appendChild(element("span", "print-note__cat", t(cat.label || cat.key)));
      top.appendChild(element("span", "print-note__index", String(i + 1)));
      card.appendChild(top);
      card.appendChild(element("p", "print-note__text", clean(typeof notePlainText === "function" ? notePlainText(note.text) : note.text)));
      const author = String(note.author || note.name || "").trim();
      if (author) card.appendChild(element("p", "print-note__author", "— " + author));
      grid.appendChild(card);
    });
    sheet.appendChild(grid);
    return notes.length;
  }

  async function downloadPDF(payload) {
    if (!payload?.notes?.length) {
      notify(t("Nothing to export yet"));
      return false;
    }
    notify(t("Preparing PDF…"));
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      buildPrintSheet(payload);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      notify(t("Save as PDF in the print dialog"));
      window.print();
      return true;
    } catch (err) {
      console.error("Could not prepare the PDF", err);
      notify(t("Could not save the image"));
      return false;
    }
  }

  function notify(message) {
    const el = $("status-text");
    if (!el) return;
    const previous = el.textContent;
    el.textContent = message;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      if (el.textContent === message) el.textContent = previous;
    }, 2200);
  }

  window.StickyExport = { downloadJPEG, downloadPDF };
})();
