# Project status — belmazad.com "Request a Property"

Read this first when continuing work in a new conversation. Last updated: 25 November 2026.
Technical details for each feature are in `HANDOFF.md`; project rules are in `CLAUDE.md`.

## Working with the owner (preferences)
- Plan and agree before building anything significant. Finish and test one piece before starting the next.
- Explain things step by step and in plain language. The owner tests manually and shares screenshots.
- Ask before creating anything in HubSpot (properties, pipelines, test records) or sending real test submissions.
- Never print or repeat secrets (HubSpot key, admin password). Refer to `.env.local` by name only.

## Where things are
- Project folder: `N:\Belmazad\Otlob Aqarak`. It is the true version, from `belmazad-claude-code.zip` in the same folder. The older ChatGPT-handoff version is backed up in `N:\Belmazad\Otlob Aqarak (old version backup)`; don't work from it.
- Run locally: Node 24 is at `C:\Program Files\nodejs`, and pnpm 11.25.0 comes from Corepack shims in `%LOCALAPPDATA%\corepack-shims` (add both to PATH), then `pnpm dev`.
  - Buyer view: http://localhost:5173/request-property
  - Seller view: http://localhost:5173/request-property?for=sellers
  - Team admin: http://localhost:5173/admin
  - Settings in `.env.local` are read only at start-up; restart `pnpm dev` after changing them.
- Settings (`.env.local`, never committed; template in `.env.example`): `HUBSPOT_ACCESS_TOKEN` (HubSpot service key "Belmazad Website") and `ADMIN_PASSWORD`.
- HubSpot: portal 143644884 (EU, app-eu1.hubspot.com).
  - Service key scopes: crm.objects.contacts.read/write, crm.objects.deals.read/write, crm.schemas.contacts.write, crm.schemas.deals.write.
- Git: GitHub `Belmazad-Admin/Otlob-3qarak` (private). The owner wants commits pushed straight to `main`. `gh` is signed in as Belmazad-Admin.
- Hosting: live on **Vercel** (otlob-3qarak.vercel.app) with Neon Postgres. **Moving to Azure Container Apps** (owner decision 25 Nov 2026), resource group `Matchmaking_belmazad`, UAE North, subscription "NTG Microsoft Azure Sponsorship" (Mahmoud manages it; Nour has Contributor + RBAC Administrator on the resource group only, and changes need an MFA sign-in). App Service is blocked on that subscription (quota 0, support request open), so Container Apps was chosen; Azure Postgres replaces Neon; run both, then switch the domain. Status: code + `infra/` ready and previewed (22 resources to create, nothing created yet). Next: Nour runs `.\infra\deploy.ps1` with the real keys, then GitHub variables, first image deploy, copy accounts from Neon, test, domain. See `HANDOFF.md` → "Deploying to Azure Container Apps". The domain belmazad.com's DNS is at CloudSmartly.
- Preview server: `.claude/launch.json` defines `belmazad-dev` on port 5173. If another conversation's preview already holds the port, that server serves this same folder and picks up changes live.

## Decisions made
- **One page, two views:** a "بتشتري | بتبيع" switch in the header (Option A). The seller view uses `?for=sellers`. Same layout; only wording and section order differ.
- **Seller messaging:** "العقار عندك… والمشتري عندنا." / "You have the property. Belmazad has the buyers."
  - Main CTA: "لاقي مشتري عقارك / Find your buyer". Never "اعرض عقارك", because the main site already handles listings.
  - The buyer pool is called **"serious buyers / مشترين جادين"**.
- **No unconfirmed claims** in seller copy: no "free", "qualified" or response-time promises (the owner didn't confirm them).
- **HubSpot is the system of record** for requests and offers. Website accounts (e-mail + password) live in Postgres (`DATABASE_URL`; first built on Cloudflare D1 in October 2026).
- **Buyer wishlists:** HubSpot contacts from the "Buyer Wishlist Form", plus requests submitted through the website wizard.
  - Public posts are anonymised: no names, phones, record IDs or raw staff notes.
  - Area, district and budget are parsed from staff notes on the server.
  - **Only Approved requests are public** (contact property `website_listing_status`).
- **Tasks** go to both Khadija owners: Khadeja Hesham 33163566 (active) and Khadija Hesham 1824975088 (inactive, but HubSpot accepted it). Titles start with "[Website]", or "[Website] [Broker]" for brokers.
- **Seller offers and "keep looking"** become deals in the HubSpot pipeline "Website seller offers" (New offer → Contacted → Viewing → Negotiating → Won / Rejected), plus call tasks.
- **Admin login:** a shared team password plus the person's name. Production plan: put `/admin` behind an access layer with 2FA (e.g. Vercel Deployment Protection or an SSO proxy).
- **Brokers:** "أنت وسيط عقاري (بروكر)؟" plus brokerage name on the account (sign-up or My account) → User Type = Broker, Company = brokerage. Broker dashboards are a later phase.
- **Design (redesign, October 2026):**
  - **Homes.com-style structure with a futuristic finish (5 October 2026):** full-width dusk photo hero with the header floating over it, a glass finder (buying/selling tabs, type, area) that pre-fills the wizard or the matching tool, photo tiles per category with live counts, and a "Newest buyer requests" row. New Unsplash photos are credited in `HANDOFF.md`.
  - **Swiss design (5 October 2026), replacing the earlier "liquid glass" look.** Big display type (Archivo for English, Alexandria for Arabic headings), solid brand-colour fields (orange count block in the hero, blue wizard panel, sand feed band, blue matching section, navy footer), a colour edge on request cards by category, one solid-blue primary button, no glows, pulsing dots, eyebrow labels or "How it works" section. The hero itself was later replaced by the photo hero above.
  - Arabic font: **IBM Plex Sans Arabic**.
  - The site **always opens in light mode**, with a sun/moon toggle for dark mode; a visitor's choice is remembered.
  - The owner wants **real photos** used (source still open, see below).

## Built and tested
| Piece | Status |
|---|---|
| Live wishlist feed from HubSpot (auto-refresh about every minute) | Done |
| Seller view, matching tool, offer → contact + deal + call tasks | Done |
| "Let us keep looking" (no match) → contact + deal + call task | Done |
| Buyer wizard → HubSpot contact (Pending) + review task | Done. Tested by the owner (contacts "Hoss Dija", "Hossam Dija") |
| Team admin `/admin`: Buyers approvals (edit public post, approve / request changes / reject) and Sellers offers (stage, notes, follow-up task) | Done |
| Broker checkbox in all three forms, Broker badge in the admin | Built. The owner was about to test it |
| Redesign Phase 1: light/dark themes, theme toggle (site and admin), IBM Plex Sans Arabic, consistent buttons, fields, glass and cards | Done and committed (`a0bee38`). Checked in both themes in the browser |
| Accounts: sign-in window before offers, "keep looking" and publishing a request; broker checkbox; "My account" page; admin Accounts tab with every account's requests and offers, password reset, disable | Built 12 October 2026. Checked locally (sign-up, sign-in, lockout, account page, phone layout). Not yet tested end-to-end with a real HubSpot submission or by the owner |
| Buyer chat spend tracking: token counts per day (no message text), estimated cost, hard daily cap (`OPENAI_DAILY_BUDGET_USD`, default $5), admin "AI chat" tab | Built 25 November 2026 after the ~$200 OpenAI charge on 23 Nov (investigation: the chat is very unlikely to be the source). Typecheck and build pass. Needs `pnpm db:migrate` on Neon before the next deploy |

## Waiting on the owner
1. Test the broker option.
1a. OpenAI charge of 23 Nov: check the receipt (ChatGPT subscription or API credit top-up?) and platform.openai.com → Usage for 22–23 Nov by model and API key; check Vercel → otlob-3qarak → Logs for `/api/buyer-assistant` from the owning account.
2. Change `ADMIN_PASSWORD` in `.env.local`. The current one was visible in a screenshot. Then restart the dev server.
3. Before going online: rotate the HubSpot service key ("Rotate" on the key page) and update `.env.local` and the server settings.

## Current work: full UI/UX redesign (in progress)
The owner asked for a premium, modern, easy-to-use redesign of every page, with light and dark modes. Rules: keep all features, routes, workflows, HubSpot connections and data; usability before decoration.

**Audit findings that drive the plan:**
- **Fake or decorative controls:** a bookmark icon that does nothing, a "newest first ⌄" label that looks like a menu, a filter icon by search that does nothing, and made-up hero numbers ("12 matches", "92%", "50–70").
- **No navigation menu on phones** (links hidden below 800 px).
- **Unnecessary steps:** a wizard "goal" step with only one answer ("buy"), and 3 clicks for a seller to respond to a match.
- **Vague errors:** wizard messages don't say which field or how to fix it.
- **Repetition and clutter:** "Anonymous buyer · Active request" on every card, a thin demo bar under the hero, a seller banner with a stock photo and a fake "92%".
- **Wording bug:** the seller offer form's notes placeholder talks about the property "you're looking for".

**Phases** (show the owner after each, then commit):
1. **Design system and dark mode.** ✅ Done (`a0bee38`).
2. **Public page and journeys.** In progress. Covers:
   - header with a phone menu ✅ (4 October 2026; built and checked, not yet tested by the owner)
   - hero with real HubSpot numbers instead of made-up ones; demo bar folded in ✅ (same)
   - cleaner request cards; fake controls removed, filters and search working ✅ (4 October 2026; built and checked, not yet tested by the owner)
   - wizard: per-field error messages ✅ (25 November 2026: each step names the exact field, outlines it in red and moves the cursor there; same checks on the server), sticky Next on phones ✅ (the bottom "اطلب عقارك" bar slides away while the wizard or seller matching tool is on screen, so Back/Next sit at the bottom edge). The goal step is already removed (4 October 2026); the wizard now has 7 steps
   - "عندي العقار ده" directly on match results ✅ (7 October 2026; opens the offer form pre-filled with size and price from the matching form)
   - fix the offer form wording ✅ (seller-specific notes hint)
   - polished dialogs, FAQ, footer and mobile, with photos ✅ (25 November 2026: request dialog now tells sellers the buyer's details are private (it showed the buyer's privacy note); FAQ intro line, clearer questions, out-of-date "demo" answers replaced; footer with readable tagline, site links and a divider; phone layout checked at 375 px). Checked in the browser preview, not yet by the owner on a real phone
3. **Admin dashboard** restyled with the same system.
4. **Testing:** every flow (buyer request → approve, offer, keep looking, broker, language, theme), phone, tablet and desktop, keyboard and reduced motion; build and commit.

**Owner decisions for Phase 2 (4 October 2026):**
1. **Goal step: remove.** Done: the wizard opens on "property type" and shows "Step 1 of 7". `CLAUDE.md` and `HANDOFF.md` updated.
2. **Photos: free licensed stock.** A shortlist is shown to the owner first; nothing is downloaded until the owner picks. The current Mallorca photo isn't cleared for reuse and will be replaced.
   - Owner picked H3 (El Gouna homes; now the main-action photo tile), S1 (modern villa, seller banner) and E2 (apartment balconies, supporting). Saved in `public/photos/`, credits in `HANDOFF.md`. S1 already replaces the Mallorca photo, which was deleted. H3 and E2 get placed during Phase 2.

## Accounts (built 12 October 2026)
Owner decisions: e-mail + password; buyers sign in when they click Publish (answers kept); sellers sign in before the offer / keep-looking form; a "My account" page; every account trackable in admin. Details in `HANDOFF.md` → "Accounts".
- **Not yet:** e-mail verification and self-service "forgot password" (need an e-mail sending service on a belmazad.com address); the team resets passwords from Admin → Accounts.
- **Limit:** HubSpot keeps one wishlist per contact, so a buyer's newer request replaces the older one there; the account keeps the history ("Replaced by a newer request"). Several live requests per buyer would need buyer requests as HubSpot deals.

## Later phases (discussed)
- Go online: deploy on Vercel (Postgres + environment variables), a belmazad.com address (DNS move from CloudSmartly), protection for /admin; GitHub Actions CI/CD to follow.
- E-mail sending (verification, password reset, notifications).
- Move to the newer HubSpot API versions before the March/September 2027 deprecation shown on the key page.
- Production assets: official logo, licensed photos, licensed Neue Haas Grotesk font.

## Known quirks
- HubSpot contact property `additional_requirments` rejects special characters, so the website writes a plain letters/numbers version.
- `scripts/hubspot-setup.mjs` (safe to re-run) creates the HubSpot properties and pipeline. `scripts/hubspot-seed-statuses.mjs` was already run once (5 Pending / 80 Approved / 11 Rejected).
- Lint: only "use next/image" hints remain (hero, tiles and seller photos; the site serves plain images). The issues inherited from the original zip were fixed in Phase 2. Typecheck and build pass.
- The preview (`.claude/launch.json`) runs `npx --yes pnpm@11.19.0 dev`, so it works without pnpm on PATH.
- The dev server on the N: drive sometimes misses edits to `src/styles.css` (most often edits made from a shell). If a style change doesn't show, save the file again from the editor or restart the dev server.
- Don't run `pnpm build` while the dev server is running: it breaks the dev server (every page returns "internal error"). Stop the preview, build, then start it again.
- The browser preview pane can't show phone layouts reliably; check on a real phone.
- In a hidden or background preview tab, the theme's colour fade can stall and leave the page background looking unchanged. In a visible browser it switches normally. The colour values themselves are correct.
