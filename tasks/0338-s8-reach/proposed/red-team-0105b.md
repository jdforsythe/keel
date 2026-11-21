# Red team: the log scrub rewrite (commit 33de6a9f)

Files: `packages/server/src/internal/{matcherOf,scrubbed,redacted,noteRequestSecrets}.ts`, `packages/schema/src/internal/secretValues.ts`. Probes ran as `packages/server/test/zz-probe.test.ts` (deleted), calling `scrubbed` directly or through an app built as in `test/redTeam0105.test.ts` (sim ctx seed 1337, production, json log).

## Findings

### 1. high: a long value is matched once per start, so one request stalls the event loop for tens of seconds (quadratic `hits`)
Probe:
```ts
const input = s.object({ user: s.string(), password: s.secret(s.string()) });
// action: async (v) => { throw new Error(`login failed for ${v.user}`) }
await app.fetch(post(JSON.stringify({ user: "a".repeat(400_000), password: "a".repeat(400_000) + "b" })));
// → 500 after 26,449 ms, synchronous
scrubbed(`m ${"a".repeat(n)}`, [[new Set(), "[secret]"], [new Set(["a".repeat(n)]), "[pii]"]]);
// n = 20k: 34 ms, 100k: 815 ms, 200k: 3,312 ms (x4 per doubling); "ab".repeat(50_000): 410 ms
```
Expected: server README log paragraph, "no value makes the scrub throw"; the brief's "the scrub never ... hangs or takes seconds"; RFC 0105 Risks (cost paid only when a record is written, bounded by the set).
Actual: for a form over 1,000 code units `chained` matches the first piece with `g`, then `hits` sets `from = m.index + 1` and re-runs the head and every sticky tail piece at each next start. Text with a long run equal to the value's period (any repeated character) costs about n²/2 compares. The secret need not appear in the log: only the head piece has to match, and the logged field (`user`) carries no mark. Within the 1 MiB default body the extrapolation is about 90 s for one record, and `redacted` runs again for each frame.
Fix: in `hits`, after a hit of a single-value probe at `at`, the next start where that value can match is `at + p`, with `p` the value's smallest period (precomputed once per form with the KMP failure table). Start positions between `at + 1` and `at + p - 1` cannot match, so skip them: test `at + p` with sticky probes, and if that fails resume the `g` search at the old hit's end minus the form length plus one. Or match long forms with a KMP/Z scan in O(n + m). Add a conformance case with a 200,000-character periodic value and a time bound.

### 2. medium: an unpadded or base64url form of a secret is left readable
Probe:
```ts
const one = (m: string, v: string) => scrubbed(m, [[new Set([v]), "[secret]"]]);
one(`m ${btoa("hunter2").replace(/=+$/, "")}`, "hunter2");                  // → "m aHVudGVyMg"
one(`m ${Buffer.from("??>?hunter").toString("base64url")}`, "??>?hunter"); // → "m Pz8-P2h1bnRlcg"
```
Expected: README, "Each value is matched as written, URL-encoded ..., JSON-escaped and base64".
Actual: the base64 form is matched only with its `=` padding and the `+/` alphabet. Unpadded base64 and base64url (JWT parts, `Buffer#toString("base64url")`, most token libraries) give the full value back with one decode. A secret whose length is a multiple of 3 and has no `+`/`/` in its encoding is marked; every other one is not.
Fix: in `formsOf`, use the base64 form with its trailing `=` removed (that also matches the padded text, leaving only the `=` behind), and add the same form with `+/` mapped to `-_`.

### 3. medium: an object key inside a secret is never marked
Probe:
```ts
secretValues(s.secret(s.record(s.string())).parse({ tok_live_ABCDEF123456: "x" }).value); // → ["x"]
secretValues(s.secret(s.json()).parse({ sk_live_KEY9999: true }).value);                  // → []
```
Expected: k.privacy Sinks / README, "each string or number in it at any depth".
Actual: `secretValues` reads `Object.values` only, so a key of an `s.record` or `s.json` secret, which is client data, is written raw in any diag that holds it (for example `JSON.stringify` of the revealed object).
Fix: inside a secret, also push each `Object.keys(v)` entry of a non-array object (non-empty, not the index of an array). Or state in k.privacy that keys are not marked.

### 4. low: forms a log commonly holds are not matched (form encoding with `+`, `encodeURI`/URL paths, double-encoding, ASCII `\u` JSON, nested JSON)
Probe (`S = "p@ss w/rd!'é\"<>&\n"`, the secret set `[S]`):
```ts
new URLSearchParams({ q: S }).toString()          // → "q=p%40ss+w%2Frd%21%27%C3%A9..." unmarked
encodeURI(S); new URL("https://h/hunter 2/x").href // "p@ss%20w/rd!..." and ".../hunter%202/x" unmarked
encodeURIComponent(encodeURIComponent(S))          // unmarked
JSON.stringify(S) with non-ASCII as é          // unmarked
JSON.stringify(JSON.stringify({ k: S }))           // unmarked (\\\" and \\n)
```
Expected: README lists four forms only, so this is within the letter; each leaves the value one decode away. Only values holding a space, a reserved character or a non-ASCII character are affected; plain-ASCII alphanumeric secrets look the same in every form and are marked.
Fix: add the `application/x-www-form-urlencoded` form (`new URLSearchParams([["", v]]).toString().slice(1)`) and the `encodeURI` form; or name the four forms in k.privacy as the whole promise.

### 5. low: a long secret with one character changed, or cut short, is left raw
Probe:
```ts
const L = "x".repeat(997) + "ABCDEFG" + "y".repeat(1500);
one(`a ${L.slice(0, 1250)}Q${L.slice(1251)} b`, L); // → 2,503 of 2,504 characters raw
one(`a ${L.slice(0, 999)} b`, L);                   // → 999-character prefix raw
```
Expected: README, "so no part of a secret is left". In context that sentence covers overlapping matches only; k.privacy promises nothing for a partial appearance.
Actual: the same holds for a short secret. It matters more for a long one, because a cut or near copy is likely (a logger or `clip` that cuts before the scrub, an edited token).
Fix: none needed in the code; make the README sentence say "of a matched secret", so the promise is not read as covering partial appearances.

## What held
- Pieces: a long secret split across the 1,000 boundary, appearing twice, `"ab".repeat(5000)` inside `"ab".repeat(7000)`, and a long secret whose prefix is a short secret: all marked whole.
- Batches: a secret at a 16,000-character batch edge; the longest-wins rule when the short value is in one batch and the longer in another; pii covering part of a secret (`[pii]` hides it all); a pii value inside a long secret; a tie between pii and secret (`[secret]`).
- Forms: lowercase percent hex (the `i` flag). Not filed: `util.inspect` writes a control character as `\x1B` where JSON writes `\u001b`, so a secret holding one is unmarked in inspect output. `util.inspect` of a long string does not split it (marked). Basic auth base64 is marked only when the prefix length is a multiple of 3.
- Surrogates: a secret starting with a lone low surrogate or ending with a lone high one, whose neighbour completes the pair in the text, is marked (short and over 1,000).
- Unicode and syntax: regex metacharacters, NUL, newline, `$&`, `$1` (marks are inserted by `slice`/`join`, so nothing is interpreted), a secret equal to `[secret]` or `[pii]`, case differences, final sigma, long s. NFD text for an NFC secret is not marked; k.privacy says "as written", so that is not a promise.
- Cache: same-size swap of a value rebuilds; a set with 150,000 numbers or 120,000 short strings builds in about 0.45 s and is reused at 4 ms; no crash.
- Time on large alternations: 998 values `a^3..a^1000` (and the same, each ending in `!`) against a 20,000-character run: 120 to 200 ms (irregexp copes); `a^999` against a 1,000,000-character run: 207 ms.
- `secretValues`: `-0` gives `"0"`, `1e21` gives `"1e+21"`; the JSON input cannot be cyclic; a 1 MiB body holds at most about 524,000 values, under the 1,000,000 cap. The diag message is scrubbed before `scrubbedCause` clips it, so the clip cannot cut a secret before the scrub sees it.
