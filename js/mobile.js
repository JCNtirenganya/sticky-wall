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
  const IDS = ["s-name", "s-cat", "s-write", "s-polls", "s-poll", "s-media"];

  const voterKey = (() => {
    let key = safe.get("sticky_voter_key");
    if (!key) {
      key = window.crypto?.randomUUID ? "v-" + crypto.randomUUID()
        : "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      safe.set("sticky_voter_key", key);
    }
    return key;
  })();

  const show = id => {
    IDS.forEach(s => $(s).classList.toggle("hidden", s !== id));
    if (id === "s-cat") {
      $("who").textContent = whoText();
      updatePollBanner();
    }
    if (id === "s-polls") renderPollList();
  };
  const whoText = () => t("Posting as {name} · change", {
    name: name.length > 22 ? name.slice(0, 21) + "…" : name
  });

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
    $("who").textContent = whoText();
    show("s-cat");
  });
  $("who").onclick = () => {
    show("s-name");
    setTimeout(() => $("name").focus(), 80);
  };

  $("back").onclick = () => { show("s-cat"); cat = null; };

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
  const mediaOpen = $("media-open"), mediaBack = $("media-back"), mediaFileInput = $("media-file");
  const mediaPhotoInput = $("media-photo-file"), mediaVideoInput = $("media-video-file");
  const mediaPhotoBtn = $("media-photo"), mediaVideoBtn = $("media-video");
  const mediaSource = $("media-source"), mediaPick = $("media-pick");
  const mediaPreview = $("media-preview"), mediaSend = $("media-send"), mediaNote = $("media-note");
  const mediaInputs = [mediaFileInput, mediaPhotoInput, mediaVideoInput].filter(Boolean);
  const MAX_MEDIA = 50 * 1024 * 1024, MAX_VIDEO_SECONDS = 30;
  let mediaState = null, mediaSending = false;

  function clearMediaSelection() {
    if (mediaState?.url) URL.revokeObjectURL(mediaState.url);
    mediaState = null;
    if (mediaPreview) { mediaPreview.replaceChildren(); mediaPreview.hidden = true; }
    if (mediaSource) mediaSource.hidden = false;
    if (mediaPick) mediaPick.hidden = false;
    if (mediaSend) mediaSend.disabled = true;
    if (mediaNote) { mediaNote.textContent = ""; mediaNote.hidden = true; }
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
    mediaState = null;
    try {
      if (isVideo) {
        const meta = await readVideoMeta(file);
        if (meta.duration > MAX_VIDEO_SECONDS + .5) {
          toast(t("Videos must be 30 seconds or shorter"), true);
          return;
        }
        mediaState = { file, kind: "video", width: meta.width, height: meta.height, duration: meta.duration, url: URL.createObjectURL(file) };
      } else {
        const shrunk = await shrinkImage(file);
        mediaState = { file: shrunk.file, kind: "photo", width: shrunk.width, height: shrunk.height, url: URL.createObjectURL(shrunk.file) };
      }
      paintMediaPreview();
    } catch (err) {
      console.error("Could not read the media file", err);
      toast(t("Could not read this file"), true);
    }
  }

  mediaOpen?.addEventListener("click", () => {
    if (!name) { show("s-name"); setTimeout(() => $("name").focus(), 80); return; }
    clearMediaSelection();
    show("s-media");
  });
  mediaBack?.addEventListener("click", () => { clearMediaSelection(); show("s-cat"); });
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
    const label = mediaSend.textContent;
    mediaSend.disabled = true;
    mediaSend.textContent = t("Sending…");
    try {
      await Store.addMedia({
        file: mediaState.file,
        author: name,
        kind: mediaState.kind,
        width: mediaState.width,
        height: mediaState.height
      });
      navigator.vibrate?.(14);
      toast(t("Sent to the big screen"));
      clearMediaSelection();
      setTimeout(() => show("s-cat"), 700);
    } catch (err) {
      console.error("Could not send the media", err);
      toast(t("Couldn't send — try again"), true);
    } finally {
      mediaSending = false;
      mediaSend.textContent = label;
      mediaSend.disabled = !mediaState;
    }
  });

  /* ── live polls ────────────────────────────────────────────── */
  const pollBanner = $("poll-banner");
  const pollBannerTitle = $("poll-banner-title"), pollBannerSub = $("poll-banner-sub");
  const pollListEl = $("poll-list"), pollListEmpty = $("poll-list-empty");
  const pollScreen = $("s-poll");
  const polls = [], votes = [];
  let activePollId = null, pollDraft = null, pollSending = false;

  const pollEl = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const pollSorted = () => polls.slice().sort((a, b) =>
    (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at)));
  const pollVisible = () => pollSorted().filter(p => p.status !== "draft");
  const pollMyVote = poll => pollVoteFor(votes, poll?.id, voterKey);
  const pollActive = () => polls.find(p => p.id === activePollId) || null;
  const pollAnsweredCount = () => pollVisible().filter(p => pollMyVote(p)).length;

  function upsertPollLocal(raw) {
    const poll = normalisePoll(raw);
    const i = polls.findIndex(p => p.id === poll.id);
    if (i >= 0) polls[i] = poll; else polls.push(poll);
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
    if (i >= 0) votes[i] = vote; else votes.push(vote);
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

  function pollRefreshChrome() {
    updatePollBanner();
    if (!$("s-polls").classList.contains("hidden")) renderPollList();
    if (pollScreen && !pollScreen.classList.contains("hidden")) renderPollScreen();
  }

  function updatePollBanner() {
    if (!pollBanner) return;
    const visible = pollVisible();
    if (!visible.length) { pollBanner.hidden = true; return; }
    const open = visible.filter(p => p.status === "open");
    const pending = open.filter(p => !pollMyVote(p)).length;
    pollBanner.hidden = false;
    if (pollBannerTitle) {
      pollBannerTitle.textContent = open.length
        ? open.length === 1 ? open[0].question : t("{n} live polls", { n: open.length })
        : t("Polls are closed");
    }
    if (pollBannerSub) {
      pollBannerSub.textContent = !open.length
        ? t("Tap to see the results")
        : pending
          ? pending === 1 ? t("1 waiting for your answer") : t("{n} waiting for your answers", { n: pending })
          : t("You answered · tap to update");
    }
  }

  function renderPollList() {
    if (!pollListEl) return;
    const list = pollVisible();
    if (pollListEmpty) pollListEmpty.hidden = list.length > 0;
    if (!list.length) { pollListEl.replaceChildren(); return; }

    pollListEl.replaceChildren(...list.map(poll => {
      const stats = pollStats(poll, votes);
      const mine = pollMyVote(poll);
      const card = pollEl("button", "poll-list-card" + (poll.status === "closed" ? " is-closed" : ""));
      card.type = "button";
      card.style.setProperty("--pc", pollCategoryColor(poll.category));
      card.setAttribute("aria-label", poll.question + ", " + pollType(poll.type).label + (mine ? ", " + t("answered") : ""));

      const top = pollEl("span", "poll-list-card__top");
      top.append(
        pollEl("span", "poll-chip", t(poll.category)),
        pollEl("span", "poll-status poll-status--" + poll.status, pollStatus(poll).label)
      );
      if (mine) top.append(pollEl("span", "poll-answered", t("✓ Answered")));

      const question = pollEl("b", "poll-list-card__q", poll.question);
      const meta = pollEl("span", "poll-list-card__meta");
      meta.textContent = pollType(poll.type).label + " · " +
        (stats.total === 1 ? t("1 response") : t("{n} responses", { n: stats.total }));

      card.append(top, question, meta);
      card.addEventListener("click", () => openPoll(poll.id));
      return card;
    }));
  }

  function openPoll(id) {
    const poll = polls.find(p => p.id === id);
    if (!poll) return;
    activePollId = id;
    const mine = pollMyVote(poll);
    pollDraft = mine
      ? { choice_ids: [...(mine.choice_ids || [])], rating: mine.rating || null, text: mine.text || "" }
      : { choice_ids: [], rating: null, text: "" };
    show("s-poll");
    renderPollScreen();
  }

  function pollDraftComplete() {
    const poll = pollActive();
    return !!poll && pollVoteIsComplete(poll, pollDraft);
  }

  function syncPollSubmit() {
    const poll = pollActive();
    const submit = $("poll-submit");
    if (!submit) return;
    const mine = pollMyVote(poll);
    const open = poll?.status === "open";
    submit.hidden = !open;
    submit.disabled = !open || pollSending || !pollDraftComplete();
    submit.textContent = pollSending
      ? t("Sending…")
      : mine ? t("Update my answer") : t("Send answer");
  }

  function pollChoiceButton(poll, option, multiple) {
    const chosen = (pollDraft.choice_ids || []).includes(option.id);
    const button = pollEl("button", "poll-choice" + (chosen ? " is-chosen" : ""));
    button.type = "button";
    button.setAttribute("aria-pressed", chosen ? "true" : "false");
    button.dataset.choice = option.id;

    const mark = pollEl("span", "poll-choice__mark", multiple ? (chosen ? "✓" : "") : "");
    const media = typeof pollMediaNode === "function" ? pollMediaNode(option.media, "poll-choice__media") : null;
    const label = pollEl("span", "poll-choice__label", option.label);
    if (media) button.append(mark, media, label);
    else button.append(mark, label);

    button.addEventListener("click", () => {
      if (!pollDraft || poll.status !== "open") return;
      if (multiple) {
        const max = Math.max(1, Number(poll.maxChoices) || poll.options.length || 1);
        const current = pollDraft.choice_ids || [];
        const at = current.indexOf(option.id);
        if (at >= 0) current.splice(at, 1);
        else if (current.length >= max) {
          toast(t("Pick up to {n}", { n: max }), true);
          return;
        } else current.push(option.id);
        pollDraft.choice_ids = current;
      } else {
        pollDraft.choice_ids = [option.id];
      }
      renderPollAnswer();
      syncPollSubmit();
    });
    return button;
  }

  function renderPollAnswer() {
    const host = $("poll-answer");
    const poll = pollActive();
    if (!host || !poll) return;
    host.replaceChildren();

    if (poll.status !== "open") {
      host.append(pollEl("p", "poll-locked",
        poll.status === "closed" ? t("This poll is closed. Answers are locked.") : t("This poll is not open yet.")));
      return;
    }

    const type = poll.type;
    if (type === "text") {
      const wrap = pollEl("div", "poll-text-wrap");
      const area = document.createElement("textarea");
      area.className = "poll-textarea";
      area.maxLength = MAX_POLL_TEXT;
      area.rows = 4;
      area.placeholder = t("Write a short answer…");
      area.value = pollDraft?.text || "";
      area.setAttribute("aria-label", t("Your answer"));
      const counter = pollEl("span", "poll-text-count", area.value.length + " / " + MAX_POLL_TEXT);
      area.addEventListener("input", () => {
        if (!pollDraft) return;
        pollDraft.text = area.value;
        counter.textContent = area.value.length + " / " + MAX_POLL_TEXT;
        syncPollSubmit();
      });
      wrap.append(area, counter);
      host.append(wrap);
      return;
    }

    if (type === "rating") {
      const wrap = pollEl("div", "poll-stars");
      const labels = ["1", "2", "3", "4", "5"];
      labels.forEach((label, i) => {
        const score = i + 1;
        const chosen = Number(pollDraft?.rating) === score;
        const button = pollEl("button", "poll-star" + (chosen ? " is-chosen" : ""), "★");
        button.type = "button";
        button.dataset.score = String(score);
        button.setAttribute("aria-label", t("{n} out of 5", { n: score }));
        button.setAttribute("aria-pressed", chosen ? "true" : "false");
        button.addEventListener("click", () => {
          if (!pollDraft) return;
          pollDraft.rating = score;
          renderPollAnswer();
          syncPollSubmit();
        });
        wrap.append(button);
      });
      const caption = pollEl("p", "poll-star-caption", pollDraft?.rating
        ? t("{n} of 5", { n: pollDraft.rating })
        : t("Tap a star to rate"));
      const box = pollEl("div", "poll-rating-wrap");
      box.append(wrap, caption);
      host.append(box);
      return;
    }

    const choices = pollChoices(poll);
    const multiple = poll.type === "multi";
    const list = pollEl("div", "poll-choices" + (poll.type === "yesno" ? " poll-choices--yesno" : ""));
    choices.forEach(option => list.append(pollChoiceButton(poll, option, multiple)));
    host.append(list);

    if (multiple) {
      const max = Math.max(1, Number(poll.maxChoices) || choices.length);
      host.append(pollEl("p", "poll-hint",
        t("Choose up to {n} · {m} selected", {
          n: max,
          m: pollDraft?.choice_ids?.length || 0
        })));
    }
  }

  function pollResultsNode(poll, vote) {
    const host = pollEl("div", "poll-results__inner");
    const stats = pollStats(poll, votes);

    if (!stats.total) {
      host.append(pollEl("p", "poll-results__none", t("No answers yet. Yours can be the first.")));
      return host;
    }

    if (poll.type === "text") {
      stats.texts.slice(0, 20).forEach(entry => {
        const item = pollEl("div", "poll-answer-text");
        item.append(
          pollEl("p", null, entry.text),
          pollEl("small", null, (entry.author || t("Anonymous")) +
            (entry.voter_key === voterKey ? t(" · you") : ""))
        );
        host.append(item);
      });
      if (stats.texts.length > 20) {
        host.append(pollEl("p", "poll-results__none", t("+ {n} more answers", { n: stats.texts.length - 20 })));
      }
      return host;
    }

    if (poll.type === "rating") {
      const chart = typeof pollHandChart === "function" ? pollHandChart(poll, stats) : null;
      if (chart) { host.append(chart); return host; }
      const wrap = pollEl("div", "poll-rating-result");
      const avg = pollEl("div", "poll-rating-result__avg");
      avg.append(pollEl("b", null, stats.rating.avg.toFixed(1)), pollEl("span", null, t(" / 5")));
      const stars = pollEl("div", "poll-rating-result__stars",
        "★".repeat(Math.max(0, Math.min(5, Math.round(stats.rating.avg)))) +
        "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(stats.rating.avg)))));
      wrap.append(avg, stars);
      [5, 4, 3, 2, 1].forEach(score => {
        const count = stats.rating.counts[score - 1] || 0;
        wrap.append(pollBarRow(score + "★", count, pollPct(count, stats.rating.total)));
      });
      host.append(wrap);
      return host;
    }

    const chart = typeof pollHandChart === "function" ? pollHandChart(poll, stats) : null;
    if (chart) { host.append(chart); return host; }
    stats.options.forEach(option => host.append(pollBarRow(option.label, option.count, option.pct)));
    return host;
  }

  function pollBarRow(label, count, pct) {
    const row = pollEl("div", "poll-result-row");
    const top = pollEl("div", "poll-result-row__top");
    top.append(pollEl("span", null, label), pollEl("span", null, count + " · " + pct + "%"));
    const track = pollEl("div", "poll-result-track");
    const fill = pollEl("span", "poll-result-fill");
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    track.append(fill);
    row.append(top, track);
    return row;
  }

  function renderPollScreen() {
    const poll = pollActive();
    if (!poll) { show("s-polls"); return; }
    const mine = pollMyVote(poll);
    const stats = pollStats(poll, votes);
    const type = pollType(poll.type);

    const pill = document.querySelector("#s-poll .poll-cat-pill");
    if (pill) pill.style.setProperty("--c", pollCategoryColor(poll.category));
    $("poll-cat-label").textContent = t(poll.category);

    const statusEl = $("poll-status");
    statusEl.textContent = pollStatus(poll).label;
    statusEl.className = "poll-status poll-status--" + poll.status;

    $("poll-question").textContent = poll.question;

    const desc = $("poll-desc");
    desc.textContent = poll.description || "";
    desc.hidden = !poll.description;

    const meta = $("poll-meta");
    meta.textContent = type.label + " · " +
      (stats.total === 1 ? t("1 response") : t("{n} responses", { n: stats.total })) +
      (poll.type === "multi" ? " · " + t("Pick up to {n}", { n: Math.max(1, Number(poll.maxChoices) || poll.options.length) }) : "");

    renderPollAnswer();
    syncPollSubmit();

    const your = $("poll-your");
    if (your) {
      if (mine) {
        your.hidden = false;
        your.replaceChildren(
          pollEl("span", "poll-your__label", t("Your answer")),
          pollEl("b", null, pollAnswerSummary(poll, mine))
        );
      } else {
        your.hidden = true;
        your.replaceChildren();
      }
    }

    const results = $("poll-results");
    const canSee = pollCanSeeResults(poll, mine);
    if (results) {
      if (canSee) {
        results.hidden = false;
        results.replaceChildren(
          pollEl("p", "poll-results__title", t("Live results")),
          pollResultsNode(poll, mine)
        );
      } else {
        results.hidden = true;
        results.replaceChildren();
      }
    }

    const note = $("poll-note");
    if (note) {
      let message = "";
      if (poll.status === "closed") message = t("This poll is closed. Thanks for taking part.");
      else if (poll.status !== "open") message = t("The presenter has not opened this poll yet.");
      else if (poll.results === "presenter") message = t("The presenter will share the results with the room.");
      else if (poll.results === "after" && !mine) message = t("Send your answer to unlock the live results.");
      else if (mine) message = t("You can update your answer until the poll closes.");
      note.textContent = message;
      note.hidden = !message;
    }
  }

  async function submitPollAnswer() {
    const poll = pollActive();
    if (!poll || poll.status !== "open" || pollSending) return;
    if (!pollDraftComplete()) { toast(t("Choose an answer first"), true); return; }

    const mine = pollMyVote(poll);
    pollSending = true;
    syncPollSubmit();
    try {
      const saved = await Store.submitVote({
        id: mine?.id,
        poll_id: poll.id,
        voter_key: voterKey,
        author: name,
        choice_ids: poll.type === "text" || poll.type === "rating" ? [] : (pollDraft.choice_ids || []),
        rating: poll.type === "rating" ? pollDraft.rating : null,
        text: poll.type === "text" ? pollDraft.text : "",
        created_at: mine?.created_at,
        updated_at: new Date().toISOString()
      });
      upsertVoteLocal(saved);
      navigator.vibrate?.(14);
      toast(mine ? t("Answer updated") : t("Answer sent"));
      renderPollScreen();
      updatePollBanner();
    } catch (err) {
      console.error("Could not send the answer", err);
      toast(t("Couldn't send — try again"), true);
    } finally {
      pollSending = false;
      syncPollSubmit();
    }
  }

  async function syncPolls() {
    try {
      const [freshPolls, freshVotes] = await Promise.all([Store.listPolls(), Store.listVotes()]);
      polls.splice(0, polls.length, ...normalisePolls(freshPolls));
      votes.splice(0, votes.length, ...normalisePollVotes(freshVotes));
    } catch (err) {
      console.warn("Could not load polls. In live mode run supabase/migration-polls.sql.", err);
    }
    pollRefreshChrome();
  }

  pollBanner?.addEventListener("click", () => show("s-polls"));
  $("poll-list-back")?.addEventListener("click", () => show("s-cat"));
  $("poll-back")?.addEventListener("click", () => show("s-polls"));
  $("poll-submit")?.addEventListener("click", submitPollAnswer);

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (mediaPreview && !$("s-media").classList.contains("hidden")) { clearMediaSelection(); show("s-cat"); return; }
    if (pollScreen && !pollScreen.classList.contains("hidden")) { show("s-polls"); return; }
    if (!$("s-polls").classList.contains("hidden")) { show("s-cat"); return; }
    if (!$("s-write").classList.contains("hidden")) { show("s-cat"); cat = null; }
  });

  /* ── boot: load the presenter's category plan ──────────────── */
  applyCategories(DEFAULT_CATEGORIES);
  renderCategories();
  update();
  if (name) { $("who").textContent = whoText(); show("s-cat"); } else show("s-name");

  Store.getCategories().then(list => {
    applyCategories(list);
    renderCategories();
    if (cat && !CATS[cat]) { cat = null; show("s-cat"); }
    else if (cat) paintWrite(CATS[cat]);
  }).catch(err => console.error("Could not load categories", err));

  Store.subscribeCategories(list => {
    applyCategories(list);
    renderCategories();
    if (cat && !CATS[cat]) {
      cat = null;
      show("s-cat");
    } else if (cat) {
      paintWrite(CATS[cat]);
    }
  });

  syncPolls();
  Store.subscribePolls({
    onPoll: poll => { upsertPollLocal(poll); pollRefreshChrome(); },
    onDelete: id => { removePollLocal(id); pollRefreshChrome(); },
    onVote: vote => { upsertVoteLocal(vote); pollRefreshChrome(); },
    onVoteDelete: vote => { removeVoteLocal(vote); pollRefreshChrome(); },
    onResetVotes: id => { resetVotesLocal(id); pollRefreshChrome(); },
    resync: syncPolls
  });
})();
