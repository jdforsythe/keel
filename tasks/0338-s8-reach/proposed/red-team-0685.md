# Red team: the single-pass scrub (commit 5c095d63)

Files: `packages/server/src/internal/{automatonOf,scrubbed,redacted,scrubbedCause}.ts`, with `createApp.ts` (diag sink) and `@keel/schema`'s `secretValues.ts` read for how sets fill. Probes ran as `packages/server/test/zz-probe.test.ts` (deleted), calling `scrubbed` directly or through an app built as in `test/redTeam0105.test.ts` (sim ctx seed 1337, production unless stated, json log), timed with `performance.now()`. Every timing below was taken with `pnpm mutate:status` at 0 running. One earlier run overlapped a mutation run and its worker died; that run is not used. `sec(vals)` is `[[new Set(vals), "[secret]"]]`. No probe left a copy of a value as written, JSON-escaped, URL-encoded or in base64 (see the fuzz below). The findings are about cost, mark choice and contract wording.

## Findings

### 1. medium: the cap does not bound the time. Every form of every value is made before the cap is checked, so a large set costs seconds and then marks everything
Probe (direct, one stable secret set, as `redacted` passes it):
```ts
const set = new Set(Array.from({ length: n }, (_, i) => `user${i}@example.com`));
const none = new Set<string>();
scrubbed("login failed for user7@example.com", [[none, "[secret]"], [set, "[pii]"]]);    // first text
for (let k = 0; k < 6; k++) scrubbed("frame /app/x.ts:1:1", [[none, "[secret]"], [set, "[pii]"]]); // cache hits
```
| n | first text | 6 cache-hit texts | result | rss |
|---|---|---|---|---|
| 100,000 | 185 ms | 10 ms | `[pii]` | 116 -> 209 MB |
| 300,000 | 650 ms | 40 ms | `[pii]` | 239 -> 365 MB |
| 1,000,000 | 2,340 ms | 240 ms | `[pii]` | 452 -> 646 MB |
| 2,000,000 | 4,936 ms | 561 ms | `[pii]` | 813 -> 1,152 MB |

Expected: the design's Bounds and Options table, "(c) automaton + size cap ... Build O(m log k), m ≤ 2,000,000"; the README, "Each text is read once, in steps linear in its length, however many values the request has". The brief's limit of one second for one request, with any number of values.
Actual: `build` runs `formsInto` for every value (UTF-8 encode, `btoa`, `JSON.stringify`, `encodeURIComponent`, fold, `Map.set`) and only then sums `m` and returns `"over"`. At 1,000,000 values that is 75,566,570 characters of forms, all thrown away. Each later text then pays `holds`, which is O(values) (about 40 ms a text at 1,000,000). The pii set holds loader outputs and store states, so the app's data, not the body, sets n. A 1 MiB body reaches only about 165,000 values (measured through an app: 164,445 numbers, 186 ms for the whole request, message `[pii]`). Reasoned, not run: the earlier regex code was also O(values) per build, so the cost per value is not new. What is new is that the cap is described as the backstop and does not stop it.
Fix: sum `m` while forms go into the `Map` and return `"over"` the moment it passes `CAP`. The sum of distinct forms only grows, so the early answer is exact. Cache `"over"` per secret set without `holds`, since a request's sets only grow and over stays over. Optionally record each set's size at build time and compare sizes, not contents. Add a step test: `count.forms ≤ CAP + longest form` on an over-cap set.

### 2. low: past the cap, a request whose only secret is a boolean or empty string is marked `[pii]`
Probe (app, production):
```ts
input: s.object({ flag: s.secret(s.boolean()), names: s.array(s.string()).pii("name") }),
throw new Error(`refused ${String(reveal(v.flag))} ${v.names[0]}`)
body: { flag: true, names: 2,000 × ("@".repeat(300) + i) }      // -> 500, diag message "[pii]"
// same with k: s.secret(s.string()) and k: ""                    // -> "[pii]"
```
Expected: k.privacy Sinks, "Past 2,000,000 characters of these values' written forms, the message and each frame are one mark, `[secret]` if the request made a secret."
Actual: `held = passes.find(([values]) => values.size > 0)`. `secretValues` leaves out booleans and `""`, so the secret set is empty and the mark is `[pii]`. Nothing leaks; the mark breaks the stated rule.
Fix: either word the sentence as "`[secret]` if the request's secrets hold a string or number", or have `noteRequestSecrets` record that a secret was made (a flag on the scope) and choose the mark from that.

### 3. low: the contract says a short value or bearer is marked inside words; the code marks a value of 1 or 2 units only as a whole token
Probe: `scrubbed("tokens xabx and ab-1 and ab", sec(["ab"]))` -> `"tokens xabx and [secret]-1 and [secret]"`.
Expected: THREAT-MODEL Bearer, "its text is scrubbed from that request's own log lines wherever it appears, inside words too"; README, the bearer is "a `Secret` whose revealed text no `diag` holds", and "Each value is matched as written". No contract text states the whole-token rule.
Actual: the test `i + 1 - at < 3 && (word(...) || word(...))` in `scrubbed.ts` (carried over from `matcherOf`) keeps `ab` in `xabx`. The value is under 3 units, so this is not a weight-1 finding, but the code and the contract disagree.
Fix: state the rule in the README log paragraph and in k.privacy ("a value of 1 or 2 code units is replaced only where it stands as a whole token"), and change THREAT-MODEL Bearer to match. This also settles 0663.

### 4. low: a short form that ends in a lone high surrogate, or starts with a lone low one, splits a pair in the text
Probe:
```ts
scrubbed("say 😀 ok", sec(["\ud83d"]))    // -> "say [secret]\ude00 ok"
scrubbed("say a😀 ok", sec(["a\ud83d"]))  // -> "say [secret]\ude00 ok"
scrubbed("say 😀 ok", sec(["\ude00"]))    // -> "say \ud83d[secret] ok"
```
Expected: the whole-token rule as the earlier `/u` lookarounds applied it, by code point. A match that ends inside a pair is not at a code-point edge.
Actual: `word(message, i + 1)` reads the code point that starts at the trailing low surrogate. That is the lone surrogate itself, which is not `\p{L}`, so the token test passes in the middle of a pair. The log then holds half of an ordinary emoji or letter. This needs a lone-surrogate value, which a client can send in JSON for its own request.
Fix: in the token test, treat a match whose last unit is a high surrogate followed by a low one (or whose first unit is a low surrogate preceded by a high one) as not at a token edge.

### 5. low: a padded base64 copy leaves its `==` when a longer form ends at the same unit
Probe:
```ts
const w = "hunter2!xy";                                         // 10 bytes, base64 aHVudGVyMiF4eQ==
scrubbed("m aHVudGVyMiF4eQ== x", sec([w]))                      // -> "m [secret] x"
scrubbed("m QaHVudGVyMiF4eQ== x", sec([w, "QaHVudGVyMiF4eQ"]))  // -> "m [secret]== x"
```
Expected: README, "A padded copy goes with its `=` padding, in either alphabet."
Actual: at each end only the longest valid match is kept, and its padding count (0 here) is the one used. The shorter base64 form's count of 2 is lost. This is contrived, since one value must end with another's base64, and nothing of a value is readable.
Fix: store on each node, at build time, the largest padding count along its out chain, and take that when the match is read.

## Proposed backlog lines (`## Red team`)
- 0705 server (medium): forms of every value are made before the 2,000,000 cap is checked; 1,000,000 pii values cost 2,340 ms for the first text, then `[pii]`; each cached text costs O(values) (`holds`). Stop forming at the cap; keep "over" per set without `holds`.
- 0706 server: past the cap, a request whose only secret is a boolean or `""` is marked `[pii]`; k.privacy says `[secret]` if the request made a secret.
- 0707 docs: THREAT-MODEL Bearer "inside words too" and README "matched as written" against the whole-token rule for 1 to 2 unit values.
- 0708 server: a short lone-surrogate form is marked inside a pair (`"say 😀 ok"`, secret `\ud83d` -> `"say [secret]\ude00 ok"`).
- 0709 server: `==` kept when a longer form ends at the same unit as a padded base64 copy.

## Probes that held
- 0685 #1 direct: 34 ms (build 1,183,465 steps, walk 1,039,000 for 520,000 units). 0685 #3: 29 ms, `[secret]`.
- 0685 #2 app (1,026,020-byte body): 500 in 61 ms production, 39 ms dev, message `action app.a threw: Error: login failed for aaaa…`, keys marked.
- 0680 400,000 run vs 400,001-unit secret: 37 ms, unchanged. `"ab"` periodic 400,000: 45 ms, unchanged.
- 0670: 20,000 keys, message plus 8 frames: 76 ms in all, `refused [secret]`, `/app/x/[secret]/f.ts:1:0`.
- 0686: `"Error: node code index under content until total today mode"` with `81`: unchanged; `pin [secret] sent`, `line [secret]`.
- 0687: `ı`+k at 998, 999 and 1,000 gives `< [secret] >`. `ᾈ`/`ᾀ` at 999, 1,000 and 1,001: marked. A lone low surrogate opening a 1,001-unit form gives `"< \ud801[secret] >"`. Padded base64url gives `m [secret] x`. (`ﬅ`/`ﬆ` stays, as the design accepts.)
- Cap through an app (`"@"×300+i` secrets, production): 10 values (m 16,040) give `refused [secret]`. 1,000 (m 1,609,670) and 1,100 (m 1,771,070) give `refused [secret]` in 21 and 27 ms. 2,000 (m 3,223,670) give `[secret]` in 35 ms. No line holds `@@@`.
- 130,000 two-unit CJK values: over the cap (m 2,671,154), 141 ms. 1,000 values of 340 `€` against 340,000 `€`: `[secret]`, 65 ms.
- Worst build under the cap: 153,000 two-unit Latin-1 values (m 1,478,061), 203 ms, rss +101 MB. 100,000 four-unit values with a space (m 1,412,129), 159 ms.
- 520,000 units where every position ends a failing short form (`a`, `ab`, `ba`): 19 ms.
- Fold table over all 65,536 units: idempotent. A unit, its one-unit upper case and its one-unit lower case share an image. Inside `a?a`, a whole-string case change gives no unit that differs.
- Surrogate fuzz (fast-check seed 1337, 5,000 runs; lone high and low, astral, case pairs, `=`): no throw, no value of 3 or more units between marks.
- Forms fuzz (seed 1337, 20,000 runs). Secrets and pii, with the text holding each value as written, JSON, URL, padded, unpadded and url-safe base64, and per-unit upper or lower case: 0 copies left once astral case variants are excluded. With them included, all 1,338 hits were Deseret `𐐀`/`𐐨`, which the README excludes.
