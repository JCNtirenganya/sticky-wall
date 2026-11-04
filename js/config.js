// ─────────────────────────────────────────────────────────────
//  Fill these two values after creating your Supabase project.
//  Leave them empty to run in DEMO MODE (notes sync between tabs
//  of the same browser only — perfect for trying it out).
// ─────────────────────────────────────────────────────────────
window.STICKY_CONFIG = {
  SUPABASE_URL: "",        // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "",   // the public "anon" key (safe to publish)

  // Optional event branding. The presenter can change the title and
  // subtitle directly on the board (pencil button or press E).
  EVENT_TITLE: "Sticky Wall",
  EVENT_SUBTITLE: "Notes from the room",
  EVENT_LOGO: "assets/sanokip-cbc-light.png",
  EVENT_LOGO_ALT: "Sanokip CBC",

  // Optional: address encoded in the board's QR code. Leave empty to use
  // the mobile page sitting next to the board (index.html).
  MOBILE_URL: "",

  MAX_CHARS: 200,
  MIN_SECONDS_BETWEEN_NOTES: 6
};
