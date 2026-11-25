# RFC 0232: the identity mount and the router: one mount, no shadowed assets, stated fallbacks

Status: implemented (ADR-0254), accepted by the orchestrator on 2026-11-25. Amends k.mount (Declaration, Rules, Messages, Conformance), k.user (Rules, Conformance), k.opening, k.head, k.prefix (Conformance), k.forms (Validation, Conformance), std.messages (Set, Conformance), the map and the std index. From fix lane 08 "router-identity" of the P1 weakness triage (backlog 0968, 0969, 0976, 0336, 0314, 0895).

## For the operator
1. **A stray `identityMount` call is an error, E1593, not a warning.** Recommended: yes. The call reaches no router or shell, and on its own it puts the `/__keel/user` read in the bundle: an app half opted in to identity, which the project makes a check error.
2. **`Set.text` parses.** It returns its argument with the set's type and no check today, so a locale file imported directly holds text the set never accepted. Parsing at `Set.text` gives one checked path for every import; the cost is one parse when a locale file evaluates.
3. **`settle` keeps its bound.** The 200,000-turn bound on a navigation that waits stays as D39 of task 0963 decided: a shorter bound tied to a pending sim-clock deadline trips on a debounce beside a slow import, and the message already names the count and the unit.
4. **A record key a person typed reaches `issueText`.** Stated, not changed: the path is the one `errors()` keys by, and Keel's English never shows it.

## Decisions
- D1 (0976): E1593, an error at the call: an `identityMount` call in a non-test code file of the project other than `identity.ts`'s `export default` expression. k.mount Declaration states that only that default export reaches the router and a shell.
- D2 (0895): E1579 also refuses a `handle.path` at or under `/assets`, as a literal or as `identity.ts`'s `.path`, in `keel check`, `keel build` and `createApp`.
- D3 (0968, 0969, 0314, 0336 `\`): bugs against today's spec, or already closed by it. Each gets a regression clause where conformance lacks one; no behaviour changes.
- D4 (0336 locale): `Set.text(entry)` parses `entry` with the set.
- D5 (0336 `issueText`): k.forms states what `path` holds.
- D6 (0336 `settle`): no change.

## Problem
Six backlog lines, from red-team passes on the identity mount, the openings gate and the router:
- 0976: E1580 and E1584 read only `identity.ts`'s default export, so `identityMount('/x', { links: ['/v'] })` elsewhere passes `keel check`. The tree today: the generated entry passes only that default export to `createRouter` (`mount`) and to `shellMount` (`packages/compiler/src/internal/entryCode.ts`), so a stray call's `links` reach no shell. But the spec does not say so, and any call sets `userRead.fn` (`packages/router/src/identityMount.ts`), which puts the `/__keel/user` read in the bundle of an app with no `identity.ts`.
- 0895: `handle` is dispatched before the built assets (`packages/server/src/internal/handle.ts`), and `/^(\/[a-z0-9-]+)+$/` admits `/assets`, so a library mounted there answers every request for the built client's files. Nothing reports it.
- 0968: an admitted return link whose chain lands on a page that navigates to the mount on render, through a guard's redirect, must record no opening. k.opening Link-started already says so ("a page that navigates to the mount on render, reached by the link or a guard's redirect"), and `personActs` implements it; conformance covers the direct landing (`/auto`) and not the guard hop.
- 0969: k.opening Stored value already states that a failed `set` leaves the older opening pending until its own deadline, and `return-opening.test.ts` covers it.
- 0314: k.head says the fallback title is "the served deployable's name: a server's". The client router reads `document.title` when it starts (`createRouterWith.ts`), which on a resumed document is the first route's title, so later untitled pages keep it.
- 0336, four leads:
  - `navigate('/en-US/\\x')`: closed by k.router Links and k.mount-scope Test (a raw `\` matches no page, so it is a document navigation on the origin; `/\x` itself rejects E1501). Conformance covers unprefixed paths only.
  - `settle`: see For the operator 3.
  - `Set.text` (`packages/std-messages/src/messages.ts`) returns `asEntry(entry)` and parses nothing; only `Set.load` parses. A locale file imported directly holds an unparsed entry typed as a parsed one.
  - `issueText`'s `path` is `pathToString(issue.path)`: a record key goes in as the input holds it.

## Proposal
### Clause 1: one identity mount (0976), k.mount
- Declaration: only `identity.ts`'s default export is the mount. The build passes its `path` to the router and its `path` and `links` to a shell. No other `identityMount` call's `path` or `links` reaches either. Another call throws nothing at run time.
- E1593 (`keel check`, a kernel rule in `@keel/check` beside E1730, at the call's callee): an `identityMount` call imported from `@keel/router`, under any local name, in a code file of the project that is not a test file (k.testing), unless it is the `export default` expression of `identity.ts` beside `topology.ts`. This covers a project without `identity.ts`, and a second call inside `identity.ts`. `export default m` after `const m = identityMount(...)` is E1580 (the default export is not the call) plus one E1593 at the call. No fix: moving a mount is the author's call.
- Message, 75 units, no variable part: `identityMount is for identity.ts's default export; import that file instead`. `keel explain E1593`: the mount is the file the build reads; a call elsewhere opens no path and carries the user read into the bundle; import `identity.ts`'s default export.
- Protection (#13): for every `p` and `l` the call accepts, with `p` neither the harness mount's path nor under it and no page at `p + l`, a return link to `p + l` with no opening sends no `net` request, and `navigate` there is a document navigation, not a mount request.

### Clause 2: `/assets` is not a mount (0895), k.user
- E1579 also covers a `handle.path` equal to `/assets` or beginning `/assets/`, whether `handle.path` is a literal or `identity.ts`'s `.path`. `keel check` and `keel build` report it at `identity.server.ts` line 1. `createApp` throws E1579 before serving.
- Message (`keel check`, `keel build`): `handle.path <p> is at or under /assets (built files)`, `<p>` the path's JSON text cut to 40 units: 89 at the bound. `createApp`'s thrown text becomes `identity handle.path: lowercase / segments, not /assets, no route under it` (74).
- Only `/assets`: the mark (`/keel-mark.svg`) and `/__keel/*` cannot be lowercase `/` segments, so the existing pattern already refuses them.
- Protection (#16): for every `handle.path` of lowercase segments with no route under it, E1579 exactly when it is `/assets` or begins `/assets/`.

### Clause 3: `Set.text` parses (0336), std.messages
`Set.text(entry)` parses `entry` with the set and returns the parsed entry. A failing entry throws the error `Set.load` rejects with (the issues as JSON, no locale text), whether the file is imported through `load` or directly. `Set.load` is unchanged; it parses the default export, which is now already parsed. Protection (#12): for every value `e`, `Set.text(e)` returns exactly when the set's `parse(e)` is `ok`, a value equal to it.

### Clause 4: what `issueText`'s `path` holds (0336), k.forms
`path` is the key `errors()` uses: the issue's path segments joined by `.`, record keys and array indexes as the input holds them. So a record key a person typed reaches `issueText`, and a key holding `.` reads as more segments. Keel's English holds no path. Behaviour unchanged. Pinned by #18, over every record key `parse` accepts (`parse` already refuses `__proto__`, `constructor` and `prototype`, k.schema).

## Builder's work, no spec change
- 0968. Expected: link (taking the opening) → 302 `/private` → the guard redirects to `/auto` → `/auto` calls `navigate(mount.href('/login/github'))` on render, and no opening is recorded, so a second link sends nothing. Sentence it already holds to: k.opening Link-started, "a mount request, whoever starts it (that link's chain, a page that navigates to the mount on render, reached by the link or a guard's redirect, …), opens the external browser where k.return says and records no opening". The code holds it today (`personActs.linked` is set before the GET and cleared only by an act). Regression clauses k.opening#15 and the property #16 (#14's sequence with the guard hop). Builder: none beyond the tests.
- 0969. Expected and stated (k.opening Stored value, "an older pending opening stays pending until its own deadline") and covered (`packages/testing/conformance/return-opening.test.ts`, the 299999/600000 ms cases). Builder: tick the line.
- 0314. Expected: after `resume` of a document `node` deployable `api` served for a titled route, a client navigation to an untitled route, or to one whose loader returns `err`, sets `document.title` to `api`. Sentence violated: k.head, "it is the fallback: the served deployable's name: a server's". Fix: the served document carries the fallback (the deployable's name) in `#k-state`, and the router takes it from there on `resume`; a `client` deployable keeps reading `index.html`'s title at `mount`. Clause k.head#11.
- 0336 `\`. Expected and already true: `navigate('/en-US/\\x')` is a document navigation to that path on the origin, and no history entry begins `//`. Sentences: k.router Links (`navigate` rejects E1501 unless the value is an `Href` once `\` reads as `/`) and k.mount-scope Test (no page at a path holding a raw `\`). Clause k.prefix#8 adds the prefixed case and a property over generated strings.

## Alternatives
- **0976: register every call's `links`, checked where made.** Two places a mount can come from, and a module of any deployable could open a path on the shell. Rejected (one way).
- **0976: make the call throw outside `identity.ts`.** A call cannot know its file at run time, and tests make mounts legitimately.
- **0895: move `handle` after the assets.** Then a library mounted at `/assets` gets only the requests no file answers: a mount that half works. Refusing it is plainer.
- **0336 `Set.text`: report a direct import of a locale file (a new E24xx).** It leaves the type claim false for any import the rule cannot see (a re-export, a test). Parsing makes the claim true everywhere.
- **0336 `issueText`: replace record keys by `*` in `path`.** `errors()` keys by the real path, and a field's issue would then name a path no field has. A second path field is a second way.
- **0336 `settle`: a short bound when the sim clock has a deadline.** Tried in lane 03 and rejected in review (D39): any pending deadline trips it.

## Spec diff
Applied in this commit. Status `implemented` (accepted, conformance owed) on k.mount, k.user, k.opening, k.head, k.prefix, k.forms (map rows) and std.messages (std index), each from `conformance-covered`.
- k.mount: Declaration's mount sentence; Rules gains E1593; Messages its text; Conformance #12, #13.
- k.user: E1579's `/assets` case and message; Conformance #16.
- k.opening: Conformance #15, #16. k.head: #11. k.prefix: #8.
- k.forms: Validation's `path` sentence; Conformance #18.
- std.messages: `Set.text`; Conformance #12.
- E1593 is free in E155x, whose owners include k.mount; the map's code table is unchanged. No glossary term, no new section.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/mount-identitymount-e1593.test.ts`: k.mount#12; `fixtures-by-code.ts` gains an E1593 fixture (no fix).
- `packages/testing/conformance/mount-stray-links.test.ts`: k.mount#13 (property over `p`, `l`).
- `packages/check/conformance/identity-e1579-assets.test.ts` and a `createApp` case in `packages/server/conformance/`: k.user#16.
- `packages/testing/conformance/return-acts.test.ts`: k.opening#15, #16 (beside #7 and #14).
- `packages/testing/conformance/head-fallback-resume.test.ts`: k.head#11.
- `packages/router/conformance/navigate-prefix-backslash.test.ts`: k.prefix#8.
- `packages/forms/conformance/issue-text-record-path.test.ts`: k.forms#18.
- `packages/std-messages/conformance/text-parses.test.ts`: std.messages#12.
- Existing: `mount-identitymount-e1580.test.ts` fixtures with a second call outside `identity.ts` now also get E1593; the writer confirms no case asserts a whole clean check over one.

## Migration
None. No app is released. The golden apps, household and examples call `identityMount` only in `identity.ts` (the builder confirms with `git grep identityMount -- apps examples`).

## Token impact
- Spec: k.mount +360 to about 2,620; k.user +155 to about 2,690; k.opening +130 to about 1,620; k.head +75; k.prefix +90; k.forms +155; std.messages +110. All under 3,110. The map shrinks by 12 tokens (six statuses).
- `keel explain E1593`: one entry, under 300.
- Bytes: `@keel/check` one rule; `@keel/std-messages` `text` calls `parse` (it already holds it); `@keel/router` and `@keel/server` a few bytes for the fallback and the `/assets` test. Measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the ten clauses. 3. Build:
- `packages/check/src/rules/identityMountElsewhere.ts` (new, E1593, in `KERNEL_RULES.ts`); `EXPLANATIONS.ts`, `PIPELINE_CODES.ts` if the pipeline lists it.
- `packages/compiler/src/hosting/identitySource.ts` and `identityDiags.ts` (the `/assets` E1579, literal and mounted); `packages/server/src/createApp.ts` (the same refusal and the 74-unit text).
- `packages/router/src/internal/createRouterWith.ts` and the server's `#k-state` writer: the fallback title on resume.
- `packages/std-messages/src/messages.ts`: `text` parses (one `asEntry` fewer).
- Docs: the `keel` and `keel-server` skills' code lists, the READMEs of `@keel/check`, `@keel/server`, `@keel/std-messages`, a changeset, `tasks/BACKLOG.md` (all six lines).
