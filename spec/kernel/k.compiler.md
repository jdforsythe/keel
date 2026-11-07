# k.compiler: Compiler and artifacts
status: conformance-covered

**API.** One Vite plugin, no options (`@keel/compiler/vite`). Project shape comes from module manifests, `routes.ts`, `tokens.ts`, and `topology.ts`.

**Output.** JSX compiles to direct DOM operations (k.runtime). A component function runs once per instance. Each dynamic expression becomes one binding (text, attribute, property, or event) that updates only its own node. Static subtrees are hoisted into templates built once and cloned. `If`, `For`, `Match`/`Case`, and `Boundary` are compiler intrinsics; they lower to runtime ops, not component calls.

**Escaping by context.** Attributes and properties are set through the DOM, never string-concatenated. Server HTML escapes text and attribute contexts separately. **URL policy** (runtime ops, `@keel/ui` `Link`/`Image`): URL attributes are `href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `data`, `ping`/`srcset`/`imagesrcset` (each URL; split at spaces, commas), and `to`/`from`/`by`/`values` on any element (each `;` item). Navigation attributes (`href`, `action`, `formaction`, `Link to`) take an `Href` from `routes.href()` or an absolute URL; a literal path there that starts with `/` or matches a `routes.json` path pattern is E1501 (k.router). The rest are assets: relative literals pass. A value with a URL whose scheme, after the leading characters the URL parser skips, is not `http`, `https`, `mailto`, or `tel` renders as `about:blank`; no scheme is relative. Every `srcdoc` renders as `about:blank`; a `<base>` `href` is never rendered. Raw HTML has no API outside `unsafe`.

**Artifacts.** Written to `.keel/` on every build and dev change. JSON, sorted keys. Each file carries a content hash; all are read-only. `keel check` recompiles the project holding each `.keel/`; a differing hash or unknown file is E1005.
- `deps.json`: reactive graph (k.reactive).
- `ids.json`: `{ [elementId]: { file, line, col, component, tag, role } }` (k.component ids).
- `routes.json`: `{ [routeId]: { path, params, search, actions, layout, guard, module } }`; schemas as JSON Schema.
- `a11y.json`: per element id, expected `role` and the source of its accessible name (`label`, `alt`, `text`, `aria`). Its rules are one table, `@keel/compiler/a11y`, that the harness applies to the DOM (WAI-ARIA 1.2, HTML-AAM): `img` with literal `alt=""` is `presentation`, unnamed; `section` without `aria-label(ledby)` is `generic`; name from content only for non-control roles whose ARIA 1.2 "Name From" includes contents (so not `listitem`). A role, input `type`, or `select` `size`/`multiple` unknown statically is `null`, not compared.

**Build-time evaluation.** `tokens.ts` and each `routes.ts` run once in Node. A thrown error with an E code keeps it; else `tokens.ts` throwing or exporting no tokens is E1807 (k.ui), a `routes.ts` throwing or exporting no `routes` is E1006, each with file and message. Any other failure is E1049.

**Rules.** E1000 source does not parse (at the parser's location, `syntax error: <parser message>` under 90 chars; the file gets no other rule, element, or lowering) · E1001 `For` without `key`, or `key` not a field of the item · E1002 raw HTML in app code (`innerHTML` family by literal key, `DOMParser`, `document.write`, `on*` strings, also spread; rfc:0053) · E1003 any `srcdoc` or `<base>` `href`, or a literal the URL policy renders as `about:blank` in a URL attribute or `Link to`/`Image src`; fix removes the attribute, except a required prop · E1004 a `*.server.ts` module imported from client-reachable code (evaluated per deployable: a file under `modules/<m>/` belongs to every deployable listing `m`; not reported when all of them declare no server, nor for the `routes.ts` of a module only `node` deployables list; never for files outside `modules/`) · E1005 hand edit to generated output (`.keel/`, `turbo.json`, CI workflows, Dockerfiles, generated API schemas) · W1005 `routes.json` beside a `routes.ts`: unverified by `keel check`; `vite build` rewrites it, warning if it differed · E1006 `routes.ts` fails to evaluate · E1049 internal compiler failure: the message verbatim, no app location, never an app code.

**Conformance.**
- Compiling the same sources twice yields byte-identical JS and artifacts.
- Updating one signal changes only the DOM nodes bound to it; every other node keeps its identity.
- A string containing `<script>` or `"><img onerror=x>` rendered as a child or attribute value appears verbatim as text or attribute value and creates no element.
- A dynamic `href` whose value is `javascript:alert(1)` renders as `about:blank`.
- `ids.json` has exactly one entry per element in source, and each key is an id the harness `find(id)` resolves.
- Reordering a keyed `For` list preserves the DOM node identity of every row.
- Changing any byte of a file under `.keel/` makes `keel check` report E1005 on that file.
- A component with no dynamic expressions compiles to a single cloned template and no bindings.
- A literal `poster="javascript:alert(1)"` is E1003, and the same value bound dynamically renders as `about:blank`.
- Any `srcdoc`, and a `vbscript:` URL in any URL attribute, is E1003 as a literal and `about:blank` when bound.
- A literal `src="logo.png"` is not E1501; `href="/orders"` is.
- `<img alt="">`, an unnamed `<section>`, `<td>` and `<li>` with text render with no E1702.
- A file with a syntax error yields only E1000, also in `routes.ts` at build time.
- A `routes.ts` throwing a plain Error is E1006; throwing `{ code: 'E1502' }` keeps E1502.
- A compared `.keel/` artifact with changed `data` and recomputed `hash`, or older than its sources, is E1005.
- Beside a `routes.ts`, a forged self-consistent `routes.json` is W1005 in `keel check` and in `vite build`, which rewrites it.
- `javascript:` in `object data`, a `srcset` candidate, or a `<set>` `to`/`<animate>` `values` item is E1003 as a literal and `about:blank` bound; any `<base>` `href` is E1003, never rendered.
