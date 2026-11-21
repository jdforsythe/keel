# ADR-0067: a node deployable's document carries its title, stylesheet and icon (RFC 0078)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC defaults 2, 3, 5 and 6.

**Context.** `createApp` writes a head with a charset and a viewport only, so a node-rendered page has no title, stylesheet or icon, and an unknown path shows the bare code `keel.notFound`. A client deployable gets these from the scaffold's `index.html`; a node deployable has none. The production build's manifest already records the entry's stylesheets, and the build already holds `keel-mark.svg` from `public/`, but the asset loader serves only `assets/`.

**Decision.** `createApp` computes one head per app at startup: `<title>` the served deployable's name, a stylesheet link per CSS file of the manifest's entry chunk that the build holds, and `/keel-mark.svg` as the icon when the build has it. The asset loader serves the build's top-level `keel-mark.svg` when it is a regular file, follows a symlinked `assets/` to its real path, and reads nothing under it when that real path cannot be read. Only the entry chunk's own `.css` files under `/assets/` are linked. Every value is escaped and nothing is inline. The default alert for `keel.notFound` is `<h1>Not found</h1>`. No option, export or file convention is added.

**Alternatives.**
- A brand base stylesheet from `brandTokens`, rejected: a second styling path beside `keel.css`, wrong for apps with their own tokens.
- Serving every top-level build file, rejected for now: it reverses the rule that only `assets/` is served.
- Inline style or a data-URL icon, rejected: a strict CSP refuses inline style, and the data URL costs every page about 1 kB.
- A prose message on the `keel.notFound` error, rejected: the router builds the same error, so client and server would disagree.

**Consequences.**
- k.server gains one Document sentence, one Build phrase and one conformance clause, offset by rewording within the section.
- Every node document has a title, and a 404 has a heading. The stylesheet link appears once the compiler's node client build emits CSS; today it emits none.
- Per-route titles and custom head links remain open: each needs a new API shape (RFC 0078 Open questions).
- `@keel/server` grows by 235 bytes gzip to 14,390, over 14 kB and under the 14.5 kB re-base.
