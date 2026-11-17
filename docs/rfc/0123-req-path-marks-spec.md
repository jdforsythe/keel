# RFC 0123: the `req` path marks and the last resort enter the spec; a longer path is cut at its secret

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0743 (review 4, M1, major), 0736 (red team 4, finding 2, medium), 0737 (findings 3 and 4, stated limits), 0742 (finding 9) and 0746 (review 4, minor m6).

## Problem
**No spec, no conformance.** k.privacy says one thing about the `req` path's route marks: "A secret route param is `[secret]` in the `req` path." The rule the server runs (`packages/server/src/internal/secretSegments.ts`) and the last resort (`packages/server/src/createApp.ts:192-206`, `internal/logUnwritable.ts`) are written down only in `packages/server/README.md` and pinned only by `packages/server/test/{reqPathEscapes.property,reqPathForwarded,reqPathScrub,lastResort}.test.ts`. Anyone may edit `test/` without an RFC, so the privacy behavior is not frozen.

What exists today, read from the code and README:
- The marks come from every route of `createApp`'s `routes`, other deployables' routes included, so a path forwarded to a peer is marked by the front server.
- A route lines up from the path's first non-empty segment, empty segments skipped, by its segments up to and including the secret param. A param fits any segment. A static segment fits one equal to it after one `decodeURIComponent` and a lower-case fold, or one that does not decode. A route led by a param (a prefix param, k.prefix) also lines up without that segment.
- Only the segment at the secret param becomes `[secret]`; the rest of the path is ignored.
- A path no route lines up with is written as it came: a typo in a static segment, a link missing its leading static segments.
- A throw past every guard of the handler, such as a `log.write` that throws, is a bare 500 and one fixed `keel.unexpected` `diag`, `request handler threw in <route id>` when a route matched. When that write throws too, stderr gets one fixed line once per process. Neither reads the thrown value.

**The raw slash.** About half of all 32-byte tokens in standard base64 hold a `/`, and a link built by string templating (`/reset/{{token}}` in an email) sends it raw. Red team 4 ran routes `/reset/:token`, `/confirm/:token/done` and `/o/:org/k/:key`:

```
/reset/ab/SECRETcd+ef==     => GET /reset/[secret]/SECRETcd+ef== 404
/confirm/a/SECRETx/done     => GET /confirm/[secret]/SECRETx/done 404
/o/a/b/k/SECRETx            => GET /o/a/b/k/SECRETx 404
```

The router 404s, so no params parse and no value joins the scrub set, and the text after the slash is written as sent.

**A peer that fails.** A forward failure's `diag` is `peer unreachable: <error.message>` (`packages/server/src/internal/forward.ts:50`), written with no marks. Deno's fetch names the URL in that message, so the forwarded path, secret segment included, is written raw.

**Who has a secret param.** E1111 refuses a `.pii()` or `s.secret` node in a route's `params` or `search` in every route table `keel check` reads. The runtime marks are the backstop for tables check does not read: a package's own table, a server test, an app that ships without `keel check`. That shapes the choices below: a narrower check rule would cover nothing E1111 does not.

## Proposal
**Cut at the secret.** A route still lines up as above. When the path has more non-empty segments than the lined-up route, the segment at the secret param and every segment after it become one `[secret]`; when it has as many or fewer, only that segment is marked, as today. With several routes lined up, the earliest cut wins and the other marks before it stay. The three probes log `/reset/[secret]`, `/confirm/[secret]` and `/o/a/b/k/SECRETx`. The cut does not depend on whether a route matched, so the front server marks a forwarded path by the same rule. One `[secret]` for the whole tail hides how many slashes the value held.

What it costs: a served path longer than a secret route it lines up with loses its tail in the log. With `/reset/:token` (secret) and `/reset/help/faq` (plain), a request for the second logs `GET /reset/[secret] app.faq 200`; the route id still names the page. A route whose secret param is its first segment, or follows only a prefix param (`/:token`, `/:lang/:token`), lines up with every path, so every path longer than it logs as `/[secret]` (or `/en/[secret]`). Today such a table already writes `[secret]` for the first segment of every path (review 4, m6); the cut blinds the rest of each line too. Both over-mark and never leak.

**Stated limits.** Each is a path no route lines up with, logged as sent:
- a raw `/` in a plain param before the secret (`/o/a/b/k/SECRETx`): lining it up means letting a param take several segments, which makes every route with a param line up with most paths;
- a typo in a static segment, a homoglyph, a double encoding, `;jsessionid`, a trailing dot, `%20`;
- an extra leading segment (`/en/reset/SECRETx` on an app with no prefix param, a proxy base path left in place); the any-offset line-up that would catch it was removed in 4969a27e for predictability (principle 9), and this RFC keeps that decision;
- a secret `search` value in a link missing its `?` (`/callback&code=SECRETx`): the query is never logged, and the path segment is not a param.

**Peer failures.** A forward failure's `diag` is `peer unreachable: <name>`, the error's `name` read inside a try (`TypeError`, else `Error`), never its message. Marking the message would mean finding a path inside a URL inside free text.

**Spec and conformance.** k.privacy gains the rule as one Sinks bullet and widens its req path conformance bullet. k.server gains the last resort in Log and one conformance bullet. Paying for them moves pure schema text out of k.privacy into k.schema and the `frames` definition out of k.server into k.deploy, unchanged in meaning.

**Check rules.** None new. E1111 already refuses every secret route param in checked code. "A secret param must be the last segment" or "must not be the first" would only allow what E1111 refuses today, and the runtime still needs a rule for the tables check never sees. A startup warning at `createApp` for a front secret param is possible (review 4 suggests one); it is a new W code for a table E1111 already refuses, so this RFC leaves it out and the README states the over-marking.

## Alternatives
- Cut only when no route matched (red team 4's first option): a raw-slash secret that happens to match a longer plain route (`/reset/:a/:b`) keeps its tail; the rule also has to know the match result, which a forwarded path's front server reads from another deployable's table.
- On a 404 in a table with any secret param, write only the segments before the first param of any lined-up route (red team 4's second option): hides more of every 404 and still leaves the matched-path case.
- Mark each tail segment as its own `[secret]`: leaks the slash count of the value.
- Let a param absorb several segments to catch a raw `/` in an earlier param: every route with a param then lines up with most long paths, and the log loses its use.
- Any-offset and fuzzy matching (one-edit typos, NFKC, repeated decodes): tried in 3e8a60ae and removed in 4969a27e as unpredictable.
- Keep the forward message and run it through the path marks: the marks line up a pathname, not a URL inside a sentence.

## Spec diff
k.privacy (before 5,998 characters, 1,500 tokens; after 5,994 characters, 1,499 tokens). To pay for the change, the `piiPaths` and `piiValues` definitions, the `s.secret` derivations sentence, and the three conformance bullets on marked-schema derivations, `piiPaths` and `piiValues` move unchanged to k.schema, which owns derivations; the Server log bullet points to k.schema for `piiValues`. Whole new text of each changed paragraph:

Secrets (the sentence "`decodeStrings` reads the inner type. `gen` wraps a generated inner value; `doc()` is `secret<T>`." leaves):
```
**Secrets.** `s.secret(inner)` parses a raw `inner` value, or an existing secret, to a `Secret<T>` whose value is read only by `reveal(secret): T` (E1105). A secret never serializes: `encode`, `JSON.stringify`, `String()`, template literals and `util.inspect` give the marker `"[secret]"`; it has no own enumerable keys, so spread and `structuredClone` copy nothing. `parse` of the marker fails with rule `secret-missing`, so a store snapshot, `#k-state`, log or session capture never carries or restores the value. What `reveal` returns is plain data: a store, driver or log keeps it as written. A secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field (E1113, k.api).
```

Personal data (the sentence from "From `@keel/schema`, both pure:" to "undeclared keys and values." leaves):
```
**Personal data.** `schema.pii(class)` marks any schema node as personal data, in a `*.schema.ts` file. `PiiClass` is closed: `name` · `contact` (email, phone, handle) · `location` (address, coordinates) · `identifier` (government, account and customer numbers, birth dates) · `financial` · `special` (health, biometric, belief, ethnicity, orientation) · `network` (IP address, device id) · `content` (text a person wrote). The mark keeps the type and every derivation (`parse`, `encode`, `decodeStrings`, `gen`); the node gains `pii: class`, which covers every value under it; `doc()` appends ` pii(<class>)` and JSON Schema adds `x-keel-pii`.
```

Sinks, the Server log bullet and a new bullet after it:
```
- Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` (k.schema) of the request's decoded action input, its loaders' and actions' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`. A runner's `run` is scoped alike. Past 2,000,000 characters of these values' written forms or 100,000 secret values, a message after its prefix (`loader <id> threw: `), each frame and the path are one mark, `[secret]` if it holds a secret.
- `req` path, first: a segment at a secret `params` field of any route of `routes` (any deployable's) is `[secret]` as sent. A route lines up from the first segment, skipping empties (a prefix-param route also without it), to that param: a param fits any segment, a static one the same text once decoded and case-folded, or undecodable. A longer path is cut there: the rest joins that `[secret]`. A path no route lines up with (a static typo, an extra leading segment, a raw `/` in an earlier param, `&` for `?`) is logged as sent. A failed peer forward logs its error's `name` only.
```

Conformance: the bullets "For every generated schema with marked nodes, …", "`piiPaths` lists each marked leaf once …" and "For every generated value of a fixture schema, `piiValues` …" leave (to k.schema). The req path bullet becomes:
```
- A secret route param is `[secret]` in the `req` path, escaped any way, in `/%52ESET/<v>` and `//reset//<v>/`, with and without a prefix param, and forwarded to a peer; `/reset/ab/<v>` and `/confirm/a/<v>/done` (of `/confirm/:token/done`) log `/reset/[secret]` and `/confirm/[secret]`; `/en/reset/<v>` logs as sent; a failed forward logs no path. Past 100,000 secret values a loader's throw logs `loader <id> threw: [secret]`.
```

The list keeps the log and inputs sinks at their sixth and seventh places because k.evidence names them by number. Its order after the change: the secret bullet, the `doc()` bullet, the E1111 bullet, the revealed-secret throw bullet, the req path bullet (above), the marked-input `Error` bullet (log), the sim ctx `input` bullet (inputs), the E1113 bullet; all text unchanged except the req path bullet.

k.schema (before 5,072 characters, 1,268 tokens; after 5,988 characters, 1,497 tokens). Derivations gains the moved text:
```
**Derivations.** `User.parse(x): Result<User, SchemaError>` validates any input, also the JSON `User.encode(v)` gives · `gen(User)` fast-check arbitrary (`import { gen } from '@keel/schema/gen'`) · `User.doc()`. For `s.secret` (k.privacy), `decodeStrings` reads the inner type, `gen` wraps a generated inner value and `doc()` is `secret<T>`. Pure, for `.pii()` marks: `piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, `path` dotted with `*` for an array item or record value, the class its nearest mark's; `piiValues(schema, value)` gives, for a valid encoded value, each non-empty string and number (as `String()`) under a marked path, a marked record's keys and a marked open object's undeclared keys and values.
```
Conformance gains, after "Branded IDs are not assignable across brands.", the three bullets k.privacy drops, text unchanged:
```
- For every generated schema with marked nodes, `parse`, `encode`, `decodeStrings` and `gen` give what the unmarked schema gives.
- `piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object.
- For every generated value of a fixture schema, `piiValues` returns exactly the non-empty strings and the numbers under marked paths.
```

k.server (before 5,975 characters, 1,494 tokens; after 5,993 characters, 1,499 tokens). To pay for the change, the definition of a throw's `frames` and its conformance bullet move to k.deploy, which already owns `server.mjs.map` and the built-server `frames` case. Whole new text:

Log:
```
**Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (personal data dropped, k.privacy; a throw's `frames`: k.deploy), `csp` (k.security), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line. A throw past the handler's guards (a throwing `log.write`) is a bare 500 and one fixed `keel.unexpected` `diag` naming the matched route id, if any; if that write throws, one fixed stderr line, once per process. Neither holds a thrown or request value.
```
Conformance: the bullet "A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: …" leaves (to k.deploy); a new last bullet:
```
- A `log.write` that throws on the `req` record gives a 500 and one `keel.unexpected` `diag` naming the route id; one that always throws gives one fixed stderr line per process.
```

k.deploy (before 5,289 characters, 1,323 tokens; after 5,750 characters, 1,438 tokens). Build gains, after "never served.":
```
A thrown error's `diag` `frames` (k.server Log) are its first 5 stack positions in app code (E1576's), as `<path>:<line>:<col>` relative to the folder holding `artifacts`, a `server.mjs` position read through its map; without `artifacts`, none.
```
Conformance gains, before the built-fixture `frames` bullet, the k.server bullet, text unchanged:
```
- A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: at most 5, none under `packages/`, `node_modules/` or outside the folder holding `artifacts`; none without `artifacts`.
```

## Conformance diff
One `rfc:0123` commit by the `conformance-writer`:
- `packages/server/conformance/privacy-req-path.test.ts`: header quotes the new k.privacy req path bullet and the new Sinks bullet. New cases, each in dev and production, compact and json: `/%52ESET/<v>` and `//reset//<v>/` log `[secret]` at the param; a route `/:lang/acct/:token` logs `[secret]` with and without the `lang` segment; a route of a second deployable, requested at the front server, logs `[secret]`; `/reset/ab/<v>` logs `/reset/[secret]` and `/confirm/a/<v>/done` logs `/confirm/[secret]`, no line holding either half of `<v>`; `/en/reset/<v>` logs the path as sent (the stated limit, asserted so a change to it is an RFC); a peer whose fetch rejects with an error whose message holds the path logs a `diag` without it.
- New `packages/server/conformance/last-resort.test.ts`, citing the new k.server bullet: a `log.write` that throws on the `req` record makes `fetch` resolve 500 and logs one `keel.unexpected` `diag` holding the route id and no request value; with a `log.write` that always throws, two requests write one stderr line between them, and `fetch` never rejects.
- `packages/server/conformance/diag-frames-0095.test.ts:1`: the header cites k.deploy in place of k.server, same clause text.
- `packages/schema/conformance/privacy-pii-paths.test.ts:1`, `privacy-pii-values.test.ts:1`, `privacy-derivations.test.ts:1`: each header cites k.schema in place of k.privacy, same clause text.

## Migration
None for an app that passes `keel check`: E1111 keeps secret params out of its route tables. A table with a secret param logs a path longer than the secret route as cut at the secret segment; a log search for such a path's tail no longer finds it. A front secret param marks every path whole. A peer failure's `diag` names the error type and no longer quotes the runtime's message. Tests that assert the old tail (`packages/server/test/reqPathEscapes.property.test.ts`, `reqPathScrub.test.ts`, `reqPathForwarded.test.ts`) and the forward `diag` text (`forward.test.ts`) change with the build.

## Build order
1. Orchestrator: `spec/kernel/k.privacy.md`, `k.schema.md`, `k.server.md`, `k.deploy.md`. The `conformance-writer`: the conformance diff.
2. Lane A (server, sonnet): `secretSegments.ts` (the cut, its doc comment), `forward.ts` (the error's `name` through `attempted`), the comment at `createApp.ts:285` ("a served route" becomes "a route of `routes`"), `packages/server/test/**` (the probes above as property cases), `packages/server/README.md` (the rule paragraph: the cut, the over-marking, the four stated limits), changeset (`@keel/server` patch). Runs the server suite once and `pnpm budgets`; `@keel/server` is 23.75kb, and if the cut needs more, the raise is 0.25kb and stated.
3. Orchestrator: `docs/THREAT-MODEL.md` and `docs/COMPLIANCE.md` say a front server logs a forwarded path "as it came"; the server marks it by the whole route table, so both lines change to say so and name the stated limits. Ledger, backlog 0743, 0736, 0737, 0742, 0746, HANDOFF.

## Token impact
k.privacy 1,500 to 1,499 tokens (5,998 to 5,994 characters); k.server 1,494 to 1,499 (5,975 to 5,993); k.schema 1,268 to 1,497 (5,072 to 5,988); k.deploy 1,323 to 1,438 (5,289 to 5,750).

## Choices
Each is the drafter's recommendation; the operator can reverse any of them.
- C1: a path longer than a lined-up secret route is cut at the secret segment, whether or not a route matched; a longer served sibling path over-marks.
- C2: the cut tail is one `[secret]`, not one per segment.
- C3: a front secret param (`/:token`) marks every path whole, and no startup warning or new check rule is added; E1111 already refuses such a table in checked code, and the README states it.
- C4: a raw `/` in an earlier plain param, a static typo, an extra leading segment and a search value with no `?` stay stated limits, asserted in conformance so a change needs an RFC.
- C5: a forward failure logs the error's `name`, never its message.
- C6: to fit the budgets, schema derivation text moves from k.privacy to k.schema and the `frames` definition from k.server to k.deploy, unchanged in meaning.
- C7: backlog 0744 (the stderr line ignores `KEEL_FORMAT=json`) stays out of this RFC; the spec sentence says "one fixed stderr line" and does not fix its format.
