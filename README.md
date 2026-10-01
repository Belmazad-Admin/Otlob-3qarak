# belmazad.com — Request a Property (Claude Code handoff)

This is the complete front-end prototype, with no node_modules, generated build output, or live Site credentials. It has one user-facing route, `/request-property`; `/` redirects to it.

## Open locally

1. Install Node.js 22.13 or later.
2. Open this folder in Claude Code.
3. Run `npx pnpm@11.19.0 install --frozen-lockfile`.
4. Run `npx pnpm@11.19.0 dev` and open the printed local URL.
5. Run `npx pnpm@11.19.0 build` after changes.

See `CLAUDE.md` for design rules, file map, and implementation boundaries. `HANDOFF.md` records the existing agency integration points.

The live ChatGPT Sites version was deployed privately at https://belmazad-demand.mahmoudfarahat.chatgpt.site . This ZIP is an independent source copy; it contains no active Site identity or credentials.
