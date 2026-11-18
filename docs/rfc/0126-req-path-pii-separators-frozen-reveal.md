# RFC 0126: a revealed value is frozen deep; the `req` path marks `.pii()` params and cuts at an encoded separator

Status: accepted (orchestrator under the owner's standing leave, 2026-11-18). For backlog 0739, 0746, 0753, 0754 and 0760; the options and measurements are in `tasks/0338-s8-reach/proposed/lane-a-0718.md`.

## Problem
Four gaps in k.privacy, each reproduced by a test in the build:
- **A revealed value changes in place.** `noteRequestSecrets` walks each `Secret` once per scope, and `Secret.of` freezes the `Secret`, not its value. `reveal(sec).token = "rotated-token-5678"` after the first reveal leaves the new text raw in a later `diag` (`packages/server/test/revealMutated.test.ts`, `packages/schema/test/revealFrozen.test.ts`, both `test.fails`).
- **`.pii()` route params are logged raw.** With `/u/:email` and `email: s.string().pii("contact")`, production logs `GET /u/alice@example.com app.who 200 0ms` and `GET /u/alice%40example.com …` (`packages/server/test/reqPathLimits.test.ts`). E1111 refuses the table in checked code; the runtime marks are the backstop for tables check does not read, and today they cover secret params only.
- **An encoded separator is logged as sent.** With `/reset/:token` (secret), `/reset%2FSECRETx`, `/reset%2fSECRETx`, `/RESET%2FSECRETx` and `/reset%5CSECRETx` come back whole. The first segment decodes to `reset/SECRETx`, which equals no static segment, so no route lines up and the stated-limit rule writes the path as sent. The spec's limits do not name the case.
- **The over-mark is unstated.** A route whose secret param is first, or second after a leading param, lines up with every path: `/about` of `/:token` and `/en/A` of `/:p/:tok` log `/[secret]` (`reqPathLimits.test.ts`, passing). k.privacy implies it ("a prefix-param route also without it", "A longer path is cut there") and the server README states it; RFC 0123's cost paragraph says `/en/[secret]`, which the build does not do (see its Amendment).

## Proposal
**Frozen deep at `Secret.of` (0739).** `Secret.of` freezes its value and every object and array under it (a walk over `Reflect.ownKeys`). A value then cannot change after any reveal, so one walk per scope stays exact, a change made after the last reveal included. Where the inner schema passes its input through (`s.secret(s.json())` keeps the caller's reference), the caller's object is the one frozen; app code writing into a revealed object throws a `TypeError` in strict mode. The server needs no change.

**`.pii()` params, by position (0753).** A segment standing at a `.pii()` `params` field of any route of `routes` is `[pii]` as sent, by the line-up secret params use: same start, same skipped lead param, same static comparison. A field is `.pii()` when its node or a node above it carries the mark (k.privacy Personal data). The cut applies too: a path longer than a lined-up pii route is cut at the pii segment and the rest joins `[pii]`. A pii value can hold a raw `/` as a token can (a birth date `1990/01/02`, an address `Flat 2/14`), and a link built by string templating splits it; without the cut its tail is logged, the leak ADR-0144 closed for secrets. One rule for both marks keeps the behavior predictable (principles 1 and 9). Where both marks apply to one segment, or two cuts fall on the same segment, the mark is `[secret]`, the precedence the Server log bullet already states for the bound ("one mark, `[secret]` if it holds a secret"). The earliest cut wins, and its tail takes the mark of the segment it was cut at.

**Encoded separators (0754).** When any route of `routes` has a secret param, the path is also cut at its first non-empty segment whose raw text holds `%2F` or `%5C` in either case (`/%2f|%5c/i`): that segment and the rest become one `[secret]`. The check reads the raw segment and runs apart from the line-up, so the sentence "a static one the same text once decoded and case-folded" is unchanged: such a segment decodes to text holding `/` or `\`, which no static segment holds, so it never fitted a static and still does not; a param segment holding one was already marked by its position. A double encoding (`%252F`) is not a separator after the one decode and stays among the stated limits. A raw `\` never reaches the pathname, since URL parsing turns it into `/`. In a table with `.pii()` params and no secret one, the separator does not cut (Choices, C4).

**The over-mark in the spec (0746, 0760).** k.privacy states that `/:t` and `/:p/:t` (`t` secret) mark any path whole, and conformance asserts `/about` of `/:token` and `/en/A` of `/:p/:tok`. The build is unchanged.

**Budget moves.** k.privacy is at 1,499 tokens. To pay for the new text, five prose items leave it unchanged in meaning; none is a Conformance bullet, so the clause numbers k.evidence cites (`k.privacy#6`, `#7`) stay.

## Alternatives
- 0739: walk again on every reveal (drop `notedSecrets`): misses a change after the last reveal, and N reveals of a large secret cost N walks. Keep each scope's revealed secrets and walk them at every scrub: exact, but a walk per record and more `@keel/server` bytes than remain.
- 0753: note the matched route's decoded params into the request's pii set (+11 bytes, measured): a path that matches no route, or whose params fail, stays raw. It is the floor if the budget raise in C5 is refused.
- 0753: mark pii params without the cut: a pii value holding a raw `/` leaves its tail.
- 0754: line up on each segment's decoded form split at `/` and `\`: more precise, more bytes, and a second line-up rule. Listing it as a stated limit: leaves a token in the log.
- 0746: line a led route up without its lead only when the path is shorter than the route, giving `/en/[secret]`: leaks `rest` of `/<token-part>/rest` when a token holds a raw `/` and the prefix is left out.

## Spec diff
k.privacy (before 5,994 characters, 1,499 tokens; after 5,995 characters, 1,499 tokens).

Secrets: "What `reveal` returns is plain data: a store, driver or log keeps it as written. A secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field (E1113, k.api)." becomes:
```
`reveal` returns plain data, frozen deep (k.reveal).
```

Sinks, the `req` path bullet, whole new text:
```
- `req` path, first: a segment at a secret `params` field of any route of `routes` (any deployable's) is `[secret]` as sent, at a `.pii()` one `[pii]`, `[secret]` if both. A route lines up from the first segment, skipping empties (a prefix-param route also without it), to that param: a param fits any segment, a static one the same text once decoded and case-folded, or undecodable. A longer path is cut there, the rest joining that mark: `/:t` and `/:p/:t` (`t` secret) mark any path whole. A secret param also cuts a path as `[secret]` at a segment holding `%2F` or `%5C` (any case). A path no route lines up with (a static typo, an extra leading segment, a raw `/` in an earlier param, `&` for `?`) is logged as sent.
```

Moves and trims out of k.privacy:
- "A failed peer forward logs its error's `name` only." leaves the `req` path bullet for k.topology Calls and peers, which owns forwarding: "(unreachable: 502 `keel.unreachable`)" becomes "(unreachable: 502 `keel.unreachable` and a `diag` `peer unreachable: <name>`, the error's `name` only)". k.topology 5,630 to 5,695 characters, 1,408 to 1,424 tokens.
- "What `reveal` returns is plain data: a store, driver or log keeps it as written." moves to k.reveal Purpose, whose "What `reveal` returns is plain data (k.privacy Secrets)." becomes "What `reveal` returns (k.privacy Secrets) is plain data, frozen deep when the secret is made, so it cannot change after a reveal; an inner schema that passes its input through (`s.json()`) leaves the caller's object frozen. A store, driver or log keeps it as written." k.reveal 4,289 to 4,620 characters, 1,073 to 1,155 tokens, with the bullet below.
- "A secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field (E1113, k.api)." moves to k.api Output, whose "`output` holds no `s.secret` (k.privacy)." becomes "`output` holds no `s.secret` (E1113, k.privacy): a secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field." k.api 5,865 to 5,966 characters, 1,467 to 1,492 tokens. E1113 stays in k.privacy Rules.
- "In dev, `/__keel/inspect` serves store values unredacted; it is not a sink." moves to k.cli Inspect: "`stores` is `{ [id]: { state, log } }` from `stores()`," gains "unredacted,". The Sinks list is closed, so a surface it does not name is not a sink. k.cli 5,965 to 5,977 characters, 1,492 to 1,495 tokens.
- Trim, "- Evidence bundle (k.evidence): holds no app value.": k.evidence already says "No file holds an app value" and owns the clause (`k.evidence#5`); k.evidence is unchanged.
- Trim, the Rules entry "E1112 a revealed value reaching a log, storage, a file, store state or a throw (k.reveal)": k.reveal's Rules own E1112, and `@keel/check` attributes it there.
- Trim, k.cli Inspect: "`inspect` ..." wording only: "after mount and whenever it changes" becomes "after mount and on each change", "the server's own or listed" becomes "its own or listed", "prints one `inspect.store` record per store and a summary of counts" becomes "prints an `inspect.store` record per store and a count summary". k.cli 5,983 to 5,964 characters.
- Trim, the E1111 clause "a package's exported route table or schema is the package's, as is the schema returned by an export on the checker's closed audited list, which refuses a marked column (`tableSearch`, `@keel/std-tables`)" becomes "a package's exported table or schema, and `tableSearch`'s (`@keel/std-tables`, refusing a marked column), are the package's". The audited list has one export; naming it states the same set.

The proposal's own destinations did not fit: k.server is at 1,499 tokens and k.check at 1,495, with room for 12 and 23 characters.

## Conformance diff
New bullets, appended at the end of each list; no existing bullet changes.

k.privacy, clause 9:
```
- `/reset%2F<v>`, `/RESET%2f<v>`, `/reset%5C<v>` (of `/reset/:token`), `/about` (of `/:t`) and `/en/A` (of `/:p/:t`) log `/[secret]`; `/a%2Fb` with no secret param, as sent.
```
k.privacy, clause 10:
```
- Of `/u/:email` (`.pii()`), `/u/a@b.c`, `/u/a%40b.c`, `/U/a@b.c` and `/u/a@b.c/x` log `/u/[pii]`; `[secret]` if also secret.
```
k.reveal, clause 9:
```
- For every generated secret over an object or array, the revealed value and each object and array under it are frozen.
```

One `rfc:0126` commit by the `conformance-writer`:
- `packages/server/conformance/privacy-req-path.test.ts`: the header quotes the new `req` path bullet and k.privacy clause 9. Cases, each in dev and production, compact and json: the four separator spellings of `/reset/<v>` log `/[secret]` and no line holds `<v>`; `/about` with route `/:token` and `/en/A` with `/:p/:tok` log `/[secret]`; a table with no secret param logs `/files/a%2Fb` as sent.
- New `packages/server/conformance/privacy-req-path-pii.test.ts`, citing clause 10 and the `req` path bullet: route `/u/:email` with `email: s.string().pii("contact")`; the four paths log `/u/[pii]` and no line holds `alice`; a field both `s.secret` and `.pii()`, and two routes putting a secret and a pii param at one segment, log `[secret]`.
- New `packages/schema/conformance/secret-frozen.test.ts`, citing k.reveal clause 9 and Purpose: for every generated secret over an object or array inner, `Object.isFrozen` holds for the revealed value and each object and array under it, and `Reflect.set(reveal(x), "k", 1)` is `false`; a string inner reveals as parsed.
- Headers whose quoted text moved: `packages/cli/conformance/evidence-no-pii.test.ts:2` cites k.evidence "No file holds an app value: records carry ids, codes, paths, counts and hashes." in place of the dropped Sinks line; `packages/router/conformance/action-output-0104.test.ts:5` cites the k.api Output sentence; the failed-forward case of `privacy-req-path.test.ts` cites k.topology Calls and peers.

## Migration
None for an app that passes `keel check`: E1111 keeps marked and secret params out of its route tables. A server test or package table with a `.pii()` param logs that segment as `[pii]` and cuts a longer path there. A table with a secret param logs a path holding `%2F` or `%5C` cut at that segment. App code that writes into an object it passed to `s.secret` or got from `reveal` throws a `TypeError`; copy the value first (`{ ...reveal(s) }`, `structuredClone`).

## Build order
1. Orchestrator: the spec diff above (done with this RFC). The `conformance-writer`: the conformance diff.
2. Lane A, schema: `Secret.of` deep-freezes `value` (+40 bytes gzip, 5,323 to 5,363 of 5,632). `revealFrozen.test.ts` and `revealMutated.test.ts` lose `test.fails`.
3. Lane A, server: `secretSegments.ts` lines up `.pii()` fields beside secret ones and marks `[pii]` with `[secret]` precedence, and cuts at the first segment matching `/%(2f|5c)/i` when a secret param exists (+28 measured, pii estimated +50 to +70), its doc comment, the README rule paragraph, `reqPathLimits.test.ts` loses `test.fails`; changesets (`@keel/schema`, `@keel/server` patch).
4. Orchestrator: ledger, backlog 0739, 0746, 0753, 0754, 0760, HANDOFF.

## Token impact
k.privacy 1,499 to 1,499 (5,994 to 5,995 characters); k.reveal 1,073 to 1,155 (4,289 to 4,620); k.api 1,467 to 1,492 (5,865 to 5,966); k.cli 1,492 to 1,495 (5,965 to 5,977); k.topology 1,408 to 1,424 (5,630 to 5,695).

## Choices
Each is the drafter's call; the operator can reverse any of them.
- C1: a revealed value is frozen in place, the caller's own object included where the inner schema keeps it, rather than copied then frozen.
- C2: `.pii()` params use the secret line-up and cut; a longer path under a pii route loses its tail.
- C3: `[secret]` wins over `[pii]` at one segment; the earliest cut's tail takes the cut segment's mark.
- C4: the encoded-separator cut needs a secret param in the table; a pii-only table logs `/u%2Falice@x` as sent.
- C5: `@keel/server` has 53 bytes left and this RFC needs about 78 to 98 (0754 +28, 0753 positional +50 to +70). The budget rises from 23.75kb to 24kb. Budgets are a gate the owner sets: if the raise is refused, the build ships the matched-params form of 0753 (+11), an amendment narrows the `.pii()` sentence to it, and the positional mark goes to the backlog.
- C6: the over-mark stays and is stated; RFC 0123's `/en/[secret]` is corrected by amendment.
- C7: five k.privacy prose items move to k.topology, k.reveal, k.api and k.cli, or are dropped as duplicates of k.evidence, k.reveal and the audited-list wording.

## Amendment (red team 7, M4)

`Secret.of` froze and walked a value before its schema check, so `parse` threw on a typed array, a throwing getter or a revoked Proxy, and left a caller's object frozen when it returned an err. The deep freeze now happens after the value passes its schema check: a value that fails to parse is left unfrozen. A value the freeze cannot walk (a typed array, a throwing getter, a revoked Proxy) makes `parse` return the schema's ordinary err rather than throw.
