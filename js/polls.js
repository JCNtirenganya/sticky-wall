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
