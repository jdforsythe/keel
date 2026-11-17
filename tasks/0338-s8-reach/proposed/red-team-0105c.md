# Red team: the linear scan and the base64 forms (commit ab00816d)

Files: `packages/server/src/internal/{scrubbed,matcherOf,folded}.ts`. Probes ran as `packages/server/test/zz-probe.test.ts` (deleted), calling `scrubbed` directly or through an app built as in `test/redTeam0105.test.ts` (sim ctx seed 1337, production, json log). `sec(vals)` below is `[[new Set(vals), "[secret]"]]`.

## Findings

### 1. high: the cost is the number of forms times the text, so many values within 1 MiB still stall one request for seconds
Probe:
```ts
const keys = Array.from({ length: 500 }, (_, i) => "a".repeat(1_000) + String(i).padStart(9, "0"));
scrubbed("a".repeat(520_000), sec(keys));                       // 2,070 ms
// app: input s.object({ user: s.string(), keys: s.secret(s.array(s.string())) }),
// action throws new Error(`login failed for ${v.user}`); body {"user":"a"*520000,"keys":keys}, 1,026,020 bytes
// -> 500 after 4,340 ms, synchronous
scrubbed("a".repeat(400_000), sec(Array.from({ length: 256 }, (_, i) => "a".repeat(999 - i)))); // regex path, 1,739 ms
```
Expected: README log paragraph, "A value over 1,000 characters is found by a scan linear in the text and the value"; the brief's "one request can no longer stall the server"; RFC 0105 Risks (cost bounded by the set).
Actual: each long form is its own KMP pass over the whole text (3 to 6 forms per value), so the work is forms x text, quadratic in the body: 1,500 passes of 520k characters. The regex path for forms of 1,000 or fewer still re-runs at every start where a batch matches (`hits`), so a run matched by each batch costs batches x text x form length. Linear per value, not per record.
Fix: one Aho-Corasick automaton over all long forms of a pass (linear in text + forms + matches), and the same for the forms the batches hold, or a budget per record (sum of form lengths x text length); over it, the message or frame is written as its mark whole (fail closed). Add a conformance case with 500 long values and a 500k text and an operation-count bound.

### 2. medium: the unpadded base64 of a 2-character secret is 3 characters and blanks ordinary words
Probe:
```ts
scrubbed("Error: node code index under content until total today mode", sec(["81"]));
// -> "Error: n[secret] c[secret] index under content until total today m[secret]"
scrubbed("in node_modules/express/index.js at line 81", sec(["81"]));
// -> "in n[secret]_modules/express/index.js at line [secret]"
```
41 marks "index"/"under", 51 "content", 52 "until", 80 "today", 90 "total"; of all 2-character ASCII secrets, 19 hit one of 20 common words (`"Lq"` -> "the").
Expected: README, "a base64 copy is matched where the value was encoded on its own, or inside a longer encoded string from a byte offset that is a multiple of 3"; "code" is neither. The raw form of a 2-character value is matched only as a whole token; its padded base64 (`ODE=`) needed the `=`. A number in a secret object (a month, a count) is enough.
Fix: treat a base64 form under 8 characters as a short form (whole token, with the base64 alphabet as the token characters), or require no base64 character after an unpadded form whose padded form had `=`.

### 3. low: the long and short paths fold different pairs
Probe:
```ts
for (const n of [999, 1000, 1001]) scrubbed(`< ${"ı" + "k".repeat(n - 1)} >`, sec(["i" + "k".repeat(n - 1)]));
// 999 kept, 1000 kept, 1001 marked
// secret "ﬆ"+k..., text "ﬅ"+k...: 999 marked, 1000 marked, 1001 kept (copy stays)
```
Over every code point: 27 pairs `/iu` equates and `folded` does not (U+1F88..U+1FAF Greek capitals with prosgegrammeni vs U+1F80..U+1FA7, ﬅ/ﬆ): a long secret holding ᾀ is left readable where the text holds ᾈ. 2 pairs the other way (ı with i and I): a long value over-marks.
Expected: README, "case-insensitively", one rule for every value; the brief's "the two paths must agree".
Actual: `folded` is `toUpperCase().toLowerCase()`, not the simple case folding `/iu` uses.
Fix: in `folded`, map a code point to the least of `{ch, lower, upper, lower(upper)}` (one code point each) that `/^ch$/iu` matches, cached per code point; then both paths agree by construction.

### 4. low: a long secret that starts with a lone low surrogate is left whole when the text pairs it
Probe:
```ts
const v = "\udc00" + "k".repeat(1_000);
scrubbed(`< \ud801${v} >`, sec([v]));   // -> "< 𐐀kkkk...k >", whole copy readable
// same with 999 units: "< \ud801[secret] >"
```
Expected: README, "no value makes the scrub throw" and each value "matched as written"; the short path matches it by code unit (`units`).
Actual: `folded` folds the pair `𐐀` (𐐀) to 𐐨, which changes the low unit, so the form's first unit is gone from the folded text.
Fix: a long form that `EDGE` matches is also scanned in the unfolded text (case-sensitive), or `folded` leaves a pair whose fold changes its low unit unchanged and the form's lone first unit is compared by code unit.

### 5. low: a padded base64url copy leaves its padding
Probe: `scrubbed(\`m ${Buffer.from("??>?hunter").toString("base64url")}== x\`, sec(["??>?hunter"]))` -> `"m [secret]== x"`.
Expected: README, "base64 with or without its `=` padding in the standard or the URL-safe alphabet"; "the whole of each marked copy is replaced".
Actual: the URL-safe form is only the unpadded one. Nothing of the value is readable; the `==` says a copy was there.
Fix: add `padded` with `+/` mapped to `-_` to `formsOf`.

## What held
- KMP: `"ab".repeat(600)` in `"ab".repeat(1000)` -> `[secret]`; with a trailing `a` -> `[secret]a`; a match at the very start and at the very end of the text; two long secrets one a suffix of the other; a long secret next to a short one on either side.
- Positions after folding: a long secret holding `ß`, `İ`, `ǅ`, `ﬃ`, `ς`, `𐐀`, `e` + U+0301, a lone `\ud800`, `ı`, `ſ`, `K`, behind `ßßßİİİﬃ` in the text, in its own, upper and lower case: marked exactly, END kept, no neighbour eaten (where upper-casing changes length, ß -> SS, it is not a copy, as on the short path).
- Fuzz, 1,500 runs (seed 1337): periodic values of 990 to 1,010 units from surrogates, astral, ß/İ/ς/Σ, `=`, `\\`, `"`, `%`, with random text around: no copy left, nothing thrown.
- Base64: long values' padded, unpadded and url forms (1,867 to 1,868 characters) marked by the scan; copies inside a longer encoding at a byte offset multiple of 3, to its end (url) and mid-string (length multiple of 3), marked with the prefix and suffix kept.
- Times: one periodic value in a 500k run, 999 / 1,000 / 1,001 units: 329 / 234 / 82 ms; 50 long values, 500k text: 532 ms; folding 1M of `é`: 166 ms, 500k of `𐐀`: 287 ms; 64 case variants of a 999-unit form, none matching, 20k text: 8 ms (the engine factors the shared prefix); 100 values with six long forms each, 200k text: 199 ms; 150,000 short values over a 200k text: 939 ms (that body is over 1 MiB).
