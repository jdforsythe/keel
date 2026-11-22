# RFC 0182: k.head, k.topology: Keel writes every document; a deployable's `styles` carries its CSS

Status: implemented (ADR-0204). For backlog 1020, from walkthrough finding L1-8 and the font note of L1-1 (`tasks/p1/walkthrough-findings.md`).

## Decisions
- D1: one source of truth. Keel writes every document in dev and in build. A `node` or `static` deployable's document is k.head's (Server). A `client` deployable's `index.html` is generated in dev too, as the build writes it now when a project has none (`packages/compiler/src/internal/indexHtml.ts`): charset, viewport, `<title>` its name, the icon, a stylesheet link per entry `.css` file, `#app`, the entry script. A project's own `index.html` is never read. The rejected alternative, reading `index.html` in both, is in Alternatives.
- D2: what an author put in `index.html` has one home each. Markup (a header with the mark) goes in a layout component. A stylesheet (the brand fonts) goes in the new deployable key `styles`: a list of package specifiers whose export is a `.css` file, `styles: ['@keel/ui/fonts']`. The compiler imports each in that deployable's entry (client and resume), so the build's entry chunk names the CSS, k.head links it on a server, the generated `index.html` links it, and Vite injects it in dev. Nothing is inline, so the strict policy holds (k.security). App code still imports no `.css` (E1825): `styles` is a declaration in `topology.ts`, read statically like the rest of it.
- D3: W1012 (k.head; the E100x range, which the map row now lists k.head under): a project root holding `index.html` is one warning per `keel check`, `keel dev` and `keel build`, naming the file. Fix: move markup into a layout and stylesheets into `styles`. It is a warning, not an error, since the file harms nothing once it is unread; the warning says that the file is ignored.
- D4: E1587 (k.topology): a `styles` entry that is not a string literal, or whose package export is not a `.css` file (a relative path, a script export), in `keel check` and `keel build`.
- D5: a `client` document's fallback title is its deployable's name, as on a server, since the generated `index.html` carries it. k.head says so in one sentence.
- D6: `keel scaffold project` writes no `index.html`, with or without `--workspace`, and its deployable gets `styles: ['@keel/ui/fonts']`.
- D7: k.head goes from `conformance-covered` to `implemented`, and k.topology (already `implemented` by RFC 0179) and k.scaffold (`implemented`) gain clauses. The four new clauses are in the ledger at `none`. Nothing becomes `frozen`.

## Problem
`keel dev` and the build serve different documents:
- For a `client` deployable, Vite serves and builds the project's `index.html` when there is one; the plugin generates one only in a build (`page()` and `resolveId` in `packages/compiler/src/vite.ts`). So dev and build agree only by the author's file.
- For a `node` deployable, dev and the built `server.mjs` render the route on the server with k.head's head (`packages/server/src/internal/headHtml.ts`: title, entry stylesheets, icon) and never read `index.html`. The scaffold's `index.html` (`packages/scaffold/src/templates/indexHtml.ts`) holds a header with the mark and the app's name, and a module script importing `@keel/ui/fonts`. The header shows in a `client` dev page only, and the brand fonts never ship for a `node` deployable (L1-1, L1-8).
- An author has no other way to bring a stylesheet to a document: k.head offers `title` alone, and a `.css` import in app code is E1825.

Five apps and four examples carry their own `index.html` (golden-1 links `/node_modules/@keel/ui/fonts/fonts.css` by path), each a copy that drifts.

## Proposal
- k.head gains **Document source** (D1, D2's last sentence), the fallback-title sentence of D5, and Rules W1012.
- k.topology Declaration gains `styles?` and its sentence; Rules gain E1587.
- k.scaffold `project`: no `index.html`; the deployable has `styles: ['@keel/ui/fonts']`.
- Map: the E100x row names k.head; the k.head row reads `implemented`.

For an app author: delete `index.html`, move its header into the layout, and add `styles: ['@keel/ui/fonts']` to the deployable. Dev and build then serve the same head, and the fonts load on every adapter.

## Alternatives
- **Read `index.html` in dev and build for every adapter.** Rejected: a `node` document would have to merge an author's head, scripts included, into the server's, which writes its head from route state with a nonce policy. That is two head writers with an ordering and escaping contract between them, and a module script in the file would need bundling into the server path.
- **Ship `@keel/ui/fonts` in every document.** Rejected: an app's typography is the app's; Keel's brand applies to Keel's own pages.
- **A head API on routes (`links`).** Rejected: fonts are per deployable, not per route, and a route-level list multiplies one fact across a table.
- **An error for a present `index.html`.** Rejected (D3): the file is harmless once unread.

## Spec diff
Applied in this commit:
- **k.head** (status `implemented`, D7): Document source, the fallback title, W1012. Conformance gains clause 9.
- **k.topology**: `styles` in Declaration, E1587. Conformance gains clauses 12 and 13.
- **k.scaffold**: `project` writes no `index.html` and the `styles` entry. Conformance gains clause 15.
- **Map**: the E100x row and the k.head row.
- **Ledger**: `k.head#9`, `k.topology#12`, `k.topology#13` and `k.scaffold#15` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0182`, from the spec text alone:
- k.head 9 (`packages/compiler/conformance/` or `packages/cli/conformance/`): a `client` fixture `web` with a project `index.html` holding `<header>Only here</header>`. Neither `keel dev`'s document nor the built `dist/web/index.html` holds that text, the built one's `<title>` is `web`, and `keel check` prints one W1012 naming `index.html`. Without the file there is none.
- k.topology 12: with `styles: ['@keel/ui/fonts']`, a built `node` document's head and a built `client` `index.html` each link a stylesheet holding that file's `@font-face` rules; without it, neither does.
- k.topology 13: `styles` entries `'./x.css'`, `'@keel/ui'` and a variable are each one E1587 in `keel check` and `keel build`.
- k.scaffold 15 (`packages/scaffold/conformance/`): `keel scaffold project p` and `keel scaffold project p --workspace` write no `index.html`, and `topology.ts`'s deployable has `styles: ['@keel/ui/fonts']`.
Spec topics: `pnpm spec k.head`, `pnpm spec k.topology`, `pnpm spec k.scaffold`; for context `pnpm spec k.hosting`, `pnpm spec k.security`, `pnpm spec k.compiler`.

## Build
- `@keel/compiler`: the generated `index.html` in dev and build, the project's file unread; `styles` imported in each entry; W1012 and E1587 at build and dev.
- `@keel/server`: `topology()` accepts `styles` (the closed deployable object).
- `@keel/check`: W1012 and E1587 in `keel check`, with `EXPLANATIONS` entries.
- `@keel/scaffold`: no `indexHtml` template; `styles` in the scaffolded topology.
- Apps and examples: `index.html` removed from golden-1, golden-2, inspector, sessions, household and the four examples; headers into layouts; `styles` added.
- Docs: the keel-deploy and keel-client skills (`styles`, no `index.html`).

## Known limits
- `styles` takes package exports only. An app's own CSS file stays E1825, as atomic styling (k.ui) intends.

## Migration
None: unreleased.

## Token impact
k.head 4,072 to 4,868 characters; k.topology 6,137 to 6,755; k.scaffold 5,779 to 5,986; map +9. No budget moves.
