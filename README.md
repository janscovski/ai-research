# K-GROUP AI Optimization 2027 — live-CMS site

A cinematic one-page site whose **only** content source is the Google Slides deck
`K-GROUP AI OPTIMIZATION 2027 — Live CMS` (`1vgXhQgd6zspwH_iBpmeq_x4hsTTxLH9eXQR4KM4698A`).
Edit the deck and the site follows within about a minute. No redeploy and no code edit. The site only reads the deck and never writes to it.

```
Google Slides ──presentations.get──▶ lib/deck.ts (server only) ──▶ lib/parser.ts ──▶ zod schema
        │                                  │ images: download → WebP → .cache/images
        │                                  └ snapshot: memory + .cache/deck.json (fallback)
        └─ Apps Script (optional) ──POST──▶ /api/revalidate ──▶ ISR page "/" (revalidate = 60)
```

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion (Framer Motion) · zod · sharp.
Why Motion over GSAP: it is declarative React, it handles enter/exit transitions between slides (`AnimatePresence`), and it respects `prefers-reduced-motion` globally through `MotionConfig`. The light traces and the hero are plain CSS, so they cost no JS.

**Format:** a full-screen, slide-by-slide presentation, not a long scroll. Each deck section opens with its divider image as a cinematic plate, followed by content slides. A block that holds more than fits one screen (e.g. Investment: figures, savings, tool tables) is split across several slides.
Navigate with the small ‹ › controls (bottom right), ← → / PageUp PageDown / Space, a horizontal swipe on touch screens, or the mouse wheel (once a slide's own content has scrolled to its edge). The slide number is in the URL (`/#7`) so a slide can be linked directly.

---

## 1. Run it

```bash
npm install
npm run dev:fixture      # preview from fixtures/ with no Google credentials
npm test                 # parser + cache-fallback tests
```

With the real deck:

```bash
cp .env.example .env.local   # fill in DECK_ID + one auth method + REVALIDATE_SECRET
npm run dev
```

Deploy: Vercel (zero config) or any Node 20+ host (`npm run build && npm start`). Set the same env vars there.

## 2. Google access (pick one)

### A. Service account (preferred)
1. Google Cloud Console → create or choose a project → **APIs & Services → Enable APIs** → enable **Google Slides API**.
2. **IAM & Admin → Service Accounts → Create**. It needs no roles. Then **Keys → Add key → JSON**.
3. Open the deck → **Share** → add the service account's `client_email` as **Viewer**.
4. Put the JSON in `GOOGLE_SERVICE_ACCOUNT_JSON`. You can paste the raw JSON on one line, or base64 it with `base64 -w0 key.json` (easier on Vercel).

### B. API key
Use this only if the deck is shared as **Anyone with the link → Viewer**.
1. Enable the Google Slides API (as above). **Credentials → Create API key**.
2. Restrict the key with **API restrictions → Google Slides API** only.
3. Put it in `GOOGLE_API_KEY`.

Either way, credentials are read only in `lib/deck.ts` (marked `server-only`). They never reach the browser, and neither do Google image URLs.

### Env vars

| Var | Required | Notes |
|---|---|---|
| `DECK_ID` | yes | Presentation ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_API_KEY` | one of them | see above |
| `REVALIDATE_SECRET` | for instant refresh | ≥ 16 chars |
| `DECK_SOURCE` | no | `fixture` = render `fixtures/` with no Google calls |
| `DECK_CACHE_DIR` | no | default `.cache` (`/tmp/deck-cache` on Vercel) |
| `NEXT_PUBLIC_BACKGROUND` | no | `shader` (default) or `video` |

## 3. Editing content

**One slide = one content block, in page order.** The printed footer numbers (`• 02`, `• 07`, `• 18`…) are ignored because they are not sequential.

How each slide is classified:

1. **Speaker notes** `section: …` wins if present.
2. Otherwise the **visible kicker** on the slide, e.g. `03 · USE CASES` → `usecases`.
   A kicker slide with two or more arrow pipelines (`A → B → C`) becomes `workflow`, even if its kicker says EFFICIENCY, as in the current deck.
3. A slide **without a kicker** that has a full-bleed image (≥ 40 % of the slide) and up to 4 lines of text:
   - the first one becomes the **hero** (cover);
   - the others become **chapter plates**. The image and title open the *next* chapter as a full-screen cinematic frame.
4. Anything else is ignored and logged (`[deck] parse:` in the server log).

| Slide state | Result |
|---|---|
| Hidden ("Skip slide") | never rendered |
| `section:` not recognised (e.g. `roadmap`) | ignored and logged |
| Recognised section but missing pieces | that piece is hidden, the rest renders |
| Image fails to download | image hidden, page still renders |

Recognised sections: `hero`, `objective`, `investment`, `usecases`, `workflow`, `efficiency`, `action_plan`, `verdict` (plus `divider` / `plate`).

### Speaker-note keys (the explicit schema)
One `key: value` per line. A key in the notes **overrides** what is read from the visible text. Repeating a key adds items. Multi-part values use `|`. Unknown keys are ignored.

Example notes for the investment slide:

```
section: investment
kicker: 02 · INVESTMENT PROPOSAL
stage: Initial Investment | Rp147,86 jt | Per year
stage: Previous Proposal | Rp93,52 jt | Per year
stage: Final Proposal | Rp39,78 jt | Per year
reduction: Total cost reduction | 73,1%
saving: Annual potential saving | Rp108,07 jt
card: label | value | note
```

| Section | Keys |
|---|---|
| any | `section`, `kicker`, `headline`, `card` (label \| value \| note), `alt` (image alt text), `focus` (image crop, CSS object-position like `20% 50%`), `align` (`left`, `right` or `top`: where a divider's title sits; measured automatically from the image when absent) |
| hero | `title`, `subtitle` |
| divider | `title` |
| objective | `pillar` (`·`-separated ok), `role` (team \| role) |
| investment | `stage` (label \| value \| unit), `allocation`, `team` (name \| total), `item` (team \| name \| amount \| note), `reduction` (label \| value), `saving` (label \| value) |
| usecases | `team`, `target` (count \| label), `output` (count \| label \| meta · meta), `supporting_title`, `support` (name \| desc), `case` |
| workflow | `pipeline` (team \| A → B → C) |
| efficiency | `principle`, `tiers_label`, `tier` (LEVEL \| use), `body` |
| action_plan | `lab`, `prompt_label`, `prompt` (comma list ok), `flow` (a + b → c), `training` (label \| text), `body` |
| verdict | `budget` (value \| label), `point`, `closing` |

**Numbers** are shown exactly as typed in the deck (`Rp147,86 jt`, `Rp19.049.190`, `73,1%`). `lib/numbers.ts` parses them to integers (Indonesian format: dot for thousands, comma for decimals) only for bar widths and sanity checks. Count-up animations always end on the raw string.

## 4. Freshness: how it works and its limits

- The page `/` uses **ISR with `revalidate = 60`**. After 60 s, the **next visit** still gets the cached page and triggers a rebuild in the background. The visit after that sees the edit. So the realistic latency is **about 60 s plus one page view**. This is **not real-time**.
- **Instant refresh:** `POST /api/revalidate` with header `x-revalidate-secret: <REVALIDATE_SECRET>`. `?secret=` also works, for a manual hit from the browser.
- **Apps Script:** `scripts/apps-script.gs`. Note that **Google Slides has no on-edit trigger** (that exists only for Sheets). The script gives you:
  1. a **Website → Publish now** menu inside the deck (instant, manual);
  2. a 1-minute time-driven trigger that pings the site only when the deck's Drive "last updated" time changed. Drive's timestamp can lag by a minute or so.
- **Fallback:** if the Slides API fails, the last good snapshot is served (memory, then `.cache/deck.json`) and the error is logged. If there is no snapshot yet, a minimal branded error state renders. ISR also keeps serving the last good page if a background rebuild throws.
- **Images:** Google `contentUrl`s expire, so images are downloaded server-side, converted to WebP (960 and 1920 wide) and served from `/api/deck-image/<hash>.webp` with immutable caching. A Viewer service account gets no `revisionId`, so change detection hashes the response. Images are re-downloaded at least every 15 min, to catch "Replace image" edits.
- **Vercel caveat:** `/tmp` is per-instance and temporary. On a cold instance the image route re-downloads the images on demand, and the CDN caches them after that. For a multi-instance setup that must survive a Google outage on a cold start, point `DECK_CACHE_DIR` at shared storage. That is out of scope here.

## 5. Swapping the background loop

The default is a **WebGL shader** in `components/Background.tsx` (0 KB of assets). Every moving term is periodic in `2π·t / --bg-loop-seconds`, so the loop is **seamless by construction** and needs no crossfade. It renders at half resolution and 30 fps, pauses in hidden tabs, starts only after `load` + idle, and drifts slightly as the deck advances (the only parallax). Layers: navy sky, aurora ribbons, horizon light, a perspective grid floor and twinkling stars. Each slide sets a mood (`theme` on its frame in `components/Slides.tsx`): colour family `blue`, `purple` or `green` (palettes are `--bg-*` tokens) and an optional hi-tech code-rain layer; the shader eases between moods on slide change. It is replaced by a static CSS poster for `prefers-reduced-motion`, Save-Data and no-WebGL.

To use a pre-rendered loop instead:
1. Export a loop that already crossfades its last ~1 s into its first frame (After Effects / Resolve). Keep it muted, ≤ 2 MB, 1280×720 is enough because it sits behind content.
   ```bash
   ffmpeg -i loop.mov -an -c:v libvpx-vp9 -b:v 0 -crf 40 -vf scale=1280:-2 public/loop/loop.webm
   ffmpeg -i loop.mov -an -c:v libx264 -crf 28 -preset slow -movflags +faststart -vf scale=1280:-2 public/loop/loop.mp4
   ffmpeg -i loop.mov -frames:v 1 -q:v 4 public/loop/poster.jpg
   ```
2. Set `NEXT_PUBLIC_BACKGROUND=video` and redeploy.

## 6. Design tokens

All colour, radius and motion values live in **`styles/tokens.css`**, which is the one file to swap.
**Assumption (please confirm):** the deck defines no web palette, so the site uses a near-black base (`#09090a`), a barely-warm off-white text (`#ece9e4`) and a single accent, the electric blue sampled from the deck's cover image (`#4d8dff`). All body text pairs pass WCAG AA on the base. Font: Plus Jakarta Sans via `next/font/google` (variable, self-hosted at build, metric-matched fallback so there is no layout shift).

## 7. Deck gaps (TODO for the deck owner)

Nothing below is filled in by the site. Each gap is either rendered as-is or hidden.

- [ ] **Alt text:** add *Alt text* to the deck images (Format options → Alt text). The plates are treated as decorative (their title is overlaid). The dashboard screenshot falls back to its slide headline.
- [ ] **Workflow and Efficiency share the kicker `04 · EFFICIENCY`** in the deck, so two chapters show the same number. Add `kicker: …` to the workflow slide's notes if it should be numbered differently.
- [ ] **Objective pillars:** the brief says 3 lines, but the deck has 2 lines × 3 terms. The site shows the 6 terms as they are in the deck.
- [ ] **Hero subtitle:** the brief mentions separate BD / Marrakesh role lines, but the cover has one line ("Business Development × Marrakesh Creative Powerhouse"). The roles appear in Objective.
- [ ] **Verdict has no divider image**, so it opens typographically. Add a divider slide before it if you want a plate.
- [ ] **Mobile crop:** on the "AI Optimization" plate the dollar bill sits at the far left and is cropped on phones. Add `focus: 15% 50%` to that divider slide's notes.
- [ ] **Tool notes:** "Video AI Generated" (Higgsfield Ultra 3K) and "Voice Over" (ElevenLabs) come from Jan, not the deck, via `lib/annotations.ts`. A note in the deck row always wins; consider moving them into the deck.
- [ ] The `<Todo>` placeholder component renders only if the cover slide loses its image.

## 8. Tests

`tests/parser.test.ts` runs against `fixtures/deck.slides.json`. The fixture holds the **visible text and images of the live deck** (read through the Drive export on 2026-11-26) in `presentations.get` shape. Object IDs, geometry and the speaker notes are synthetic. It adds **one hidden slide**, **one unknown-section slide**, and a **verdict slide whose notes have only `section:`**, so every other key is missing and falls back to the visible text.
`tests/deck-fallback.test.ts` covers fetch → image cache → snapshot, the fallback to the snapshot when the deck is unreachable, the error result with no snapshot, and path-traversal rejection on the image route.

Replace the fixture with a real API response once credentials exist:

```bash
npm run deck:dump && npm test
```

---

## 9. Verification checklist

**Verified (in this environment, fixture mode):**
- [x] `npm test`: 26/26 pass. Parser: chapter order, hidden slide never renders, unknown section ignored and logged, footer numbers stripped, plates attached, missing keys fall back, notes override, Indonesian number parsing, deck totals add up (BD 19.049.190, Marrakesh 20.739.240, 147,86 − 39,79 = 108,07, 73,1%), labels in one row with values in the next are paired correctly, off-canvas scratch notes ignored, count-up lands on the raw string. Data layer: cache fallback and error state.
- [x] `tsc --noEmit` clean. `next build` succeeds, and `/` is ISR with 1 m revalidate.
- [x] Money figures in the server HTML match the deck strings exactly.
- [x] Live-edit loop (fixture): editing the closing line in the fixture, then `POST /api/revalidate`, then the new text is served. Restoring it brings the original back.
- [x] `/api/revalidate` returns 401 without the secret and 200 with it. The image route rejects traversal.
- [x] No Google image URL appears in the HTML. Images are served from the local cache.
- [x] Playwright, every slide at 390, 768, 1366 and 1440, normal and reduced motion: no console errors. At 1366×768 and 1440×900 every slide fits one screen. At 390 the longer slides scroll inside the slide.
- [x] Lighthouse (mobile, local `next start`): Performance 89, Accessibility 100, Best Practices 100, CLS 0.

**Not verified:**
- [ ] A real Google Slides API call (needs credentials). The service-account and API-key code paths are untested against Google.
- [ ] Real `contentUrl` image downloads from Google, and their expiry behaviour.
- [ ] Whether the live deck has speaker notes or hidden slides. The Drive export used for the fixture shows neither.
- [ ] Apps Script (`scripts/apps-script.gs`) running in the deck.
- [ ] The ~60 s latency on a deployed Vercel instance (verified only locally through on-demand revalidate).
- [ ] Lighthouse on real devices or a production deploy. The local runs used a headless Chromium. The shader starts after load + idle, so a lab score may not cover its full runtime cost on low-end phones.
- [ ] Rendering in Safari and Firefox. Only Chromium was tested.
