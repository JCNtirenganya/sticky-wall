# Sticky Note Wall — live-event interaction system

Two static pages + Supabase realtime. Hosted free on GitHub Pages.

| Page | Who | URL |
|---|---|---|
| `index.html` | Audience (phones) — the board's QR code points here | `https://<you>.github.io/<repo>/` |
| `board.html` | Main monitor — includes the scannable QR card; press **Full screen** (**Shift+F**) when ready | `https://<you>.github.io/<repo>/board.html` |

## Try it now (demo mode)
Leave `js/config.js` empty. Open `board.html` and `index.html` in two tabs of the same browser (serve with `python3 -m http.server`). Press **S** on the board (or use **Extras → Demo data**) to add sample notes; pressing again adds a second, different batch. **Add sample polls** works the same way and appends a new round of polls instead of replacing the old ones.

Serving to phones on the same Wi-Fi? Bind the server to `0.0.0.0` and put your laptop's LAN address in `MOBILE_URL` (e.g. `http://192.168.1.20:8137/index.html`) so the QR code is scannable from a phone.

## Go live
1. **Supabase** → new project → SQL Editor → paste `supabase/schema.sql` → Run.
2. Paste `supabase/migration-polls.sql` → Run (adds the `polls` and `poll_votes` tables used by the poll room).
3. Paste `supabase/migration-media.sql` → Run (adds the media bucket and `event_media` table).
4. Paste `supabase/migration-presenter-reset.sql` → Run, then set your own passphrase with the update statement in step 2 of that file.
5. Project Settings → API: copy *Project URL* and the *anon public* key into `js/config.js`.
6. **GitHub** → push this folder to a repo → Settings → Pages → Deploy from branch `main` / root.
7. Open the two URLs above. Done.

Upgrading an existing install? Run `supabase/migration-author-names.sql` once if the board still hides sender names, then `supabase/migration-categories.sql` once to allow the five dynamic categories, then `supabase/migration-polls.sql` for live polls, `supabase/migration-media.sql` for the media wall, and `supabase/migration-presenter-reset.sql` for the passphrase reset. All keep existing notes.

Security: notes are written only through the RPCs (`submit_note`, `get_categories`, `set_categories`, `reassign_notes`). Polls and votes use the `polls` / `poll_votes` tables directly so the phone page can upsert one answer per voter; the anon key can technically write them. **Extras → Start fresh → Clear all submissions** calls `presenter_clear`, a `SECURITY DEFINER` function that checks a bcrypt passphrase stored in `presenter_config`; it deletes the rows, then the board removes the stored files through the Storage API. The passphrase itself is never shipped to the browser. The board has no presenter login, so treat the board URL as the presenter control and keep it off the audience phones. Sender names appear on the board, so they are stored in `notes.author_name`. To pull a note off the wall: `update notes set hidden = true where id = '…';` — it vanishes from the board instantly.

## Design stack (v2)

Still deliberately **zero-build**: plain HTML, CSS and modern JavaScript, served as static files. Nothing to compile, no node_modules, no framework to keep updated before an event — but the visual layer now uses the full modern CSS toolbox:

- **Layered CSS gradients + SVG data-URI textures** for cork, paper grain and fibres. No image files to host or preload.
- **`color-mix()`, custom properties and `clamp()`** for a consistent palette across board and phone.
- **Deterministic per-note styling** (`js/shared.js`): every note gets a stable paper shade, fold, ink colour, rotation and one of eight handwriting faces, derived from its id. The same note looks identical on every screen and after a reload.
- **CSS transitions/keyframes** for the paper lift, fold shadows, filter fades, Bun's moods, the fanned category piles and the phone "fly to the wall" send animation. No animation library.
- **A locally vendored QR generator** (`js/qrcode.js`, MIT) draws the phone link on the board at runtime, so there is no QR image to regenerate after a deploy.
- **`prefers-reduced-motion`** support in `css/paper.css`, `css/board.css`, `css/avatar.css`, `css/piles.css`, `css/charts.css` and `css/mobile.css`.
- **Web-font loading aware layout**: `js/board.js` re-fits handwriting after `document.fonts.ready` and on every `loadingdone`, so notes never clip text when a font arrives late.
- **Hand-drawn charts with no chart library** (`js/charts.js`, `css/charts.css`): wobbly inline-SVG bands, crayon hatching and handwritten labels, seeded per option so a chart does not jump between renders. The same renderer is used on the board and on phones.
- **Canvas and print exports** (`js/export.js`): a high-resolution JPEG drawn entirely on a canvas, and a print-only HTML sheet for the browser's **Save as PDF**. No server, no PDF library.

The result is a warm cork wall, matte post-it sheets with a gum line and curled corners, a map-and-coffee rabbit mascot with mood-specific SVG acting, and a phone flow built from a paper name card and full-sheet writing screen.

## Configuration (`js/config.js`)

| Key | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | `""` | Empty = demo mode (localStorage, same browser). |
| `EVENT_TITLE` | `"Sticky Wall"` | Default board title. The presenter can override it on the board. |
| `EVENT_SUBTITLE` | `"Notes from the room"` | Default second line under the title. |
| `EVENT_LOGO` | `"assets/sanokip-cbc-light.png"` | Logo shown beside the title. Empty hides the logo. |
| `EVENT_LOGO_ALT` | `"Sanokip CBC"` | Accessible description for the logo. |
| `MOBILE_URL` | `""` | Address encoded in the board's QR code. Empty = the `index.html` beside `board.html`; set a full URL when the phone page lives elsewhere. |
| `MAX_CHARS` | `200` | Phone textarea limit and board fit target. |
| `MIN_SECONDS_BETWEEN_NOTES` | `6` | Per-phone cooldown between submissions. |

Presenter changes are stored in this browser (`localStorage`) so the wall keeps its name after a refresh. **Use defaults** in the edit dialog restores the values above. In Supabase mode the category plan is also stored in the `settings` table and synced to every board and phone.

## Moderator controls (board)
- **Click** a note → reading mode (note grows & centres, rest greys out, avatar reacts to its category). Click empty space / **Esc** closes.
- **Links in notes**: write `[the school data set](https://data.humdata.org/…)` to keep a long address behind a word, or just paste a bare `https://…` / `mailto:…` address and it is linked automatically. Links open in a new tab and only `http`, `https` and `mailto` targets are allowed. On the phone, select a word in the note and paste a URL: it becomes `[word](url)` for you. Exports and screen readers use the visible word, not the raw address.
- **← → / Space** previous / next note.
- **E** or the pencil beside the logo → name the wall (event title + subtitle). Saved locally in this browser.
- **C** or the slider button beside the logo → edit categories: add, rename, recolour, change the emoji, or remove one (its notes move to the first category). Up to nine categories. Saved locally in demo, in Supabase when live.
- **Filters** are hidden: hover the top edge, press **F**, or double-tap the top edge. Keys **1–9** pick categories in their current order; **0** = all.
- **Extras** dock at the bottom centre (or **H**): a faded button that appears on pointer movement. A **Full screen** button sits beside it (or press **Shift+F**): that is the only thing that asks for real fullscreen, and it leaves every board control visible. The **Extras** button hides or shows the header/logo, mascot, QR card, note count and filter bar, and offers a **Categories in columns** layout. **Notes only** turns the wall into a full-screen presentation with no chrome at all (press **Esc** or **H** to return); **Show all** restores every extra.
- **Category piles** appear automatically only when the entire screen is full. Click a pile to show only that category; **All piles** (or the filter bar) returns to the grouped view.
- Cursor hides itself after 2.5 s; the Extras button and the header edit buttons fade in again when the pointer moves. Extras choices persist in this browser.

## Board layout
The grid uses one fixed cell size derived from the full-screen capacity, so a short list stays on a regular grid instead of stretching across the wall. Notes fill column one from top to bottom, then column two, and so on, in arrival order. The cell size does not change as notes arrive.

With **Categories in columns** enabled, every category starts a new column (still top to bottom). If the categories would need more columns than the wall has, the board falls back to regular packing so it never piles early. When even the fixed grid cannot hold every note, the board gathers the notes into one same-colour paper pile per category, with each sheet peeking out from under the one above; pile counts update live. A filtered category that overflows continues in screen-height blocks below and scrolls instead of piling. Notes always stay below the mascot and the QR card. Hiding the header from the Extras dock lets the notes reclaim the top of the wall, which adds rows before piling begins.

## Phone flow
1. Enter a name or nickname.
2. Pick a category card — the five defaults are Question, Idea, Appreciation, Resource and Request, and the presenter's changes appear live.
3. Write on the full-size paper sheet; the counter and send button track the draft.
4. Send: the sheet lifts off the screen, a paper toast confirms, and the wall receives the note in realtime — signed with the sender's name at the bottom.

## Language
Both pages ship with **English, Kinyarwanda and French**. Use the **EN / RW / FR** switch on the phone's name screen, the phone header, the board dashboard or **Extras → Language**. The choice is stored in `sticky_lang` and the page reloads. Static text uses `data-i18n` attributes; dynamic text goes through `t(key, vars)`. Stored category and poll text stays in its original language and is translated when displayed.

## Live polls
Polls are a second, independent model beside the notes. The presenter owns every field; phones can only answer.

**Presenter (board)**
- Press **P**, use the **▣ polls** chip in the status bar, or open **Extras → Poll room**. The room shows live bars, rating averages, open-text answers, response counts and filters for open / draft / closed polls.
- Press **N**, **Extras → New poll**, **+ New poll** in the room, or **+ New poll** on the dashboard strip to open the editor.
- Poll fields: question, optional description, type, category, options, maximum choices, status and phone-results visibility.
- Types: **single choice**, **multiple choice**, **Yes / No**, **1–5 rating** and **open text**.
- Every choice option can carry an **icon or image** — type an emoji, paste an image URL, or upload a small picture. Yes / No polls use 👍 / 👎 automatically. Media appears in the phone choices, the board charts and the race.
- Results are drawn as **friendly hand-made charts** (wobbly bars, crayon hatching, handwritten labels); rating polls show the average and distribution, open-text polls keep a handwritten answer list.
- **Chart race** (button in the Poll Room or press **R**) opens a full-screen animated bar chart race built from vote timestamps. It has play/pause, replay, a scrubbable progress bar and 0.5× / 1× / 2× / 4× speed. New votes update the race live.
- Categories are free text with suggestions (`Feedback`, `Priorities`, `Ideas`, `Knowledge`, `Logistics`, `Other`); each category gets a stable colour.
- Status: **Draft** (hidden from phones), **Open** (accepting answers) or **Closed** (answers locked).
- Phone results: **Always** (live results), **After voting** (results unlock once the phone answers) or **Presenter only** (phones only see a thank-you).
- Every card has **Edit**, **Chart race**, **Duplicate**, **Open / Close**, **Reset votes** and **Delete** (reset and delete need a second click). The dashboard shows the newest four polls and the status bar shows the poll count.
- **Sample polls** (button in the Poll Room, or press **S**) loads eight demo polls with 79 staggered answers: all five types, draft/open/closed, all three results modes, emoji and image media, and enough history to drive the chart race. Pressing it again appends a fresh round with new ids and voter keys — earlier results stay untouched. **Extras → Demo data → Reset sample polls** replaces every round with one clean set.
- The Poll Room keeps the presenter **Extras** dock available above it: press **H** or the room's **Extras** button to open it. The same controls work there — show/hide the header and logo, mascot, QR card, status bar and filters; edit the event name (**E**); edit note categories and colours (**C**); switch wall colour, background image and logo; and open the dashboard (**D**). **Escape** closes Extras first, then the room; **P** closes the room directly.
- **Presentation mode**: **Notes only** in Extras hides every piece of chrome (header, status bar, QR card, filters, mascot and the Extras dock) and puts the board into real fullscreen — the browser tabs/address bar and the computer's taskbar go away too, exactly like a slide show. **Escape** leaves fullscreen and brings the controls back; **H** does the same but opens Extras straight away. In the Poll Room, **Present** (or **F**, or **Extras → Present results**) shows every poll card full screen; **One by one** (or **O**, or **Extras → Present one by one**) shows a single poll per slide — **←/→**, **Space** or **Page Up/Down** move between polls. Both enter the same real fullscreen; **Escape** leaves fullscreen and restores the room, **F** restores it without leaving fullscreen, and **Escape** again closes the room. If the browser blocks fullscreen (for example a kiosk policy), the wall still fills the window instead.
- **Full screen is opt-in**: the board opens on the notes wall with all of its controls visible — header, status bar, QR card, filters, mascot and Extras dock. Press the **Full screen** button beside Extras (also on the module home footer) or **Shift+F** to remove the browser tabs, address bar and computer taskbar. Full screen never hides the board's own controls; use **Notes only**, **Present**, **One by one** or **Manual** when you deliberately want a chrome-free slideshow. For a launch with no browser chrome at all, install the board from the browser menu (**Install app** / **Add to Home Screen**): `manifest-board.webmanifest` opens it standalone.
- **Manual presentation (no autoplay)**: **No auto** in Extras (or **M** on the notes wall) opens the same chrome-free real fullscreen for the notes but never starts playing; step through the notes with the arrow keys. In the Poll Room, **Manual** (or **M**, or **Extras → Manual**) presents the results one by one and only moves when you press **←/→**, **Space** or **Page Up/Down**. Pressing **M** again leaves the presentation. This mode ignores the autoplay settings and is not saved.
- **Autoplay**: in fullscreen presentation the wall starts playing on its own after 10 quiet seconds. Notes are shown one at a time (reading mode) for 6 seconds each and loop; one-by-one poll results advance one poll per slide, and the all-results view switches to one-by-one when autoplay begins. Any pointer move, click, scroll or key press pauses the slideshow and restarts the countdown. The timing lives in **Extras → Presentation**: toggle **Autoplay in full screen**, set **Start after** (0–60 s) and **Seconds per slide** (2–60 s). Settings are remembered in this browser. If the wall is piled, the piles stay in place and the slideshow still opens the notes one by one in arrival order; leaving fullscreen returns to the same piles.

**Phones**
- The phone page never requests fullscreen on its own. It fills the available screen and `manifest.webmanifest` makes it installable as a standalone app. On iPhone, use Safari → Share → **Add to Home Screen** to launch without the browser bars.
- Open polls appear in a **Live polls** banner above the category cards. The banner and the poll list update in realtime as the presenter opens, edits or closes a poll.
- Tap a poll to answer. One answer per phone per poll; sending again updates that answer. A phone can change its answer until the poll closes.
- The phone only ever renders answer controls — questions, options and settings are never editable there.

**Storage**
- Demo mode: `sticky_demo_polls` and `sticky_demo_votes` in `localStorage`, synced across tabs with `BroadcastChannel`.
- Live mode: Supabase `polls` and `poll_votes` with realtime; `poll_votes` has a unique `(poll_id, voter_key)` pair and cascades on poll delete.
- The phone keeps its anonymous voter key in `sticky_voter_key`; the visible author name is the existing `sticky_name`.

## Wall exports
Two downloads are available from the dashboard (**Wall summary PDF**, **Notes image JPEG**) and from **Extras → Download**. They work in demo and live mode.

**Notes image (JPEG)**
- Renders only the notes view: wall colour/background, paper notes, handwriting text, author signature and a small category dot. No UI, QR card, mascot, filters or empty state.
- Uses the currently visible notes (hidden notes are left out) and draws on a high-resolution canvas, so the saved image stays sharp when zoomed or printed.

**Wall summary (PDF)**
- Includes **all valid notes in natural arrival order** (oldest `created_at` first) — hidden notes are included too.
- Shows the event **title, subtitle and logo**, the note count and the export date. Each note keeps its category tint and a running index.
- Fills a print-only `#print-sheet`; `@media print` hides the rest of the board. The browser's print dialog opens, where you choose **Save as PDF**.

## Files
- `css/paper.css` — shared design tokens, SVG grain/fibre textures, reduced-motion defaults
- `css/board.css` — cork wall, vignette, dust motes, brand/status/filter UI, Extras dock and hide states, category editor, poll room/editor/dashboard strip, option media editor, live chart race, print-only PDF sheet, focus stage, empty state
- `css/postit.css` — matte post-it paper: gum line, fibre grain, adhesive sheen, layered shadows, folded corners, hover lift
- `css/avatar.css` — Bun's mood animations (idle map-check / coffee sip, question, idea, appreciation)
- `css/piles.css` — dynamic same-colour category paper stacks, pile hover/fan, back-to-piles chip
- `css/qr.css` — paper QR card in the top-right corner
- `css/charts.css` — hand-drawn poll charts shared by the board and phone: wobbly rails, crayon fills, handwriting labels, reduced-motion handling
- `css/mobile.css` — phone screens, generated category cards, poll banner/list/voting with option media and charts, paper sheet, send/fly and toast
- `js/shared.js` — default categories, derived paper/pile palettes, eight handwriting fonts, deterministic per-note look, `paintNote()` recolouring
- `js/polls.js` - shared poll model: types, normalisation, option ids and media, category colours, validation, vote lookup, statistics, `pollRaceSeries()` and the complete `pollSampleSet()` demo data
- `js/i18n.js` — English / Kinyarwanda / French dictionaries, markup translation, `t()` and the persisted language switch
- `js/charts.js` — hand-drawn chart renderer and option-media node used by both pages
- `js/export.js` — `window.StickyExport.downloadJPEG(payload)` canvas renderer and `downloadPDF(payload)` print-sheet builder
- `js/board.js` — fixed-capacity column-first grid, category columns, pile mode, category editor, poll room/editor/live stats/option media/race, exports, handwriting fitting, reading mode, filters, extras preferences, realtime hooks, ambient dust
- `js/qrcode.js` — vendored MIT QR generator used for the board's phone link
- `js/mobile.js` — name → category → write → send flow plus the live poll banner, list, voting, updating, hand-drawn results and option media, generated category cards, live sync, toast and rate limit
- `js/store.js` — Supabase adapter (notes + settings + polls realtime, category RPCs, poll/vote upserts, 20 s resync) or demo adapter (localStorage + BroadcastChannel)
- `board.html` — main monitor markup plus the inline Bun SVG rig
- `index.html` — audience phone markup
- `assets/sanokip-cbc-light.png` — cream version of the logo for the black board (replace or point `EVENT_LOGO` elsewhere)
- `assets/sanokip-cbc.png` — original dark logo, for light backgrounds
- `assets/paper-fibre.png` / `assets/paper-mottle.png` — paper grain sampled from a real sticky note
- `supabase/schema.sql` — tables, RLS, dynamic categories and the RPCs
- `supabase/migration-author-names.sql` — one-time upgrade for installations created before sender names became public
- `supabase/migration-categories.sql` — one-time upgrade that removes the fixed category CHECK and adds category sync
- `supabase/migration-polls.sql` — poll and vote tables, one-vote-per-voter constraint, RLS, indexes and realtime
- `supabase/migration-media.sql` — media bucket, `event_media` table, storage policies and realtime
- `supabase/migration-presenter-reset.sql` — bcrypt passphrase and the `presenter_clear` reset function
- `supabase/reset-submissions.sql` — manual full reset from the SQL Editor (no passphrase needed)

## Quick checks
- Board: notes fit inside their sheets, with the sender's name signed at the bottom; one note sits top-left, five fill the first column, and the fixed grid resizes with the window/orientation without stretching a short list.
- Grouping: press **S** a few times until every slot is full; one pile per category should replace the grid. Click one pile to filter, then **All piles** to return. Notes must never cover Bun or the QR card.
- Categories: press **C**, add a sixth category, change a colour, rename one, remove one, save. Filters, piles, phone cards and note colours should follow. In demo mode, submit from the phone page and confirm it lands in the new category.
- Extras: press **H**, toggle **Categories in columns**, and confirm each category starts its own column (or falls back to regular packing when there is not enough room). Toggle the header, mascot, QR, count and filters; the wall should reclaim the space and the choices should survive a refresh.
- Full screen: press the **Full screen** button beside Extras (or **Shift+F**, or the button in the module-home footer). The browser tabs, address bar and OS taskbar should vanish while the header, status bar, QR card, filters, mascot and Extras dock stay visible. The button should read **Exit full screen** while active; press it again (or **Esc**) to return. Reloading must not enter fullscreen on its own.
- Presentation: choose **Extras → Notes only**. Every banner, the QR card, the filter bar and the Extras dock must disappear, the cursor hides, and the browser chrome plus the OS taskbar should vanish (real fullscreen); notes fill the whole screen. Press **Escape** to leave fullscreen and bring back exactly the extras that were visible before (**H** also restores them and opens Extras). In the Poll Room press **F**: the header, filters, footer hints and card buttons disappear, the screen goes fullscreen, and only the poll results remain; **Escape** leaves fullscreen and restores the room without closing it.
- One-by-one + autoplay: in **Extras → Presentation** set **Start after** to 2 s and **Seconds per slide** to 3 s. Choose **Notes only** and leave the mouse alone — after a couple of seconds notes should start advancing one at a time and loop. In the Poll Room press **O** (or **Extras → Present one by one**): one poll per slide, **←/→**/Space change slides, autoplay advances on its own, and any mouse movement pauses it until the countdown runs out again. **Esc** leaves fullscreen but keeps the room open.
- Manual presentation: choose **Extras → No auto** (or press **M**). The notes go fullscreen with no autoplay; leave the mouse alone for a minute and nothing should move, while the arrow keys still step through notes. In the Poll Room press **M** (or **Extras → Manual**): one poll per slide that only changes on **←/→**, Space or Page Up/Down; no slide advances on its own. Press **M** again or **Esc** to leave.
- QR: the top-right card should show a crisp code; scan it with a phone and confirm it opens `index.html` (or `MOBILE_URL`).
- Branding: logo appears top-left, press **E** or the pencil, enter an event name, save, refresh — it should persist.
- Reading mode: click a note, arrow through all notes, press **Esc**.
- Filters: **1–5**, then **0**; hidden filter bar via **F** (press **F** again to restore it if it was hidden in Extras).
- Demo: press **S** on the board (or **Extras → Demo data → Add sample notes**) to seed twelve notes across all categories; press it twice to see the second batch. Then submit from the phone page and watch it arrive.
- Embedded links: add a note containing `[the school data set](https://data.humdata.org/)` and one with a bare `https://…` address. Both should show a clickable word/address that opens in a new tab without opening reading mode. On the phone, select a word in the composer, paste a URL, and confirm it becomes `[word](url)`. Export a JPEG/PDF and confirm only the visible word appears.
- Polls: press **P**, then **Sample polls** (or **S**). Eight polls should appear: six open, one draft, one closed, with bars, a rating average, written answers and image options. Press **Sample polls** again: the label becomes **More samples**, and a second round appears while the first keeps its votes. **Extras → Demo data → Reset sample polls** (two clicks) should leave one clean set. Open the phone page — the Live polls banner should say **6 live polls** per round. Answer, update the answer, and confirm the board's charts and response counts change live. Switch the filter to **Draft** to see the hidden poll, and **Closed** to see locked results. Use **Reset votes** and **Delete** (two clicks) on the board.
- Poll room extras: with the Poll Room open, press **H** (or the room's **Extras** button). The dock should open above the room; toggle the header, mascot, QR, status and filters, then **Escape** to close the dock and confirm the room is still there. Press **E** to rename the event, **C** to edit categories, and **D** to jump to the dashboard; the room should behave the same as the notes wall.
- Poll results visibility: set **Presenter only** and confirm the phone shows only the thank-you note; set **After voting** and confirm results appear only after sending an answer.
- Poll media and charts: edit a choice poll, give two options an emoji and one an uploaded image. Confirm the icons appear in the editor, on the phone choices, in the board bars and in the race. Answer from several tabs and check the bars grow smoothly.
- Race: open a poll with a few answers, press **R** (or **Chart race**). Play/pause, replay, scrub the progress bar and try each speed. Open a second tab and submit an answer — the race should update. Text polls should show the “written answers, not a race” message.
- Exports: click **Notes image JPEG**; the downloaded `.jpg` should show only the wall background and notes, with no UI. Click **Wall summary PDF** and choose **Save as PDF**; the PDF should show the event title/logo and every note oldest-first, including hidden notes.
- Language: switch to **RW** and **FR** from the phone or the board dashboard. Static labels, poll types, chart stamps and race controls should all change; switching back to **EN** should restore English.
- Reduced motion: enable the OS setting; entrances, dust, mascot loops, chart fills and the race should settle down.
