// Supabase Edge Function: highlights report.
//
// Deploy:  supabase functions deploy highlights --no-verify-jwt
// Secrets: supabase secrets set OPENAI_API_KEY=sk-...
// Optional: HIGHLIGHTS_MODEL (default gpt-4o-mini), ALLOWED_ORIGIN
//
// The board posts { notes, brand, stats } and expects
// { report: { summary, themes: [{ title, detail, count }], quotes: [{ text, author, category }] } }.
// With no key the function answers 503 so the board keeps its local report.

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });

type Note = {
  text?: string;
  author?: string;
  category?: string;
  created_at?: string;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ error: "OPENAI_API_KEY is not set" }, 503);

  let payload: { notes?: Note[]; brand?: { title?: string; subtitle?: string }; stats?: { media?: number } };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const notes = (Array.isArray(payload.notes) ? payload.notes : [])
    .map(note => ({
      text: String(note.text || "").slice(0, 500),
      author: String(note.author || "").slice(0, 80),
      category: String(note.category || "").slice(0, 80),
      created_at: String(note.created_at || "")
    }))
    .filter(note => note.text.trim())
    .slice(0, 400);

  if (!notes.length) return json({ error: "No notes to summarise" }, 400);

  const brand = payload.brand || {};
  const media = Number(payload.stats?.media) || 0;
  const rows = notes.map((note, i) =>
    `${i + 1}. [${note.category || "Note"}] ${note.author || "Anonymous"} (${note.created_at || "no date"}): ${note.text}`
  ).join("\n");

  const prompt = [
    `Event: ${brand.title || "Sticky Wall"}${brand.subtitle ? " — " + brand.subtitle : ""}`,
    `${notes.length} notes from the wall${media ? ` and ${media} photos/videos` : ""}.`,
    "",
    "Write a short, warm, concrete highlights report for the presenter to read aloud.",
    "Rules:",
    "- summary: 2–3 sentences, no bullet points, no invented facts.",
    "- themes: 3–5 items with a short title, one sentence of evidence, and the number of notes.",
    "- quotes: 3–5 verbatim excerpts from the notes, each under 30 words, with the author as written (or Anonymous).",
    "- Use the same language as the notes when they are mostly one language; otherwise English.",
    "- Return JSON only, exactly this shape:",
    '{"report":{"summary":"...","themes":[{"title":"...","detail":"...","count":3}],"quotes":[{"text":"...","author":"...","category":"..."}]}}',
    "",
    "NOTES",
    rows
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: Deno.env.get("HIGHLIGHTS_MODEL") || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You write concise event highlights as strict JSON." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      console.error("OpenAI error", response.status, await response.text());
      return json({ error: "The model is unavailable" }, 502);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const report = JSON.parse(text);
    return json(report?.report ? report : { report });
  } catch (error) {
    console.error("Highlights failed", error);
    return json({ error: "Could not write the report" }, 500);
  }
});
