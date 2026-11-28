# Design: the scrub's cost (0685)

Node v24.19.0 on this machine. The prototype is plain JS in a session scratch directory (`scrub0685/`) (`ac.mjs`, with the scripts `check`, `time`, `time2`, `diff`, `prop` and `steps`). Today's code was timed by importing `packages/server/src/internal/scrubbed.ts` into the same Node. No app was booted and no suite was run. **Measured** means a number taken here; **estimate** means one reasoned from measured parts.

## Recommendation
One Aho-Corasick automaton over every written form of both sets (secret and pii) replaces the regex batches, the KMP scan and `folded`. It is built once per pair of sets and walked once per text, one code unit at a time, so each text costs a fixed number of steps per character however many values there are. A cap on the automaton's size is the backstop: past 2,000,000 characters of distinct forms, no automaton is built, and the message and each frame are written as one mark. This is option (c) below.

## Options

| | (a) automaton alone | (b) work budget on today's code | (c) automaton + size cap | (d) cap on values, rest unmarked |
|---|---|---|---|---|
| Time per text | O(n log σ) | O(B) by construction, B the budget | O(n log σ) | O(N·n) |
| Build | O(m log k) | today's | O(m log k), m ≤ 2,000,000 | today's, bounded by N |
| Memory | O(m), about 27 B per trie node, unbounded | today's | ≤ 55 MB at the cap (measured 53 MB at m = 1,985,600) | bounded |
| A 1 MiB body forces | m up to about 8,000,000 (a value of `@` or `€` has a 3 to 9 times larger URL form), so about 200 MB (estimate) | the whole record marked at modest sizes | at most the cap; past it, one mark | a leak (below) |
| Code | about 120 lines replace 203 | +10 lines, three paths kept | about 125 lines replace 203 (prototype: 148 with instrumentation) | +5 lines |
| 0687 fold split | closed | open | closed | open |

n is the text length, m the total length of distinct folded forms, k the number of forms, σ the number of distinct units after a trie node (binary search, at most 16 compares).

**(b)** keeps the three paths that each broke once. A regex batch re-runs at each start it matches, so the budget must count form length too. A budget that keeps a record under 100 ms (about 10^8 steps) marks whole records in ordinary apps, for example 1,000 pii values against a 30,000-character message. **(a)** has no memory bound, and the pii set is not limited by the body, since it holds loader outputs and store states. **(d)** breaks the promise. The input is decoded before anything is minted, so a client can fill the set with its own secrets first; a minted token or `bearer` then falls past the cap and is written raw. A cap must fail closed, as in (c).

## The design

**Forms.** Each value `v` has these forms. As written, JSON-escaped, and `encodeURIComponent` when `v.isWellFormed()`, as today. For base64 of the UTF-8 bytes (`Buffer.from(v)`): under 8 bytes, the padded form only (0686 unchanged). From 8 bytes, the unpadded standard form, and the unpadded URL-safe one when they differ, each tagged with its padding count p. A match of a form tagged p takes in up to p `=` that follow, so a padded copy in either alphabet goes whole with one form fewer (0687). Forms are folded and kept once each in a `Map` to their flags (secret, pii, padding).

**Fold.** Case-insensitive means letter case in the Basic Multilingual Plane, one code unit at a time. A 65,536-entry `Uint16Array`, built on the first scrub (4 ms, measured), maps a unit to its upper-then-lower case when that is one unit, else its lower case when that is one unit, else itself. Surrogates map to themselves. Forms and text go through the same table, so a copy as written is always found: its units' images stand at the same index. That holds by construction, and it is why a form starting with a lone low surrogate is found where the text pairs it (0687). Measured over all 65,536 units, the map is idempotent, and a unit, its upper case and its lower case share an image. It differs from `/iu` in a few pairs, which no longer matters with one path: `ı` matches `i` (over-marks), and, measured, `ﬅ` does not match `ﬆ` and Deseret `𐐀` does not match `𐐨` (letters outside the BMP match only as written). Base64 forms are folded too. Base64 is case-sensitive, so this can only over-mark a string of 11 or more characters that differs only in case; it never leaves one readable. An exact second automaton would avoid it for about 10 lines and a second lookup per unit.

**Automaton.** The folded forms are sorted (native code-unit order). One pass over them, using each form's common prefix with the one before, builds the trie in preorder into typed arrays (`label`, `depth`, `parent`, `term`). Each node's children then sit side by side in label order in `kids`, so `go(s, c)` is a binary search. Failure links are set breadth-first, and `out[x]` is `x` when it ends a form, else `out[fail[x]]`. No `Map` holds edges and nothing grows during a walk.

**Walk.** For each text unit, follow `go` and failure links to the next state, then read `t = out[s]`. A form of 3 or more units is the match ending here. A shorter one counts only as a whole token (no `\p{L}\p{N}_` code point right before or after); if it fails, try `out[fail[t]]`, at most 3 reads in all. Only the longest valid match at each end is kept: any other ends there too and lies inside it, so neither the run nor its longest changes. Runs are a stack of disjoint intervals; a match starting before the top run's end merges into it, and on down. The run's mark is its longest match's, `[secret]` on a tie, and a string in both sets is one node with both flags. These are today's overlap rules exactly. Marks go in by `slice` and `join`.

**Cap.** m is the summed length of the distinct folded forms, known before building. Past 2,000,000, every text of the request (message, frames, dev cause) is returned as one mark, `[secret]` if the secret set holds a value, else `[pii]`. It fails closed.

**Cache and files.** One automaton per pair `(rq.secrets, rq.pii)`, in a `WeakMap` keyed by the secret set, built again only when either set holds a value it was not built from (today's rule). A record's message, frames and cause share one build. `scrubbed(message, passes, count?)` keeps its signature plus an optional test-only `count: { build; walk; forms }`; `redacted` and `scrubbedCause` do not change. `matcherOf.ts` and `folded.ts` go; a new `automatonOf.ts` holds forms, fold, build and cache.

**Bounds.** The walk takes at most 5n steps: 2n for transitions and failure links (failure links never outnumber transitions) and 3n for output reads. Each step is one binary search of 16 or fewer compares. The build is O(m log k) for the sort and O(m) for the trie and links. Memory is about 27 bytes per node, with at most 2,000,001 nodes.

**Code size**, measured minified and gzipped alone: today's three files 1,426 bytes concatenated, the prototype 1,719. **Estimate:** the built version adds 100 to 300 bytes, and `@keel/server` has 118 bytes of room (22,410 of 22,528).

## Evidence
Prototype with the 2,000,000 cap and a warm fold table. Today's code is in the right column. All numbers are **measured**, calling the scrub directly and not through an app.

| Probe | Prototype | Today |
|---|---|---|
| 0685 #1: 500 values `a`×1,000 + 9 digits, text `a`×520,000 | 18 ms (build 13, walk 5; 2.0 steps/char) | 2,212 ms |
| 0685 #3: 256 values `a`×(999−i), text `a`×400,000 | 13 ms (3.0 steps/char) | 1,765 ms, 469 MB heap |
| 0680: `a`×400,000 vs secret `a`×400,000+`b` | 49 ms (nodes 933,337; 25 MB) | 63 ms |
| `"ab".repeat(200000)` vs its text less one | 45 ms | 69 ms |
| 50 secrets with a 20,000 `k` prefix | m = 2,334,270, over the cap: `[secret]`, 15 ms (under a 4,000,000 cap: marked exactly, 42 ms) | 201 ms |
| 20,000 short secrets, 10 texts (message + frames) | 66 ms in all (one build) | 1,043 ms |
| 130,000 two-character values | 149 ms (build 148) | 545 ms |
| 175,000 three-character values (the most a 1 MiB body holds) | 113 ms | not run |
| 3,400 random 250-character values (m = 1,985,600, just under the cap) | build 99 ms, walk 4 ms, arrays 53 MB, ArrayBuffers +69 MB | not run |
| 1,000 values of 340 `€`, text of 340,000 `€` | over the cap (m = 4,769,670): `[secret]`, 26 ms | 1,682 ms |

**Estimate** for 0685 #2, the app probe (a 1,026,020-byte body, 4,340 ms today): one build (13 ms, as #1) plus walks of the 520,000-character message and of the dev cause (about 5 ms each) and of five short frames. That is about 25 ms of scrub; body parsing is not counted.

**Behaviour, measured.** `check`: 41 cases pass, namely today's unit expectations, the 0686 words, and the 0687 cases (`ı`/`i` and `ᾈ`/`ᾀ` at 999, 1,000 and 1,001 units, a lone low surrogate opening a 1,001-unit form, padded base64url). `diff`: 8,000 random cases against today's `scrubbed`, 0 differ. `prop`: 3,000 cases over lone surrogates, astral pairs, `ß`, `İ`, `ς`/`Σ`, `ﬅ`, `ı`, `=`, `\`, `"`, `%`, with no copy as written left and nothing thrown. `steps`: at most 2.95 walk steps per text character and 2.33 build steps per form character.

The worst time under the cap is about 150 ms of build, once per request set. That is per-form JS work (encoding, fold, `Map`, sort), linear, not quadratic. A lower cap does not shorten it.

## What tests prove without a clock
1. **Linear steps.** For generated sets and texts (fast-check, seed 1337), `count.walk ≤ 5 × text.length + 5` and `count.build ≤ 4 × count.forms + 2 × k`. This replaces the three `matcherOf(set).long` checks in `redTeam0105.test.ts`.
2. **One pass.** `count.walk` for one text with 1 value and with 20,000 values differs by at most 3 per character (the output reads). That is the structural claim, as a test.
3. **No copy left.** For any values (surrogates, astral pairs, case pairs) and a text holding a form of one as written, no piece between marks holds a value of 3 or more units.
4. **Exact cap.** Forms totalling 2,000,000 are scrubbed; one more character makes every text one mark.

## Spec
**k.privacy, Sinks, Server log bullet**, appended after "An action's `output` counts as a loader's.":
> Past 2,000,000 characters of these values' written forms, the message and each frame are one mark, `[secret]` if the request made a secret.

Trimmed from the Secrets paragraph to make room:
1. Removed: "`credentials(ctx)` of `@keel/std-credentials` keeps a credential as a hash (std.credentials) or a token digest (std.tokens)." std.credentials and std.tokens own it.
2. "A `loader` or `action` `output` holds no `s.secret` (E1113); a secret leaves as `reveal(secret)` in an `s.string()` field (k.api)." becomes "A secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field (E1113, k.api)." E1113 keeps its Rules entry and Conformance bullet.

Measured by `Math.ceil([...text].length / 4)`: 1,500 now, 1,498 after. No Conformance bullet fits, so the conformance writer cites the Sinks sentence. k.server is unchanged; its Log paragraph defers to k.privacy.

**Server README** log paragraph: "A value over 1,000 characters is found by a scan linear in the text and the value" becomes "Each text is read once, in steps linear in its length, however many values the request has; past 2,000,000 characters of distinct written forms, each text is written as one mark". After "case-insensitively" add "(letter case in the Basic Multilingual Plane, one code unit at a time, base64 included, so a near copy may be over-marked, never missed)", and say a padded copy goes with its padding in either alphabet. **THREAT-MODEL** Secrets, after "a minted token": "(past the scrub's size cap, each `diag` is written as one mark)". **RFC 0105** gets an Amendment entry, and the PR is `rfc:0105`.

## Other findings in this code
- **0687:** closed. One fold and one path; the per-unit fold finds a lone low surrogate; padding goes in both alphabets; base64 case is closed by decision 2.
- **0672** (a live stream's set grows): partly. Each rebuild is bounded by the cap, but the `Set` still grows. Bounding it needs the noter to stop adding past the cap and mark the request as over (`RequestScope.secretsOver`, about 6 lines), so later records are one mark. Follow-up.
- **0682** (keys inside a secret): open. Proposal: `seal` passes the inner node to `Secret.of(value, node)`, kept in a private field. `secretValues` then walks node and value with the `piiValues` walk as if marked from the root, through one internal `markedValues(node, value)` that also descends into nested secrets. A `record`'s keys, an open object's undeclared keys and `json` keys are data; declared field names are not. That is its own schema-lane change.
- **0683** (other encodings): open. An extra form now costs m, not a pass. Next candidate: the form-urlencoded form (`+` for a space).
- **0671** (the listener cleared) and **0663** (a short bearer blanks text inside words): untouched, open.

## Build plan for tomorrow
1. **Spec and docs** (sonnet) owns `spec/kernel/k.privacy.md` (measure tokens after), the server README, `docs/THREAT-MODEL.md`, the RFC 0105 Amendment and a `@keel/server` changeset.
2. **Conformance writer**, after lane 1, from the Sinks sentence, owns `packages/server/conformance/privacy-secret-reach.test.ts`. Over the cap: input `{ keys: s.secret(s.array(s.string())) }` gets 2,000 values `"@".repeat(300) + i` (about 610 KB; URL forms alone pass 1,800,000), and the action throws `Error("refused " + reveal(keys)[0])`. In dev and production the `diag` message and each frame are exactly `[secret]`, and no line holds `@@@@`. Under it: 10 such values log `refused [secret]`, with frames keeping their paths.
3. **Server** (opus) owns `automatonOf.ts` (new), `scrubbed.ts`, the removal of `matcherOf.ts` and `folded.ts`, `test/redTeam0105.test.ts` (step bounds in place of `matcherOf`), and a new `test/scrubSteps.test.ts`. That file holds the four proofs above and these cases, each `[secret]`-marked unless stated:
   - `"m " + "a".repeat(400000)`, secret `"a".repeat(400000) + "b"`: unchanged.
   - `"ab".repeat(200000).slice(0, -1)`, secret `"ab".repeat(200000)`: unchanged.
   - 0685 #1: unchanged. 0685 #3: `[secret]`.
   - 50 values with a 15,000 `k` prefix: `${p.repeat(10)} [secret] end`. With a 20,000 prefix: `[secret]`.
   - `"< \ud801\udc00" + "k".repeat(1000) + " >"`, secret `"\udc00" + "k".repeat(1000)`: `"< \ud801[secret] >"`.
   - `"< ı" + "k".repeat(n) + " >"`, secret `"i" + "k".repeat(n)` for n of 998, 999 and 1,000: `"< [secret] >"`.
   - `"m " + base64url("??>?hunter") + "== x"`: `"m [secret] x"`.
   - `81`: `"node code mode"` unchanged, `"pin 81 sent"` gives `"pin [secret] sent"`.
   - `"joined aaaa-bbbb-cccc"`, secrets `aaaa-bbbb` and `bbbb-cccc`: `"joined [secret]"`.
   - `"abcd-1234-9876"`, secret it, pii `1234`: `[secret]`.

Order: lane 1, then 2, then 3. Lane 3 may write unit tests while lane 2 runs, and ends with conformance green. Verify one file at a time:
```
pnpm --filter @keel/server exec vitest run test/scrubSteps.test.ts
pnpm --filter @keel/server exec vitest run test/redTeam0105.test.ts
pnpm --filter @keel/server exec vitest run test/privacyScrub.test.ts
pnpm --filter @keel/server exec vitest run conformance/privacy-secret-reach.test.ts
pnpm --filter @keel/server exec vitest run conformance/privacy-diag-scrub.test.ts
pnpm check && pnpm build   # voice lint, size budget
```
Before done, a red-team pass re-runs these through an app, as in `redTeam0105.test.ts`, in a probe file deleted afterwards:
- the three 0685 probes, where the app one must answer in well under a second;
- 0680's 400,000 run and 0670's 20,000 keys with 8 frames;
- the 0686 words and the five 0687 cases;
- bodies just over and just under the cap;
- 130,000 two-character values and 1,000 `€` values;
- a surrogate fuzz.

## The user's decisions
1. **The cap, and a k.privacy sentence for it.** Recommended: 2,000,000 characters of forms, failing closed to one mark, stated in k.privacy as above. The alternative is the README only, so an operator could not find the rule in the contract.
2. **Base64 matched without regard to case.** Recommended: keep it; it only over-marks.
3. **Astral letters matched only as written.** Recommended: accept; per-unit folding is what makes lone surrogates safe by construction.
4. **The `@keel/server` budget.** Recommended: re-base 22kb to 22.5kb if the build lands over, with the measured number in the commit.
5. **0672's set growth.** Recommended: the over flag as a follow-up, not in this change.
