# Project status — belmazad.com "Request a Property"

Read this first when continuing work in a new conversation. Last updated: 4 October 2026.
Technical details for each feature are in `HANDOFF.md`; project rules are in `CLAUDE.md`.

## Working with the owner (preferences)
- Plan and agree before building anything significant. Finish and test one piece before starting the next.
- Explain things step by step and in plain language. The owner tests manually and shares screenshots.
- Ask before creating anything in HubSpot (properties, pipelines, test records) or sending real test submissions.
- Never print or repeat secrets (HubSpot key, admin password). Refer to `.dev.vars` by name only.

## Where things are
- Project folder: `N:\Belmazad\Otlob Aqarak`. It is the true version, from `belmazad-claude-code.zip` in the same folder. The older ChatGPT-handoff version is backed up in `N:\Belmazad\Otlob Aqarak (old version backup)`; don't work from it.
- Run locally: Node 24 is at `C:\Program Files\nodejs`, and pnpm 11.25.0 comes from Corepack shims in `%LOCALAPPDATA%\corepack-shims` (add both to PATH), then `pnpm dev`.
  - Buyer view: http://localhost:5173/request-property
  - Seller view: http://localhost:5173/request-property?for=sellers
  - Team admin: http://localhost:5173/admin
  - Settings in `.dev.vars` are read only at start-up; restart `pnpm dev` after changing them.
- Settings (`.dev.vars`, never committed; template in `.dev.vars.example`): `HUBSPOT_ACCESS_TOKEN` (HubSpot service key "Belmazad Website") and `ADMIN_PASSWORD`.
- HubSpot: portal 143644884 (EU, app-eu1.hubspot.com).
  - Service key scopes: crm.objects.contacts.read/write, crm.objects.deals.read/write, crm.schemas.contacts.write, crm.schemas.deals.write.
- Git: a local repository only, with no remote (nothing is uploaded). Git is at `C:\Program Files\Git\cmd\git.exe`.
  - The owner asks for a commit after each finished phase.
  - Commits so far: `e119da5` (snapshot of all work up to the broker option) and `a0bee38` (redesign Phase 1: themes and design system).
- Preview server: `.claude/launch.json` defines `belmazad-dev` on port 5173. If another conversation's preview already holds the port, that server serves this same folder and picks up changes live.

## Decisions made
- **One page, two views:** a "بتشتري | بتبيع" switch in the header (Option A). The seller view uses `?for=sellers`. Same layout; only wording and section order differ.
- **Seller messaging:** "العقار عندك… والمشتري عندنا." / "You have the property. Belmazad has the buyers."
  - Main CTA: "لاقي مشتري عقارك / Find your buyer". Never "اعرض عقارك", because the main site already handles listings.
  - The buyer pool is called **"serious buyers / مشترين جادين"**.
- **No unconfirmed claims** in seller copy: no "free", "qualified" or response-time promises (the owner didn't confirm them).
- **HubSpot is the system of record.** The website has no database of its own for now; the database work (Supabase recommended for security) is **paused** by the owner.
- **Buyer wishlists:** HubSpot contacts from the "Buyer Wishlist Form", plus requests submitted through the website wizard.
  - Public posts are anonymised: no names, phones, record IDs or raw staff notes.
  - Area, district and budget are parsed from staff notes on the server.
  - **Only Approved requests are public** (contact property `website_listing_status`).
- **Tasks** go to both Khadija owners: Khadeja Hesham 33163566 (active) and Khadija Hesham 1824975088 (inactive, but HubSpot accepted it). Titles start with "[Website]", or "[Website] [Broker]" for brokers.
- **Seller offers and "keep looking"** become deals in the HubSpot pipeline "Website seller offers" (New offer → Contacted → Viewing → Negotiating → Won / Rejected), plus call tasks.
- **Admin login:** a shared team password plus the person's name. Production plan: Cloudflare Access (@belmazad.com, 2FA) in front of `/admin`.
- **Brokers:** an "أنا وسيط عقاري (بروكر)" checkbox plus brokerage name in all three forms → User Type = Broker, Company = brokerage. Broker accounts and dashboards are a later phase.
- **Design (redesign, October 2026):**
  - Premium "liquid glass" look on the existing brand colours.
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

## Waiting on the owner
1. Test the broker option.
2. Change `ADMIN_PASSWORD` in `.dev.vars`. The current one was visible in a screenshot. Then restart the dev server.
3. Before going online: rotate the HubSpot service key ("Rotate" on the key page) and update `.dev.vars` and the server settings.

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
   - cleaner request cards; fake controls removed, filters and search working
   - wizard: per-field error messages, sticky Next on phones. The goal step is already removed (4 October 2026); the wizard now has 7 steps
   - "عندي العقار ده" directly on match results
   - fix the offer form wording
   - polished dialogs, FAQ, footer and mobile, with photos
3. **Admin dashboard** restyled with the same system.
4. **Testing:** every flow (buyer request → approve, offer, keep looking, broker, language, theme), phone, tablet and desktop, keyboard and reduced motion; build and commit.

**Owner decisions for Phase 2 (4 October 2026):**
1. **Goal step: remove.** Done: the wizard opens on "property type" and shows "Step 1 of 7". `CLAUDE.md` and `HANDOFF.md` updated.
2. **Photos: free licensed stock.** A shortlist is shown to the owner first; nothing is downloaded until the owner picks. The current Mallorca photo isn't cleared for reuse and will be replaced.
   - Owner picked H3 (El Gouna homes, buyer hero), S1 (modern villa, seller banner) and E2 (apartment balconies, supporting). Saved in `public/photos/`, credits in `HANDOFF.md`. S1 already replaces the Mallorca photo, which was deleted. H3 and E2 get placed during Phase 2.

## Planned, not started: easy buyer/seller sign-in
The owner asked for easy sign-in, asked for only when submitting. Proposed plan:
- **Browsing stays open.** Sign-in is asked for only when submitting a request, offer or "keep looking".
- **Flow:** the form is already filled in → "Send" → a panel slides up asking to confirm the mobile number already typed → 6-digit code by WhatsApp or SMS → account created and submission sent automatically. Nothing is lost and there is no restart.
- **Account type** is set by the action: buyer request = Buyer, offer or keep looking = Seller/Owner, broker box = Broker. It's shown in the panel with a one-tap switch.
- **Sessions:** signed cookies, about 60 days; returning users are pre-filled. No database needed (the HubSpot contact is the profile).
- **Optional:** a small "حسابي" (my account) page with request and offer statuses.
- The redesign leaves room for an account button in the header.

**Open questions (unanswered):**
1. Code provider: Twilio Verify, WhatsApp first then SMS (recommended), an Egyptian SMS provider, or no code for now?
2. "Continue with Google" too? (Recommendation: skip for now.)
3. Should accounts be shared with the main belmazad.com "Seller/Broker Login" or separate? What does the main site run on?
4. Email: don't ask (recommended), optional, or required?

## Later phases (discussed)
- Go online (Cloudflare hosting, new site identity, Access on /admin).
- Accounts and database (Supabase) once the main-site accounts question is answered.
- Move to the newer HubSpot API versions before the March/September 2027 deprecation shown on the key page.
- Production assets: official logo, licensed photos, licensed Neue Haas Grotesk font.

## Known quirks
- HubSpot contact property `additional_requirments` rejects special characters, so the website writes a plain letters/numbers version.
- `scripts/hubspot-setup.mjs` (safe to re-run) creates the HubSpot properties and pipeline. `scripts/hubspot-seed-statuses.mjs` was already run once (5 Pending / 80 Approved / 11 Rejected).
- Lint has 4 issues inherited from the original zip (in `Marketplace.tsx`) plus one "use next/image" hint for the hero photo, the same hint the seller photo already had; typecheck and build pass.
- The browser preview pane can't show phone layouts reliably; check on a real phone.
- In a hidden or background preview tab, the theme's colour fade can stall and leave the page background looking unchanged. In a visible browser it switches normally. The colour values themselves are correct.
