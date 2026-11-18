# RFC 0138: what a request leaves: `#k-state` carries only what islands need, a queued submit goes out once, late work and uncaught errors have a chosen end

Status: draft, for the orchestrator to accept (ADR-0160).

## Problem
Four gaps found by a review and red-team 8 (2026-11-18, `tasks/0338-s8-reach/proposed/red-team-8.md` M2, M3, M4, L1, L2). Each claim below was read in the code on 2026-11-18.

**(a) Personal data in `#k-state`.** `packages/server/src/internal/snapshotStores.ts` writes a snapshot of every store in the request's registry, and `documentResponse.ts` puts it in `#k-state` whether or not the document has an island (`entry` decides only the script). Red-team 8 L2 observed `"email":"alice@x.com"` in a document with `"islands":{}` and no entry script. A loader that holds another person's contact data in a request store to render one line ships all of it. k.server says "`#k-state` holds every request-scope store"; k.resume Stores says "A store created in the request goes to `#k-state`". On the client such a snapshot is useful only when an island needs the store: `resume` restores a snapshot into a store in `stores` (the client's registry: module stores, which the server never snapshots) or into one an island creates while it resumes (`resume.ts`, `waitingSnapshot`); any other is an E1253 "unknown store" warning. The conformance fixture `resume-graph-routes.ts` shows the pattern that must keep working: a loader seeds `p.local`, the island page reads it on the server and creates it on the client from the waiting snapshot. `s.secret` cannot reach a snapshot today: `store()` throws E1303 on a state schema holding one, and `snapshot()` folds every log entry up to the last secret payload (k.store). `#k-state` is not named among k.privacy's sinks.

**(b) A submit before resume goes out twice.** `packages/runtime-dom/src/internal/eventQueue.ts` `capture` records the event and never calls `preventDefault`, so the browser runs the default action (form submission, link navigation) when the event fires; `replay` later runs the island handler, whose `preventDefault` is a no-op on a finished event. Red-team 8 M4 observed `defaultPrevented === false` after dispatch and the handler running after `resume`: the native POST and the handler's own request both go out. k.runtime promises "applied exactly once after resume".

**(c) Work a request leaves running.** `serving` (`packages/server/src/internal/serving.ts`, an `AsyncLocalStorage`) is entered with `serving.run(true, …)` for each request (`createApp.ts`) and never exited, so a timer or promise chain the request schedules carries the mark after the response; a module-store write there throws E1256 from a timer (red-team 8 M2, ran). No Keel server installs an `uncaughtException` or `unhandledRejection` listener (`git grep` over `packages`: only `start.ts`'s `SIGTERM`/`SIGINT`), so Node's default ends the process on any uncaught throw, E1256 or other, with no Keel record. The guard now covers `tx`, `restore` (not the one made from a waiting snapshot during creation), `undo` and `undoWhere` (`packages/store/src/store.ts` `writable`, `refuseModuleWrites.ts`), while k.resume says `tx`. The mark follows async context, not data: a `.then` registered at module load and resolved by a loader writes unguarded (red-team 8 L1). Runners and startup run outside the mark (`createApp.ts`, `keepRunning`), and `packages/server/README.md` already states the whole-life check and the module-load limit; the spec does not.

**(d) A refused snapshot.** `resume` now warns `E1253 #k-state snapshot for store "<id>" does not restore` on both restore paths (`resume.ts` `unrestored`, `REFUSED`), and a mismatched island's re-render restores its stores from the served snapshot; k.resume says nothing of the warning.

k.resume (5,961 characters), k.server (6,003), k.runtime (5,995) and k.privacy (6,004) are full, so the contract goes into new sections.

## Proposal
Two new sections, status proposed: `k.leave` (a, c, d) and `k.defaults` (b).

### D1. A snapshot ships only when an island needs it
`#k-state` `stores` holds a request store's snapshot only when the store was created, looked up through `stores()` or read (`get`, `select`, `snapshot`, `log`, `head`) while a level's component rendered on the server and that level is an island root. The server records the stores each level's render touches (a read tap in `@keel/store/internal`, beside `moduleWrites`) and keeps those of island levels. A store only a guard, loader, action or static level touched is not sent; a document with no island has `stores` `{}`.

Why: a snapshot is read only by `resume`, which can restore it only into a store an island creates or holds; any other snapshot is dead weight that carries data to the browser (and an E1253 warning in dev). "Created or read" keeps the loader-seeds, island-reads pattern of `resume-graph-routes.ts` working. Alternative rejected: **only stores created during an island render** (simpler, but breaks that pattern: the island would start from initial state while the page shows the loader's values). Alternative rejected: **drop `stores` when the page has no island only** (red-team 8's minimum fix): a page with one island still ships every loader's store.

### D2. Marked values in a needed snapshot ship, behind a declared list
`#k-state` is not a k.privacy sink: a snapshot an island needs goes as it is, `.pii()` values included, since the island renders from them, and the page is its own user's (k.privacy Purpose). To keep that a decision, E1107 (new, k.privacy's block) reports a `store` call in a client-reachable file (E1004's reachability) whose state schema holds a `.pii(class)` node of a class its module manifest's new `clientPii` list does not name; the fix adds the class. A store made only in `*.server.ts` code is never reported. `s.secret` never ships, as today (E1303, the secret fold); the section says so. Alternatives rejected: **redact marked values in `#k-state`** (the island would render `[pii]` and its state would differ from the server's); **a serve-time warning** (fires only on requests a developer makes, and has no fix diff; principle 5); **a list on the deployable in `topology.ts`** (the module owns its stores and schemas, and moving a module must not change what it may hold).

### D3. Queued default actions
- `submit` inside an unresumed island: default prevented at capture. At replay, after its handlers, if none called `preventDefault()`, the runtime submits the form natively once with no second `submit` event, carrying the submitter (`name`/`value`, `formaction`, `formmethod`, `formenctype`, `formtarget`; e.g. a hidden input for the pair and the form's attributes set from the submitter for the call, then restored). A queued submit no root encloses (island with no component) is submitted the same way; one whose form left the document (re-rendered island) is dropped. During replay its `defaultPrevented` reads `true` (a stated wart: the event is the captured one). Alternative rejected: `requestSubmit(submitter)` at replay (fires a second `submit`, which the now-resumed island handles again).
- `click` inside `a[href]`: not queued unless the `href` is a same-document fragment. The browser navigates at once; an island handler that would intercept the link does not see that click. Why: preventing it would hold every early link click until resume, breaking the one thing static HTML does well; queueing without preventing replays a handler on a page that is unloading. Fragment links do not unload, so they keep replaying.
- Left alone, stated: checkbox and radio toggles (their `input` and `change` replay), typed text (`input` replays; values typed before the queue existed are synced by k.runtime), `keydown` Enter (implicit submission arrives as `submit`, D3's first bullet), `reset`. A handler's `preventDefault()` at replay changes nothing for them. Alternative rejected: prevent every queued event and re-dispatch defaults at replay (no API runs a native default such as a checkbox toggle or a text insertion, so it cannot be done faithfully).

### D4. Late work stays checked; the limit is stated
The request mark stays on the request's async descendants for their whole life. Work a request starts is request work: a module-store write from it after the response is the same leak E1256 exists to stop, so it still throws. The guarded operations are listed: `tx`, `restore` (but the creation-time restore from a waiting snapshot), `undo`, `undoWhere`, as built. The limit is stated: the mark follows async context, not data. Alternatives rejected: **end the mark when the response settles** (M2's first fix; `setTimeout(0)` then writes request data into process-wide state unchecked); **return E1256 as `err` after the response** (the same call would throw or return by timing, and `restore`, `undo` and `undoWhere` do not return a `Result` for it).

### D5. The process ends on an uncaught error, deliberately
The production entry (`start`, `server.mjs`) and `keel dev` install `uncaughtException` and `unhandledRejection` listeners; `createApp` installs none (a process that embeds it owns its process). Each event writes one `diag` E1577 (new, k.server's block): `uncaught <exception|rejection> in work of route <id>` (the route id when the failing work's async context is a request's: `serving` carries the route id instead of `true`; else `-`), the error's `frames`, no thrown text (the production error text rule). Production then stops listening, lets requests in flight finish for at most 10,000 ms, calls `app.close()` and the driver's `close()`, and exits 1 for a supervisor (the Dockerfile's restart policy, systemd, a platform) to restart. A later one during the drain writes its record only. `keel dev` appends the thrown text, scrubbed and cut by k.serverlog, and keeps serving.

Why: after an uncaught exception the process's state is unknown (a half-applied write, a held lock, a leaked stream), and Node's own documentation says to exit; draining keeps the requests that were fine. Alternatives rejected: **inherit Node's default** (exits at once, no Keel record, every in-flight request cut: the operator's direction is to choose, not inherit); **log and keep running** (serves from unknown state indefinitely, and an attacker who finds one throwing path fills the log instead of being restarted); **exit at once after the record** (cuts in-flight requests for no gain); **install the listeners in `createApp`** (a library taking over a host process's fault handling, and every test's process).

### D6. The refused-snapshot warning is specified
k.leave Restore states the E1253 text as built.

## Spec diff
- New `spec/kernel/k.leave.md`, status proposed: intro, Snapshots, Restore, Module stores, Process, Rules (E1107, E1577), ten Conformance bullets. 5,242 characters, 1,311 tokens.
- New `spec/kernel/k.defaults.md`, status proposed: intro, Submit, Links, Others, six Conformance bullets. 3,025 characters, 757 tokens.
- `spec/00-map.md`: rows `k.defaults` (after k.claim) and `k.leave` (after k.server); `k.leave` added to the E110x and E155x owners; one-line cells trimmed (k.schema, k.reactive, k.store, k.component, k.runtime, k.ui, k.a11y, k.sim, k.ledger, k.server, k.compat, k.topology); no title or status changed. 1,199 to 1,195 tokens.
- No existing bullet changes, so the ledger does not move. Prose that describes today's code changes with the build (commit 3), each within its section's budget:
  - k.server Request flow: "`#k-state` holds every request-scope store." becomes "`#k-state` stores: k.leave." (5,993 to 5,977 characters, as `pnpm budgets` counts.)
  - k.resume Stores: "A store created in the request goes to `#k-state`;" becomes "A store an island level's render touches goes to `#k-state` (k.leave);"; Rules: "E1256 `tx` on a module store during a request" becomes "E1256 a write to a module store during a request (k.leave)". (5,958 to 5,991.)

## Conformance diff
One `rfc:0138` commit by the `conformance-writer`, files headed `Spec: k.leave` or `Spec: k.defaults`.

**Snapshots** (`packages/server/conformance/leave-snapshots.test.ts`, `createApp` under a sim ctx):
- Loader creates `a` (`email: s.string().pii('contact')`) and `p`; the island page reads `p` and creates `b`: `Object.keys(state.stores)` is `['b', 'p']` in any order; `a`'s email is nowhere in the document.
- The same loader with a static page: no `<script type="module">`, `stores` `{}`, the email nowhere in the body.
- A static layout creating `c` around an island page creating `b`: `b` only; `b`'s `.pii('contact')` value is in `#k-state` as rendered.
- A factory store (`stores` option) the island page reads: not in `stores` (k.server, kept).
- Negative: a guard that creates `g` for an auth lookup, then an island page: `g` absent.

**E1107** (`packages/check/conformance/client-pii.test.ts`): `store(Contact, …)` with a `contact` field in `modules/a/Card.tsx`: E1107 with no `clientPii`, and with `clientPii: ['name']`; none with `clientPii: ['contact']`; none in `modules/a/a.server.ts`; the fix's diff adds `'contact'`. Negative: a schema with no `.pii()` node is clean.

**Module stores** (`packages/server/conformance/leave-module-stores.test.ts`, the `rm.board` fixture of `resume-modstore.ts`):
- A loader calling `board.restore(snapshot)`, one calling `board.undo()` after two pre-request `tx`, one calling `board.undoWhere(() => true)`: each fails its level with a throw starting `E1256`; `board.get('rows')` and `board.head()` as before.
- An action that schedules `setTimeout(() => { try { tx(setRows, { rows: 'late' }) } catch (e) { seen = String(e) } }, 30)` and returns `ok(null)`: answered before the timer; `seen` starts with `E1256`; `rows` unchanged.
- Limit: `const gate = new Promise(r => { release = r }); gate.then(v => tx(setRows, { rows: v }))` at module load, a loader calls `release('via-gate')`: 200, `rows` is `'via-gate'`, no E1256 line.
- Negative: in `resumeDocument`, a store an island creates from a waiting snapshot restores with no E1256.

**Process** (`packages/server/conformance/leave-process.test.ts`, a `keel build` fixture run as a child `node server.mjs` with `KEEL_FORMAT=json`, bounded by a 20 s timeout; and `packages/cli/conformance/dev-uncaught.test.ts`):
- `/late`'s loader answers 200 and throws from `setTimeout(…, 30)`: stdout has one record `{ kind: 'diag', code: 'E1577' }` whose message names `late` and holds neither the thrown text nor its stack text; then a new connection is refused; a request to a `/slow` loader (resolves after 500 ms) sent before the throw completes 200; the exit code is 1 within 11 s.
- A module-scope `Promise.reject(new Error('boom'))` after listen: one E1577 naming `-`, exit 1.
- Two throws 10 ms apart: two E1577 records, one drain, exit 1.
- Under `keel dev` the `/late` throw writes one E1577 whose message holds the thrown text, with a planted `.pii()` input value as `[pii]`; a later GET answers 200.
- Negative: `createApp(...)` in a test leaves `process.listenerCount('uncaughtException')` and `('unhandledRejection')` unchanged.

**Restore** (`packages/runtime-dom/conformance/leave-restore.test.ts`): `known` in `stores` with `#k-state` `{ state: { n: 'seven' }, log: [], initial: { n: 7 } }`, and `late` created by the island with `{ state: { n: -1.5 }, log: [] }` for `s.object({ n: s.int() })`: warnings hold both `E1253 #k-state snapshot for store "known" does not restore` and `… "late" …`; both stores `n === 0`. Negative: a valid snapshot warns nothing.

**Defaults** (`packages/runtime-dom/conformance/queued-defaults.test.ts`, happy-dom, server-mode island with a `<form>` holding `<button name="op" value="save" formaction="/other">`; `HTMLFormElement.prototype.submit` and `requestSubmit` stubbed to record calls and the form data):
- Handler prevents: dispatch `new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter })` before `resume`: `defaultPrevented` true; after `resume`, handler ran once, no native call, a `document` capture listener counted one `submit`.
- Handler does not prevent: one native submission, data holding `op=save`, action `/other`; one `submit` event in all.
- Island with no compiled component: one native submission after `resume`. Island that mismatches (E1253): none.
- `<a href="/other">` click before `resume`: not `defaultPrevented`; its handler count 0 after `resume`. `<a href="#part">`: handler runs once.
- Checkbox click before `resume`: checked; `change` handler runs once after `resume`; a click handler calling `preventDefault()` leaves it checked.
- Negative: a submit on a form outside every island, and one in an already resumed island, is not `defaultPrevented` by the queue.

## Migration
- `@keel/server`: `snapshotStores.ts` keeps the island levels' touched stores; `renderChain.ts` records each level's touches; `documentResponse.ts` passes them; `serving.ts` carries the route id; `start.ts` installs the listeners and the bounded drain (its `SIGTERM` path is unchanged); README (`#k-state`, the E1577 drain; its E1256 paragraph already matches D4).
- `@keel/store`: a read tap in `internal` (`get`, `select`, `snapshot`, `log`, `head`, `stores()` lookups) beside `moduleWrites`; `store.ts` comments name the four guarded operations (already built).
- `@keel/runtime-dom`: `eventQueue.ts` (`capture` prevents a queued `submit`, skips non-fragment link clicks; `replay` submits natively when no handler prevented); README.
- `@keel/cli`: `keel dev` (`devStart.ts`) installs the dev listeners; `keel explain E1256` text names the four operations and the async-context limit; `keel explain E1107`, `E1577`.
- `@keel/check` (or the compiler's rule set, beside E1004): E1107 with its fix; the module manifest schema gains `clientPii` (k.module text at the build, if it fits; else k.leave carries it).
- Tests kept as they are (grep for `k-state` in `packages/*/test`, `packages/*/conformance`, `apps/*/test`, `evals/`): `packages/server/test/document.test.ts` (its request store is created in the island page's render), `packages/server/conformance/resume-fresh-graph.test.ts` (`p.local` is read and `p.created` created by the island page), `packages/testing/conformance/resume-document-0092.test.ts` (hand-written `stores: {}`). No test found asserts a loader-only store in `#k-state`.
- Apps: no app creates a `.pii()` store in client-reachable code (`apps/golden-2/modules/accounts/accountStores.ts` is reached only from `*.server.ts` files and a node-only `routes.ts`); the build's `keel check` over `apps/` confirms no E1107. No eval changes.
- Docs: `docs/THREAT-MODEL.md` (a Personal data line: `#k-state` carries only island-touched stores, E1107; a Process line: E1577 and the drain), `.claude/skills/keel-deploy/SKILL.md` (the exit-1 restart contract, E1577), `.claude/skills/keel-compliance/SKILL.md` (`clientPii`, E1107), `.claude/skills/keel-server/SKILL.md` (late work and E1256's four operations).

## Build order
1. This RFC, ADR-0160, k.leave and k.defaults (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): the Migration; the k.server and k.resume prose of the Spec diff; changesets (`@keel/server`, `@keel/store`, `@keel/runtime-dom`, `@keel/cli` minor); k.leave and k.defaults to `conformance-covered`.

## Token impact
k.leave 1,311 and k.defaults 757 (new). Map 1,199 to 1,195. k.server and k.resume stay under 1,500 after the build's prose.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: a snapshot ships when an island level's render created or read the store (D1).
- C2: marked values in a needed snapshot ship; E1107 makes each class a declared `clientPii` decision (D2).
- C3: queued `submit` prevented and resubmitted natively once; non-fragment link clicks not queued; other defaults left as they fired (D3).
- C4: the request mark stays on late work; the limit is stated (D4).
- C5: production drains for at most 10 s and exits 1 on an uncaught error; dev reports and keeps serving; `createApp` installs nothing (D5).
