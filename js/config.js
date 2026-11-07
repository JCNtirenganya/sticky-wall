// ─────────────────────────────────────────────────────────────
//  Fill these two values after creating your Supabase project.
//  Leave them empty to run in DEMO MODE (notes sync between tabs
//  of the same browser only — perfect for trying it out).
// ─────────────────────────────────────────────────────────────
window.STICKY_CONFIG = {
  SUPABASE_URL: "https://vkphwxyctiftwqhqtwda.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_d4oNn8kp1y0oZhek6W1S7A_r-GpXRXF",

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
  MIN_SECONDS_BETWEEN_NOTES: 6,

  // Live phone streaming uses WebRTC. STUN works on most home Wi-Fi; a TURN
  // relay is what connects phones on strict mobile/CGNAT networks. Leave these
  // empty to use the shared free Open Relay fallback, or point them at your own
  // relay for reliability. Set LIVE_PUBLIC_TURN: false to disable the fallback.
  TURN_URL: "",
  TURN_USERNAME: "",
  TURN_CREDENTIAL: "",
  LIVE_PUBLIC_TURN: true
};
