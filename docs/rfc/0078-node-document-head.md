# RFC 0078: a node deployable's document carries its title, stylesheet and icon

Status: accepted (ADR-0067, 2026-11-10) for the Proposal. Applies WORKFLOW RFC default 2 (one way per thing: the head reuses the build's own stylesheet and the scaffold's mark, no second styling path), default 3 (reuse the existing path: the client build's manifest and the asset loader), default 5 (server-only by default: nothing new reaches the client) and default 6 (the kernel writes the head, so no app has to remember to). The Open questions need the user: each is a new hand-written API shape.

## Problem
`createApp` writes a `<head>` with only a charset and a viewport. A page a node deployable renders has no `<title>`, links no stylesheet and has no icon, so the browser tab shows the URL and the default page icon. An unknown path answers 404 with `<div role="alert" data-keel-error="keel.notFound">keel.notFound</div>`, which reads as a raw code. A client deployable gets all three from the scaffold's `index.html` (`<title>` the project name, `/keel-mark.svg` as icon, the self-hosted fonts); a node deployable has no `index.html`, so every node app starts off brand.

The production build already holds what the head needs. Vite records the stylesheets an entry imports in the manifest entry chunk's `css`, and copies `public/keel-mark.svg` (scaffolded with every project) to `dist/<name>/keel-mark.svg`. The asset loader reads only `assets/`, so the mark is never served.

## Proposal
- **Title.** Every document's head has `<title>` the served deployable's name (the `deployable` option, else the topology's one key), escaped. A 404 carries the same head.
- **Stylesheet.** With a production build, the head links each CSS file the manifest's entry chunk names and the build holds, as `<link rel="stylesheet" href>`, on every page, islands or not.
- **Icon.** The asset loader also serves the build's top-level `keel-mark.svg` when it is a regular file (no symlink), with the same headers as any unhashed built file (`nosniff`, `no-cache`, ETag). When the build has it, the head links it as `<link rel="icon" href="/keel-mark.svg">`.
- **404.** The default alert for `keel.notFound` (no `errorElement` applies) is `<h1>Not found</h1>` inside the same `role="alert"` `data-keel-error` element. Other codes keep the message.

Everything in the head is an element with escaped attribute values: no inline script or style, so a strict CSP allows it. In dev, or without a build, the head has the title only. No option, prop, export or file convention is added: the name comes from the topology, the stylesheet from the manifest, and the icon from the file every scaffolded project already has.

The stylesheet link is live as soon as the node client build emits CSS. The compiler's node build (`KEEL_DEPLOYABLE` naming a `node` deployable) bundles the resume entry alone, which imports no `virtual:keel.css` and no `@keel/ui/fonts`, so today it emits no CSS and the link is absent. Emitting `keel.css` and the fonts from that build is a k.compiler change outside this RFC; with it, the server links them with no further change.

## Alternatives
- **A brand base stylesheet the server writes from `brandTokens`.** A second styling path beside `keel.css` (default 2), wrong for an app with its own `tokens.ts`, and it leaves the atomic classes unstyled.
- **Serve every top-level build file (all of `public/`).** Dev parity with Vite, but it reverses the asset rule that only `assets/` is served, so a stray root file (an `index.html`, an entry outside `assets/`) would be served. Kept as an Open question.
- **An inline `<style>` or data-URL icon.** A strict CSP refuses inline style, and the mark as a data URL adds about 1 kB to every page.
- **Change the `keel.notFound` message to prose.** The router builds the same error with message `keel.notFound`; changing one side gives the client and the server two messages for one error.

## Open questions
These need a new hand-written API shape, so they are the user's call.
1. **Per-route title.** Recommended: an optional `title` on the route definition (k.router), a string or `(props) => string` of the route's `params` and loader `data`, written as `<title>{route title} · {deployable}</title>`; the client router sets `document.title` on navigation from the same field. Alternative: a deployable-level `title` in `topology({ <name>: { modules, adapter, title } })`, one title per deployable and no per-page text.
2. **A custom icon or other head links.** Recommended: none; the icon stays `public/keel-mark.svg`, which an app replaces. Alternative: a `head` field on the deployable in `topology.ts` listing extra `{ rel, href }` links.
3. **Serving all of `public/` in production.** Not an author-facing API, but it reverses an existing asset decision; recommended only together with an explicit allowlist from the build.

## Spec diff
- **k.server** Document: adds "Head: `<title>` the deployable name, entry CSS and `/keel-mark.svg` icon if built. A `keel.notFound` default alert has an `h1`." Build: "serves `/assets/*`" becomes "serves `/assets/*` and `/keel-mark.svg`". **Conformance**: "A built document has the head Document names; an unmatched path is 404 with an `h1`."
- To stay within the section budget the same section is reworded without a change in meaning: the API, Server state, Request flow, Topology, Dev server and Rules paragraphs are shortened, and the `caller` sentence keeps the signed-token rule while its fallback order lives in the existing conformance clause.

## Conformance diff
- Added `packages/server/conformance/document-head-0078.test.ts`. No existing conformance file changes.

## Migration
None. An existing node app gains the title and the readable 404 on upgrade, and the icon once its build holds `keel-mark.svg`, as every scaffolded project's does. A test that matched the 404 alert's text `keel.notFound` matches `data-keel-error="keel.notFound"` or the `h1` instead.

## Token impact
k.server stays at the 1,500 token section limit: about 40 words of new text, offset by rewording elsewhere in the section. The `@keel/server` bundle grows by 212 bytes gzip to 14,367 bytes, 31 bytes over its 14 kB budget; the budget is the orchestrator's to re-base.
