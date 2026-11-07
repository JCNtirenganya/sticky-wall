/* Storage adapter: Supabase (realtime) or Demo (localStorage + BroadcastChannel).
   API:
     Store.mode
     Store.list() → Promise<note[]>
     Store.add({name,category,text})
     Store.subscribe({onAdd(note), onRemove(id), onUpdate(note), onReassign(from,to), resync})
     Store.getCategories() → Promise<category[]>
     Store.saveCategories(list, {removed, fallback}) → Promise<category[]>
     Store.subscribeCategories(cb) → unsubscribe
     Store.reassign(fromKeys, toKey) → Promise<number>

     Store.listPolls() → Promise<poll[]>
     Store.savePoll(poll) → Promise<poll>
     Store.deletePoll(id) → Promise<void>
     Store.listVotes(pollId?) → Promise<vote[]>
     Store.submitVote(vote) → Promise<vote>
     Store.submitVotes(votes) → Promise<vote[]>
     Store.resetVotes(pollId) → Promise<void>
     Store.subscribePolls({onPoll, onDelete, onVote, onVoteDelete, onResetVotes, resync})

     Store.listMedia() → Promise<media[]>
     Store.addMedia({file, author, kind, width, height}) → Promise<media>
     Store.hideMedia(id) → Promise<void>
     Store.removeMedia(media) → Promise<void>
     Store.subscribeMedia({onAdd, onRemove, onUpdate, resync})                                      */
(function () {
  const C = window.STICKY_CONFIG || {};
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  const norm = r => ({ id: r.id, created_at: r.created_at, category: r.category, text: r.text, author: r.author_name || "" });
  const normalize = list => typeof normalizeCategoryList === "function"
    ? normalizeCategoryList(list)
    : (Array.isArray(list) ? list : []);
  const compact = list => normalize(list).map(c => ({
    key: c.key, label: c.label, short: c.short, action: c.action,
    emoji: c.emoji, hint: c.hint, color: c.color
  }));
  const normPoll = r => ({
    id: r.id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    question: r.question,
    description: r.description || "",
    type: r.type,
    category: r.category || "Feedback",
    options: Array.isArray(r.options) ? r.options : [],
    maxChoices: r.max_choices ?? 1,
    status: r.status || "draft",
    results: r.results || "after",
    position: r.position ?? 0
  });
  const normVote = r => ({
    id: r.id,
    poll_id: r.poll_id,
    voter_key: r.voter_key,
    author: r.author_name || "",
    choice_ids: Array.isArray(r.choice_ids) ? r.choice_ids : [],
    rating: r.rating,
    text: r.text || "",
    created_at: r.created_at,
    updated_at: r.updated_at
  });
  const pollRow = p => ({
    id: p.id,
    question: p.question,
    description: p.description || "",
    type: p.type,
    category: p.category,
    options: p.options,
    max_choices: p.maxChoices,
    status: p.status,
    results: p.results,
    position: p.position || 0,
    updated_at: new Date().toISOString()
  });
  const voteRow = v => ({
    poll_id: v.poll_id,
    voter_key: v.voter_key,
    author_name: v.author || "",
    choice_ids: v.choice_ids || [],
    rating: v.rating || null,
    text: v.text || "",
    updated_at: new Date().toISOString()
  });

  if (live) {
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

    /* Tiny realtime bus for live-stream signalling. Broadcast messages are
       ephemeral (nothing is stored) and are only used to exchange WebRTC
       offers, answers and ICE candidates between phones and the board. */
    const liveBus = (() => {
      const listeners = new Set();
      let channel = null, ready = null, subscribed = false;
      function connect() {
        if (ready) return ready;
        ready = new Promise((resolve, reject) => {
          channel = sb.channel("event-live", { config: { broadcast: { self: false } } });
          channel.on("broadcast", { event: "live" }, payload => {
            const data = payload?.payload;
            if (!data) return;
            for (const cb of [...listeners]) {
              try { cb(data); } catch (err) { console.error("Live signal handler failed", err); }
            }
          });
          channel.subscribe(status => {
            if (status === "SUBSCRIBED") {
              subscribed = true;
              resolve(channel);
            } else if (!subscribed) {
              ready = null;
              channel = null;
              reject(new Error("Live channel " + String(status).toLowerCase()));
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              /* allow the next send to build a fresh channel */
              ready = null;
              channel = null;
              subscribed = false;
            }
          });
        });
        return ready;
      }
      return {
        ready: connect,
        on(cb) {
          listeners.add(cb);
          connect().catch(() => {});
          return () => listeners.delete(cb);
        },
        async send(msg) {
          const ch = await connect();
          const result = await ch.send({ type: "broadcast", event: "live", payload: msg });
          if (result !== "ok") throw new Error("Live signal could not be sent");
        }
      };
    })();

    const normMedia = r => ({
      id: r.id,
      created_at: r.created_at,
      kind: r.kind,
      path: r.storage_path,
      author: r.author || "Guest",
      caption: r.caption || "",
      width: r.width,
      height: r.height,
      hidden: !!r.hidden,
      url: sb.storage.from("event-media").getPublicUrl(r.storage_path).data.publicUrl
    });
    window.Store = {
      mode: "supabase",
      liveBus,
      async list() {
        const { data, error } = await sb.from("notes").select("id,created_at,category,text,author_name,hidden")
          .eq("hidden", false).order("created_at", { ascending: true }).limit(2000);
        if (error) throw error;
        return data.map(norm);
      },
      async add({ name, category, text }) {
        const author = String(name || "").trim() || "Anonymous";
        const { error } = await sb.rpc("submit_note", { p_name: author, p_category: category, p_text: text });
        if (error) throw error;
      },
      async getCategories() {
        const { data, error } = await sb.rpc("get_categories");
        if (error) {
          console.warn("Could not read categories (run supabase/migration-categories.sql):", error.message);
          return normalize(DEFAULT_CATEGORIES);
        }
        return normalize(data || DEFAULT_CATEGORIES);
      },
      async saveCategories(list, options = {}) {
        const categories = normalize(list);
        const { error } = await sb.rpc("set_categories", { p_categories: compact(categories) });
        if (error) throw error;
        if (options.removed?.length && options.fallback) {
          const { error: moveError } = await sb.rpc("reassign_notes", { p_from: options.removed, p_to: options.fallback });
          if (moveError) throw moveError;
        }
        return categories;
      },
      async reassign(fromKeys, toKey) {
        if (!fromKeys?.length || !toKey) return 0;
        const { error } = await sb.rpc("reassign_notes", { p_from: fromKeys, p_to: toKey });
        if (error) throw error;
        return fromKeys.length;
      },
      subscribe({ onAdd, onRemove, onUpdate, resync }) {
        sb.channel("notes-feed")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, p => { if (!p.new.hidden) onAdd(norm(p.new)); })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes" }, p => {
            if (p.new.hidden) onRemove(p.new.id);
            else if (onUpdate) onUpdate(norm(p.new));
            else onAdd(norm(p.new));
          })
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, p => onRemove(p.old.id))
          .subscribe();
        if (resync) setInterval(resync, 20000); // safety net if the socket drops
      },
      subscribeCategories(cb) {
        const channel = sb.channel("settings-feed")
          .on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: "key=eq.categories" }, p => {
            const value = p.new?.value;
            if (Array.isArray(value)) cb(normalize(value));
          })
          .subscribe();
        return () => sb.removeChannel(channel);
      },
      async listPolls() {
        const { data, error } = await sb.from("polls").select("*")
          .order("position", { ascending: true }).order("created_at", { ascending: true }).limit(200);
        if (error) throw error;
        return (data || []).map(normPoll);
      },
      async savePoll(poll) {
        const { data, error } = await sb.from("polls").upsert(pollRow(poll), { onConflict: "id" }).select().single();
        if (error) throw error;
        return normPoll(data);
      },
      async deletePoll(id) {
        const { error: voteError } = await sb.from("poll_votes").delete().eq("poll_id", id);
        if (voteError) throw voteError;
        const { error } = await sb.from("polls").delete().eq("id", id);
        if (error) throw error;
      },
      async listVotes(pollId) {
        let query = sb.from("poll_votes").select("*");
        if (pollId) query = query.eq("poll_id", pollId);
        const { data, error } = await query.order("updated_at", { ascending: true }).limit(5000);
        if (error) throw error;
        return (data || []).map(normVote);
      },
      async submitVote(vote) {
        const { data, error } = await sb.from("poll_votes")
          .upsert(voteRow(vote), { onConflict: "poll_id,voter_key" })
          .select().single();
        if (error) throw error;
        return normVote(data);
      },
      async submitVotes(votes) {
        if (!votes || !votes.length) return [];
        const { data, error } = await sb.from("poll_votes")
          .upsert(votes.map(voteRow), { onConflict: "poll_id,voter_key" })
          .select();
        if (error) throw error;
        return (data || []).map(normVote);
      },
      async resetVotes(pollId) {
        const { error } = await sb.from("poll_votes").delete().eq("poll_id", pollId);
        if (error) throw error;
      },
      subscribePolls({ onPoll, onDelete, onVote, onVoteDelete, onResetVotes, resync } = {}) {
        sb.channel("polls-feed")
          .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, p => {
            if (p.eventType === "DELETE") onDelete?.(p.old.id);
            else onPoll?.(normPoll(p.new));
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, p => {
            if (p.eventType === "DELETE") {
              if (onVoteDelete) onVoteDelete(normVote(p.old));
              else onResetVotes?.(p.old.poll_id);
            } else {
              onVote?.(normVote(p.new));
            }
          })
          .subscribe();
        if (resync) setInterval(resync, 20000);
      },
      async listMedia() {
        const { data, error } = await sb.from("event_media").select("*")
          .eq("hidden", false).order("created_at", { ascending: true }).limit(500);
        if (error) throw error;
        return (data || []).map(normMedia);
      },
      async addMedia({ file, author, kind, width, height }) {
        if (!file) throw new Error("No file selected");
        const type = String(file.type || "");
        const isVideo = /^video\//.test(type) || kind === "video";
        const ext = (String(file.name || "").match(/\.[a-z0-9]+$/i)?.[0] || (isVideo ? ".mp4" : ".jpg")).toLowerCase();
        const unique = window.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const path = `${Date.now()}-${unique}${ext}`;
        const upload = await sb.storage.from("event-media").upload(path, file, {
          contentType: type || undefined,
          cacheControl: "3600",
          upsert: false
        });
        if (upload.error) throw upload.error;
        const { data, error } = await sb.from("event_media").insert({
          kind: isVideo ? "video" : "photo",
          storage_path: path,
          author: String(author || "").trim() || "Guest",
          caption: "",
          width: Number(width) || null,
          height: Number(height) || null
        }).select().single();
        if (error) {
          await sb.storage.from("event-media").remove([path]);
          throw error;
        }
        return normMedia(data);
      },
      async hideMedia(id) {
        const { error } = await sb.from("event_media").update({ hidden: true }).eq("id", id);
        if (error) throw error;
      },
      async removeMedia(media) {
        if (!media?.id) return;
        const { error } = await sb.from("event_media").delete().eq("id", media.id);
        if (error) throw error;
        if (media.path) {
          const removed = await sb.storage.from("event-media").remove([media.path]);
          if (removed.error) console.warn("Could not delete the media file", removed.error);
        }
      },
      subscribeMedia({ onAdd, onRemove, onUpdate, resync } = {}) {
        sb.channel("media-feed")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_media" }, p => {
            if (!p.new.hidden) onAdd?.(normMedia(p.new));
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_media" }, p => {
            if (p.new.hidden) onRemove?.(p.new.id);
            else if (onUpdate) onUpdate(normMedia(p.new));
            else onAdd?.(normMedia(p.new));
          })
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_media" }, p => {
            onRemove?.(p.old.id);
          })
          .subscribe();
        if (resync) setInterval(resync, 20000);
      }
    };
  } else {
    const NOTE_KEY = "sticky_demo_notes", CAT_KEY = "sticky_categories";
    const POLL_KEY = "sticky_demo_polls", VOTE_KEY = "sticky_demo_votes";
    const MEDIA_KEY = "sticky_demo_media";
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("sticky_demo") : null;
    const readNotes = () => { try { return JSON.parse(localStorage.getItem(NOTE_KEY) || "[]"); } catch { return []; } };
    const writeNotes = list => {
      try { localStorage.setItem(NOTE_KEY, JSON.stringify(list)); } catch {}
    };
    const readCategories = () => {
      try {
        const value = JSON.parse(localStorage.getItem(CAT_KEY) || "null");
        return Array.isArray(value) && value.length ? value : null;
      } catch { return null; }
    };
    const readPolls = () => {
      try {
        const value = JSON.parse(localStorage.getItem(POLL_KEY) || "[]");
        return Array.isArray(value) ? value : [];
      } catch { return []; }
    };
    const writePolls = list => {
      try { localStorage.setItem(POLL_KEY, JSON.stringify(list)); } catch {}
    };
    const readVotes = () => {
      try {
        const value = JSON.parse(localStorage.getItem(VOTE_KEY) || "[]");
        return Array.isArray(value) ? value : [];
      } catch { return []; }
    };
    const writeVotes = list => {
      try { localStorage.setItem(VOTE_KEY, JSON.stringify(list)); } catch {}
    };
    const readMedia = () => {
      try {
        const value = JSON.parse(localStorage.getItem(MEDIA_KEY) || "[]");
        return Array.isArray(value) ? value : [];
      } catch { return []; }
    };
    const writeMedia = list => {
      try { localStorage.setItem(MEDIA_KEY, JSON.stringify(list)); } catch {}
    };
    const categoryHandlers = new Set();
    const notifyCategories = list => {
      const categories = normalize(list);
      categoryHandlers.forEach(cb => { try { cb(categories); } catch (err) { console.error(err); } });
    };
    let noteHandlers = null;
    let pollHandlers = null;
    let mediaHandlers = null;

    function emitAdd(note) {
      noteHandlers?.onAdd?.(note);
    }
    function emitUpdate(note) {
      if (noteHandlers?.onUpdate) noteHandlers.onUpdate(note);
      else noteHandlers?.resync?.();
    }
    function emitReassign(from, to) {
      noteHandlers?.onReassign?.(from, to);
    }
    function emitPoll(poll) {
      pollHandlers?.onPoll?.(poll);
    }
    function emitPollDelete(id) {
      pollHandlers?.onDelete?.(id);
    }
    function emitVote(vote) {
      pollHandlers?.onVote?.(vote);
    }
    function emitVoteDelete(vote) {
      pollHandlers?.onVoteDelete?.(vote);
    }
    function emitResetVotes(pollId) {
      pollHandlers?.onResetVotes?.(pollId);
    }
    function emitMedia(media) {
      mediaHandlers?.onAdd?.(media);
    }
    function removeMediaLocal(id) {
      mediaHandlers?.onRemove?.(id);
    }

    function handleMessage(m) {
      if (!m || typeof m !== "object") return;
      if (m.type === "add" && m.note) emitAdd(m.note);
      else if (m.type === "update" && m.note) emitUpdate(m.note);
      else if (m.type === "reassign") emitReassign(m.from, m.to);
      else if (m.type === "categories") notifyCategories(m.categories);
      else if (m.type === "resync") noteHandlers?.resync?.();
      else if (m.type === "poll-save" && m.poll) emitPoll(m.poll);
      else if (m.type === "poll-delete") emitPollDelete(m.id);
      else if (m.type === "vote-save" && m.vote) emitVote(m.vote);
      else if (m.type === "vote-delete" && m.vote) emitVoteDelete(m.vote);
      else if (m.type === "votes-reset") emitResetVotes(m.pollId);
      else if (m.type === "media-add" && m.media) emitMedia(m.media);
      else if (m.type === "media-remove") removeMediaLocal(m.id);
      else if (m.type === "resync-polls") pollHandlers?.resync?.();
      else if (m.type === "resync-media") mediaHandlers?.resync?.();
    }
    if (bc) bc.onmessage = e => handleMessage(e.data || {});

    /* demo signalling: phones and the board in this browser talk over a
       separate BroadcastChannel, so live streaming can be tried locally. */
    const liveBC = "BroadcastChannel" in window ? new BroadcastChannel("sticky_live") : null;
    const liveListeners = new Set();
    if (liveBC) liveBC.onmessage = e => {
      const data = e.data;
      if (!data) return;
      for (const cb of [...liveListeners]) {
        try { cb(data); } catch (err) { console.error("Live signal handler failed", err); }
      }
    };
    const demoLiveBus = {
      ready: () => Promise.resolve(true),
      on(cb) {
        liveListeners.add(cb);
        return () => liveListeners.delete(cb);
      },
      async send(msg) {
        liveBC?.postMessage(msg);
      }
    };

    window.Store = {
      mode: "demo",
      liveBus: demoLiveBus,
      async list() { return readNotes(); },
      async add({ name, category, text }) {
        const n = {
          id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
          created_at: new Date().toISOString(), category, text, author: name
        };
        const all = readNotes(); all.push(n); writeNotes(all);
        bc && bc.postMessage({ type: "add", note: n });
        window.dispatchEvent(new CustomEvent("sticky-local-add", { detail: n }));
      },
      async getCategories() {
        return normalize(readCategories() || DEFAULT_CATEGORIES);
      },
      async saveCategories(list, options = {}) {
        const categories = normalize(list);
        try { localStorage.setItem(CAT_KEY, JSON.stringify(compact(categories))); } catch {}
        const removed = (options.removed || []).filter(Boolean);
        const fallback = options.fallback || categories[0]?.key;
        if (removed.length && fallback) {
          const from = new Set(removed);
          const all = readNotes();
          let changed = 0;
          all.forEach(n => { if (from.has(n.category)) { n.category = fallback; changed++; } });
          if (changed) writeNotes(all);
          bc && bc.postMessage({ type: "reassign", from: removed, to: fallback });
          window.dispatchEvent(new CustomEvent("sticky-local-reassign", { detail: { from: removed, to: fallback } }));
        }
        bc && bc.postMessage({ type: "categories", categories: compact(categories) });
        return categories;
      },
      async reassign(fromKeys, toKey) {
        const from = new Set(fromKeys || []);
        if (!from.size || !toKey) return 0;
        const all = readNotes();
        let changed = 0;
        all.forEach(n => { if (from.has(n.category)) { n.category = toKey; changed++; } });
        if (changed) {
          writeNotes(all);
          bc && bc.postMessage({ type: "reassign", from: [...from], to: toKey });
          window.dispatchEvent(new CustomEvent("sticky-local-reassign", { detail: { from: [...from], to: toKey } }));
        }
        return changed;
      },
      subscribeCategories(cb) {
        categoryHandlers.add(cb);
        return () => categoryHandlers.delete(cb);
      },
      async listPolls() {
        return normalisePolls(readPolls());
      },
      async savePoll(poll) {
        const clean = normalisePoll(poll);
        const all = readPolls();
        const i = all.findIndex(p => p.id === clean.id);
        if (i >= 0) all[i] = clean; else all.push(clean);
        writePolls(all);
        bc && bc.postMessage({ type: "poll-save", poll: clean });
        window.dispatchEvent(new CustomEvent("sticky-local-poll-save", { detail: clean }));
        return clean;
      },
      async deletePoll(id) {
        writePolls(readPolls().filter(p => p.id !== id));
        writeVotes(readVotes().filter(v => v.poll_id !== id));
        bc && bc.postMessage({ type: "poll-delete", id });
        window.dispatchEvent(new CustomEvent("sticky-local-poll-delete", { detail: id }));
      },
      async listVotes(pollId) {
        const all = normalisePollVotes(readVotes());
        return pollId ? all.filter(v => v.poll_id === pollId) : all;
      },
      async submitVote(vote) {
        const clean = normalisePollVote(vote);
        if (!clean.poll_id || !clean.voter_key) throw new Error("poll_id and voter_key are required");
        const all = readVotes();
        const i = all.findIndex(v => v.poll_id === clean.poll_id && v.voter_key === clean.voter_key);
        if (i >= 0) {
          clean.id = all[i].id || clean.id;
          clean.created_at = all[i].created_at || clean.created_at;
          all[i] = clean;
        } else all.push(clean);
        writeVotes(all);
        bc && bc.postMessage({ type: "vote-save", vote: clean });
        window.dispatchEvent(new CustomEvent("sticky-local-vote-save", { detail: clean }));
        return clean;
      },
      async submitVotes(votes) {
        const out = [];
        for (const vote of votes || []) out.push(await this.submitVote(vote));
        return out;
      },
      async resetVotes(pollId) {
        writeVotes(readVotes().filter(v => v.poll_id !== pollId));
        bc && bc.postMessage({ type: "votes-reset", pollId });
        window.dispatchEvent(new CustomEvent("sticky-local-votes-reset", { detail: pollId }));
      },
      subscribePolls({ onPoll, onDelete, onVote, onVoteDelete, onResetVotes, resync } = {}) {
        pollHandlers = { onPoll, onDelete, onVote, onVoteDelete, onResetVotes, resync };
        window.addEventListener("sticky-local-poll-save", e => emitPoll(e.detail));
        window.addEventListener("sticky-local-poll-delete", e => emitPollDelete(e.detail));
        window.addEventListener("sticky-local-vote-save", e => emitVote(e.detail));
        window.addEventListener("sticky-local-votes-reset", e => emitResetVotes(e.detail));
        window.addEventListener("storage", e => {
          if (e.key === POLL_KEY && !bc) resync?.();
          else if (e.key === VOTE_KEY && !bc) resync?.();
        });
      },
      async listMedia() {
        return readMedia().slice().sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
      },
      async addMedia({ file, author, kind, width, height }) {
        if (!file) throw new Error("No file selected");
        if (file.size > 4 * 1024 * 1024) throw new Error("Demo mode supports files up to 4 MB");
        const url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error || new Error("Could not read the file"));
          reader.readAsDataURL(file);
        });
        const isVideo = /^video\//.test(String(file.type || "")) || kind === "video";
        const item = {
          id: window.crypto?.randomUUID ? crypto.randomUUID() : "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          created_at: new Date().toISOString(),
          kind: isVideo ? "video" : "photo",
          author: String(author || "").trim() || "Guest",
          caption: "",
          width: Number(width) || null,
          height: Number(height) || null,
          url
        };
        const all = readMedia();
        all.push(item);
        writeMedia(all);
        bc && bc.postMessage({ type: "media-add", media: item });
        window.dispatchEvent(new CustomEvent("sticky-local-media-add", { detail: item }));
        return item;
      },
      async hideMedia(id) {
        const all = readMedia().filter(m => m.id !== id);
        writeMedia(all);
        bc && bc.postMessage({ type: "media-remove", id });
        window.dispatchEvent(new CustomEvent("sticky-local-media-remove", { detail: id }));
      },
      async removeMedia(media) {
        if (!media?.id) return;
        await this.hideMedia(media.id);
      },
      subscribeMedia({ onAdd, onRemove, onUpdate, resync } = {}) {
        mediaHandlers = { onAdd, onRemove, onUpdate, resync };
        window.addEventListener("sticky-local-media-add", e => emitMedia(e.detail));
        window.addEventListener("sticky-local-media-remove", e => removeMediaLocal(e.detail));
        window.addEventListener("storage", e => {
          if (e.key === MEDIA_KEY && !bc) resync?.();
        });
      },
      subscribe({ onAdd, onRemove, onUpdate, onReassign, resync }) {
        noteHandlers = { onAdd, onRemove, onUpdate, onReassign, resync };
        window.addEventListener("sticky-local-add", e => emitAdd(e.detail));
        window.addEventListener("sticky-local-update", e => emitUpdate(e.detail));
        window.addEventListener("sticky-local-reassign", e => emitReassign(e.detail.from, e.detail.to));
        window.addEventListener("storage", e => {
          if (e.key === CAT_KEY) notifyCategories(readCategories() || DEFAULT_CATEGORIES);
          else if (e.key === NOTE_KEY && !bc) resync?.();
        });
      },
      clear() {
        localStorage.removeItem(NOTE_KEY);
        localStorage.removeItem(MEDIA_KEY);
        bc && bc.postMessage({ type: "resync" });
      }
    };
  }
})();
