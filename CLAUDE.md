# Claude Code project guide — belmazad.com Request a Property

**Start here:** read `PROJECT_STATUS.md` first. It has the current status, decisions, open questions and the owner's working preferences.

You are continuing an existing working front-end prototype. Preserve its core model and visual direction unless Mahmoud asks for a change. The product is a reverse property marketplace: buyers publish demand; owners and brokers discover requests; an AI-style demo ranks matches. This is the page itself, not a concept presentation.

## Run and verify
- Node.js >=22.13. Use `npx pnpm@11.19.0 install --frozen-lockfile`, then `npx pnpm@11.19.0 dev`.
- Run `npx pnpm@11.19.0 build` before handoff. The prototype uses React 19, TypeScript, Tailwind v4 and Vinext/Cloudflare's local Vite runtime.
- The root `/` redirects to `/request-property`.
- A local copy has `.openai/hosting.json` with a null project ID to avoid editing the existing privately hosted Site by accident. Use a separate hosting destination if asked to publish this copy.

## Required experience
- Arabic-first RTL and English LTR; language toggle updates document direction. All bilingual strings and option labels live in `src/content.ts`.
- Brand name is lowercase `belmazad.com`. Preserve its primary blue #0077B5, orange #F56E3D, supporting neutral palette, and Arabic tagline `السوق في إيدك.`. CSS tokens live in `src/styles.css`; do not hardcode new colours in components. Licensed Neue Haas Grotesk is for future production; free stand-ins are in CSS.
- Feed posts mean *buyer requests*, never properties for sale. Keep requests anonymised; never expose contact details on public cards or matching results.
- Buy only. Buyer flow has seven stages (the one-option "goal" stage was removed in October 2026): type, multi-area location, budget, requirements, must-haves, notes/contact, public review. Land and other non-residential types hide bedrooms, bathrooms and floor.
- Mobile layout has a sticky action bar and a full-height wizard. Keyboard focus and reduced-motion rules matter.
- The buyer request feed is live from HubSpot (see "HubSpot wishlist feed" in `HANDOFF.md`) when `HUBSPOT_ACCESS_TOKEN` is set; the sample requests in `src/data.ts` appear only when it is not. Never send HubSpot names, phones, e-mails, owners, record IDs or the raw `additional_requirments` note to the browser — only the fields produced by `src/hubspot/wishlist.ts`.
- Seller matching ranks those buyer requests with a deterministic front-end score, not a real AI service.
- Buyer wizard submission (`/api/buyer-request`, `src/hubspot/buyerRequest.ts`) creates/updates a HubSpot contact as Pending plus a "[Website] Review new buyer request" task; it is public only after approval in /admin. Without a HubSpot token it stays a local demo. Seller responses on live HubSpot posts are real (they create HubSpot tasks); on sample posts they remain a local demo. Live backend, auth, payments, notifications, rental, seller dashboard and real listings are outside this reference.

## Source map
- `src/Marketplace.tsx` — page UI, wizard, demand feed, seller demo and dialogs.
- `src/content.ts` — all Arabic/English copy and option labels.
- `src/data.ts` — typed PropertyRequest, sample requests, options, validation and match scoring.
- `src/api.ts` — `submitRequest()` is the single future buyer API integration point.
- `app/api/wishlist/route.ts` — server route that reads Buyer Wishlist contacts from HubSpot (60 s cache).
- `src/hubspot/wishlist.ts` — server-only mapping and note parsing into anonymised `Demand` posts; `src/hubspot/feed.ts` — shared cache; `src/hubspot/client.ts` — HubSpot REST helper.
- `app/api/seller-response/route.ts` + `src/hubspot/sellerResponse.ts` — seller offers on live posts become HubSpot tasks (seller contact found/created, duplicate-checked).
- `app/admin/page.tsx`, `src/admin/*`, `app/api/admin/*` — team admin (Buyers approvals, Sellers offers), password + signed-cookie session (`src/admin/auth.ts`). Every admin API goes through `adminRoute`.
- `scripts/hubspot-setup.mjs`, `scripts/hubspot-seed-statuses.mjs` — HubSpot properties/pipeline setup and first statuses.
- `src/styles.css` — semantic tokens, typography, responsive layout and motion.
- `app/request-property/page.tsx`, `app/page.tsx`, `app/layout.tsx` — route and metadata.
- `HANDOFF.md` — integration notes and demo limits.

## Practical cautions
- Photos in `public/photos/` are free Unsplash stock chosen by the owner (credits in `HANDOFF.md`, section "Photos"). The old Mallorca photo was removed because its reuse rights were never established.
- The text logo is a prototype; replace with approved logo files and licensed fonts before production.
- Apply server-side validation and moderation before publishing free-text buyer notes. Keep private contact fields separate from the public request model.
- The site's existing private URL may require the original ChatGPT account. This archive is the transferable source.

When asked to change a feature, edit the source directly, run the build, and explain the result and any remaining demo limitation succinctly.
