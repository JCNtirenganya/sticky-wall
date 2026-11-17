# Sticky Note Wall — live-event interaction system

Three static pages + Supabase realtime. Hosted free on GitHub Pages.

| Page | Who | URL |
|---|---|---|
| `index.html` | Main monitor (presenter board) — includes the draggable scannable QR card; press **Full screen** (**Shift+F**) when ready | `https://<you>.github.io/<repo>/` |
| `phone.html` | Audience (phones) — the board's QR code points here | `https://<you>.github.io/<repo>/phone.html` |
| `embed.html` | Optional read-only live notes embed | `https://<you>.github.io/<repo>/embed.html?module=notes` |

## Try it now (local mode)

Leave `js/config.js` empty. Open `index.html` and `phone.html` in two tabs of the same browser (serve with `python3 -m http.server`). The board opens on its module picker; choose a wall. Everything stays in that browser: submit from the phone page and watch the note land on the wall. To run a real event, fill in the Supabase keys as described below.

Serving to phones on the same Wi-Fi? Bind the server to `0.0.0.0` and put your laptop's LAN address in `MOBILE_URL` (e.g. `http://192.168.1.20:8137/phone.html`) so the QR code is scannable from a phone.

## Go live
1. **Supabase** → new project → SQL Editor → paste `supabase/schema.sql` → Run.
2. Paste `supabase/migration-media.sql` → Run (adds the media bucket and `event_media` table).
3. Paste `supabase/migration-presenter-reset.sql` → Run, then set your own passphrase with the update statement in step 2 of that file.
4. Project Settings → API: copy *Project URL* and the publishable/anon key into `js/config.js`.
5. **GitHub** → push this folder to a repo → Settings → Pages → Deploy from branch `main` / root.
6. Open the board and phone URLs above. Done.

Upgrading an existing install? Run `supabase/migration-author-names.sql` once if the board still hides sender names, `supabase/migration-categories.sql` to allow the five dynamic categories, `supabase/migration-media.sql` for the media wall, and `supabase/migration-presenter-reset.sql` for the passphrase reset. All keep existing notes.

Security: notes are written only through the RPCs (`submit_note`, `get_categories`, `set_categories`, `reassign_notes`). **Settings → Start fresh → Clear all submissions** calls `presenter_clear`, a `SECURITY DEFINER` function that checks a bcrypt passphrase stored in `presenter_config`; it deletes the rows, then the board removes the stored files through the Storage API. The passphrase itself is never shipped to the browser. The board has no presenter login, so treat the board URL as the presenter control and keep it off the audience phones. Sender names appear on the board, so they are stored in `notes.author_name`. To pull a note off the wall: `update notes set hidden = true where id = '…';` — it vanishes from the board instantly.

## Design stack

Deliberately **zero-build**: plain HTML, CSS and modern JavaScript, served as static files. Nothing to compile, no node_modules, no framework to keep updated before an event.

- **Layered CSS gradients + SVG data-URI textures** for cork, paper grain and fibres. No image files to host or preload.
- **`color-mix()`, custom properties and `clamp()`** for a consistent palette across board and phone.
- **Deterministic per-note styling** (`js/shared.js`): every note gets a stable paper shade, fold, ink colour, rotation and one of eight handwriting faces, derived from its id.
- **CSS transitions/keyframes** for paper lifts, filter fades and the phone send animation. No animation library.
- **Day rails** filter notes, dashboard rows, the media grid and the media stage with one shared choice.
- **Swiss chrome pass**: the interface layer (header, buttons, dialogs, rails) is flat, hairline-ruled and typographic, while the notes keep their paper character.
- **A locally vendored QR generator** (`js/qrcode.js`, MIT) draws the phone link on the board at runtime.
- **`prefers-reduced-motion`** support across the stylesheets.
- **Canvas export** (`js/export.js`): a high-resolution JPEG of the notes-only wall.
- **Highlights report** (`js/highlights.js`): themes, quotes and participation, with an optional AI writer and a deterministic local fallback.

## Configuration (`js/config.js`)

| Key | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | `""` | Empty = demo mode (localStorage, same browser). |
| `EVENT_TITLE` | `"Sticky Wall"` | Default board title. The presenter can override it. |
| `EVENT_SUBTITLE` | `"Notes from the room"` | Default second line under the title. |
| `EVENT_LOGO` | `"assets/sanokip-cbc-light.png"` | Logo shown beside the title. Empty hides it. |
| `EVENT_LOGO_ALT` | `"Sanokip CBC"` | Accessible description for the logo. |
| `MOBILE_URL` | `""` | Address encoded in the board's QR code. Empty = the `phone.html` beside `index.html`. |
| `HIGHLIGHTS_URL` | `""` | Supabase Edge Function that writes the highlights report with a model. Empty = local extractor. |
| `MAX_CHARS` | `200` | Phone textarea limit and board fit target. |
| `MIN_SECONDS_BETWEEN_NOTES` | `6` | Per-phone cooldown between submissions. |

Presenter changes are stored in this browser (`localStorage`) so the wall keeps its name after a refresh. **Use defaults** restores the values above. In Supabase mode the category plan is also stored in the `settings` table and synced to every board and phone.

## Moderator controls (board)
- **Click** a note → reading mode (note grows and centres, the rest greys out). **Esc** closes.
- **← → / Space** previous / next note.
- **E** or the pencil beside the logo → name the wall (event title + subtitle).
- **One header**: the event name stays top-left everywhere, and its second line names the module on screen (Notes, Dashboard, Media, Stream, Split screen, Settings). Module walls have no repeated titles.
- **C** or the slider button beside the logo → edit categories and colours. Up to nine categories.
- **Filters** are hidden: hover the top edge or press **F**. Keys **1–9** pick categories; **0** = all.
- **Settings** (**H**, or the button on every module wall and the split bar): event name, header/QR/filter-bar toggles, wall colour, and **Advanced** (background image, logo). **Module home** there returns to the picker.
- **Module home**: the board opens here on every load. Pick notes, media or stream with the cards or number shortcuts **1–3**; **V** opens media from anywhere.
- **Module counts** under each module's buttons are buttons too: click one to open that module. Zeros stay dimmed. The open module never counts itself.
- **Dates**: every note, media card, dashboard row and media slide carries its arrival date/time. A day rail filters the wall by day; **All days** restores everything.
- **Move the QR card**: drag it anywhere; the board remembers the spot. Double-click returns it to the top-right, or use **Settings → Advanced**.
- **Dashboard colour**, category colours and dashboard settings live in **Settings → Notes**.
- Cursor hides after 2.5 s; controls fade back in on pointer movement. Choices persist in this browser.
- **Presentation modes** — **Notes only**, **Present**, **One by one**, **Manual** — are chrome-free: header, status, QR, filters and the Settings dock disappear, the browser goes fullscreen, and only the content remains.

## Board layout
The grid uses one fixed cell size derived from the full-screen capacity, so a short list stays on a regular grid instead of stretching across the wall. Notes fill column one top to bottom, then column two, in arrival order. The cell size does not change as notes arrive.

With **Categories in columns** enabled, every category starts a new column. When the fixed grid cannot hold every note, the board gathers notes into one same-colour paper pile per category; pile counts update live. Notes always stay below the QR card. Hiding the header lets notes reclaim the top of the wall.

## Phone flow
1. Enter a name or nickname.
2. Pick a category card — the five defaults are Question, Idea, Appreciation, Resource and Request, and the presenter's changes appear live.
3. Write on the full-size paper sheet; the counter and send button track the draft.
4. Send: the sheet lifts off the screen, a paper toast confirms, and the wall receives the note in realtime, signed with the sender's name.

**Event media.** Photos are resized before sending. Videos must be **15 seconds or shorter** and under 50 MB; clips over about 6 MB are re-recorded on the phone at a lower bitrate first, so the upload is much smaller. The phone shows real upload progress, and any compression problem falls back to the original file (iOS Safari cannot capture a playing video, so it uploads the original).

**Live camera.** A phone can ask to go live. The presenter approves the request and chooses the stream wall, a floating window or a split with media. The **LIVE** signal is a coloured dot, never a text badge.

## Language
Both pages ship with **English and French**. Use the **EN / FR** switch on the phone, the board dashboard or **Settings → Language**. The choice is stored in `sticky_lang` and the page reloads. A saved `sticky_lang=rw` value falls back to English. Static text uses `data-i18n` attributes; dynamic text goes through `t(key, vars)`.

## Highlights report
Open it from the dashboard (**Highlights report**) or **Settings → Highlights report**.

- **Themes**: each category that received notes, with its most recurring words and a note count.
- **In their words**: scored verbatim excerpts, one strong quote per category first, then the best remaining.
- **Participation**: note count, named contributors, anonymous notes, first/last note dates and media count.
- **AI or local**: with `HIGHLIGHTS_URL` set, the board POSTs the notes to the Edge Function and shows whatever model-written report it returns. Without it, or if the request fails, a deterministic local extractor builds the same sections. A small badge says **AI summary** or **Local summary**.
- **Save as PDF** fills the print-only `#print-sheet` and opens the browser's print dialog, where **Save as PDF** produces an A4 report with the event title and logo.

To enable the AI writer:

```bash
supabase functions deploy highlights --no-verify-jwt
supabase secrets set OPENAI_API_KEY=sk-...
# optional
supabase secrets set HIGHLIGHTS_MODEL=gpt-4o-mini
```

Then set `HIGHLIGHTS_URL` in `js/config.js` to
`https://<project>.supabase.co/functions/v1/highlights`. The function is in `supabase/functions/highlights/index.ts`.

## Exports
- **Notes image JPEG** renders only the notes view: wall colour/background, paper notes, handwriting, author signature, a small category dot and the date stamp. No UI, QR, filters or empty state. Visible notes only.
- The old wall-summary PDF is replaced by the **Highlights report** above.

## Files
- `css/paper.css` — shared design tokens, SVG grain/fibre textures, reduced-motion defaults
- `css/board.css` — cork wall, brand/status/filter UI, dashboard, Settings dock, module walls, day rails, focus stage, highlights dialog and print report
- `css/postit.css` — matte post-it paper: gum line, fibre grain, adhesive sheen, fold, hover lift, date stamp
- `css/piles.css` — dynamic same-colour category paper stacks
- `css/qr.css` — draggable paper QR card
- `css/mobile.css` — phone screens, category cards, media and live screens, paper sheet, send/fly and toast
- `js/shared.js` — default categories, palettes, handwriting fonts, deterministic note look, `noteDateLabel()`, `buildNote()`
- `js/i18n.js` — English / French dictionaries, markup translation, `t()` and the persisted switch
- `js/export.js` — `window.StickyExport.downloadJPEG(payload)` canvas renderer
- `js/highlights.js` — local and remote highlights report, dialog and print sheet
- `js/board.js` — grid, piles, categories, module walls, day rails, exports, reading mode, filters, preferences, realtime hooks
- `js/qrcode.js` — vendored MIT QR generator
- `js/mobile.js` — name → category → write → send flow, media (15 s cap) and live camera
- `js/store.js` — Supabase adapter or demo adapter (localStorage + BroadcastChannel)
- `index.html` — main monitor markup
- `phone.html` — audience phone markup
- `supabase/functions/highlights/index.ts` — optional AI highlights Edge Function
- `supabase/schema.sql` — tables, RLS, dynamic categories and the RPCs
- `supabase/migration-media.sql` — media bucket, `event_media` table, storage policies and realtime
- `supabase/migration-presenter-reset.sql` — bcrypt passphrase and the `presenter_clear` reset function

The poll module is gone: no board, phone or embed code loads it. `supabase/migration-polls.sql` remains only as history for databases that ran it; new installs do not need it.

## Quick checks
- Board: notes fit inside their sheets, with the sender's name and arrival date at the bottom; the fixed grid resizes without stretching a short list.
- Modules: opening media or stream hides the notes layer completely. Only one module is open at a time, and **Esc** returns to notes.
- Counts: the other-module counts appear under the open module's buttons and in the status strip; clicking one opens that module. Zero counts are dimmed.
- Dates: switch a day in the rail and confirm notes, dashboard rows and media follow; **All days** restores everything.
- Settings: **H** opens Settings; **Module home** there returns to the picker. Toggling header, QR and filters should reclaim space and survive a refresh.
- Startup: open the board and confirm the module picker appears before any wall; reload and confirm it returns there.
- Presentation: **Notes only** hides all chrome and enters fullscreen; **Esc** restores exactly what was visible.
- QR: scan the top-right code; drag it, refresh, and confirm it stays. Double-click returns it to the corner.
- Media: press **V**; photos and videos sit directly on the cork. Try a clip longer than 15 seconds and confirm the phone refuses it. **Present** switches to the black stage.
- Highlights: open the report, check themes/quotes/participation, then **Save as PDF** and confirm the A4 report. With `HIGHLIGHTS_URL` empty the badge should read **Local summary**.
- Language: switch between **EN** and **FR** on both pages; dynamic labels should follow.
- Reduced motion: enable the OS setting; entrances and pulses should settle down.
