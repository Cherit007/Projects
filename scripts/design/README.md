# Design mockup generation

Batch-generate UI mockup images for Phase 2.5 and save them to `docs/design/mockups/`.

## Free tier note (read this first)

**Gemini API image models return `429 limit: 0` on the free tier.** That means zero API image quota — not that you ran out on a new account. Text models work; **image generation via API requires paid billing** (or use the workarounds below).

| Method | Cost | Works for images? |
|--------|------|-------------------|
| **Gemini web chat** | Free (browser) | Yes — use your chat URL |
| **Manual paste** | Free | Yes |
| **Gemini API** | Paid billing required | Yes, after billing enabled |

---

## Two ways to generate (free)

| Method | Command | Best for |
|--------|---------|----------|
| **Gemini web chat** | `npm run design:mockups:web` | Free — your chat URL |
| **Manual paste** | `npm run design:prompts:export` | Copy `.txt` into Gemini |

## API (paid billing only)

| Method | Command |
|--------|---------|
| **Gemini API** | `npm run design:mockups` |

The web UI cannot be fully automated (Google login). The web script opens your chat, submits prompts, and saves images — you log in once.

---

## 1. Gemini web chat (free — use this)

### One-time login

```bash
npm run design:mockups:web:login
```

Log in in the browser, open your chat, press **Enter** in the terminal.

### Generate

```bash
npm run design:mockups:web
npm run design:mockups:web -- --only=03-setup-home-mobile,03-setup-home-web
npm run design:mockups:web -- --interactive   # confirm each prompt
```

Chat URL default: `https://gemini.google.com/app/3c92073cbf174a38`

Optional env:

```env
GEMINI_CHAT_URL=https://gemini.google.com/app/3c92073cbf174a38
```

Browser profile: `.gemini-playwright-profile/` (gitignored).

**Tip:** In the web chat, ask: *"Generate a UI mockup image:"* then paste the prompt from `scripts/design/prompts/03-setup-home-mobile.txt`.

---

## 2. Manual export (free fallback)

```bash
npm run design:prompts:export
```

Creates `scripts/design/prompts/03-setup-home-mobile.txt` — paste into Gemini, download image, save as `docs/design/mockups/03-setup-home-mobile.png`.

---

## 3. Gemini API (requires billing)

### Setup

```bash
npm install
# Add to .env:
# GEMINI_API_KEY=your_key_from_https://aistudio.google.com/apikey
# Enable billing: https://ai.google.dev/gemini-api/docs/billing
```

If you see `limit: 0` / `free_tier_requests`, billing is not active for image models — use web mode above.

### Run

```bash
npm run design:mockups
npm run design:mockups -- --priority=2
npm run design:mockups -- --only=03-setup-home-mobile
npm run design:mockups:dry-run
npm run design:mockups -- --force
```

---

## Manifest

All filenames and prompts: [`mockup-manifest.json`](./mockup-manifest.json)

Design spec: [`docs/sport-setup-ux.md` §11](../../docs/sport-setup-ux.md)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `429 limit: 0` / `free_tier_requests` | **Expected on free API tier** — image gen not included. Use `npm run design:mockups:web` or enable [billing](https://ai.google.dev/gemini-api/docs/billing) |
| `Missing GEMINI_API_KEY` | Add key to `.env` or use web mode |
| API model not found | Set `--model=gemini-2.5-flash-preview-image` |
| Web: can't find input | Run `--interactive`, paste from `scripts/design/prompts/` |
| Web: no image saved | Wait for generation; use `--interactive` |
| Rate limits (paid) | Increase `--delay-ms=15000` |

---

## .gitignore

Add (if not present):

```
.gemini-playwright-profile/
```

Commit generated PNGs under `docs/design/mockups/` when ready for the team.
