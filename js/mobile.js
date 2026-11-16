(() => {
  const C = window.STICKY_CONFIG || {};
  const MAX = C.MAX_CHARS || 200;
  const $ = id => document.getElementById(id);
  const t = (key, vars) => typeof window.t === "function" ? window.t(key, vars) : key;
  const safe = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
  };
  let name = safe.get("sticky_name") || "", cat = null, last = 0, sending = false;
  let liveSession = null, liveStarting = false, livePendingCancel = null, liveFacing = "environment", liveMicOn = true;
  const IDS = ["s-name", "s-home", "s-cat", "s-write", "s-media", "s-live"];

  const voterKey = (() => {
    let key = safe.get("sticky_voter_key");
    if (!key) {
      key = window.crypto?.randomUUID ? "v-" + crypto.randomUUID()
        : "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      safe.set("sticky_voter_key", key);
    }
    return key;
  })();

  const whoText = () => t("Posting as {name} · change", {
    name: name.length > 22 ? name.slice(0, 21) + "…" : name
  });
  const syncWho = () => {
    const label = whoText();
    ["who", "home-who"].forEach(id => {
      const el = $(id);
      if (el) el.textContent = label;
    });
  };

  const show = id => {
    if (id !== "s-live" && liveSession) stopLive();
    setReactionTray(false);
    IDS.forEach(s => $(s).classList.toggle("hidden", s !== id));
    if (id === "s-home" || id === "s-cat") {
      syncWho();
    }
  };

  const demoNote = $("demo-note");
  if (demoNote) demoNote.hidden = Store.mode !== "demo";

  /* ── dynamic category cards ────────────────────────────────── */
  const catsHost = $("cats");
  const TILTS = [-.8, .6, -.45, .75, -.6, .4, -.3, .55, -.7];

  function card(c, idx) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat";
    b.dataset.cat = c.key;
    b.style.setProperty("--c", c.color);
    b.style.setProperty("--c2", c.color2);
    b.style.setProperty("--tilt", TILTS[idx % TILTS.length] + "deg");
    b.style.animationDelay = (idx * .045).toFixed(3) + "s";
    b.setAttribute("aria-label", t(c.action || c.label) + ". " + t(c.hint));

    const icon = document.createElement("span");
    icon.className = "cat__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = c.emoji;

    const copy = document.createElement("span");
    copy.className = "cat__copy";
    const title = document.createElement("b");
    title.textContent = t(c.action || c.label);
    const sub = document.createElement("small");
    sub.textContent = t(c.hint);
    copy.append(title, sub);

    const go = document.createElement("span");
    go.className = "cat__go";
    go.setAttribute("aria-hidden", "true");
    go.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    b.append(icon, copy, go);
    b.addEventListener("click", () => chooseCategory(c.key));
    return b;
  }

  function renderCategories() {
    if (!catsHost) return;
    catsHost.replaceChildren(...categoryList().map(card));
  }

  function paintWrite(c) {
    if (!c) return;
    const screen = $("s-write");
    screen.style.setProperty("--c", c.color);
    screen.style.setProperty("--c2", c.color2);
    $("cat-pill-label").textContent = t(c.label);
    $("hint").textContent = t(c.hint);
    $("text").placeholder = t(c.hint);
  }

  function chooseCategory(key) {
    const c = CATS[key];
    if (!c) return;
    cat = key;
    $("text").value = "";
    paintWrite(c);
    update();
    refreshLinkHint();
    show("s-write");
    setTimeout(() => $("text").focus(), 90);
  }

  /* ── name ──────────────────────────────────────────────────── */
  $("name").value = name;
  $("f-name").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("name").value.trim();
    if (!v) return;
    name = v;
    safe.set("sticky_name", name);
    syncWho();
    show("s-home");
  });
  $("who").onclick = () => {
    show("s-name");
    setTimeout(() => $("name").focus(), 80);
  };
  $("home-who")?.addEventListener("click", () => {
    show("s-name");
    setTimeout(() => $("name").focus(), 80);
  });

  $("back").onclick = () => { show("s-cat"); cat = null; };
  $("cat-back")?.addEventListener("click", () => { cat = null; show("s-home"); });

  /* ── writing ───────────────────────────────────────────────── */
  const text = $("text"), count = $("count"), send = $("send");
  const linkHint = $("link-hint");
  text.maxLength = MAX;
  function update() {
    const n = text.value.length;
    count.textContent = n + " / " + MAX;
    count.classList.toggle("near", n > MAX * .85);
    send.disabled = !text.value.trim() || sending;
  }
  text.addEventListener("input", update);

  /* ── links behind a word ───────────────────────────────────────
     Select a word, then paste a URL: the note stores the readable
     Markdown form [word](https://…) instead of a long raw address. */
  const URL_ONLY = /^(?:https?:\/\/|mailto:)\S+$/i;
  const selectedWord = () => text.value.slice(text.selectionStart, text.selectionEnd).trim();

  function refreshLinkHint() {
    if (!linkHint) return;
    const word = selectedWord();
    linkHint.hidden = !(word && word.length <= 180 && !/[\r\n]/.test(word));
    linkHint.classList.toggle("is-ready", !linkHint.hidden);
  }

  function embedPastedLink(raw) {
    let href = String(raw || "").trim().replace(/\s+/g, "");
    if (typeof trimLinkTail === "function") href = trimLinkTail(href);
    const start = text.selectionStart, end = text.selectionEnd;
    if (!href || start === end || !URL_ONLY.test(href)) return false;
    const word = text.value.slice(start, end).trim();
    if (!word || word.length > 180 || /[\r\n]/.test(word)) return false;
    if (/^\[[^\]]+\]\([^)]*\)$/.test(word)) return false;
    /* Parentheses would end the Markdown target early, so keep them
       inside the URL as percent escapes. */
    href = href.replace(/[()]/g, ch => ch === "(" ? "%28" : "%29");
    const insert = "[" + word + "](" + href + ")";
    const next = text.value.slice(0, start) + insert + text.value.slice(end);
    if (next.length > MAX) {
      toast(t("That link is too long for this note"), true);
      return false;
    }
    text.value = next;
    const caret = start + insert.length;
    text.setSelectionRange(caret, caret);
    update();
    refreshLinkHint();
    toast(t("Link embedded"));
    return true;
  }

  text.addEventListener("paste", event => {
    const raw = event.clipboardData?.getData("text") || "";
    if (embedPastedLink(raw)) event.preventDefault();
  });
  ["select", "keyup", "mouseup", "touchend", "input"].forEach(type =>
    text.addEventListener(type, refreshLinkHint));
  text.addEventListener("blur", () => setTimeout(refreshLinkHint, 0));

  send.onclick = async () => {
    const body = text.value.trim();
    if (!body || !cat || sending) return;
    if (!name) { show("s-name"); setTimeout(() => $("name").focus(), 80); return; }
    const wait = (C.MIN_SECONDS_BETWEEN_NOTES || 6) * 1000 - (Date.now() - last);
    if (wait > 0) return toast(t("Easy! Wait {n}s", { n: Math.ceil(wait / 1000) }), true);
    sending = true;
    send.disabled = true;
    try {
      await Store.add({ name, category: cat, text: body });
      last = Date.now();
      navigator.vibrate?.(14);
      $("sheet").classList.add("fly");
      toast(t("Stuck on the wall!"));
      setTimeout(() => {
        $("sheet").classList.remove("fly");
        text.value = "";
        update();
        show("s-cat");
        cat = null;
      }, 680);
    } catch (e) {
      console.error(e);
      toast(t("Couldn't send — try again"), true);
    } finally {
      sending = false;
      update();
    }
  };

  /* ── toast ─────────────────────────────────────────────────── */
  function toast(msg, error) {
    document.querySelector(".toast")?.remove();
    const d = document.createElement("div");
    d.className = "toast" + (error ? " is-error" : "");
    const icon = document.createElement("span");
    icon.className = "toast__icon";
    icon.textContent = error ? "!" : "✓";
    const label = document.createElement("span");
    label.textContent = msg;
    d.append(icon, label);
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  }

  /* ── event media: photo or short video ─────────────────────── */
  const mediaBack = $("media-back"), mediaFileInput = $("media-file");
  const mediaPhotoInput = $("media-photo-file"), mediaVideoInput = $("media-video-file");
  const mediaPhotoBtn = $("media-photo"), mediaVideoBtn = $("media-video");
  const mediaSource = $("media-source"), mediaPick = $("media-pick");
  const mediaPreview = $("media-preview"), mediaSend = $("media-send"), mediaNote = $("media-note");
  const mediaInputs = [mediaFileInput, mediaPhotoInput, mediaVideoInput].filter(Boolean);
  const MAX_MEDIA = 50 * 1024 * 1024, MAX_VIDEO_SECONDS = 15;
  const VIDEO_COMPRESS_OVER = 6 * 1024 * 1024;
  let mediaState = null, mediaSending = false, mediaToken = 0;

  function setMediaNote(text) {
    if (!mediaNote) return;
    mediaNote.textContent = text || "";
    mediaNote.hidden = !text;
  }

  function clearMediaSelection() {
    mediaToken++;
    mediaState?.cancel?.();
    if (mediaState?.url) URL.revokeObjectURL(mediaState.url);
    mediaState = null;
    if (mediaPreview) { mediaPreview.replaceChildren(); mediaPreview.hidden = true; }
    if (mediaSource) mediaSource.hidden = false;
    if (mediaPick) mediaPick.hidden = false;
    if (mediaSend) mediaSend.disabled = true;
    setMediaNote("");
    mediaInputs.forEach(input => { input.value = ""; });
  }

  function readVideoMeta(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const meta = { duration: Number(video.duration) || 0, width: video.videoWidth || 0, height: video.videoHeight || 0 };
        URL.revokeObjectURL(url);
        resolve(meta);
      };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this video")); };
      video.src = url;
    });
  }

  function pickVideoMime() {
    if (typeof MediaRecorder === "undefined") return "";
    return [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ].find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  /* Re-record a too-large clip at a lower bitrate so it uploads faster.
     Playback runs in real time, so this returns immediately and the send
     button waits for the result. Any problem keeps the original file. */
  function shrinkVideo(file, meta, onProgress) {
    let stopped = false;
    let stopNow = () => {};
    let resolvePromise = () => {};
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
      const finish = result => {
        if (stopped) return;
        stopped = true;
        stopNow();
        resolve(result);
      };
      const original = { file, width: meta.width, height: meta.height, duration: meta.duration, optimized: false };
      const mime = file.size >= VIDEO_COMPRESS_OVER && typeof HTMLMediaElement.prototype.captureStream === "function"
        ? pickVideoMime()
        : "";
      if (!mime) { finish(original); return; }

      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.preload = "auto";
      video.playsInline = true;
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.style.cssText = "position:fixed;left:-2px;top:-2px;width:2px;height:2px;opacity:0;pointer-events:none";
      document.body.appendChild(video);

      let recorder = null, chunks = [], timer = 0;
      stopNow = () => {
        clearTimeout(timer);
        video.ontimeupdate = video.onended = video.onerror = null;
        try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch {}
        try { video.pause(); } catch {}
        video.removeAttribute("src");
        try { video.load(); } catch {}
        video.remove();
        URL.revokeObjectURL(url);
      };
      const giveUp = () => finish(original);

      video.onerror = giveUp;
      video.onended = () => {
        try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { giveUp(); }
      };
      video.onloadeddata = () => {
        try {
          const stream = video.captureStream();
          if (!stream || !stream.getVideoTracks().length) { giveUp(); return; }
          const pixels = (meta.width || 0) * (meta.height || 0);
          const videoBitsPerSecond = pixels >= 1920 * 1080 ? 2200000 : pixels >= 1280 * 720 ? 1600000 : 1000000;
          recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond, audioBitsPerSecond: 96000 });
          recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
          recorder.onerror = giveUp;
          recorder.onstop = () => {
            if (stopped) return;
            try {
              const blob = new Blob(chunks, { type: recorder.mimeType || mime });
              if (!blob.size || blob.size >= file.size * 0.9) { finish(original); return; }
              const ext = /mp4/i.test(blob.type) ? ".mp4" : ".webm";
              const base = String(file.name || "video").replace(/\.[a-z0-9]+$/i, "") || "video";
              finish({
                file: new File([blob], base + ext, { type: blob.type }),
                width: meta.width,
                height: meta.height,
                duration: Math.min(meta.duration || 0, MAX_VIDEO_SECONDS),
                optimized: true
              });
            } catch (err) {
              finish(original);
            }
          };
          recorder.start(250);
          video.ontimeupdate = () => {
            if (meta.duration) onProgress?.(Math.max(0, Math.min(1, video.currentTime / meta.duration)));
          };
          timer = setTimeout(() => {
            try { if (recorder.state !== "inactive") recorder.stop(); } catch { giveUp(); }
          }, Math.max(4000, (Math.min(meta.duration || MAX_VIDEO_SECONDS, MAX_VIDEO_SECONDS) + 3) * 1000));
          const played = video.play();
          if (played && typeof played.catch === "function") played.catch(giveUp);
        } catch (err) {
          giveUp();
        }
      };
    });
    return {
      promise,
      cancel() {
        if (stopped) return;
        stopped = true;
        stopNow();
        resolvePromise(null);
      }
    };
  }

  function shrinkImage(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 2400;
        const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
        if (scale === 1 && file.size < 2.4 * 1024 * 1024) {
          URL.revokeObjectURL(url);
          resolve({ file, width: img.width, height: img.height });
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob || blob.size >= file.size) {
            resolve({ file, width: img.width, height: img.height });
            return;
          }
          const base = String(file.name || "photo").replace(/\.[a-z0-9]+$/i, "") || "photo";
          resolve({
            file: new File([blob], base + ".jpg", { type: "image/jpeg" }),
            width: canvas.width,
            height: canvas.height
          });
        }, "image/jpeg", .86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, width: 0, height: 0 }); };
      img.src = url;
    });
  }

  function paintMediaPreview() {
    if (!mediaState || !mediaPreview) return;
    mediaPreview.replaceChildren();
    const node = document.createElement(mediaState.kind === "video" ? "video" : "img");
    if (mediaState.kind === "video") {
      node.muted = true;
      node.loop = true;
      node.autoplay = true;
      node.playsInline = true;
      node.setAttribute("playsinline", "");
    } else {
      node.alt = t("Preview");
    }
    node.src = mediaState.url;

    const badge = document.createElement("span");
    badge.className = "media-preview__badge";
    const seconds = mediaState.kind === "video" && Number.isFinite(mediaState.duration)
      ? Math.max(1, Math.round(mediaState.duration))
      : 0;
    badge.textContent = mediaState.kind === "video"
      ? t("Video") + (seconds ? " · " + seconds + "s" : "")
      : t("Photo");

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "media-preview__clear";
    clear.textContent = "×";
    clear.setAttribute("aria-label", t("Choose another"));
    clear.addEventListener("click", () => clearMediaSelection());

    mediaPreview.append(node, badge, clear);
    mediaPreview.hidden = false;
    if (mediaSource) mediaSource.hidden = true;
    mediaPick.hidden = true;
    mediaSend.disabled = !name || mediaSending;
  }

  async function chooseMedia(file) {
    if (!file) return;
    const type = String(file.type || "");
    const isVideo = /^video\//.test(type);
    if (!isVideo && !/^image\//.test(type)) { toast(t("Choose a photo or video"), true); return; }
    if (file.size > MAX_MEDIA) { toast(t("Too large. Choose a file under 50 MB."), true); return; }
    const token = ++mediaToken;
    mediaState?.cancel?.();
    if (mediaState?.url) URL.revokeObjectURL(mediaState.url);
    mediaState = null;
    try {
      if (isVideo) {
        const meta = await readVideoMeta(file);
        if (token !== mediaToken) return;
        if (meta.duration > MAX_VIDEO_SECONDS + .5) {
          toast(t("Videos must be 15 seconds or shorter"), true);
          return;
        }
        const state = {
          file,
          kind: "video",
          width: meta.width,
          height: meta.height,
          duration: meta.duration,
          url: URL.createObjectURL(file),
          optimized: false,
          preparing: false,
          prepared: null
        };
        mediaState = state;
        if (file.size >= VIDEO_COMPRESS_OVER) {
          state.preparing = true;
          const job = shrinkVideo(file, meta, ratio => {
            if (token === mediaToken && mediaSending) {
              setMediaNote(t("Sending…") + " " + Math.round(ratio * 40) + "%");
            }
          });
          state.cancel = job.cancel;
          state.prepared = job.promise;
        }
      } else {
        const shrunk = await shrinkImage(file);
        if (token !== mediaToken) return;
        mediaState = { file: shrunk.file, kind: "photo", width: shrunk.width, height: shrunk.height, url: URL.createObjectURL(shrunk.file) };
      }
      paintMediaPreview();
    } catch (err) {
      console.error("Could not read the media file", err);
      toast(t("Could not read this file"), true);
    }
  }

  mediaBack?.addEventListener("click", () => { clearMediaSelection(); show("s-home"); });
  mediaPhotoBtn?.addEventListener("click", () => mediaPhotoInput?.click());
  mediaVideoBtn?.addEventListener("click", () => mediaVideoInput?.click());
  mediaPick?.addEventListener("click", () => mediaFileInput?.click());
  mediaInputs.forEach(input => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      input.value = "";
      chooseMedia(file);
    });
  });
  mediaSend?.addEventListener("click", async () => {
    if (!mediaState || mediaSending) return;
    if (!name) { show("s-name"); return; }
    mediaSending = true;
    const token = mediaToken;
    const state = mediaState;
    const label = mediaSend.textContent;
    mediaSend.disabled = true;
    mediaSend.textContent = t("Sending…");
    setMediaNote(t("Sending…"));
    try {
      if (state.prepared) {
        const prepared = await state.prepared;
        state.prepared = null;
        if (prepared && token === mediaToken && mediaState === state) {
          state.file = prepared.file;
          state.width = prepared.width;
          state.height = prepared.height;
          state.duration = prepared.duration;
          state.optimized = prepared.optimized;
        }
      }
      if (token !== mediaToken || !mediaState || mediaState !== state) return;
      const origin = state.preparing ? 40 : 0;
      const span = state.preparing ? 60 : 100;
      await Store.addMedia({
        file: state.file,
        author: name,
        kind: state.kind,
        width: state.width,
        height: state.height,
        onProgress: (loaded, total) => {
          if (token !== mediaToken || mediaState !== state) return;
          const ratio = total ? Math.min(1, loaded / total) : 0;
          setMediaNote(t("Sending…") + " " + Math.round(origin + ratio * span) + "%");
        }
      });
      navigator.vibrate?.(14);
      toast(t("Sent to the big screen"));
      clearMediaSelection();
      setTimeout(() => show("s-home"), 700);
    } catch (err) {
      console.error("Could not send the media", err);
      setMediaNote("");
      toast(t("Couldn't send — try again"), true);
    } finally {
      mediaSending = false;
      mediaSend.textContent = label;
      mediaSend.disabled = !mediaState;
    }
  });

  /* ── live from the phone camera ────────────────────────────── */
  const liveBack = $("live-back");
  const livePreview = $("live-preview"), livePlaceholder = $("live-placeholder");
  const liveBadge = $("live-badge"), liveStatus = $("live-status");
  const liveStart = $("live-start"), liveStop = $("live-stop");
  const liveTools = $("live-tools"), liveFlip = $("live-flip"), liveMic = $("live-mic");
  const liveFallback = $("live-fallback");
  const phoneReactions = $("phone-reactions");
  const reactFab = $("react-fab"), reactOpen = $("react-open"), reactTray = $("react-tray");
  const REACTION_CHOICES = [
    "👍", "❤️", "😂", "🎉", "👏",
    "🔥", "😍", "🥳", "😮", "😢",
    "🙌", "💯", "🙏", "😊", "🤩",
    "💡", "👀", "✅", "🤔", "😅"
  ];
  let reactTrayTimer = 0;

  const LIVE_STATUS = {
    idle: "Camera off",
    asking: "Asking the presenter…",
    starting: "Opening the camera…",
    waiting: "Waiting for the board…",
    live: "You're live",
    reconnecting: "Reconnecting…",
    trouble: "This network may block live video. Record a short video instead?",
    ended: "Live ended",
    denied: "The presenter did not allow the camera",
    cancelled: "Request cancelled",
    expired: "The request expired. Ask again.",
    error: "Could not start the camera",
    unsupported: "Live video is not supported here"
  };

  function setLiveStatus(state) {
    if (!liveStatus) return;
    liveStatus.textContent = t(LIVE_STATUS[state] || state);
    liveStatus.dataset.state = state;
    if (liveBadge) liveBadge.hidden = state !== "live" && state !== "reconnecting";
    if (liveFallback) {
      liveFallback.hidden = !(state === "trouble" || state === "error" || state === "reconnecting" || state === "unsupported");
    }
    const note = document.querySelector("#s-live .live-request-note");
    if (note) {
      note.hidden = !(state === "idle" || state === "asking" || state === "denied" || state === "cancelled" || state === "expired" || state === "unsupported");
    }
  }

  function syncLiveControls() {
    const active = !!liveSession || liveStarting;
    if (liveStart) liveStart.hidden = active;
    if (liveStop) {
      liveStop.hidden = !liveSession && !livePendingCancel;
      liveStop.textContent = livePendingCancel ? t("Cancel request") : t("Stop live");
    }
    if (liveTools) liveTools.hidden = !liveSession;
  }

  function showPhoneReaction(reaction) {
    if (!phoneReactions || !reaction?.emoji) return;
    const item = document.createElement("span");
    item.className = "phone-reaction";
    item.textContent = reaction.emoji;
    item.style.setProperty("--x", (16 + Math.random() * 68).toFixed(1) + "%");
    item.style.setProperty("--drift", (Math.random() * 44 - 22).toFixed(0) + "px");
    item.style.setProperty("--scale", (1 + Math.random() * .5).toFixed(2));
    phoneReactions.append(item);
    navigator.vibrate?.(10);
    setTimeout(() => item.remove(), 2100);
  }

  function setReactionTray(open) {
    if (!reactTray || !reactOpen) return;
    clearTimeout(reactTrayTimer);
    reactTray.hidden = !open;
    reactOpen.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      reactTrayTimer = setTimeout(() => setReactionTray(false), 6500);
    }
  }

  function buildReactionTray() {
    if (!reactTray || reactTray.children.length) return;
    reactTray.replaceChildren(...REACTION_CHOICES.map(emoji => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "react-tray__item";
      button.textContent = emoji;
      button.addEventListener("click", () => sendReaction(emoji));
      return button;
    }));
  }

  async function sendReaction(emoji) {
    if (!window.StickyLive?.react) {
      toast(t("Couldn't send — try again"), true);
      return;
    }
    showPhoneReaction({ emoji });
    clearTimeout(reactTrayTimer);
    reactTrayTimer = setTimeout(() => setReactionTray(false), 4200);
    try {
      const sent = await window.StickyLive.react({ emoji, author: name });
      if (!sent) toast(t("Couldn't send — try again"), true);
    } catch (err) {
      console.warn("Could not send the reaction", err);
      toast(t("Couldn't send — try again"), true);
    }
  }

  function showLivePreview(on) {
    if (livePreview) livePreview.hidden = !on;
    if (livePlaceholder) livePlaceholder.hidden = on;
  }

  function applyLiveMic() {
    if (!liveSession) return;
    liveSession.stream.getAudioTracks().forEach(track => { track.enabled = liveMicOn; });
    if (liveMic) {
      const label = liveMic.querySelector("span") || liveMic;
      label.textContent = t(liveMicOn ? "Mute mic" : "Unmute mic");
      liveMic.setAttribute("aria-pressed", liveMicOn ? "true" : "false");
      liveMic.classList.toggle("is-off", !liveMicOn);
    }
  }

  async function startLive() {
    if (liveStarting || liveSession) return;
    if (!name) { show("s-name"); setTimeout(() => $("name").focus(), 80); return; }
    if (!window.StickyLive || !navigator.mediaDevices?.getUserMedia) {
      setLiveStatus("unsupported");
      toast(t(LIVE_STATUS.unsupported), true);
      return;
    }
    liveStarting = true;
    livePendingCancel = null;
    if (liveStart) { liveStart.disabled = true; liveStart.textContent = t("Asking…"); }
    setLiveStatus("asking");
    showLivePreview(false);
    syncLiveControls();
    try {
      const session = await StickyLive.stream({
        author: name,
        facingMode: liveFacing,
        onStatus: (state, detail) => {
          if (state === "asking") {
            livePendingCancel = detail?.cancel || null;
            syncLiveControls();
            setLiveStatus("asking");
            return;
          }
          if (!liveSession && !liveStarting) return;
          if (state === "starting") {
            /* approved: the cancel offer no longer applies */
            livePendingCancel = null;
            syncLiveControls();
            setLiveStatus("starting");
          }
          else if (state === "live") setLiveStatus("live");
          else if (state === "reconnecting") setLiveStatus("reconnecting");
          else if (state === "trouble") setLiveStatus("trouble");
          else if (state === "waiting" || state === "connecting") setLiveStatus("waiting");
          else if (state === "ended") setLiveStatus("ended");
          else if (state === "denied" || state === "cancelled" || state === "expired") setLiveStatus(state);
        }
      });
      liveSession = session;
      livePendingCancel = null;
      showLivePreview(true);
      if (livePreview) {
        livePreview.srcObject = session.stream;
        livePreview.muted = true;
        livePreview.classList.toggle("is-front", liveFacing === "user");
        const started = livePreview.play();
        if (started?.catch) started.catch(() => {});
      }
      setLiveStatus("waiting");
      applyLiveMic();
      syncLiveControls();
      navigator.vibrate?.(12);
    } catch (err) {
      const code = err?.code;
      console.warn("Could not go live", err);
      livePendingCancel = null;
      showLivePreview(false);
      if (code === "denied" || code === "cancelled" || code === "expired") {
        setLiveStatus(code);
        toast(t(LIVE_STATUS[code]), code !== "cancelled");
      } else {
        setLiveStatus("error");
        toast(t(LIVE_STATUS.error), true);
      }
    } finally {
      liveStarting = false;
      if (liveStart) { liveStart.disabled = false; liveStart.textContent = t("Start live"); }
      syncLiveControls();
    }
  }

  function stopLive() {
    if (!liveSession) {
      if (livePendingCancel) {
        const cancel = livePendingCancel;
        livePendingCancel = null;
        try { cancel(); } catch {}
      }
      showLivePreview(false);
      if (!livePendingCancel) setLiveStatus("idle");
      syncLiveControls();
      return;
    }
    const session = liveSession;
    liveSession = null;
    try { session.stop(); } catch (err) { console.warn(err); }
    if (livePreview) {
      livePreview.srcObject = null;
      livePreview.hidden = true;
    }
    if (phoneReactions) phoneReactions.replaceChildren();
    showLivePreview(false);
    setLiveStatus("ended");
    syncLiveControls();
  }

  /* ── module home navigation ────────────────────────────────── */
  $("home-notes")?.addEventListener("click", () => { cat = null; show("s-cat"); });
  $("home-media")?.addEventListener("click", () => {
    if (!name) { show("s-name"); setTimeout(() => $("name").focus(), 80); return; }
    clearMediaSelection();
    show("s-media");
  });
  $("home-stream")?.addEventListener("click", () => {
    if (!name) { show("s-name"); setTimeout(() => $("name").focus(), 80); return; }
    if (liveSession) { show("s-live"); return; }
    setLiveStatus("idle");
    showLivePreview(false);
    syncLiveControls();
    show("s-live");
  });

  liveBack?.addEventListener("click", () => { stopLive(); show("s-home"); });
  liveStart?.addEventListener("click", startLive);
  liveStop?.addEventListener("click", stopLive);
  liveFlip?.addEventListener("click", async () => {
    if (!liveSession || liveStarting) return;
    const next = liveFacing === "environment" ? "user" : "environment";
    try {
      const stream = await liveSession.swapCamera(next);
      liveFacing = next;
      if (livePreview) {
        livePreview.srcObject = stream;
        livePreview.muted = true;
        livePreview.classList.toggle("is-front", liveFacing === "user");
        const started = livePreview.play();
        if (started?.catch) started.catch(() => {});
      }
      navigator.vibrate?.(8);
    } catch (err) {
      console.warn("Could not flip the live camera", err);
      toast(t("Could not switch the camera"), true);
    }
  });
  liveMic?.addEventListener("click", () => {
    liveMicOn = !liveMicOn;
    applyLiveMic();
  });
  liveFallback?.addEventListener("click", () => {
    stopLive();
    clearMediaSelection();
    show("s-media");
  });
  reactOpen?.addEventListener("click", () => {
    buildReactionTray();
    setReactionTray(!!reactTray?.hidden);
  });
  document.addEventListener("click", event => {
    if (!reactTray || reactTray.hidden) return;
    if (!event.target.closest?.("#react-fab")) setReactionTray(false);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && liveSession) {
      stopLive();
      toast(t(LIVE_STATUS.ended));
    }
  });
  window.addEventListener("pagehide", () => {
    if (liveSession) {
      const session = liveSession;
      liveSession = null;
      try { session.stop(); } catch {}
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (reactTray && !reactTray.hidden) { setReactionTray(false); return; }
    if (mediaPreview && !$("s-media").classList.contains("hidden")) { clearMediaSelection(); show("s-home"); return; }
    if (!$("s-live").classList.contains("hidden")) { show("s-home"); return; }
    if (!$("s-write").classList.contains("hidden")) { show("s-cat"); cat = null; return; }
    if (!$("s-cat").classList.contains("hidden")) { show("s-home"); cat = null; }
  });

  /* ── colour theme ──────────────────────────────────────────── */
  const THEME_KEY = "sticky_theme";
  const THEMES = ["classic", "ocean", "mint", "blush", "grape"];
  const THEME_META = {
    classic: "#1b120d",
    ocean: "#0b1420",
    mint: "#0a1710",
    blush: "#1b0c13",
    grape: "#120a1c"
  };
  const themeTray = $("theme-tray");
  const themeToggles = ["theme-open-name", "theme-open-home"].map($).filter(Boolean);

  function applyTheme(name) {
    const theme = THEMES.includes(name) ? name : "classic";
    document.documentElement.dataset.theme = theme;
    safe.set(THEME_KEY, theme);
    themeTray?.querySelectorAll(".theme-swatch").forEach(button => {
      button.setAttribute("aria-checked", button.dataset.theme === theme ? "true" : "false");
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META[theme]);
  }

  function setThemeTray(open) {
    if (!themeTray) return;
    themeTray.hidden = !open;
    themeToggles.forEach(button => button.setAttribute("aria-expanded", open ? "true" : "false"));
  }

  themeToggles.forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    setThemeTray(themeTray ? themeTray.hidden : false);
  }));
  themeTray?.querySelectorAll(".theme-swatch").forEach(button => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.theme);
      setThemeTray(false);
    });
  });
  document.addEventListener("click", event => {
    if (!themeTray || themeTray.hidden) return;
    if (!event.target.closest?.("#theme-tray, .theme-toggle")) setThemeTray(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !themeTray || themeTray.hidden) return;
    event.stopPropagation();
    setThemeTray(false);
  }, true);
  applyTheme(safe.get(THEME_KEY) || "classic");

  /* ── boot: load the presenter's category plan ──────────────── */
  applyCategories(DEFAULT_CATEGORIES);
  renderCategories();
  update();
  if (name) { syncWho(); show("s-home"); } else show("s-name");

  Store.getCategories().then(list => {
    applyCategories(list);
    renderCategories();
    if (cat && !CATS[cat]) {
      cat = null;
      if (!$("s-write").classList.contains("hidden")) show("s-cat");
    } else if (cat) paintWrite(CATS[cat]);
  }).catch(err => console.error("Could not load categories", err));

  Store.subscribeCategories(list => {
    applyCategories(list);
    renderCategories();
    if (cat && !CATS[cat]) {
      cat = null;
      if (!$("s-write").classList.contains("hidden")) show("s-cat");
    } else if (cat) {
      paintWrite(CATS[cat]);
    }
  });

})();
