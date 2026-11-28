# Red team 4: what merged after the third review round (`94955772..HEAD`, plus the rfc:0110 commits)

Probes ran as one throwaway test file at a time (`packages/{server,router,store,check,schema}/test/zz-rt4-probe*.test.ts`, all deleted), each through `pnpm --filter <pkg> exec vitest run <file> --reporter=dot` under `alarm`. Server probes built an app the way `test/reqPathEscapes.property.test.ts` does (sim ctx seed 1337, mode `dev`, compact log). The E1802 probes ran against the working tree, which held an uncommitted change to `packages/check/src/rules/blankLabel.ts` (namespace imports, character references) made by another session.

Counts: 1 HIGH, 1 MEDIUM, 7 LOW.

## Findings

### 1. HIGH: a routed app's production root fallback still shows the thrown message (RFC 0119 bypassed)
Files: `packages/router/src/internal/createRouterWith.ts:360-383` (the router's own root `boundary`, fallback `defaultError(error)`), `packages/router/src/internal/defaultError.ts:10` (`else el.textContent = error.message`), also `renderView.ts:9` and `:64`.
Probe (ran, `packages/router/test/zz-rt4-probe.test.ts`):
```ts
const routes = manifest({
  "p.page": { path: "/p", component: () => { throw new Error("db password hunter2 SECRETTEXT"); } },
  "p.loaded": { path: "/l", loader: { output: s.string(), run: () => { throw new Error("loader SECRETLOADER"); } }, component: () => document.createElement("i") },
});
mount(createRouter(routes, { ctx, history: memoryHistory(at) }).App, host, { mode: "production" });
```
Observed:
```
/p: <div role="alert" data-keel-error="keel.unexpected">db password hunter2 SECRETTEXT</div>
/l: <div role="alert" data-keel-error="keel.unexpected">Error: loader SECRETLOADER</div>
```
The generated client entry is `mount(router.App, el, { ctx, mode })`. The router's App wraps the page in its own `boundary`, which catches every page throw before the `mount` root does, so `rootFallback`'s `mode` never applies. The server renders the same failure through `publicize` (`packages/server/src/internal/renderChain.ts:34,70`), so a client-only (`client` / static) deployable shows a message the server hides. RFC 0119 lists "a route's `errorElement` already serves that need for routed apps" as a reason not to add more. But with no `errorElement`, the fallback is the router's `defaultError`, which is kernel code, not app code.
Fix: give `createRouter` the same `mode` (or have `defaultError` take one): in production, `keel.unexpected`'s alert holds the code (or the kernel's fixed `unexpected` text), as the server's `publicize` does. Add a conformance case to k.errors (a router-mounted page throw in production holds no message). Have the entry pass `mode` to `createRouter` too.

### 2. MEDIUM: a secret value with a raw `/`, or a raw `/` in an earlier param, leaves the secret in the `req` line
File: `packages/server/src/internal/secretSegments.ts:39-47` (only `where[at]` is marked; the tail is ignored).
Probe (ran, `packages/server/test/zz-rt4-probe.test.ts`; routes `/reset/:token`, `/confirm/:token/done` and `/o/:org/k/:key`, each secret param `s.secret(s.string())`):
```
/reset/ab/SECRETcd+ef==     => GET /reset/[secret]/SECRETcd+ef== 404
/confirm/a/SECRETx/done     => GET /confirm/[secret]/SECRETx/done 404
/o/a/b/k/SECRETx            => GET /o/a/b/k/SECRETx 404
```
About half of all 32-byte tokens in standard base64 hold a `/`. A link built by string templating (`/reset/{{token}}` in an email template) sends it raw. The router 404s, the request reveals nothing, so `redacted` has no value, and the half of the token past the slash is written as it came. A raw `/` in an earlier plain param shifts the alignment, and then the whole secret is written. The README says "the rest ignored", but the same paragraph says "`[secret]` whole, whatever the client sent there". The rule removed in 4969a27e (tail marking) covered the first two cases.
Fix: on a request no route matched, mark every segment from the first lined-up secret position to the end of the path. That is still one predictable rule ("a 404 path is cut at the first segment that stands at a secret param"). Or, for a 404 in a table with any secret param, write only the segments before the first param of any lined-up route. Add both probes to `reqPathEscapes.property.test.ts`.

### 3. LOW: a mistyped link written as it came (the stated limit, measured)
File: `secretSegments.ts:41-45`. Probe (ran), each `404` with the value raw:
```
/en/reset/SECRETx  /app/reset/SECRETx  /r%2565set/SECRETx  /reset;jsessionid=1/SECRETx  /reset./SECRETx
/reset%2FSECRETx  /reset%20/SECRETx  /%20reset/SECRETx  /reset%00/SECRETx  /r%D0%B5set/SECRETx (Cyrillic e)
/%EF%BD%92...(fullwidth reset)/SECRETx
```
The README states this ("a typo in a static segment or a link missing its leading static segments is a path no route has"). The extra-leading-segment case (`/en/...` on an app with no prefix param, or a proxy base path not stripped) is not named there, and it is the one a misconfigured link builder repeats for every user. Weigh it against principle 9 (predictability) in the operator's call. If the 404 rule of finding 2 lands, a 404 cut at any segment that lines up from any offset would cover this without fuzzy matching.

### 4. LOW: a secret search value in a link that is missing its `?` is written raw
Route `/callback` with `search: s.object({ code: s.secret(s.string()).optional() })`. Probe (ran):
```
/callback?code=SECRETx  => GET /callback app.cb 200        (held: the query is never logged)
/callback&code=SECRETx  => GET /callback&code=SECRETx 404
/callback/code=SECRETx  => GET /callback/code=SECRETx 404
```
The req path rule covers `params` only, and the README is silent on search. OAuth-style callbacks are where this typo happens.
Fix: within finding 2's 404 rule, also cut a 404 path at a segment holding `=` when some route has a secret search field. At least, say in the README that search values are safe only because the query is not logged.

### 5. LOW: stale comment on the req path marker
`packages/server/src/createApp.ts:285`: "each segment where a served route has a secret param". Since 788e06a7, `marks = secretSegments(table)` (line 153) covers every route, served or not. Reasoned.
Fix: "where a route of `routes` has a secret param".

### 6. LOW: RFC 0110's once-per-set walk misses a revealed value changed in place
Files: `packages/server/src/internal/noteRequestSecrets.ts:18-27`, `packages/schema/src/Secret.ts:17-21` (only the `Secret` is frozen, not its value). Probe (ran, `packages/schema/test/zz-rt4-probe.test.ts`): `reveal(s.secret(s.object({ a, list })).parse(...))` gives `Object.isFrozen` `false`, and `false` for the array. Server probe (ran, `packages/server/test/zz-rt4-probe2.test.ts`):
```ts
requestSecrets.run(into, () => { const v = reveal(made); Reflect.set(v, "token", "rotated-token-5678"); reveal(made); });
redacted("threw with rotated-token-5678 and old-token-1234", { secrets: into, pii: new Set() })
// -> "threw with rotated-token-5678 and [secret]"
```
Fix: deep-freeze the value in `Secret.of` (it is a fresh decode, so this is cheap), so a revealed value cannot change and one walk per set is exact. Or re-walk on every reveal and drop `notedSecrets`.

### 7. LOW: E1802 misses blank labels a reader would call literal
File: `packages/check/src/rules/blankLabel.ts:13-20,29-36,91-95`. Probe (ran, `packages/check/test/zz-rt4-probe.test.ts`). Each of these was missed (only E1752 reported):
```
<Input label="​" />   <Input label="&#8203;" />   <Input label="⠀" />   <Input label="ㅤ" />
<Input label={("")} />     <Input label={"" as string} />   <Input label={" " satisfies string} />
<Input {...{ label: "" }} />   Input(({ label: "" }))   Input({ label: ("") })   Input({ label: "" } as const)
Input({ ...{ label: "" } })    const I = Input; <I label="" />
```
`label={"\x20"}`, `Input?.({ label: "" })` and `label=" "` were flagged. `&ensp;` / `&emsp;` / `&Tab;` / `&shy;` are not blank, consistent with `packages/compiler/src/internal/decodeEntities.ts`, which keeps unknown named references as text.
Fix: unwrap `ParenthesizedExpression`, `TSAsExpression`, `TSSatisfiesExpression` and `TSNonNullExpression` in `literalText` and around the call argument. Count `\p{Cf}`, U+2800, U+3164, U+115F, U+1160 and U+FFA0 as blank. Read an object-literal spread in a JSX attribute or a call argument.

### 8. LOW: a write key does nothing on a store with `logLimit: 0`, and a busy shared store forgets it after `logLimit` keyed writes
File: `packages/store/src/store.ts:68,166`. Probe (ran, `packages/store/test/zz-rt4-probe.test.ts`):
```
store(Bag, {items:[]}, { logLimit: 0 }); tx(push, {v:1}, {key:"k"}) twice  -> items [1,1], keys []
logLimit 2: keys k1, (2 unkeyed), k2, k3; retry k1                        -> commits again: [1,2,3,4,5,1]
```
This follows the README ("the latest `logLimit` commits made with a `key`"), but idempotency then depends on an undo-history setting. On a server store shared by many clients, an outbox flushed after 256 other keyed writes commits twice.
Fix: bound `keys` by its own constant (for example `max(logLimit, 256)`, carried in the snapshot), or refuse `key` on a `logLimit: 0` store with an E-code.

### 9. LOW: a forward failure's `diag` is written with no scrub and no path marks
Files: `packages/server/src/internal/forward.ts:50` (`peer unreachable: ${sent.error.message}`), `packages/server/src/createApp.ts:283` (`h.diags` from `forward` written as is; only `routed` diags go through `scrubbedDiag`). Reasoned, not run. A fetch error whose message names the URL writes the forwarded path, secret segment included, raw. Deno's fetch does this ("error sending request for url (…)"), as can a custom in-process peer or a sim net handler. Node's undici does not.
Fix: pass the forward `diag` through `marks` on any path text it holds, or drop `sent.error.message` and log `sent.error.name` only.

## Probes that held
- Server req path, matched routes: `/reset/SECRETx`, `/RESET/SECRETx` (404, marked), `/reset/SECRETx/` (308, marked), `//reset//SECRETx//`, `/%72eset/…`, `/re%73et/…`, `/./reset/…`, `/reset/%2e%2e/reset/…`, `/x/../reset/…` (URL normalizes first), `/reset/new` (static sibling over-marked as `[secret]`, fine), `/confirm/SECRETx/done` and `/confirm/SECRETx` (tail missing), prefix param `/fr/acct/…`, `/en/acct/…` (308), `/acct/…`, `/zz/acct/…`, `/FR/acct/…`, `/o/acme/k/…`, `/o/acme/K/…`. Reasoned: for every path the router matches, the marker lines up, since the router compares decoded statics exactly and the marker case-folds a superset.
- Long paths: a 120,000-character secret segment took 24 ms; `/reset/SECRETx` plus 50,000 `/a` segments took 8 ms. Nothing leaked.
- Several modules or deployables: `marks` is built from the whole `table` (`reqPathForwarded.test.ts` covers it); a peer route found only in `routes.json` is the stated limit.
- Last resort: `lastResort` reads nothing of the thrown value; its `diag` holds only the route id; `logUnwritable` writes a fixed line once per process and swallows a throwing `stderr.write` (reasoned from `createApp.ts:197-206`, `logUnwritable.ts`). A throwing `onDispose` in `rq.scope.dispose()` now surfaces as a last-resort 500 with no `req` line. This behaves as before 72216f23, with nothing of the value logged.
- RFC 0119 `rootFallback` / `rootCatcher` / `resume`: `mode` defaults to production; the entries derive `mode` from `import.meta.env?.DEV === true`, so an unbundled entry is production. `data-k-error` holds `at`, a compiler id.
- RFC 0111: the same key on another transaction commits (`bag.pop` with key `k` after `bag.push` `k`); a snapshot with `keys: []` restores and the retry commits; `keys: null` and a 65-character key are `schema.invalid`; a snapshot without `keys` takes them from its log; `__proto__` as a name is inert. Forging `keys` in a snapshot silences a later write with that key, but snapshots come from server storage or the server's own `#k-state`, not from a client, so this needs storage write access.
- RFC 0113: a failed first fire rejects, and the stored start mark makes a `once` restart enqueue it with key `<id>@<t>`. A mark write that fails after a good enqueue re-enqueues the same key, deduped by std-jobs. A storage error on the start write rejects `run`, and `keepRunning` reruns it after 1 s (reasoned).
- E1802: a character reference past U+10FFFF does not throw (working tree guards it); `&amp;#32;` is not blank; `label={"\x20"}` flagged.
- Reactive disposal (72216f23): `runAll` disposes every owned node and runs every hook; `refresh` unlinks a node disposed mid-run before disposing its owned nodes (read; covered by the commit's property test).

## Proposed backlog lines (`## Red team`)
- 0735 router: a routed app's production root fallback shows the thrown message: the router's root `boundary` renders `defaultError(error)` with `error.message`, so `mount(router.App, el, { mode: "production" })` shows `db password hunter2` (repro: `packages/router` test mounting a page whose component throws, `host.innerHTML`). Give `createRouter`/`defaultError` the `mode` and add a k.errors conformance case · router, compiler · k.errors · rfc:0119
- 0736 server: a secret value with a raw `/`, or a raw `/` in an earlier param, leaves the secret in the `req` line (`/reset/ab/SECRETcd+ef==` gives `GET /reset/[secret]/SECRETcd+ef== 404`; `/o/a/b/k/SECRETx` stays whole). On a 404, cut the path at the first segment that lines up with a secret param · server · k.privacy
- 0737 server/docs: a 404 path with an extra leading segment (`/en/reset/X`), `;jsessionid`, a trailing dot, `%20`, a double-encoded or homoglyph static, or a search value in a link without `?` (`/callback&code=X`) is written raw; decide whether finding 2's 404 rule covers these and say so in the README · server · k.privacy
- 0738 server: the comment at `createApp.ts:285` says "a served route"; the marks come from every route of `routes` · server
- 0739 schema: a revealed `Secret` value is not frozen, so a value changed in place after the first reveal in a scope is never walked (`reveal(sec).token = "rotated"; reveal(sec)` then the log holds `rotated-token-5678`). Deep-freeze in `Secret.of` · schema, server · k.privacy
- 0740 check: E1802 misses `label={("")}`, `{"" as string}`, `{" " satisfies string}`, `{...{ label: "" }}`, `Input(({ label: "" }))` and invisible-only labels (`​`, `⠀`, `ㅤ`). Unwrap parentheses and type assertions; count `\p{Cf}` and the blank fillers as blank · check · k.a11y
- 0741 store: write keys hold only the latest `logLimit` keyed commits, so `logLimit: 0` disables dedupe (a retry commits twice) and a busy shared store forgets a key after 256 keyed writes. Bound `keys` on its own or refuse `key` at `logLimit: 0` · store · k.store, k.sync
- 0742 server: a forward failure's `diag` (`peer unreachable: <error.message>`) is written with no scrub or path marks; a runtime whose fetch error names the URL writes the secret segment raw. Mark it or log the error name only · server · k.privacy
