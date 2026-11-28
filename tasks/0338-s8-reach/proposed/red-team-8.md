# Red team 8: served documents resume (958defa9, 16af70a0, 05c0b2e6; RFC 0133 + amendment, RFC 0134)

Probes ran as scratch vitest files inside `packages/server/test` and `packages/runtime-dom/test`, one file at a time, deleted afterwards. "Ran" means the output quoted was observed; "reasoned" means it was read from the code only. The server probes reuse `conformance/resume-graph-app.ts` and `conformance/resume-modstore.ts` (`board`, `setRows`, `PRISTINE`).

Counts: HIGH 0 · MEDIUM 4 · LOW 3.

## MEDIUM

### M1. `restore`, `undo` and `undoWhere` on a module store during a request pass with no E1256 (ran)
`packages/store/src/store.ts:136`: only `run` (the `tx` path) calls `moduleWrites.check`. `restore` (`:251`), `undo` (`drop`, `:299`) and `undoWhere` change a module-registry store with no check.
Probe (loaders under `createApp`, production):
- `/restore`: `await Promise.resolve(); board.restore({ state: { rows: "via-restore" }, initial: { rows: "via-restore" }, log: [] })` → `{"ok":true}`, status 200, `board.get("rows") === "via-restore"`, 0 E1256 lines.
- `/undo`: two `tx(setRows, …)` in the test before the request, then `board.undo()` in the loader → status 200, rows `"committed-before"`, head 3, 0 E1256 lines.
The E1256 rule exists to keep process-wide state free of request data; `restore` writes any request-shaped state into it, visible to the next request. k.resume Stores names `tx`, so this is a gap in the rule, not in the code against its text.
Fix: call `moduleWrites.check?.(id)` at the top of `restore`, `drop` and `undoWhere` when `registry === registries.shared`, except the creation-time `restore` from `waitingSnapshot` (`making`); extend k.resume Stores and E1256 to "a write (`tx`, `restore`, `undo`)"; add those cases to `resume-module-store-e1256.test.ts`.

### M2. A write the request started that runs after the response is still refused with E1256, thrown from a timer (ran)
`packages/server/src/createApp.ts:237`, `internal/serving.ts`. `serving.run(true, …)` is never exited, so every timer, microtask or in-process job the request starts keeps `serving` set after the response.
Probe: action `async () => { setTimeout(() => { try { tx(setRows, { rows: "late" }) } catch (e) { lateErr = String(e) } }, 30); return ok(null) }`; POST, wait 80 ms.
Observed: response 200; 30 ms later `lateErr === "Error: E1256 tx on module store rm.board during a request"`.
Expected: the server README says the check holds "while a request runs". By then the request has finished. The throw comes out of a timer callback, so without the probe's try it is an `uncaughtException`, and Node's default exits the process. The same holds for a job or workflow step started in-process from an action.
Fix: either end the mark when the response settles (keep a per-request `{ live: true }` cell in the ALS, set `live = false` after `handle` resolves, and check `serving.getStore()?.live`), or state that work started by a request is checked for its whole life and make `tx` return the E1256 failure as an `err` instead of throwing when outside every level.

### M3. A `#k-state` snapshot that does not restore is dropped with no warning (ran)
`packages/runtime-dom/src/ops/resume.ts:41` (`else store.restore(snapshot);` ignores the `Result`) and `packages/store/src/store.ts:358` (the waiting snapshot is taken from the map, then its `restore` result is ignored, so the "unknown store" warning never fires either).
Probe: `known` store `s.object({ n: s.int() })` passed in `stores`; `#k-state` `{"stores":{"known":{"state":{"n":"seven"},"log":[],"initial":{"n":7}},"late":{"state":{"n":-1.5},"log":[]}},"islands":{"T":{}}}`; the island creates store `late`.
Observed: `warnings: []`, `known.get("n") === 0`, `late.get("n") === 0`.
The page shows the server's state while the stores hold initial state. The next binding update renders from initial state, and nothing reaches the console (k.claim Client: every resume warning on the console; k.resume Stores: otherwise E1253). Reachable from a truncated or edited document, or a server/client schema codec that does not round-trip.
Fix: push `E1253 #k-state snapshot for store "<id>" does not restore: <code>` when `restore` returns `err`, in both places. For the waiting path, have `waitingSnapshot` hand back a report callback, or let `resume` check after the islands resume that each taken snapshot restored.

### M4. A `submit` fired before resume is not prevented, then replayed to the island's handler: two submissions (ran in happy-dom; browser navigation reasoned; not new in this diff)
`packages/runtime-dom/src/internal/eventQueue.ts:59-64`. `capture` only records the event. The native default action (form submission, link navigation) runs at once. `replay` later runs the handler, whose `preventDefault` is a no-op on a finished event.
Probe: an island `<form>` with `on(form, "submit", e => { e.preventDefault(); log.push("submit-handler") })`, served in server mode. Before `resume`, `form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))`.
Observed: `defaultPrevented === false` after dispatch; after `resume`, `replayLog === ["submit-handler", …]`.
In a browser, the native POST goes out and the replayed handler's own `fetch` goes out too, unless the native navigation unloads the page first. `<Form>` on an island page has no router (`Form.ts`: `core === null`), so it posts natively only. App `onSubmit` handlers are the ones that double. Breaks k.runtime "replayed in order, exactly once" for the effect the user caused.
Fix: in `capture`, `preventDefault()` a queued `submit`. At replay, if no handler called `preventDefault`, run `form.requestSubmit(submitter)` (or `form.submit()`) so the native path still happens once. Apply the same to `click` on `a[href]` only if an island handler may intercept it. Add a conformance case for a queued submit.

## LOW

- L1. E1256 follows async context, not data (ran). A continuation registered at module load runs outside the request even when a request resolves it: module scope `const gate = new Promise(r => { release = r }); gate.then(v => tx(setRows, { rows: v }))`, then a loader calls `release("via-gate")` → status 200, `board.get("rows") === "via-gate"`, 0 E1256 lines. The same holds for a module-level `setInterval` draining a queue a request pushes to. Fix: state the limit in k.resume Stores and in the E1256 explanation ("checked by async context; a callback registered outside a request is not checked").
- L2. A document with no islands still ships every request store's snapshot, `.pii()` fields included (ran). Two overlapping requests (`/b/alice`, `/b/bob`, alice's loader delayed 40 ms) each got only their own `cc.before` store (good), but `#k-state` held `"email":"alice@x.com"` with `"islands":{}` and no entry script, so no code reads it. A store a guard makes for an auth lookup ships the same way. Fix: write `stores` only when `entry !== null`. Consider dropping snapshots of stores no island can create, or state that every store made in the request is sent to the viewer (k.resume Stores, k.privacy).
- L3. `resume` rethrows an island's throw after replay (`resume.ts:83`), and the generated entry's `for (const w of resume(…).warnings) console.warn(w)` then never runs, so every warning collected for the other islands is lost (reasoned; reachable when `resumeIsland` throws outside the catcher, e.g. a client render that returns an ancestor of its server element: `el.replaceWith(n)` HierarchyRequestError). Fix: return `{ warnings, error }`, or attach the warnings to the thrown error and print them in the entry before rethrowing.

## Probes that held
- Marker forgery (ran, node adapter, server DOM, production): `?q=--><!--]--><!--[--><!--k--><!--+--></script><script>alert(1)</script></textarea><b>x</b>` + U+2028 + `<!--` + `%ED%A0%80`, echoed as text, a `title` on a layout island and a page island, `<textarea>` content and a `Match` tag, through a layout that calls `children()` (the `htmlToNode` reparse round trip). The body has the same `<!--[-->` 1 / `<!--]-->` 1 / `<!--k-->` 1 / `<!--+-->` 0 / `<script` 2 counts as `?q=safe`, and every payload character is `&lt;`/`&gt;` in markup and `<`/`>`/` ` in `#k-state`. The lone surrogate arrives as U+FFFD.
- Client marker reads are exact (`nodeValue === "["`, `"]"`, `"+"`); the only data-bearing comment the runtime makes is `case <tag>`, never a bare marker; the server's `escapeComment` closes `-->`, `--!>`, `<!-->`.
- `#k-state` script-data: `stateJson` escapes every `<` and `>` (so `</script`, `<!--`, `<script`), `&`, U+2028/9; it is `type="application/json"`, so the CSP nonce does not need to cover it, and the nonce is only on the module script and `csp-nonce` meta.
- Truncation (ran): a served island (For of 3 rows + form) cut at every one of 174 offsets, then resumed: 0 throws, 154 warned (E1253, re-render), 20 clean (all before the island's open tag completes), 0 silently different.
- Replay to the right row (ran): a click on row `a` whose handler re-orders rows to `[c, b]`, then a queued click on row `b` → `["click:a", "click:b"]`; a click whose target was removed is dropped (no enclosing root).
- Scale (ran): a `For` of 1,000 / 2,000 / 4,000 / 8,000 rows resumes in 11 / 17 / 53 / 84 ms (render 14 / 27 / 45 / 116 ms): linear, no warning.
- Request isolation under overlap (ran): two concurrent requests creating the same store id in a loader each serve only their own snapshot; a store created after an `await` throws E1203 (no scope), not into another request.
- E1257 bookkeeping is keyed by route id (`r.sv.eager`), so attacker paths cannot grow it.
- Production error text (ran): a loader's E1256 serves `<div role="alert" data-keel-error="keel.unexpected">unexpected</div>` with no code or store id; `#k-state.error` is `{ code, message: code, data: {} }`.
- Prototype keys in a forged `#k-state`: `Object.hasOwn` guards `stores` and `components`; island props are spread from JSON own keys (no `__proto__` setter); `secret` cannot reach a snapshot (E1303 on state schemas, log folded at the last secret payload).

## Proposed backlog lines
- [ ] 0848 red-team, medium: `restore`, `undo` and `undoWhere` on a module store during a request change it with no E1256 · store, server · k.resume · repro: red-team-8.md M1
- [ ] 0849 red-team, medium: the E1256 mark outlives the response; a timer or job a request started throws E1256 from its callback (uncaught, process exit by default) · server · k.resume · repro: red-team-8.md M2
- [ ] 0850 red-team, medium: a `#k-state` snapshot that does not restore (stores passed or created while resuming) is dropped with no warning; the page shows server state over initial-state stores · runtime-dom, store · k.resume, k.claim · repro: red-team-8.md M3
- [ ] 0851 red-team, medium: a submit fired before resume is not prevented and is replayed to the island handler: native POST plus the handler's request · runtime-dom · k.runtime · repro: red-team-8.md M4
- [ ] 0852 red-team, low: E1256 is checked by async context; a continuation registered at module load writes a module store with request data unchecked; state the limit · server · k.resume
- [ ] 0853 red-team, low: a document with no islands ships every request store's snapshot (`.pii()` fields included) in `#k-state` · server · k.resume, k.privacy
- [ ] 0854 red-team, low: `resume` rethrowing an island's throw loses every collected warning in the generated entry · runtime-dom, compiler · k.claim
