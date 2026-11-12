# RFC 0091: friction batch 3 (focus in tests, blank strings, required text, dev port, unreachable peers, deployable names, landmark names)

Status: accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC defaults, after the user said to keep working; the user confirms or reverses it (`docs/HANDOFF.md`, pending decisions). For backlog 0446, 0394, 0395, 0377, 0387, 0449, 0450 and the golden-2 landmark finding. Each decision cites the WORKFLOW RFC default it applies; the points the defaults say to escalate are under Questions.

## Decisions
- D-A (0446): `fire` `focus` and `blur` move focus; the existing `focused` flag of `find(id).state` and `a11y()` is the one focus query. New E1719.
- D-B (0394): with `min` >= 1, a string of only whitespace fails `parse`. Parsing never trims; the value is unchanged.
- D-C (0395): with `min` >= 1, `''` fails rule `required`, as an absent key does. The rule lives in k.schema `parse`.
- D-D (0377): `keel dev --port N`, default 5173; a busy port is E1560 and exit 1, never a silent move to another port.
- D-E (0387): an unreachable peer is 502 `keel.unreachable`; a `service()` caller sees `api.network`.
- D-F (0449, 0450): one name form, `[a-z][a-z0-9-]*`, checked by one function everywhere; one key derivation, `KEEL_PEER_` plus the name upper-cased with `-` as `_`.
- D-G (golden-2 axe `landmark-unique`): `Box` takes `label`, written as `aria-label`; required with `as="nav"` or `as="aside"` (E1802), optional on the other landmark tags, refused on the rest. Duplicate names stay a test-time E1703.

## Problem
- **A.** `fire(id, { type: 'focus' })` dispatches a `FocusEvent` and moves no focus, so `document.activeElement` never changes and an app test cannot show that a control keeps focus across a write, the guarantee of RFC 0090. Tests may not touch the DOM (E1701). The harness already reports focus: `stateOf` sets `focused: true` on the element that is `activeElement`, in `find(id).state` and in `a11y()` (k.testing a11y lists `focused?`), and golden-1 and golden-2 assert it after a failed submit. The gap is that only app code moves focus; a test cannot.
- **B.** `s.string({ min: 1 })` accepts `'   '`. Golden-1 `TodoDraft` and `ListDraft` (and `Todo`, `TodoList`, `addTodo`, `editTodo`) store a whitespace title and render a blank row.
- **C.** For one schema, an empty required text field shows "Required" on one form and "Must be at least 1 character" on another. A key absent from the form's values (no `initial`, never edited) fails rule `required`; an edited-then-cleared field holds `''` (`coerceText` keeps `''` for a non-optional string), which fails rule `min`. The same happens on the server: `decodeStrings` keeps `''` for a non-optional string.
- **D.** `keel dev` takes no flags. It runs `npx vite`, which listens on 5173 and, when that is busy, moves to the next free port without saying so to a non-TTY caller. `keel inspect` defaults to `http://localhost:5173`, so it then reads the wrong app or none.
- **E.** A forward to an unreachable peer answers 502 with `keel.unexpected` (`packages/server/src/internal/forward.ts`). k.server maps `keel.unexpected` to 500, so the code and status disagree, a client cannot tell a down peer from a server bug, and k.topology's promise that a split adds only `api.network` and `api.timeout` outcomes fails: a browser `service({ module })` call forwarded through its origin gets `api.status` 502.
- **F.** k.topology and E1552 accept `[a-z][a-z0-9-]*`. `KEEL_PEER_<NAME>` upper-cases the name in four places (`server/src/start.ts`, `server/src/internal/DeployEnv.ts`, `compiler/src/hosting/peerOrigins.ts`, `scaffold/src/templates/composeYaml.ts`), so `my-api` gives `KEEL_PEER_MY-API`, which POSIX shells cannot set or read. `codemod place` checks deployable names with `isLowerCamel` (E1352), so it refuses `my-api` and writes `apiEdge`, which E1552 then refuses.
- **G.** `@keel/testing`'s axe run includes `landmark-unique`. Golden-2 renders three unnamed `nav` landmarks (`recipes.nav` and `recipes.locales` in `BoxShell.tsx`, `recipes.filters` in `RecipeList.tsx`) and no `@keel/ui` prop can name a `Box`.

## Proposal

### A. Focus moves on `fire` (k.testing)
- `fire(id, { type: 'focus' })` calls `el.focus()` and `fire(id, { type: 'blur' })` calls `el.blur()`. The DOM then dispatches `focus`/`focusin` on the element and `blur`/`focusout` on the one losing focus, in the order a browser does, through the delegated table as today. `fire` still settles before it resolves.
- `focus` on an element a user cannot focus rejects with E1719 and moves nothing: an element is focusable when it is not disabled and not hidden (`isHidden`), and is an `a` or `area` with `href`, a `button`, an `input` other than `type="hidden"`, a `select`, a `textarea`, a `summary`, `contenteditable`, or has a `tabindex`. `blur` on an element that does not have focus rejects with E1719. The harness checks this itself, because happy-dom focuses a plain `div`, which a browser does not.
- The focus query is the existing `focused` flag: `find(id).state.focused` and the `a11y()` node's `state.focused`. No `focused()` method is added. Principle 1: a second query beside the a11y state would be a second way to read one fact. Principle 6: focus is part of the a11y tree a tool reads (the inspect document's `a11y` is the same tree), so the test reads what any tool reads.
- `click` does not move focus: browsers differ (Safari does not focus a clicked button), and a test that needs focus says so with `focus`.

A test for RFC 0090's guarantee:
```ts
await t.fire('todos.row.t1.done', { type: 'focus' })
await t.fire('todos.row.t1.done', { type: 'click' })
expect(t.find('todos.row.t1.done').state.focused).toBe(true)
```

Default applied: 3 (the harness keeps its one dispatch path, the DOM's own focus method).

### B and C. Blank and empty required strings (k.schema)
One rule in `parse`, so the client form parse, `decodeStrings` on the server, services and stores all agree: **for a `string` node with `min` >= 1, a value with no non-whitespace character (`''` included) fails rule `required`.** A non-empty value shorter than `min` still fails `min`; length is counted on the value as given.

- Parsing never changes a value (no trim): `parse` stays validation, `encode` and `decodeStrings` stay inverses, and `'  milk '` is stored as typed. A trim on parse would make `parse` a decode (k.schema: "A schema has no `decode`"), change values that already round-trip, and leave JSON Schema unable to describe what is accepted.
- No new option: `min: 1` is how every schema in the repo says "required text", and an option beside it (`blank: false`, `trim: true`) would be a second spelling of "required" whose difference an agent has to remember (principle 1). Whitespace is not content for any `min` >= 1 field in the golden apps, stdlib or the OpenAPI importer's output.
- Derivations: `gen` for `min` >= 1 yields strings with a non-whitespace character (the existing "Generator produces only valid values" clause holds it); JSON Schema adds `pattern: "\\S"`; `doc()` is unchanged; `decodeStrings` is unchanged (`''` for an optional key is still absent).
- k.forms needs no code change: `messageFor('required')` is "Required" and `issueText` receives `{ rule: 'required' }` for both idioms. Its `min` text keeps serving non-empty short values ("Must be at least 2 characters").
- `id` keeps rule `min` for `''` (ids are generated, not typed); `messageFor` already shows "Required" for it.

Defaults applied: 2 (one spelling of required text) and 6 (the schema enforces it; no doc tells apps to add a check).

### D. `keel dev --port` (k.cli, k.topology)
- The `dev` operation's input gains `port: s.int({ min: 1, max: 65535 }).optional()`, default 5173 (Vite's, and `keel inspect`'s default URL). The flag reaches the MCP tool as every operation input does.
- Before starting, `keel dev` binds and releases the port; if it fails it prints one E1560 line in the wording `server.mjs` uses (`port 5173 fails to bind (EADDRINUSE); free it or pass --port`) and exits 1. It starts Vite with `--port N --strictPort`, so a port taken in between also fails rather than moving.
- No `PORT` environment reading for dev: one way to set it. `server.mjs` keeps `PORT` (production).
- E1560 already covers an unbindable `PORT` in `server.mjs`; its Rules line is widened to name both. No new code (one code per meaning, principle 5).

Default applied: 3 (Vite stays the dev server; the flag passes through).

### E. `keel.unreachable` (k.server, k.topology, k.services, k.errors)
- New kernel KeelError code `keel.unreachable`, data `{}`, status 502. A forward whose `fetch` rejects returns it with one `diag` naming the peer and the cause. The response's message names no host, address or cause, in every mode, since it reaches the browser (default 4); the dev log has the detail.
- `statusOf('keel.unreachable')` is 502; `crashed(..., 502)` is no longer used for it.
- `@keel/services`: a 502 response whose body is a `Result` `err` with code `keel.unreachable` is `api.network`, for every service. A caller sees the same outcome whether its request went to the peer directly (fetch rejects) or through a forwarding origin, which is k.topology's promise. Any other 502 stays `api.status`.

Defaults applied: 4 (no address leaves the server) and 1 (the kernel names the failure; apps do not parse messages).

### F. Deployable names and peer keys (k.topology, k.scaffold)
- The form stays `[a-z][a-z0-9-]*`. Dropping `-` would refuse names people use for services (`api-edge`) and would change `packages/server/conformance/head-title.test.ts` and `document-head-0078.test.ts`, whose generators produce `[a-z][a-z0-9-]{0,15}`; with this decision they stay as they are.
- The key is `KEEL_PEER_` plus the name upper-cased with `-` as `_`: `my-api` is `KEEL_PEER_MY_API`. Names hold no `_` and no capitals, so the mapping is one-to-one.
- One function, `peerKey(name)`, at `@keel/compiler/hosting/peerKey` beside `deployableNameProblem` (server already imports that path). `start.ts`, `DeployEnv.ts`, `peerOrigins.ts` and `composeYaml.ts` call it; none builds the key itself.
- `codemod place` checks `--to` with `deployableNameProblem` and reports E1352 with its message; `isLowerCamel` is no longer used for deployable names. `apiEdge` is refused and `api-edge` accepted, as by `keel check`.
- Compose service and volume names keep the name as written (`-` is valid there); only the environment key changes.

Defaults applied: 2 (one name check, one key derivation) and 6 (the shared function replaces four copies).

### G. A landmark `Box` takes `label` (k.ui)
- `Box` gains `label?: string`, written as `aria-label` through `attrOf`, so a getter prop binds like `id` and `lang` (RFC 0090's rule: no prop read once into the DOM).
- The `Box` props type is a union on `as`: `nav` and `aside` require `label`; `section`, `main`, `header` and `footer` accept it; `div`, `ul`, `ol`, `li` and `article` refuse it (`aria-label` on a generic or list role is prohibited by ARIA 1.2, which axe reports). A missing required `label` is a type error that `keel check` maps to E1802, as for `Image alt` or `Input label`.
- Why required on `nav` and `aside`: these are the landmark roles a page repeats, and two of them meet across files (golden-2's `recipes.filters` is in a page, the other two in its layout), so a one-file static check cannot see the pair. Requiring the name in the type catches it in every file before a test runs; `main`, `header` and `footer` are normally one per page and have their own axe rules.
- Two landmarks of one role with equal labels stay a test-time E1703 (axe `landmark-unique`); no static rule, since the labels are usually messages known only at render.
- `label` is the existing name for a control's accessible name (`Input`, `TextArea`, `Select`, `Checkbox`), so no new word is introduced. Unlike theirs it renders no visible text: a landmark name is not shown.

Defaults applied: 6 (the type requires the name) and 2 (`label` is the one way to name an element in `@keel/ui`).

## Alternatives
- **A: a `focused()` method returning the focused id.** A second way to read what `state.focused` already says. **Dispatch only, assert with an event handler's state:** proves nothing about `activeElement`, which is what RFC 0090 guarantees. **`click` focuses:** browsers disagree; it would hide that a control is not focusable.
- **B: `s.string({ trim: true })` that trims on parse.** Makes parse a decode, gives two required spellings, and its JSON Schema cannot express the accepted input. **`blank: false` option:** a second spelling of required text beside `min: 1`. **Trim in `@keel/forms` before parse:** the server and services would still accept blanks.
- **C: map `''` to absent in `decodeStrings` for `min` >= 1.** Fixes the server only; the client parses values without `decodeStrings`. **Special-case the message in `messageFor`:** `FieldIssue` carries no value, and an app's `issueText` would have to repeat the special case.
- **D: follow Vite and move to the next free port.** The caller and `keel inspect` cannot know where the app is. **A new code (E1058):** E1560 already means "a server could not bind its port".
- **E: keep `keel.unexpected` with 502.** The code says bug and the status table says 500. **Expose 502 as `api.status`:** breaks the topology promise that a split adds no new outcome.
- **F: drop `-` from names.** Refuses common names and changes two server conformance generators. **Keep `KEEL_PEER_MY-API`:** not settable from a shell or most process managers.
- **G: a static rule for two unlabeled same-role landmarks in one file.** Misses the cross-file pair that golden-2 has. **`aria-label` as a prop:** a raw ARIA attribute beside the `label` name every control uses. **`labelledBy` an element id:** needs a visible heading the golden-2 navs do not have; it can come later through the same prop union if a need appears.

## Spec diff
Sizes are measured with `tooling/spec.mjs`'s count (characters / 4) on the section with every replacement applied. Sections at or near 1,500 tokens take trims, listed with each.

**k.testing** (1,485 to 1,490)
- Harness, `fire` bullet: replace "`focus`, `blur`). It resolves once" with "`focus`, `blur`; both move focus). It resolves once".
- Trim: the example line `expect(t.find('cart.total').name).toBe('Total 3')`, the example line `const r = await renderRoute('orders.show', ...)` (the `renderRoute` bullet defines it), and the failure-output example's second line `  payload: {...}`.
- Rules: after E1706, add "E1719 `fire` `focus` on an unfocusable element, or `blur` off an unfocused one".
- Conformance, after the `fire` resolves clause: "`fire(id, { type: 'focus' })` on an input makes `find(id).state.focused` true; `blur` makes it false."

**k.schema** (1,498 to 1,495)
- API: replace "Primitives: `string`, " with "Primitives: `string` (`{ min, max }`; with `min` >= 1, `''` or only whitespace fails rule `required`; JSON Schema adds `pattern: "\\S"`), ".
- Trim: the **Purpose** paragraph ("One declaration per data shape. Everything derives from it.", principle 4 says it); "; fast-check is a peer dependency, absent from app bundles" (packaging, in the package's README); "Members that are all tagged objects use `union(key, variants)`." (guidance, not semantics).
- Conformance, after "A schema has no `decode`.": "`s.string({ min: 1 })` fails `''` and `' '` with rule `required`."

**k.forms** (1,316 to 1,344)
- Conformance, after the focus clause: "A field of `s.string({ min: 1 })` shows one message for an absent value, `''` and `'  '`: the `required` one."

**k.cli** (1,486 to 1,499)
- Commands: replace the row "| `dev` | dev server and log stream |" with "| `dev [--port N]` | dev server and log stream on port N (default 5173; in use: E1560, exit 1) |".
- Trim: " (`artifacts` names the `.keel` directory)" (k.server's `createApp` option); "and a summary with node, edge, store, id, a11y, route, and section counts." becomes "and a summary of counts."; I1055's "(info; exit 0)" becomes "(info)" (the `session` clause states exit 0).
- Conformance, before the `keel inspect` unreachable clause: "`keel dev --port <p>` serves on `p`; with `p` in use it prints one E1560 line and exits 1."

**k.server** (1,499 to 1,500)
- Status: replace "`keel.conflict` 409 · other `err` 400" with "`keel.conflict` 409 · `keel.unreachable` 502 (names no host) · other `err` 400".
- Trim: "; `url` is absolute." becomes "." (a Conformance clause states it); E1551's " (any deployable)".

**k.topology** (1,499 to 1,497)
- Calls and peers: replace "(unreachable: 502)" with "(unreachable: 502 `keel.unreachable`)".
- Build: replace "`KEEL_PEER_<NAME>`, an http(s) URL, per other `node` deployable." with "`KEEL_PEER_<NAME>` (`my-api`: `KEEL_PEER_MY_API`), an http(s) URL, per other `node` deployable."
- Deploy files: replace "`KEEL_PEER_<NAME>` (name upper-cased) set to" with "`KEEL_PEER_<NAME>` set to".
- Rules: replace "E1560 the environment fails `DeployEnv` at startup" with "E1560 `DeployEnv` fails, or a port will not bind, at startup".
- Trim: " (std.jobs, std.schedules)"; "A deployable serves its modules' routes: the generated entry merges" becomes "The generated entry merges"; " (outside the Keel repo)".
- Conformance: replace "`x` answers a path of `b` with `y`'s status, headers and body; one carrying `x-keel-forwarded` is not forwarded." with "`x` answers a path of `b` with `y`'s status, headers and body, or 502 `keel.unreachable` with `y` down; one carrying `x-keel-forwarded` is not forwarded."

**k.services** (1,500 to 1,499)
- ApiError: replace "`api.network` `{}`: `fetch` rejected." with "`api.network` `{}`: `fetch` rejected, or a 502 `keel.unreachable` err came back."
- Trim: the API comment "// modules/orders/OrdersApi.schema.ts: handwritten, or generated by `keel scaffold service orders --openapi openapi.json`" becomes "// modules/orders/OrdersApi.schema.ts" (the OpenAPI paragraph says `keel scaffold service` writes it).
- Conformance: replace "A rejected `fetch` yields `api.network`." with "A rejected `fetch`, or a 502 `keel.unreachable` err, yields `api.network`."

**k.errors** (1,484 to 1,489)
- API: replace "`keel.payloadTooLarge` and `keel.conflict` (k.server)" with "`keel.payloadTooLarge`, `keel.conflict` and `keel.unreachable` (k.server)".

**k.scaffold** (1,142 to about 1,200)
- Rules: replace "components PascalCase ·" with "components PascalCase; deployable names as k.topology E1552 ·".
- Conformance: "With `node` deployables `api` and `my-api`, `deploy/compose.yaml` sets `KEEL_PEER_MY_API` for `api`; `place b --to apiEdge --adapter node` is E1352 and writes nothing."

**k.ui** (1,498 to 1,498)
- Base elements: replace "`label` on `Input`, `TextArea`, `Select`, `Checkbox`;" with "`label` on `Input`, `TextArea`, `Select`, `Checkbox`, and on `Box as` `nav` or `aside` (`aria-label`; optional on other landmarks);".
- Trim: " `Image src` is an asset URL string, not an `Href`." (a Conformance clause states it); "a string written as its `lang` attribute" becomes "written as its `lang` attribute"; the style example's `<Heading level={2}>Orders</Heading>` line; " Dynamic values switch classes; no inline style is generated." (the signal style-prop clause states it).
- Conformance, after the axe clause: "Two `Box as="nav"` with distinct `label`s pass axe; a `nav` without one is E1802."

No trimmed sentence is quoted by a conformance header (checked with a search of `packages/*/conformance`); the k.testing **ctx.** paragraph and "Tests address elements by id only." are quoted and stay.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:
- New files: `packages/testing/conformance/fire-focus-0091.test.ts`; `packages/schema/conformance/blank-required-0091.test.ts`; `packages/forms/conformance/required-message-0091.test.ts`; `packages/cli/conformance/dev-port-0091.test.ts`; `packages/scaffold/conformance/peer-key-0091.test.ts`; `packages/ui/conformance/box-label-0091.test.ts`.
- Changed clause text, header and a new case: `packages/services/conformance/network-failure.test.ts` (a 502 `keel.unreachable` body); `packages/server/conformance/topology-forwarding-unserved-paths.test.ts` (peer down).
- Unchanged: `packages/server/conformance/head-title.test.ts` and `document-head-0078.test.ts` (their `[a-z][a-z0-9-]{0,15}` names stay valid).
- Unit tests that assert the old behavior change with the implementation: `packages/schema/test/secret.test.ts` (`Secret.of('')` under `min: 1` is `required`), `packages/testing/test/fire.test.ts` (focus moves), `packages/check/test/mutants.test.ts` (an `aside` fixture gains `label`).

## Diagnostics
- **E1719** (k.testing, E17xx block; E1715 to E1718 and W1714 are taken, E1719 appears nowhere in `spec/`, `docs/` or `packages/*/src`): `fire` `focus` on an unfocusable element, or `blur` off an unfocused one. Explanation: "focus fired where a user cannot focus" with the fix pattern "give the element a role that takes focus, or `fire` `focus` before `blur`". Added to `EXPLANATIONS.ts`.
- E1560 (k.topology) widened to `keel dev`'s port. E1352 (k.scaffold) and E1802 (k.ui) keep their codes with wider coverage. No other new code.
- `keel.unreachable` is a KeelError code (data), not a diagnostic.

## Token impact
Every section stays at or under 1,500 tokens (figures in Spec diff). Package size guesses: `@keel/testing` +120 B (focusable test, `focus()`/`blur()`); `@keel/schema` +40 B; `@keel/forms` 0; `@keel/cli` +150 B (flag, bind probe); `@keel/server` +40 B; `@keel/services` +60 B; `@keel/compiler` +30 B (`peerKey`); `@keel/scaffold` about 0; `@keel/ui` +30 B (`Box` `label`).

## Migration
- **golden-1:** `AppShell.tsx` `<Box as="nav" id="todos.nav">` gains `label="Main"` (D-G; golden-1 shows English literals). Its whitespace-title bug (D-B) is fixed with no code change. A `.keel-dev` storage file holding a whitespace-only title now fails to restore; delete `.keel-dev/api.storage.json` (dev data only).
- **golden-2:** `RecipesText.schema.ts` gains `navLabel: {}`, `localesLabel: {}`, `filtersLabel: {}`; the locale files gain:

  | key | en-US | de-DE | ja-JP |
  | --- | --- | --- | --- |
  | `navLabel` | Recipes site | Rezeptseite | レシピサイト |
  | `localesLabel` | Language | Sprache | 言語 |
  | `filtersLabel` | Filters | Filter | 絞り込み |

  `BoxShell.tsx` passes `label={props.data.text.navLabel}` and `label={props.data.text.localesLabel}`, `RecipeList.tsx` `label={props.data.text.filtersLabel}`. The names follow the page's locale, as the rest of the page does.
- **Both:** no change for D-A (their `focus` fires target inputs), D-C (no test asserts the `min` text for an empty value), D-D, D-E or D-F (deployable names `web`, `api`, `sessions`).
- **Projects outside the repo:** a deployable named with `-` reads `KEEL_PEER_MY_API` where it read `KEEL_PEER_MY-API`; `keel build` regenerates `deploy/compose.yaml` (E1005 otherwise).

## Questions
The RFC defaults escalate new hand-written user-facing API shapes and migrations of existing golden apps. Answers taken:
1. **`keel dev --port N` (D-D), a new CLI flag.** Recommended: accept as written, default 5173, a busy port is E1560 and exit 1 (no fallback port).
   Taken: accepted as recommended.
2. **`Box label`, required with `as="nav"` or `as="aside"` (D-G), a new prop, and its golden-1 and golden-2 migration.** Recommended: accept as written. The other choice is `label` optional everywhere with duplicates left to E1703 alone; it needs no golden-1 edit but lets an unnamed `nav` pass `keel check` and fail only when two meet in a test.
   Taken: accepted as recommended.
3. **`keel.unreachable` (D-E), a new kernel KeelError code apps can match on.** Recommended: accept the name and status 502, with `@keel/services` reporting it as `api.network`.
   Taken: accepted as recommended.
4. **D-B and D-C change what golden-1 and golden-2 accept** (whitespace-only titles and names now fail; empty required text reads "Required" everywhere) with no code edit. Recommended: accept; the only migration is clearing dev storage that holds a blank title.
   Taken: accepted as recommended.
