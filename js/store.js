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

     Store.listMedia() → Promise<media[]>
     Store.addMedia({file, author, kind, width, height, onProgress}) → Promise<media>
     Store.hideMedia(id) → Promise<void>
     Store.removeMedia(media) → Promise<void>
     Store.clearSubmissions(passphrase) → Promise<counts>   // presenter reset
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

    /* Upload straight to the event-media bucket with XHR so the phone can
       show real progress. storage-js sends Blob/File uploads as multipart
       FormData with a cacheControl field, so this mirrors that request. */
    function uploadMediaFile(path, file, onProgress) {
      return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append("cacheControl", "3600");
        form.append("", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${C.SUPABASE_URL}/storage/v1/object/event-media/${path}`);
        xhr.setRequestHeader("apikey", C.SUPABASE_ANON_KEY);
        xhr.setRequestHeader("Authorization", `Bearer ${C.SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader("x-upsert", "false");
        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = event => {
            if (event.lengthComputable && event.total) onProgress(event.loaded, event.total);
          };
        }
        xhr.onload = () => {
          let payload = null;
          try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { payload = null; }
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(1, 1);
            resolve({ path, id: payload?.Id, fullPath: payload?.Key });
            return;
          }
          const detail = payload?.message || payload?.error || `Upload failed (${xhr.status})`;
          reject(new Error(detail));
        };
        xhr.onerror = () => reject(new Error("Could not upload the media file"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.send(form);
      });
    }

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
      async listMedia() {
        const { data, error } = await sb.from("event_media").select("*")
          .eq("hidden", false).order("created_at", { ascending: true }).limit(500);
        if (error) throw error;
        return (data || []).map(normMedia);
      },
      async addMedia({ file, author, kind, width, height, onProgress }) {
        if (!file) throw new Error("No file selected");
        const type = String(file.type || "");
        const isVideo = /^video\//.test(type) || kind === "video";
        const ext = (String(file.name || "").match(/\.[a-z0-9]+$/i)?.[0] || (isVideo ? ".mp4" : ".jpg")).toLowerCase();
        const unique = window.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const path = `${Date.now()}-${unique}${ext}`;
        await uploadMediaFile(path, file, onProgress);
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
      async clearSubmissions(passphrase) {
        const { data, error } = await sb.rpc("presenter_clear", { p_secret: String(passphrase || "") });
        if (error) throw error;
        const paths = Array.isArray(data?.paths) ? data.paths.filter(Boolean) : [];
        if (paths.length) {
          const removed = await sb.storage.from("event-media").remove(paths);
          if (removed.error) console.warn("Submissions cleared, but some media files could not be removed", removed.error);
        }
        return data || {};
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
      else if (m.type === "media-add" && m.media) emitMedia(m.media);
      else if (m.type === "media-remove") removeMediaLocal(m.id);
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
      async listMedia() {
        return readMedia().slice().sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
      },
      async addMedia({ file, author, kind, width, height, onProgress }) {
        if (!file) throw new Error("No file selected");
        if (file.size > 4 * 1024 * 1024) throw new Error("Demo mode supports files up to 4 MB");
        const url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error || new Error("Could not read the file"));
          reader.readAsDataURL(file);
        });
        onProgress?.(1, 1);
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
      async clearSubmissions() {
        localStorage.removeItem(NOTE_KEY);
        localStorage.removeItem(MEDIA_KEY);
        bc && bc.postMessage({ type: "resync" });
        bc && bc.postMessage({ type: "resync-media" });
        return { notes: 0, media: 0, files: 0 };
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
