# Lane A proposals: 0739, 0746 with 0760, 0753, 0754

Built in this lane (no proposal needed): 0744 (`logUnwritable` writes its record in the log's format through `diagLine`) and 0755 (`errorName` gives only a runtime error name, else `Error`). k.privacy's "A failed peer forward logs its error's `name` only" still holds: the allowlist logs less, never more.

## Section budget

`spec/kernel/k.privacy.md` is 5,994 characters, 1,499 tokens (ceil(chars/4)), against a limit of 1,500. Every proposal below adds text, so taken together they need room. The full set below, with these three moves, comes to 5,959 characters, **1,490 tokens**:

- Move "- Evidence bundle (k.evidence): holds no app value." to k.evidence (quoted by `packages/cli/conformance/evidence-no-pii.test.ts` line 2; its header then quotes k.evidence).
- Move "In dev, `/__keel/inspect` serves store values unredacted; it is not a sink." to k.server (no conformance header quotes it).
- Move the E1111 clause "a package's exported route table or schema is the package's, as is the schema returned by an export on the checker's closed audited list, which refuses a marked column (`tableSearch`, `@keel/std-tables`)" to k.check's E1111 entry (no conformance header in a package quotes it; check the `@keel/check` E1111 tests' headers before the move).

Without the moves only one of the four fits. Which moves to make is the user's call.

## 0739: a revealed value changed in place is never walked again

Reproduction: `packages/schema/test/revealFrozen.test.ts` (`Object.isFrozen(reveal(v))` and of a nested array are `false`) and `packages/server/test/revealMutated.test.ts` (in one scope: `reveal(sec).token = "rotated-token-5678"`, reveal again, then the scrub of `threw with rotated-token-5678` leaves it raw). Both are `test.fails`.

Cause: `noteRequestSecrets` walks each `Secret` once per scope (`notedSecrets`), and `Secret.of` freezes the `Secret`, not its value.

Options:
- A. Deep-freeze the value in `Secret.of`: once revealed, a value cannot change, so one walk per scope is exact, including a change after the last reveal. The value is frozen even where `seal` passes the caller's own object through (`s.secret(s.json())` keeps the input reference), so the caller's object is frozen as well. App code that writes into a revealed object throws a `TypeError` in strict mode. Measured: **+40 bytes** gzip on `@keel/schema` (5,323 to 5,363 of 5,632). The 11 cases in `secret.test.ts` stay green.
- B. Walk again on every reveal (drop `notedSecrets`): this fits today's spec text and saves bytes in `@keel/server`. It misses a change made after the last reveal, and a loop that reveals a large secret N times costs N walks.
- C. Keep each scope's revealed `Secret`s and walk them at every scrub: exact, but costs a walk per record and more server bytes than are left.

Recommendation: A. It fails closed, and the cost lands in schema, which has room.

Spec, k.privacy Secrets. Today: "What `reveal` returns is plain data: a store, driver or log keeps it as written." New: "What `reveal` returns is plain data, frozen deep: a store, driver or log keeps it as written."
Conformance, the first k.privacy bullet. Today: "parsing a raw value yields a secret revealing it;" New: "parsing a raw value yields a secret revealing it, frozen deep;". The header of `packages/schema/conformance/secret.test.ts` quotes this bullet. Cases: for every generated secret over an object or array inner, `Object.isFrozen` is `true` for the revealed value and for each object and array under it; `Reflect.set(reveal(x), "k", 1)` returns `false`; a string inner is unchanged.
Code: a `freeze` walk over `Reflect.ownKeys`, called on `value` in `Secret.of`. Once A lands, the server needs nothing more and the `revealMutated` test passes.

## 0746 and 0760: a route led by a param over-marks

Reproduction: `packages/server/test/reqPathLimits.test.ts`, which passes and pins today's build. With `/:token`, `/about` and `/about/team` log `/[secret]`. With `/:lang/:token`, `/about` and `/en/A` log `/[secret]`. With `/:p/:tok`, `/en/A` and `/A` log `/[secret]`.

What the texts say: the build matches k.privacy ("a prefix-param route also without it", "A longer path is cut there") and the server README ("lines up with every path, so every path of two or more segments logs as one `[secret]`"). Only RFC 0123's cost paragraph says "(or `/en/[secret]`)". That reading is the route lined up without its lead: `en` is the secret, `A` is a tail, and the earliest cut wins. A secret holding a raw `/` with the lead left out (`/A/rest`) needs that cut.

Options:
- A. Keep the build, and state the over-mark in the spec and conformance.
- B. Mark `/en/[secret]` by lining up a led route without its lead only when the path is shorter than the route. That leaks `rest` of `/<tok-part>/rest` when a token holds a raw `/` and the prefix is omitted.

Recommendation: A, at no byte cost. The RFC 0123 parenthetical is wrong. The RFC set describes history and is reset at 1.0, so correcting it is optional; the spec carries the truth.

Spec, k.privacy `req` path. Today: "A longer path is cut there: the rest joins that `[secret]`." New (together with 0754): "A longer path, or one whose segment holds `%2F` or `%5C`, is cut there: the rest joins that mark. A route led by its secret, or by a param then its secret, lines up with every path."
Conformance (see the combined bullet under 0754): `/about` of `/:token` logs `/[secret]`; `/en/A` of `/:p/:tok` logs `/[secret]`. The header of `packages/server/conformance/privacy-req-path.test.ts` (line 3) quotes the changed sentence.

## 0753: `.pii()` route params are logged raw

Reproduction: in `reqPathLimits.test.ts` (`test.fails`), route `/u/:email` with `email: s.string().pii("contact")`, served in production. It logs `GET /u/alice@example.com app.who 200 0ms` and `GET /u/alice%40example.com app.who 200 0ms`. E1111 refuses this table in checked code; the runtime is the backstop for tables check does not read.

Options:
- A. Positional, like secrets: a segment at a `.pii()` params field of any route is `[pii]` as sent, using the same line-up and cut; `[secret]` wins where both apply. This also covers a 404 or a typo. Not measured; estimated at +50 to +70 bytes on `@keel/server`, which with 0754 A is over the 53 left after this lane's builds.
- B. Note the matched route's decoded params into the request's pii set (`notePii(rq.pii, def.params, m.params)` in `handle.ts`). Measured: **+11 bytes**. The prototype made the reproduction pass, and both forms are marked through the scrub's URL-encoded match. A path that matches no route, or whose params fail, stays raw.

Recommendation: A. It fails closed and gives one rule for both marks (principle 1). If the budget is not raised, B now as the floor, with A on the backlog. The budget is the user's call.

Spec, k.privacy `req` path. Today: "is `[secret]` as sent." New: "is `[secret]` as sent, one at a `.pii()` field `[pii]`." (For B, the Server-log bullet instead: "of the request's matched route params, decoded action input, …")
Conformance, as part of the combined bullet: route `/u/:email` with `.pii("contact")`, compact and json, dev and production. `/u/alice@example.com` and `/u/alice%40example.com` log `/u/[pii]`, and no line holds `alice`. (A only:) `/u/alice@example.com/x` logs `/u/[pii]`, and `/U/alice@example.com` with route `/u/:email` logs `/U/[pii]`.

## 0754: an encoded separator is logged as sent

Reproduction: in `reqPathLimits.test.ts` (`test.fails`), table `/reset/:token` (secret). `/reset%2FSECRETx`, `/reset%2fSECRETx`, `/RESET%2FSECRETx` and `/reset%5CSECRETx` come back as sent. The spec's stated limits do not name this case.

Options:
- A. When the table has a secret param, cut the path at the first non-leading segment holding `%2F` or `%5C` in either case. That segment and the rest become one mark (`/[secret]`). Measured: **+28 bytes**. Over-marks an app path with an encoded slash in it, which is rare.
- B. Line up on each segment's decoded form split at `/` and `\`. This is more precise but costs more bytes and adds a second line-up rule.
- C. Add it to the stated limits, with a conformance case.

Recommendation: A. It is the smallest change, it fails closed, and it needs no second rule.

Spec: see the sentence under 0746 ("or one whose segment holds `%2F` or `%5C`").
Conformance, k.privacy bullet 5. Today: "`/en/reset/<v>` logs as sent;" New: "`/en/reset/<v>` logs as sent; `/reset%2F<v>` and `/about` (of `/:token`) and `/en/A` (of `/:p/:tok`) log `/[secret]`; a `.pii()` param is `[pii]`;". Cases for 0754: `/reset%2F<v>`, `/reset%2f<v>`, `/RESET%2F<v>` and `/reset%5C<v>` of `/reset/:token` log `/[secret]`, and no line holds `<v>`. In a table with no secret param, `/files/a%2Fb` logs as sent.

## Budget summary (`@keel/server` 24,320 bytes max)

After this lane's builds: 24,267 bytes (53 left; `errorName` keeps the six names of the backlog line only). 0753 B (+11) plus 0754 A (+28) fit, at 14 left. 0753 A (est. +50 to +70) does not fit beside 0754 A without a budget raise or a trim, the user's call. 0739 A: nothing in server, +40 in schema (269 left after).
