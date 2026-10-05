# belmazad.com — Request a property

Arabic-first, English-toggle front-end reference. React 19 + TypeScript + Tailwind v4, served by the Sites Vinext starter. No application backend, authentication, payments, or real AI.

## Source map
- `app/page.tsx`: preview redirect to `/request-property`.
- `src/Marketplace.tsx`: demand feed, detail/response dialogs, 7-step buyer wizard (internal step numbers run 1–7, matching `validateStep` in `src/data.ts` and the server re-check), seller matching, confirmation.
- `src/content.ts`: Arabic/English interface dictionary and translated option labels.
- `src/styles.css`: semantic palette, glass surfaces, responsive rules, motion and isolated Arabic/Latin font stacks. Replace `--font-brand`, `--font-latin`, and Arabic font with the licensed production assets as appropriate.
- `src/data.ts`: typed `PropertyRequest`, validation, options, sample demand, deterministic matching function.
- `src/api.ts`: `submitRequest()` is the future buyer API boundary. Returns a demo reference without transmitting or storing contact information.

## Agency integration
1. Replace the text wordmark with the approved brand logo and licensed brand fonts.
2. Replace sample demand with API data, preserving private contact fields separately from the public projection.
3. Implement `submitRequest()` with the agreed API and server validation. Apply moderation to public free text to avoid personal contact information appearing there.
4. Connect seller response submission through Belmazad; the current dialog acknowledges the demo locally only.
5. Replace `matchRequests()` with the matching service. Current score: type 25, location 25, area 15, budget 20, features 10, bedrooms/bathrooms 5. Results require matching type and >=65 points. Notes are collected for buyer review; semantic interpretation requires the future AI service.
6. Confirm production privacy terms, consent, transaction fees and moderation before launch. Publishing a buyer request is described as free; no claim of a free transaction is made.

## Demo behaviors
- Language switches document `lang` and `dir` without clearing form state.
- Buy-only flow; land and other non-residential types remove bedrooms/bathrooms/floor.
- Multi-area filtering, typed budgets and upper-budget slider, required field validation.
- Public review excludes name/phone; editable steps and full-screen success with copyable summary.
- Seller inputs influence calculated results; no-match and loading states provided.
- Reduced motion honored; keyboard focus styles and Radix focus-trapped dialogs.
- Submitted requests join the feed and matching pool in session memory. All state resets on reload.

## HubSpot wishlist feed
The "طلبات المشترين" feed and the seller matching read real buyer requests from HubSpot.

- **Source:** HubSpot contacts whose `hs_object_source_detail_1` is `Buyer Wishlist Form`. Excluded: `user_type` Seller or Broker, budget `Rental`, and notes that mention brokers, rent or lease.
- **Flow:** the browser calls `GET /api/wishlist` (`app/api/wishlist/route.ts`) on load, every 60 s, and when the tab regains focus. The route queries the HubSpot CRM search API with the server-side token, caches for 60 s, shares one fetch between concurrent requests, and serves the last good copy if HubSpot is unreachable. New or edited requests appear within about 2 minutes, without a page reload.
- **Mapping** (`src/hubspot/wishlist.ts`): `property_subtype`/`property_type` → type; `preferred_locations` + `secondary_preferred_locations` → governorates; `budget__maximum_` → budget range. The free-text `additional_requirments` note is parsed on the server for area (feddan → m²), EGP budget figures, known districts and requirement keywords. A note budget is used only when it agrees with the HubSpot range. **The note text itself never reaches the browser**, because it contains internal staff remarks, third-party names and sometimes phone numbers.
- **Privacy:** only type, locations, size, budget, feature chips, dates and an anonymised `BM-xxxx` reference (a hash of the contact ID) are sent. Names, phone numbers, e-mails, owners, lead status and HubSpot record IDs are never requested for, or sent to, the website.
- **Fallback:** without `HUBSPOT_ACCESS_TOKEN` the route returns 503 `unconfigured` and the page shows the sample requests with the demo label. Once the token is set, sample data is not used; errors show a retry message instead.
- **Setup:** create a HubSpot private app with the scopes listed in `.dev.vars.example`. Copy that file to `.dev.vars` and paste the token (local dev); in production, set `HUBSPOT_ACCESS_TOKEN` as a secret.
- **Known limits:** area, district and budget figures come from automatic parsing of informal notes, so some posts show "غير محدد" or miss a detail. Districts outside the dictionary fall back to the governorate. Staff can improve a post by writing clear figures in the note, e.g. "2000 meter", "budget 30 million", "in gamalon".

## Themes and design system
- **Light by default:** the site always opens in light. The sun/moon button (`src/ThemeToggle.tsx`, in the public header and the admin header) switches `<html data-theme>` between `light` and `dark` and saves the choice in `localStorage` under `bm-theme`.
- **No flash:** `themeBootScript` (`src/theme.ts`), inlined in `<head>` by `app/layout.tsx`, re-applies a saved dark choice before first paint. `<html>` uses `suppressHydrationWarning` for that attribute only.
- **Colour tokens** (`src/styles.css`): components use only the existing tokens (`--white` = card surface, `--surface`, `--ink`, `--muted`, `--line`, `--blue`, `--pale-blue`, …). The "Design system layer" at the end of the file redefines them under `:root[data-theme=dark]`, so new components get dark mode automatically if they use tokens.
  - Never hardcode colours in components.
- **Fixed roles that stay the same in both themes:**
  - `--blue-fill` and `--green-fill`: button and badge fills
  - `--on-fill`: white text on those fills
  - `--on-orange`: dark ink text on the orange CTA, kept for contrast
  - `--page`: page background
- **Shared component rules:** button states (hover lift, press, focus ring `--ring`), field focus, glass blur on `.nav`, `.glass` and `.mobile-action`, card radius and shadow scale (`--radius-sm/md/lg`, `--shadow-sm/md`), the `.theme-toggle` styles, and reduced-motion overrides.
- **Fonts:** Arabic `--font-arabic` is IBM Plex Sans Arabic; Latin `--font-latin` is DM Sans. Both are loaded from Google Fonts at the top of `src/styles.css`. Replace them with the licensed brand font (Neue Haas Grotesk) at production.
- **Admin:** `src/admin/admin.css` uses the same tokens, so it follows the theme too.
- The full redesign plan and its phases are in `PROJECT_STATUS.md`.

## Team admin (`/admin`)
The admin is a private team page; the HubSpot data it shows is never sent to the public site.

- **Login:** the shared team password `ADMIN_PASSWORD` (in `.dev.vars`) plus the person's name, which is recorded on every decision.
  - Sessions are HMAC-signed, HttpOnly, SameSite=Strict cookies lasting 12 hours; changing the password logs everyone out.
  - Five failed attempts lock an IP for 15 minutes.
  - Production: also put Cloudflare Access (@belmazad.com emails, 2FA) in front of `/admin`.
- **Buyers** (`src/admin/buyers.ts`, `/api/admin/buyers`): every Buyer Wishlist request with status filters, search, private details (name, phone, staff note, "Open in HubSpot"), an editable public post with a live Arabic/English preview, and actions.
  - Approve and publish.
  - Request changes: hides the post and creates a "[Website] Call buyer to update request" task.
  - Reject: hides the post; a comment is required.
  - Saving writes `website_listing_*` and `website_public_*` on the contact.
  - **Only Approved requests are public.** Until any contact has a listing status (setup not yet run), the feed falls back to the automatic rules.
- **Sellers** (`src/admin/sellers.ts`, `/api/admin/sellers`): deals in the "Website seller offers" pipeline, one per offer or "keep looking" request.
  - Shows date, buyer request, seller and property, price and stage.
  - Actions: change stage, team notes, create a follow-up call task, open the deal or contacts in HubSpot.
- **HubSpot setup:** `node scripts/hubspot-setup.mjs` creates the properties and pipeline and is safe to re-run. `node scripts/hubspot-seed-statuses.mjs [--dry-run]` gives existing requests a first status: 5 newest Pending, the others Approved, auto-excluded ones Rejected.
  - Required extra key scopes: `crm.schemas.contacts.write`, `crm.schemas.deals.write`, `crm.objects.deals.write`.

## Buyer requests from the website wizard
"انشر طلبي" posts to `POST /api/buyer-request` (`src/hubspot/buyerRequest.ts`).
- **Validation:** the server re-validates every wizard step and requires consent.
- **Contact:** found by mobile or created with User Type = Buyer. The existing wishlist fields are filled in:
  - property type / subtype
  - governorates from the chosen districts
  - budget range
  - an English summary in `additional_requirments`

  Also set: `wishlist_submitted` = Yes and `website_request_source` = website.
- **Public post:** the buyer's exact choices are saved as `website_public_*`, and the status is set to **Pending**. An existing contact's current wishlist is replaced by the new request and goes back to Pending.
- **Review:** a "[Website] Review new buyer request BM-xxxx" task is created for each owner. The request appears in Admin → Buyers → Pending and is public only after approval.
- **Duplicates:** the same buyer and the same request within 10 minutes counts once.
- **Buyer's confirmation:** shows the real BM- reference and "reviewed by the team" steps. Nothing is added to the public feed before approval.

## Brokers
The buyer request wizard (contact step), the seller offer form and "Let us keep looking" all have an "أنا وسيط عقاري (بروكر)" checkbox. When ticked, a brokerage name is required.
- **New contacts:** User Type = Broker, and Company = the brokerage.
- **Existing contacts:** keep their user type; the task notes say it was submitted by a broker.
- **Tasks:** titled "[Website] [Broker] …", with a "Submitted by a broker — brokerage: …" line. They still go to the Khadija owners.
- **Offer deals:** store `website_broker_company`.
- **Admin:** shows a "Broker · company" badge on requests and offers. Broker requests submitted through the website aren't flagged as auto-excluded.
- **Later:** broker accounts and dashboards belong to the account phase, so they're not built yet.

## Header menu and hero (redesign Phase 2)
- **Phone menu:** below 800 px the header links are replaced by a menu button that opens a glass panel with the section links and the main action. Below 600 px the theme and language buttons move into the panel too. The buyer/seller switch always stays in the header bar. The panel closes on Escape (focus returns to the button), on a tap outside the header, and when a link is chosen; menu links scroll to their section themselves.
- **Hero:** the El Gouna photo (`public/photos/hero-el-gouna.webp`) with two cards on top, both from real data:
  - the number of active buyer requests (the live HubSpot feed, or the sample set in demo mode) and when it was last updated, or the demo label;
  - the newest request (type, areas, budget, size). Tapping it opens the usual request details.
- The old made-up scene ("12 matches", "92%", "4,000 m²", "50–70") and the separate demo bar under the hero were removed.

## Request cards and feed (redesign Phase 2)
- **Cards** show "Wanted to buy", the type and areas, the request's age and its BM reference, size, budget and feature chips. The "Anonymous buyer" line, the per-card "Active request" badge, the bookmark icon and the decorative response counts were removed (live requests never had response counts). The admin's public-post preview uses the same layout.
- **Type chips** are built from the requests that match the search, most common first, each with its count, so every type in the feed can be filtered (shops, buildings and warehouses had no chip before).
- **Search** looks at both languages' labels (type, areas, features) and the BM reference; every word must match; Arabic spelling variants (أ/إ/آ/ا, ة/ه, ى/ي, diacritics) are ignored. A clear button empties it.
- **Order** is always newest first ("Sorted by newest" is plain text, not a menu). "Show more" adds 6 cards at a time and shows how many remain. The counter uses correct Arabic and English plurals.

## Buyer and seller views
`/request-property` has two views, switched by "بتشتري | بتبيع" in the header. `?for=sellers` opens the seller view directly, for ads and WhatsApp links.

- **Seller view:** wording from `sellerCopy` in `src/content.ts`, which overrides the buyer text; "serious buyers / مشترين جادين" is the term for the buyer pool.
  - Section order: hero (with the live count of requests), live requests, how it works, matching tool ("لاقي مشتري عقارك"), seller banner, seller FAQ.
- **Buyer view:** hero, how it works, request wizard, live requests (its side card switches to the seller view), buyer FAQ.
- **No unconfirmed claims** in seller copy: no "free", "qualified" or response-time promises.

## "Let us keep looking" (seller, no match)
In the matching results, "خلّينا ندوّرلك" asks for name, mobile and optional details, and posts the property from the matching form to `POST /api/seller-search`.
- The seller contact is found or created.
- A "[Website] Call seller – let us keep looking" call task is created for each owner, linked to the seller.
- Duplicates are checked per mobile + type + location.

## Seller responses → HubSpot tasks
All website tasks are titled "[Website] …", have type **Call**, and their notes start with "Created automatically from belmazad.com".
On a live post, "عندي عقار مناسب" submits the seller's details, area, asking price and notes to `POST /api/seller-response` (`app/api/seller-response/route.ts` → `src/hubspot/sellerResponse.ts`).

- **Validation:** the server re-validates everything and resolves the public `BM-` reference to the buyer contact through the cached wishlist.
- **Seller contact:** found by Egyptian mobile number (several stored formats are checked). If there is none, a contact is created with `user_type` = Seller.
- **Tasks:** one task per owner in `HUBSPOT_TASK_OWNER_IDS` (default Khadeja Hesham 33163566 and Khadija Hesham 1824975088). Each is To-do, High priority, Not started, due now, and linked to the buyer contact, the seller contact and the buyer's deals.
  - The subject holds a duplicate-check key, `[SR…]`, plus the request type, location and reference.
  - The notes hold the request as shown on the website, the original HubSpot wishlist fields including the staff note, links to both contacts, and the seller's submission.
- **Duplicates:** the key is derived from the buyer contact + the seller's mobile. Before creating, the server searches HubSpot tasks for that key per owner, and it also remembers recent keys in memory to cover HubSpot's search-index delay. A repeat from the same seller for the same request creates nothing, and the seller sees "already received". A different seller on the same request gets a new task.
- **Rejected owners:** if HubSpot rejects an owner (for example a deactivated user; Khadija Hesham 1824975088 is currently inactive and not offered in HubSpot's task "Assigned to" list), that owner is skipped for an hour and the other owners still get their task. The rejection is logged.
- **Sample posts:** posts from the sample data (no token configured) keep the local demo acknowledgement and send nothing.

## Photos
Chosen by the owner on 4 October 2026 from Unsplash. The Unsplash License allows free commercial use without attribution; credit is kept here anyway. Files are WebP copies resized by Unsplash's image service.

| File | Use | Photo | Photographer |
|---|---|---|---|
| `public/photos/seller-villa.webp` | Seller banner (seller view) | https://unsplash.com/photos/hHz4yrvxwlA | Avi Werde |
| `public/photos/hero-el-gouna.webp` | Buyer hero (to be placed in redesign Phase 2) | https://unsplash.com/photos/3VsSOtf26j0 · El Gouna, Egypt | Levi Morsy |
| `public/photos/apartments.webp` | Supporting image (to be placed in Phase 2) | https://unsplash.com/photos/AHzHbWmNaU4 | CodeShady |

The earlier `public/property.webp` (a Mallorca villa with no established reuse rights) was removed.
