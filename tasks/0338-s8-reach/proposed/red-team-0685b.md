# Red team: the scrub's cap and the four fixes (commit 5bbe5003)

Files: `packages/server/src/internal/{automatonOf,scrubbed,noteRequestSecrets}.ts`, with `createApp.ts`, `redacted.ts`, `scrubbedCause.ts`, `liveStream.ts`, `runAction.ts` read for how the sets fill and who reads them. Probes ran as `packages/server/test/zz-probe.test.ts` (deleted), calling `scrubbed` directly or through an app built as in `test/redTeam0105.test.ts` (sim ctx seed 1337, production unless stated, json log), timed with `performance.now()`. `pnpm mutate:status` read 0 running before each of the two vitest runs. `sec(vals)` is `[[new Set(vals), "[secret]"]]`. No probe left a copy of a value of 3 or more units, as written, JSON-escaped, URL-encoded or in base64, and nothing threw. The four fixes hold. The two findings are low: both are about the new whole-token sentence in the README.

## Findings

### 1. low: the README's whole-token sentence covers the value, but the code applies it only to the value as written; the value's URL, JSON and base64 copies are replaced inside words
Probe:
```ts
scrubbed("caf%C3%A9 café w6k=x", sec(["é"]));        // -> "caf[secret] café [secret]x"
scrubbed("xYQ==z and a", sec(["a"]));                  // -> "x[secret]z and [secret]"
scrubbed("q=%E6%9D%8E%E5%9B%9B name 李四 and 李 x", [[new Set(), "[secret]"], [new Set(["李"]), "[pii]"]]);
// -> "q=[pii]%E5%9B%9B name 李四 and [pii] x"
```
Expected: README log paragraph, "A value of 1 or 2 code units is replaced only where it stands as a whole token, with no letter, digit or `_` right before or after it."
Actual: the token test in `scrubbed.ts` is `i + 1 - at < 3`, so it applies to a form's length, not the value's. A 1 or 2 unit value has forms of 3 or more units (padded base64 `YQ==`, URL `%C3%A9`, JSON `\u0001`), and those are replaced anywhere. The same word is left alone as written (`李四`, `café`) and blanked when URL-encoded (`%E6%9D%8E%E5%9B%9B`). Nothing of a value is left; this is ordinary text blanked beyond what the sentence states. A one-character `.pii("name")` value (a CJK surname) is the realistic case.
Fix: either word the sentence for what the code does ("A value of 1 or 2 code units is replaced as written only where it stands as a whole token; its encoded forms are replaced wherever they appear"), or apply the token test to a form whose value is under 3 units. That second fix needs the value length in `term`, and the URL token test then has to treat `%XX` as part of a word.

### 2. low: a combining mark is not a letter to the token test, so a 2-unit value is marked inside a decomposed word
Probe:
```ts
scrubbed("éab x", sec(["ab"]));   // -> "é[secret] x"   (NFC "éab x" stays as it is)
scrubbed("ab́ x", sec(["ab"]));    // -> "[secret]́ x"  (the mark is left after the replacement)
```
Expected: README, "with no letter, digit or `_` right before or after it". A reader takes `é` written as e + U+0301 to be a letter, as the precomposed `é` is.
Actual: `WORD` is `/[\p{L}\p{N}_]/u`, and U+0301 is `\p{M}`. The same word in NFD and NFC is scrubbed differently. The code does what the sentence says literally, so this is wording or a one-class fix, not a leak.
Fix: add `\p{M}` to `WORD`, or say "letter (combining marks are not)" in the README.

## Proposed backlog lines (`## Red team`)
- 0711 server/docs: the README whole-token rule for a 1 or 2 unit value holds only as written; its URL, JSON and base64 copies are replaced inside words (`caf%C3%A9` with secret `é` gives `caf[secret]`). Word the sentence for the code or test by value length.
- 0712 server: a combining mark is not a word unit to the token test (`e\u0301ab x` with secret `ab` gives `é[secret] x`; NFC stays). Add `\p{M}` to `WORD` or say so.

## The four fixes, aimed at as briefed
1. **Cap stops forming: holds.** 1,000,000 `user${i}@example.com` pii values: first text 60 ms, `[pii]`, 28,243 values formed (`count.forms` 2,000,066). Six cache-hit texts took 0 ms (rss 302 -> 369 MB, mostly the probe's own set). At 100,000 values: 59 ms. 1,000,000 numbers: 131 ms, over after 151,080 formed. Folded forms that collide make a value cost less than its forms: 140,608 three-letter values over `[a-zA-Z]` gave m = 409,656, built in 95 ms, under the cap. With a 1 MiB body a client reaches about 200,000 values, so a 1 s build would need app data. Just under the cap (140,000 numbers, m 1,844,890): build 138 ms. 1,400 cached texts of 2,000 characters took 67 ms. Five rebuilds after the secret set grew took 687 ms (137 ms each). A request rebuilds only when a set has grown between scrubs, which is once per throwing loader, guard or action, plus once at the end. Over is all or nothing, with no partial automaton, so nothing under the cap is left unmarked. Through an app at 2,000 `"@"×300+i` secrets the result was `[secret]`. Reasoned: no server path deletes from `pii` or `secrets` (the only `.clear()` in runAction is `rq.held`, a factory map), and both are made per request in `routed`, so no path gives a set of the same size with new contents, a set that falls back under the cap, or a shared cache entry. Only a direct call that does `delete` then `add` misses the new value (`"[secret] gamma-secret"`), and the server never does that. The same object as both passes gives `[secret]`. An empty first set with a huge second gives `[pii]`.
2. **`""` in the secret set: holds.** `redacted` is the only reader of `rq.secrets`. Nothing in `packages/std-*/src` reads `requestSecrets` or `secretValues`. `formsInto` skips `""` forms. Results: boolean secret plus pii over the cap gives `[secret]` (production 37 ms, dev 22 ms, no `@@@` in any line). Boolean only, under the cap: `refused true [pii] plain text`, with nothing new marked. Pii-only with `""` among the pii values, over the cap: `[pii]`. `{""}` alone, under the cap: the text is unchanged.
3. **Surrogate split: holds.** `😀` as a secret: `pin [secret] ok`, `[secret][secret]` for `😀😀`, `[secret].`, and its JSON, URL (`%F0%9F%98%80`) and base64 (`8J+YgA==`) copies are marked. `x😀y` and `a😀` stay, as the whole-token rule says. `\ud83dA` in `😀A` stays and is marked when it stands alone. `A\ude00` is marked after a lone high surrogate. `\ude00\ud83d` across `😀😀` stays. `\ud83d`, `a\ud83d` and `\ude00` against `say 😀 ok` stay. The 3-unit form `a😀` is marked inside `xa😀y`. `ab\ud83d` in `ab😀` gives `[secret]\ude00`, because a form of 3 or more units has no token test, as with the 1,001-unit case that held before.
4. **Padding propagation: holds, no over-take.** `m QaHVudGVyMiF4eQ== x` gives `m [secret] x`, with the second value in either pass. `token=abc== and a==b` with secrets `abc` and `a` gives `token=[secret]== and [secret]==b`, so `=` stays after a form without padding. A padding count is carried only from a form of 11 or more units that is a suffix of the matched text, so the `=` taken always follows a copy. `B==tail1` with pii `==tail1` merges into one run, `[secret]`. A count of 1 before `==` takes one: `[secret]=`. Three `=` after a count of 2 leaves one. An upper-case copy is marked.

## Probes that held (re-run)
- 0685 #1 direct: 41 ms (build 1,183,965 steps, walk 1,039,000), unchanged. 0685 #3: 35 ms, `[secret]`.
- 0685 #2 app (1,026,020-byte body): 500 in 48 ms in production and 47 ms in dev. The message is `action app.a threw: Error: login failed for aaaa…`, and no line holds a key.
- 0680: the 400,000 run against a 400,001-unit secret took 52 ms, unchanged. The `"ab"` periodic secret against its text less its last unit took 43 ms, unchanged.
- 0670, run directly here (the earlier run went through an app): 20,000 keys, a message and 8 frames took 49 ms. The results were `refused [secret]` and `/app/x/[secret]/f.ts:1:0`.
- 0686: the ordinary sentence with `81` is unchanged; `pin [secret] sent, line [secret]`.
- 0687: `ı`+k at 998, 999 and 1,000 gives `< [secret] >`. `ᾈ`/`ᾀ` at 999, 1,000 and 1,001 is marked. A lone low surrogate opening a 1,001-unit form gives `"< \ud801[secret] >"`. Padded base64url gives `m [secret] x`. `ﬅ`/`ﬆ` stays, as the design accepts.
- Cap through an app (`"@"×300+i` secrets): 10, 1,000 and 1,100 values gave `refused [secret]` in 1, 20 and 23 ms. 2,000 values gave `[secret]` in 22 ms. No line holds `@@@`.
- 130,000 two-unit CJK values: over (forms 2,000,020 at the stop), 83 ms. 1,000 values of 340 `€` against 340,000 `€`: `[secret]`, 30 ms.
- 153,000 two-unit Latin-1 values (now over the cap, at 2,000,022 with the stop): 96 ms. 200,000 four-unit values: over, 82 ms. The worst build under the cap measured here is 140,000 numbers, 138 to 147 ms.
- 520,000 units where every position ends a failing short form (`a`, `ab`, `ba`): 21 ms. 260,000 whole-token `a` matches, each one also checked by `split`: 39 ms.
- Fold table: not re-run. `foldTable` is not exported and this commit does not change it.
- Surrogate fuzz (seed 1337, 5,000 runs; lone high and low, astral, case pairs, `=`): no throw, no value of 3 or more units left between marks.
- Forms fuzz (seed 1337, 20,000 runs; a secret and a pii value, each as written, JSON, URL, padded, unpadded and url base64, the odd ones with letter case flipped by unit): 0 exact copies of 3 or more units left. The flipped copies were not checked for leftovers.
