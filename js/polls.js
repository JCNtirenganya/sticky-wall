/* Shared poll model.
   Used by the presenter board and the phone page so both sides agree on
   question types, option ids, validation and the statistics we display.

   Poll shape:
     { id, created_at, updated_at, question, description, type, category,
       options:[{id,label,media}], maxChoices, status, results, position }

   Vote shape:
     { id, poll_id, voter_key, author, choice_ids:[], rating, text,
       created_at, updated_at }

   One vote per voter_key per poll. Re-submitting updates that vote. */

const POLL_TYPES = {
  single: {
    key: "single", label: "Single choice", short: "One answer", emoji: "◉",
    hint: "Pick one option", hasOptions: true, multiple: false
  },
  multi: {
    key: "multi", label: "Multiple choice", short: "Many answers", emoji: "☑",
    hint: "Pick one or more options", hasOptions: true, multiple: true
  },
  yesno: {
    key: "yesno", label: "Yes / No", short: "Yes or no", emoji: "👍",
    hint: "Pick yes or no", hasOptions: false, multiple: false
  },
  rating: {
    key: "rating", label: "Rating", short: "1–5 rating", emoji: "★",
    hint: "Rate from 1 to 5", hasOptions: false, multiple: false
  },
  text: {
    key: "text", label: "Open response", short: "Open text", emoji: "✍",
    hint: "Write a short answer", hasOptions: false, multiple: false
  }
};

const POLL_TYPE_KEYS = Object.keys(POLL_TYPES);
const DEFAULT_POLL_CATEGORIES = ["Feedback", "Priorities", "Ideas", "Knowledge", "Logistics", "Other"];
const POLL_STATUSES = {
  draft: { key: "draft", label: "Draft", hint: "Hidden from phones" },
  open: { key: "open", label: "Open", hint: "Accepting answers" },
  closed: { key: "closed", label: "Closed", hint: "Answers locked" }
};
const POLL_RESULTS = {
  always: { key: "always", label: "Always", hint: "Phones see live results" },
  after: { key: "after", label: "After voting", hint: "Results unlock after an answer" },
  presenter: { key: "presenter", label: "Presenter only", hint: "Phones only see a thank-you" }
};

const MAX_POLL_OPTIONS = 8;
const MAX_POLL_QUESTION = 160;
const MAX_POLL_DESCRIPTION = 320;
const MAX_POLL_OPTION = 80;
const MAX_POLL_MEDIA = 240000;
const MAX_POLL_TEXT = 280;
const MAX_POLL_CATEGORY = 32;
const POLL_CAT_COLORS = ["#E6E600", "#E60073", "#00E600", "#00B4E6", "#E67300", "#8E44AD", "#16A085", "#E74C3C"];

function pollUid(prefix) {
  const p = prefix || "poll";
  if (window.crypto?.randomUUID) return p + "-" + crypto.randomUUID();
  return p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

/* Translate a poll string through the shared i18n layer when it is
   loaded, and fall back to the English source text otherwise. */
function pollText(key, vars) {
  if (typeof window.t === "function") return window.t(key, vars);
  if (!vars) return key;
  return String(key).replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] == null ? match : String(vars[name]));
}

function pollClean(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

/* Option media is either a short emoji/label or an image URL / data URL.
   Nothing is fetched here: the UI decides how to paint it. */
function pollMediaKind(value) {
  const v = String(value == null ? "" : value).trim();
  if (!v) return "";
  if (/^(https?:|data:image\/|blob:)/i.test(v)) return "image";
  if (/\//.test(v) || /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(v)) return "image";
  return "text";
}

function pollCleanMedia(value) {
  return String(value == null ? "" : value).trim().slice(0, MAX_POLL_MEDIA);
}

function pollType(type) {
  const meta = POLL_TYPES[type] || POLL_TYPES.single;
  return {
    ...meta,
    label: pollText(meta.label),
    short: pollText(meta.short),
    hint: pollText(meta.hint)
  };
}

function pollStatus(poll) {
  const meta = POLL_STATUSES[poll?.status] || POLL_STATUSES.draft;
  return { ...meta, label: pollText(meta.label), hint: pollText(meta.hint) };
}

function pollIsOpen(poll) {
  return poll?.status === "open";
}

function pollIsClosed(poll) {
  return poll?.status === "closed";
}

function pollResultsMode(poll) {
  const meta = POLL_RESULTS[poll?.results] || POLL_RESULTS.after;
  return { ...meta, label: pollText(meta.label), hint: pollText(meta.hint) };
}

function pollCategoryColor(category) {
  const value = String(category || "Poll");
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return POLL_CAT_COLORS[(h >>> 0) % POLL_CAT_COLORS.length];
}

function pollOptionId(raw, index, used) {
  let base = String(raw?.id || raw?.label || raw || "")
    .toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!base) base = "option-" + (index + 1);
  let id = base, n = 2;
  while (used.has(id)) id = base + "-" + (n++);
  used.add(id);
  return id;
}

function normalisePollOptions(rawOptions) {
  const source = Array.isArray(rawOptions) ? rawOptions : [];
  const used = new Set(), out = [];
  source.slice(0, MAX_POLL_OPTIONS).forEach((raw, i) => {
    const label = pollClean(typeof raw === "string" ? raw : raw?.label, MAX_POLL_OPTION);
    if (!label) return;
    out.push({
      id: pollOptionId(raw, i, used),
      label,
      media: pollCleanMedia(typeof raw === "string" ? "" : raw?.media)
    });
  });
  return out;
}

function normalisePoll(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const type = POLL_TYPES[source.type] ? source.type : "single";
  const meta = POLL_TYPES[type];
  let options = normalisePollOptions(source.options);
  if (meta.hasOptions && options.length < 2) {
    const used = new Set(options.map(o => o.id));
    ["Option 1", "Option 2"].forEach((label, i) => {
      if (options.length >= 2) return;
      const shown = pollText("Option {n}", { n: i + 1 });
      if (options.some(o => o.label === shown)) return;
      options.push({ id: pollOptionId({ label: shown }, i, used), label: shown, media: "" });
    });
  }
  if (!meta.hasOptions) options = [];
  const maxChoices = meta.multiple
    ? Math.max(2, Math.min(options.length || 2, Math.round(Number(source.maxChoices) || options.length || 2)))
    : 1;
  const created = source.created_at || new Date().toISOString();
  return {
    id: String(source.id || pollUid("poll")),
    created_at: created,
    updated_at: source.updated_at || created,
    question: pollClean(source.question, MAX_POLL_QUESTION) || "Untitled poll",
    description: pollClean(source.description, MAX_POLL_DESCRIPTION),
    type,
    category: pollClean(source.category, MAX_POLL_CATEGORY) || "Feedback",
    options,
    maxChoices,
    status: POLL_STATUSES[source.status] ? source.status : "draft",
    results: POLL_RESULTS[source.results] ? source.results : "after",
    position: Number.isFinite(Number(source.position)) ? Number(source.position) : 0
  };
}

function normalisePolls(list) {
  const source = Array.isArray(list) ? list : [];
  const seen = new Set(), out = [];
  source.forEach(raw => {
    const poll = normalisePoll(raw);
    if (seen.has(poll.id)) poll.id = pollUid("poll");
    seen.add(poll.id);
    out.push(poll);
  });
  return out.sort((a, b) => (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at)));
}

function normalisePollVote(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const created = source.created_at || new Date().toISOString();
  const rating = Number(source.rating);
  return {
    id: String(source.id || pollUid("vote")),
    poll_id: String(source.poll_id || ""),
    voter_key: String(source.voter_key || ""),
    author: pollClean(source.author, 40),
    choice_ids: Array.isArray(source.choice_ids) ? source.choice_ids.map(String) : [],
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    text: pollClean(source.text, MAX_POLL_TEXT),
    created_at: created,
    updated_at: source.updated_at || created
  };
}

function normalisePollVotes(list) {
  return (Array.isArray(list) ? list : []).map(normalisePollVote).filter(v => v.poll_id && v.voter_key);
}

/* Choices shown for a poll: explicit options, or the built-in yes/no set. */
function pollChoices(poll) {
  if (poll?.type === "yesno") {
    return [
      { id: "yes", label: pollText("Yes"), media: "👍" },
      { id: "no", label: pollText("No"), media: "👎" }
    ];
  }
  return Array.isArray(poll?.options) ? poll.options : [];
}

function pollAnswerFor(poll, vote) {
  if (!poll || !vote) return "";
  if (poll.type === "text") return vote.text || "";
  if (poll.type === "rating") return vote.rating ? vote.rating + pollText(" / 5") : "";
  const ids = new Set(vote.choice_ids || []);
  return pollChoices(poll).filter(o => ids.has(o.id)).map(o => o.label).join(", ");
}

function pollHasAnswer(poll, vote) {
  if (!poll || !vote) return false;
  if (poll.type === "text") return !!String(vote.text || "").trim();
  if (poll.type === "rating") return !!vote.rating;
  return (vote.choice_ids || []).some(id => pollChoices(poll).some(o => o.id === id));
}

function pollVoteFor(votes, pollId, voterKey) {
  if (!pollId || !voterKey) return null;
  return (votes || []).find(v => v.poll_id === pollId && v.voter_key === voterKey) || null;
}

function pollPct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function pollStats(poll, votes) {
  const all = (votes || []).filter(v => v.poll_id === poll?.id && pollHasAnswer(poll, v));
  const total = all.length;
  const people = new Set(all.map(v => v.voter_key || v.author).filter(Boolean)).size;
  const base = { total, people, lastAt: all.reduce((last, v) => {
    const t = String(v.updated_at || v.created_at || "");
    return t > last ? t : last;
  }, ""), responses: all };

  if (poll?.type === "rating") {
    const counts = [0, 0, 0, 0, 0];
    all.forEach(v => { if (v.rating >= 1 && v.rating <= 5) counts[v.rating - 1]++; });
    const rated = counts.reduce((a, b) => a + b, 0);
    const sum = counts.reduce((acc, count, i) => acc + count * (i + 1), 0);
    return {
      ...base,
      rating: {
        counts,
        total: rated,
        avg: rated ? sum / rated : 0
      },
      options: [],
      top: []
    };
  }

  if (poll?.type === "text") {
    const texts = all.filter(v => String(v.text || "").trim())
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    return { ...base, total: texts.length, texts, options: [], top: [] };
  }

  const choices = pollChoices(poll);
  const options = choices.map(option => {
    const count = all.filter(v => (v.choice_ids || []).includes(option.id)).length;
    return { ...option, count, pct: pollPct(count, total) };
  });
  const max = options.reduce((m, o) => Math.max(m, o.count), 0);
  return {
    ...base,
    options,
    top: max > 0 ? options.filter(o => o.count === max) : [],
    multi: !!pollType(poll?.type).multiple
  };
}

function pollAnswerSummary(poll, vote) {
  const answer = pollAnswerFor(poll, vote);
  return answer || pollText("No answer");
}

/* A frame-by-frame history for the live bar-chart race.
   Every vote becomes one frame at the time it was (last) saved, so an
   updated answer moves the race just like a fresh one. */
function pollRaceSeries(poll, votes) {
  const kind = poll?.type === "rating" ? "rating" : poll?.type === "text" ? "text" : "choice";
  const relevant = (votes || [])
    .filter(v => v.poll_id === poll?.id && pollHasAnswer(poll, v))
    .slice()
    .sort((a, b) => {
      const at = String(a.updated_at || a.created_at || "");
      const bt = String(b.updated_at || b.created_at || "");
      return at.localeCompare(bt) || String(a.id).localeCompare(String(b.id));
    });

  if (kind === "text") {
    return { kind, entries: [], frames: [{ at: "", counts: [], total: 0 }], total: relevant.length };
  }

  const entries = kind === "rating"
    ? [5, 4, 3, 2, 1].map(score => ({ id: "rate-" + score, label: score + "★", media: "", score }))
    : pollChoices(poll).map(option => ({ ...option }));

  const counts = entries.map(() => 0);
  const frames = [{ at: "", counts: counts.slice(), total: 0 }];
  relevant.forEach(vote => {
    if (kind === "rating") {
      const index = 5 - (Number(vote.rating) || 0);
      if (index >= 0 && index < 5) counts[index]++;
    } else {
      const ids = new Set(vote.choice_ids || []);
      entries.forEach((entry, i) => { if (ids.has(entry.id)) counts[i]++; });
    }
    frames.push({
      at: String(vote.updated_at || vote.created_at || ""),
      counts: counts.slice(),
      total: frames.length
    });
  });

  return { kind, entries, frames, total: relevant.length, lastAt: frames[frames.length - 1]?.at || "" };
}

function pollVoteIsComplete(poll, draft) {
  if (!poll || !draft) return false;
  if (poll.type === "text") return !!String(draft.text || "").trim();
  if (poll.type === "rating") return Number(draft.rating) >= 1 && Number(draft.rating) <= 5;
  const ids = Array.isArray(draft.choice_ids) ? draft.choice_ids : [];
  if (!ids.length) return false;
  if (poll.type === "multi") return ids.length <= Math.max(1, poll.maxChoices || poll.options.length);
  return ids.length === 1;
}

function pollCanSeeResults(poll, vote) {
  if (!poll) return false;
  if (poll.results === "always") return true;
  if (poll.results === "presenter") return false;
  return !!vote;
}

/* ── demo samples ───────────────────────────────────────────────
   One click should exercise the whole poll feature: every type,
   every status, all three result modes, emoji and image media,
   and enough staggered votes for the chart race to move. */

function pollSampleImage(emoji, bg) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="14" fill="' + (bg || "#FFE28A") + '"/>' +
    '<text x="32" y="44" font-size="34" text-anchor="middle" ' +
    'font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">' +
    emoji + '</text></svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function pollSampleVotes(slug, pollId, start, step, rows) {
  return rows.map(([author, answer], index) => {
    const at = new Date(start + index * step).toISOString();
    const n = String(index + 1).padStart(2, "0");
    return normalisePollVote({
      id: "sample-vote-" + slug + "-" + n,
      poll_id: pollId,
      voter_key: "sample-" + slug + "-" + n,
      author,
      ...answer,
      created_at: at,
      updated_at: at
    });
  });
}

function pollSampleSet(now, batch) {
  const end = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const minute = 60000;
  const round = Math.max(0, Math.floor(Number(batch) || 0));
  const created = new Date(end - 75 * minute).toISOString();
  const make = (slug, position, raw) => normalisePoll({
    id: "sample-" + slug,
    created_at: created,
    updated_at: created,
    position: position + round * 100,
    ...raw
  });

  const polls = [
    make("priorities", 1, {
      question: "Which improvement should we map next?",
      description: "Pick the one your community needs most. The bars move live.",
      type: "single",
      category: "Priorities",
      status: "open",
      results: "always",
      options: [
        { id: "maps", label: "Better maps", media: "🗺️" },
        { id: "training", label: "Training", media: "🎓" },
        { id: "data", label: "Open data", media: "📊" },
        { id: "safe", label: "Safer streets", media: "🚸" }
      ]
    }),
    make("improvements", 2, {
      question: "Which improvements matter most today?",
      description: "Choose up to three. Every option has a little picture for the race.",
      type: "multi",
      category: "Feedback",
      status: "open",
      results: "always",
      maxChoices: 3,
      options: [
        { id: "wifi", label: "Free Wi-Fi", media: pollSampleImage("📶", "#FFE28A") },
        { id: "coffee", label: "Coffee corner", media: pollSampleImage("☕", "#FFD1B8") },
        { id: "childcare", label: "Childcare", media: pollSampleImage("🧸", "#CDE7FF") },
        { id: "quiet", label: "Quiet room", media: pollSampleImage("🤫", "#D9F2CC") },
        { id: "stream", label: "Live stream", media: pollSampleImage("🎥", "#F3D1FF") }
      ]
    }),
    make("open-data", 3, {
      question: "Should we publish the map data openly?",
      description: "Vote first, then the results unlock on your phone.",
      type: "yesno",
      category: "Knowledge",
      status: "open",
      results: "after"
    }),
    make("workshop", 4, {
      question: "How useful was today's workshop?",
      description: "One to five stars. The average updates as people answer.",
      type: "rating",
      category: "Feedback",
      status: "open",
      results: "always"
    }),
    make("next-idea", 5, {
      question: "What should we try next?",
      description: "Open answers stay on the presenter screen during the session.",
      type: "text",
      category: "Ideas",
      status: "open",
      results: "presenter"
    }),
    make("updates", 6, {
      question: "Which channel should we use for updates?",
      description: "A draft poll: only the presenter can see it until it opens.",
      type: "single",
      category: "Knowledge",
      status: "draft",
      results: "after",
      options: [
        { id: "email", label: "Email", media: "✉️" },
        { id: "whatsapp", label: "WhatsApp", media: "💬" },
        { id: "signal", label: "Signal", media: "🔒" },
        { id: "sms", label: "SMS", media: "📱" }
      ]
    }),
    make("meetup-day", 7, {
      question: "Which day worked best for the meetup?",
      description: "A closed poll with final results still visible on the wall.",
      type: "single",
      category: "Other",
      status: "closed",
      results: "always",
      options: [
        { id: "saturday", label: "Saturday", media: "🌞" },
        { id: "sunday", label: "Sunday", media: "🌿" },
        { id: "weekday", label: "Weekday evening", media: "🌙" }
      ]
    }),
    make("venue", 8, {
      question: "Where should the next meetup happen?",
      description: "After you vote, your phone shows the live results.",
      type: "single",
      category: "Logistics",
      status: "open",
      results: "after",
      options: [
        { id: "library", label: "Kigali Library", media: "📚" },
        { id: "hub", label: "Innovation Hub", media: "💡" },
        { id: "hall", label: "Community Hall", media: "🏡" },
        { id: "online", label: "Online", media: "💻" }
      ]
    })
  ];

  const votes = [
    ...pollSampleVotes("priorities", "sample-priorities", end - 14 * minute, 50 * 1000, [
      ["Amina", { choice_ids: ["training"] }],
      ["Tunde", { choice_ids: ["maps"] }],
      ["Lerato", { choice_ids: ["training"] }],
      ["Sofia", { choice_ids: ["data"] }],
      ["Kwame", { choice_ids: ["maps"] }],
      ["Nadia", { choice_ids: ["training"] }],
      ["Ibrahim", { choice_ids: ["data"] }],
      ["Chen", { choice_ids: ["maps"] }],
      ["Maya", { choice_ids: ["safe"] }],
      ["Zola", { choice_ids: ["training"] }],
      ["Kofi", { choice_ids: ["maps"] }],
      ["Nia", { choice_ids: ["data"] }],
      ["Omar", { choice_ids: ["maps"] }],
      ["Aya", { choice_ids: ["safe"] }],
      ["Esi", { choice_ids: ["training"] }],
      ["Blaise", { choice_ids: ["maps"] }]
    ]),
    ...pollSampleVotes("improvements", "sample-improvements", end - 12 * minute, 45 * 1000, [
      ["Amina", { choice_ids: ["wifi", "coffee"] }],
      ["Tunde", { choice_ids: ["childcare"] }],
      ["Lerato", { choice_ids: ["wifi"] }],
      ["Sofia", { choice_ids: ["coffee", "quiet"] }],
      ["Kwame", { choice_ids: ["stream"] }],
      ["Nadia", { choice_ids: ["wifi", "childcare"] }],
      ["Ibrahim", { choice_ids: ["coffee", "quiet"] }],
      ["Chen", { choice_ids: ["wifi", "stream"] }],
      ["Maya", { choice_ids: ["coffee", "childcare"] }],
      ["Zola", { choice_ids: ["quiet"] }],
      ["Kofi", { choice_ids: ["wifi", "coffee"] }],
      ["Nia", { choice_ids: ["stream", "quiet"] }],
      ["Omar", { choice_ids: ["childcare"] }],
      ["Aya", { choice_ids: ["wifi", "quiet"] }]
    ]),
    ...pollSampleVotes("open-data", "sample-open-data", end - 11.5 * minute, 55 * 1000, [
      ["Amina", { choice_ids: ["yes"] }],
      ["Tunde", { choice_ids: ["no"] }],
      ["Lerato", { choice_ids: ["yes"] }],
      ["Sofia", { choice_ids: ["yes"] }],
      ["Kwame", { choice_ids: ["no"] }],
      ["Nadia", { choice_ids: ["yes"] }],
      ["Ibrahim", { choice_ids: ["yes"] }],
      ["Chen", { choice_ids: ["no"] }],
      ["Maya", { choice_ids: ["yes"] }],
      ["Zola", { choice_ids: ["no"] }],
      ["Kofi", { choice_ids: ["yes"] }]
    ]),
    ...pollSampleVotes("workshop", "sample-workshop", end - 11.5 * minute, 40 * 1000, [
      ["Amina", { rating: 5 }],
      ["Tunde", { rating: 4 }],
      ["Lerato", { rating: 5 }],
      ["Sofia", { rating: 3 }],
      ["Kwame", { rating: 5 }],
      ["Nadia", { rating: 4 }],
      ["Ibrahim", { rating: 5 }],
      ["Chen", { rating: 2 }],
      ["Maya", { rating: 4 }],
      ["Zola", { rating: 3 }],
      ["Kofi", { rating: 5 }],
      ["Nia", { rating: 4 }],
      ["Omar", { rating: 3 }],
      ["Aya", { rating: 5 }],
      ["Esi", { rating: 1 }]
    ]),
    ...pollSampleVotes("next-idea", "sample-next-idea", end - 8.5 * minute, 70 * 1000, [
      ["Amina", { text: "A monthly mapathon in every district." }],
      ["Tunde", { text: "Teach teachers how to use the map in class." }],
      ["Lerato", { text: "Publish a tiny starter kit for new mappers." }],
      ["Sofia", { text: "Invite the water points team to the next session." }],
      ["Kwame", { text: "Add a French and Kinyarwanda guide." }],
      ["Nadia", { text: "Make a poster we can print for the library." }]
    ]),
    ...pollSampleVotes("meetup-day", "sample-meetup-day", end - 10.2 * minute, 65 * 1000, [
      ["Amina", { choice_ids: ["saturday"] }],
      ["Tunde", { choice_ids: ["saturday"] }],
      ["Lerato", { choice_ids: ["sunday"] }],
      ["Sofia", { choice_ids: ["weekday"] }],
      ["Kwame", { choice_ids: ["saturday"] }],
      ["Nadia", { choice_ids: ["weekday"] }],
      ["Ibrahim", { choice_ids: ["sunday"] }],
      ["Chen", { choice_ids: ["saturday"] }]
    ]),
    ...pollSampleVotes("venue", "sample-venue", end - 9.8 * minute, 50 * 1000, [
      ["Amina", { choice_ids: ["library"] }],
      ["Tunde", { choice_ids: ["hub"] }],
      ["Lerato", { choice_ids: ["library"] }],
      ["Sofia", { choice_ids: ["online"] }],
      ["Kwame", { choice_ids: ["hub"] }],
      ["Nadia", { choice_ids: ["library"] }],
      ["Ibrahim", { choice_ids: ["hub"] }],
      ["Chen", { choice_ids: ["hall"] }],
      ["Maya", { choice_ids: ["library"] }]
    ])
  ];

  /* Loading the samples again appends a fresh round with its own ids,
     positions and voter keys, so the earlier results stay untouched. */
  if (round > 0) {
    const prefix = "b" + round + "-";
    const remap = id => id.startsWith("sample-") ? "sample-" + prefix + id.slice(7) : id;
    polls.forEach(poll => {
      poll.id = remap(poll.id);
      poll.question = "Round " + (round + 1) + " · " + poll.question;
    });
    votes.forEach(vote => {
      vote.poll_id = remap(vote.poll_id);
      vote.voter_key = vote.voter_key + "-" + prefix;
    });
  }

  return { polls, votes };
}
