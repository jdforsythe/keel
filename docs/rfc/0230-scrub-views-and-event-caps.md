# RFC 0230: the log scrub reads decoded views under a byte cap; one event has a size cap

Status: accepted (ADR-0252), accepted by the orchestrator on 2026-11-25 on standing authority, for the operator to confirm. Amends k.privacy (Sinks, Conformance), k.serverlog (Path, Conformance), k.server (Request flow, Conformance), k.services (events, Conformance), k.forms (Conformance), the map. Fix lane 06 of the weakness triage (`tasks/p1/weaknesses.md`): backlog 0970, 0971, 0974, 0756, 0729, 0972, 0442, 1001.

## Decisions
- D1: the scrub stops listing encoder outputs. It reads each text three times: as is, as its decoded view, and as the decoded view of that view. One decoder reads `%` escapes, `+`, JSON escapes and five named and all numeric HTML entities. A copy found in a view marks the raw text it came from.
- D2: a value's forms are the value, its NFC and its NFD, hex of its UTF-8 (from 8 bytes), and base64 of its UTF-8 at all three byte alignments (from 8 bytes; under 8, the padded encoding standing alone). Everything else is a stated limit.
- D3: the cap counts the UTF-8 bytes of the scope's distinct values, secret and `.pii()` together: past 65,536 bytes every text of the scope is one mark. It replaces the 2,000,000-character forms cap and the 100,000-value cap. The 1,000,000-values-per-`Secret` read cap and the 2,000,000-character text cap stay.
- D4: the matcher builds in steps linear in the set's bytes and reads each text in steps linear in its length.
- D5: a lost `onSecret` slot makes each text of the scope one mark as past the cap: a `diag` keeps its prefix.
- D6: a `req` path mark or cut takes in the slashes beside it.
- D7: one event is capped at 1,048,576 bytes as written on the server, and at the client's `maxBytes` per line block.
- D8: 0442 is a bug against k.forms as written. Plain siblings of a secret are restored.

## Problem
The scrub (`packages/server/src/internal/formsOf.ts`, `automatonOf.ts`, `holdSecrets.ts`, `scrubbed.ts`) builds, for each value, the outputs of nine exact encoders (`formsOf`) and finds them with one Aho-Corasick automaton. What the red team and review found:
- 0970: `formsOf` holds `encodeURIComponent`, `encodeURI` and `URLSearchParams` outputs only. qs (RFC 3986: `!'()*` escaped), axios, Go's `QueryEscape` and Python's `quote` write other strings, so their copies slip.
- 0971: hex, HTML-safe JSON (`<`), `\/`, HTML entities, NFD, JSON inside a URL, and base64 at an unaligned offset (a JWT payload) slip.
- 0974: the whole-text mark when another package takes the `onSecret` slot is stated in the README and the threat model, not in the spec.
- 0729: a 790 KB body of 99,000 secret items whose action throws costs about 1.2 s of event loop. `holdSecrets` builds every form of every value until the bound passes the cap, rebuilds the automaton each time the bound doubles, and the build sorts all forms.
- 0972: the cap counts characters of forms. A non-ASCII value's `\u` and `%` forms are about 6 characters per character, so such values reach the cap about 2.2 times sooner than its text says. The cap claims one thing and counts another.
- 0756: `secretSegments` marks the segment and keeps the slashes beside it. `/reset//abc` logs `/reset//[secret]`, `/reset/abc/` logs `/reset/[secret]/`: a value that begins or ends with `/` leaves that slash.
- 0442: `secretKey` (`packages/server/src/internal/secretKey.ts`) calls a key secret at any array, record, union or `anyOf` node whose subtree holds a secret, whatever segments remain. So `cards.a.name` under `s.record(s.object({ name, pin: s.secret(...) }))` is dropped from a 422 re-render. k.forms says the re-render drops "any that may reach an `s.secret`", and `cards.a.name` cannot reach one.
- 1001: `liveStream.ts` writes any yield whole, and `sseData.ts` (services) buffers any line whole. `maxBytes` covers a response body and not a stream. `sseData` also splits the whole buffer on every chunk, so a long line costs time quadratic in its length.

## Proposal
Clauses C1 to C8 are applied to `spec/` in this commit. Each names its backlog lines.

### C1. Views (0970, 0971)
k.privacy Sinks, "Views". The decoded view reads a text once from the start and writes each escape as what it stands for, and any other unit as is:
- A run of `%HH` (either case) is read as bytes. Each well-formed UTF-8 sequence becomes its code point; any other byte stays as its three characters.
- `+` becomes a space.
- `\uHHHH` becomes that unit. `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r` and `\t` become their characters.
- `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;` become their characters. So does `&#` with 1 to 7 decimal digits and `;`, and `&#x` or `&#X` with 1 to 6 hex digits and `;`, for a code point up to U+10FFFF that is no surrogate.

The scrub reads the text, its view, and the view of that view. A copy found in a view marks the raw text from the first character of the escape its first unit came from to the last character of the escape its last unit came from. The view keeps a map from each of its units to the raw range of its escape (two `Int32Array`s per view), and a view of a view composes the maps.

Two decodings cover every pair of the escapings above in any order: URL inside JSON, JSON inside a URL, JSON escaped twice, URL encoded twice, HTML entities over JSON. One decoding covers any encoder that writes `%` escapes, so qs, axios, Go and Python all reduce to the value. JSON forms are no longer listed: the view decodes `\u` for non-ASCII, `<`, `\/` and doubled escapes.

### C2. Forms (0971)
k.privacy Sinks, "Copies" and "Base64". The forms the matcher holds for each value:
- The value as given. Its NFC and NFD where they differ, each counted as a value (C4).
- From 8 bytes of UTF-8, the hex of those bytes. A shorter hex form is a run of digits common in logs and would over-mark numbers; its absence is a limit.
- Base64 in both alphabets. Under 8 bytes: its own padded encoding, whole. From 8 bytes: for each alignment k in 0, 1, 2 (the value's first byte at a byte offset of k modulo 3), the core, which is the characters whose six bits all come from the value's bytes: the indexes from ⌈8k/6⌉ through ⌊8(k+n)/6⌋ − 1 of the encoding of k filler bytes, the value and filler bytes after it. That is at least 10 characters for 8 bytes. A core match is widened to take in, at that alignment, the character before it when 8k mod 6 ≠ 0, the character after it when 8(k+n) mod 6 ≠ 0, and then any `=` right after it. Every character that carries a bit of the value is then inside the mark: in the encoding of a, the value's bytes and b, the characters from ⌊4|a|/3⌋ through ⌈4(|a|+n)/3⌉ − 1. The aligned-only rule today is k = 0 of this.
- A value with a lone surrogate has no hex or base64 form. Its UTF-8 would hold U+FFFD and would not be the value.

Folding stays one code unit at a time, for every view and form. The whole-token rule for forms under 3 units is checked against the neighbours in the view where the form was found. Overlapping copies across views make one mark: `[secret]` when any is a secret's, else `[pii]`. Today the longest match picks the mark; the new rule is simpler and never shows `[pii]` over a secret.

### C3. Limits (0971)
k.privacy Sinks, "Limits", listed in the spec and the threat model as not marked:
- three or more escapings;
- `\x`, octal, `\U`, `%u`, other named entities, a numeric entity without `;`;
- a copy part NFC and part NFD, and compatibility forms;
- hex of a value under 8 bytes, and base64 of a value under 8 bytes inside a longer encoding;
- hex or base64 of a text in which the value is itself escaped;
- base64 with line breaks;
- other encodings, hashes, compression, encryption;
- a cut, split or changed copy;
- a value revealed outside every scope.

### C4. Cap and cost (0729, 0972)
k.privacy Sinks, "Cost". The scope counts the UTF-8 bytes of its distinct values, secret and `.pii()` together. A lone surrogate counts 3 bytes, and an NFC or NFD form that differs counts as a value. The count is exact and costs O(1) per value: a `Set` dedupes, and the bytes are summed as values arrive. Past 65,536 bytes, or once one `Secret` has more than 1,000,000 values to read, the set takes no more values and every text of the scope is past the cap.

Why 65,536. The matcher holds at most about 12 characters of forms per byte of values (the value 1, hex 2, six base64 cores about 8, padded and NFC or NFD on top). At 65,536 bytes that is under 800,000 trie nodes, about 22 MB of typed arrays, built in tens of milliseconds. That bounds the stall a client can buy with one 1 MiB body. Today's 2,000,000-character cap allows about 2.5 times that. Past the cap the log over-marks, the safe side: a page whose loaders return more than 64 KiB of `.pii()` values logs `GET [pii] app.customers 200`, with the route id kept.

Below the cap the matcher is built once per scope and set list, in steps linear in the bytes of the set. It is built again only when the set has grown. The trie is built by insertion into an open-addressed `(node, unit)` table, with no sort. Each text is read in steps linear in its length, each of its three views once. `holdSecrets` no longer builds the automaton to learn whether the set is over: the byte count decides. A text over 2,000,000 characters is still not read (k.serverlog).

Counting bytes makes the cap say what it counts for any script: 65,536 bytes is 65,536 ASCII characters, 32,768 two-byte ones or 21,845 three-byte ones.

### C5. The lost slot (0974)
k.privacy Sinks, "Server log". Each request and runner `run` takes the `onSecret` slot as it begins. Each text of a scope during which a package cleared or replaced the slot is one mark as past the cap, `[secret]`: a `diag` keeps the server's own prefix, as past the cap. Today `scrubbed` returns `[secret]` for the whole message, the prefix included. Keeping the prefix makes the two whole-text cases one rule.

### C6. Slashes in the `req` path (0756)
k.serverlog Path. Each mark and each cut takes in the `/`s before its segment but one. A mark at the last non-empty segment also takes in the `/`s after it. `/reset//<v>`, `/reset/<v>/` and `/reset/<v>//` log `/reset/[secret]`; `//reset//<v>/` logs `//reset/[secret]`. Slashes before a static segment are not a value's, and stay.

### C7. Event size (1001)
- k.server, server side. An event over 1,048,576 bytes of UTF-8 as written (`data: `, the `Result` JSON and its two line feeds) is not written. The stream writes the `keel.unexpected` `err` line a throw of `fn` gives, logs one `diag` `keel.unexpected` `loader <id> event over 1048576 bytes`, ends, and returns `fn`'s iterator. The size is measured on the JSON text already made (`Buffer.byteLength` plus 8), so the cap bounds what is written, not the memory of one yield. That memory is the loader's own. The cap is fixed, with no option.
- k.services, client side. One event is at most `maxBytes` (default 1 MiB): its line block, from the byte after the blank line that ends the block before it, or the body's start, through the blank line that ends it. Every line, comment and line end counts. Once a block passes `maxBytes` before its blank line comes, the body is cancelled and the iteration yields one `api.decode` with issues `[{ path: [], rule: 'max' }]` and ends. That is the error a 2xx body over `maxBytes` gives. A heartbeat (`:` and two line feeds) is its own block. The server's cap counts the same bytes, so any event a Keel server writes fits a client at the default. `sseData` scans only the bytes it has not scanned yet, so a body is read in steps linear in its bytes.

### C8. Conformance clauses
Listed under Conformance diff.

## Builder's work, no spec change
- **0442 (bug).** k.forms Submit already says: "re-renders the page with the submitted values, less password-input ones and any that may reach an `s.secret`". Today a plain sibling under a record, union or `anyOf` that holds a secret is dropped, which contradicts that sentence. Expected: `secretKey(root, key)` follows the key's dotted segments (a trailing `[]` dropped) through optional, nullable and format wrappers: an object's field by name, a record's value for any segment, each variant of a union and each member of an `anyOf`. A key is secret when some path reaches an `s.secret` node, or ends at a node holding one, or meets an array whose item holds one (an array's FormData values are leaves, so the key itself is the array). It stays linear in the key times the union width, memoized per node. Re-base the server's size budget by the bytes the walk costs (about 50 B, noted in the commit). One conformance bullet is added to k.forms so the conformance writer covers it.

## Alternatives
- **Keep listing encoders** (0970's first reading: add qs, Go and Python outputs to `formsOf`). Every new encoder is another form per value, and the cap fills faster. Rejected for the decoded view, which covers any `%` encoder in one pass.
- **Decode to a fixed point.** It costs time unbounded in nesting (each pass is linear, but passes are not bounded) and over-marks more. Two decodings cover every pair of the escapings in use. Three or more is a stated limit.
- **Normalize the text to NFC in a view.** Normalization reorders combining marks, so the offset map is no longer monotone, and a mark could not be placed exactly. Adding the value's NFC and NFD forms is exact for a copy in either form; a mixed copy is a limit.
- **Keep a forms-character cap.** It is what 0972 found misleading. A byte cap counts the input, which a reviewer can check.
- **A higher cap (256 KiB).** About four times the stall and memory per request, for fewer over-marked list pages. Offered to the operator.
- **A `createApp({ maxEventBytes })` option.** A second knob for a case no app has met. A live loader that yields over 1 MiB yields too much for a browser, too. Offered to the operator.
- **Skip an oversized event and keep the stream.** The client would never learn that an update was lost. Ending with an `err` matches a throw, and the client ends on an `err` anyway.

## Spec diff
Applied in this commit.
- k.privacy (to `implemented`): Sinks "Server log" names the cap through Cost and the lost slot; "Written forms" is replaced by "Copies", "Views", "Base64", "Limits" and "Cost". One sentence leaves an existing bullet (the 100,000-value cap). Five conformance bullets are added.
- k.serverlog (to `implemented`): Path gains the slash sentence; one conformance bullet.
- k.server (to `implemented`): Request flow gains the event cap; one conformance bullet.
- k.services (to `implemented`): `events` gains the per-event cap and linear reading; one conformance bullet.
- k.forms (to `implemented`): one conformance bullet.
- Map: the five rows read `implemented`.
- No new diagnostic code: the server's case is a `keel.unexpected` `diag`, and the client's is `api.decode` with `rule: 'max'`, as for a body. No glossary term is added.

## Conformance diff
By the `conformance-writer`, from the spec text only.
- `packages/server/conformance/privacy-scrub-views.property.test.ts`: k.privacy, the "every generated secret ... each encoding E" bullet, and the unaligned base64 bullet.
- `packages/server/conformance/privacy-scrub-limits.test.ts`: the three-times `encodeURIComponent` bullet.
- `packages/server/conformance/privacy-scrub-cap.test.ts`: the 8,192 / 8,193 ASCII and 4,096 / 4,097 Cyrillic bullet.
- `packages/server/conformance/privacy-slot-lost.test.ts`: the `onSecret(() => {})` bullet.
- `packages/server/conformance/log-record-path-slashes.test.ts`: the k.serverlog bullet.
- `packages/server/conformance/live-loader-event-cap.test.ts`: the k.server bullet.
- `packages/services/conformance/events-max-bytes.test.ts`: the k.services bullet.
- `packages/server/conformance/served-form-422-siblings.test.ts`: the k.forms bullet.
- Existing cases: `privacy-req-path.test.ts` quotes the bullet that lost its 100,000-value sentence and asserts it. The writer re-quotes the header and moves that case to the byte cap. `privacy-written-forms.test.ts` asserts the old forms. Each still holds (all are covered by the views), but its header quotes the removed "Written forms" text, so the writer re-points it at "Copies" and "Views".

## Migration
None. Nothing is released.

## Token impact
- Spec: k.privacy grows by about 1,350 tokens to about 2,850 of 3,110; k.serverlog by about 130 to about 1,300; k.server by about 165; k.services by about 280; k.forms by about 140. The map is unchanged in size.
- `@keel/server`: `formsOf` shrinks (no JSON or URL forms), and a decoder of about 1 kB minified is added; measure against the budget in the build and re-base with the note. `@keel/services`: a byte counter in `sseData`.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the clauses above. 3. Build:
- `packages/server/src/internal/decodedView.ts` (new): the C1 decoder with its offset map.
- `formsOf.ts`: the C2 forms (value, NFC, NFD, hex, base64 cores with their widening counts).
- `automatonOf.ts`: linear trie build (no sort), the term data carrying the widening counts before and after.
- `scrubbed.ts`: three views, marks mapped to raw ranges, the `[secret]`-if-any rule.
- `holdSecrets.ts`, `noteRequestSecrets.ts`, `pastCap.ts`: the byte count (C4). `SCRUB_CAP.ts` becomes the 65,536-byte cap, `SECRETS_CAP.ts` goes. The 2,000,000-character text cap moves to its own name for k.serverlog.
- `scrubbedDiag.ts`: keep the prefix when the slot was lost (C5).
- `secretSegments.ts`: C6.
- `secretKey.ts`: 0442.
- `liveStream.ts`: C7, server side.
- `packages/services/src/internal/sseData.ts` and `events.ts`: C7, client side.
- Package tests (not conformance): a property test with `count` showing build steps at most c × bytes and walk steps at most c × 3 × length, for generated sets and texts. The 0729 body (99,000 distinct 8-byte secrets, about 790 KB, action throws) as a regression case.
- Docs: `packages/server/README.md` (the forms paragraph, the caps, the lost slot, the slashes, the event cap), `packages/services/README.md`, a changeset per package, and `docs/THREAT-MODEL.md` as below, once built.

### Threat model text, to apply with the build
- In **Secrets**, replace the parenthesis "(past 2,000,000 characters of their forms or 100,000 values, or for a text over 2,000,000 characters, everything after the server's own prefix is one mark)" with: "(past 65,536 bytes of a scope's distinct values, counted as UTF-8, or for a text over 2,000,000 characters, everything after the server's own prefix is one mark)". After "and the query is never logged." add: "A value is found as given, in NFC and NFD, as hex and as base64 at any alignment (from 8 bytes; a shorter one as its own padded base64), in the text and in two decoded views that undo `%` escapes, `+`, JSON escapes and HTML entities, so any single or double nesting of those is found. Limits: three or more escapings, escapes the views do not read (`\x`, octal, `%u`, other named entities), a copy part NFC and part NFD, compatibility forms, hex or base64 of an escaped copy, base64 with line breaks, hex of a value under 8 bytes or a base64 copy of one inside a longer encoding, any other encoding, a hash or ciphertext, a copy cut, split or changed." In the path sentence, after "is cut the same way", add "; a mark or cut takes in the slashes beside it".
- In **Server log**, replace "and each text of one during which the slot was lost is one `[secret]`" with "and each text of one during which the slot was lost is one `[secret]` after the server's own prefix".
- In **Event streams**, after "it ends on request abort or `close()`." add: "An event over 1,048,576 bytes as written is not sent: the stream ends with a `keel.unexpected` `err` and a `diag`. A service client reads at most `maxBytes` (default 1 MiB) of one event and ends with `api.decode` past it, so no peer can make it buffer an endless line."

## For the operator
1. **The cap is 65,536 bytes of distinct values per request.** Recommended: yes. It bounds the stall to tens of milliseconds and about 22 MB. The cost is over-marking: a page whose loaders return more than 64 KiB of `.pii()` values logs its path as `[pii]`. 262,144 bytes is the alternative.
2. **The server's event cap is fixed at 1 MiB, with no option.** Recommended: yes. An option can be added when an app needs one.
3. **Under 8 bytes, hex is not a form, and base64 matches only standing alone.** Recommended: yes. Short forms would over-mark ordinary numbers and base64 in logs.
4. **A run of overlapping copies is `[secret]` when any copy is a secret's.** Recommended: yes. It replaces "the longest match's mark".
5. **A lost `onSecret` slot keeps the `diag` prefix.** Recommended: yes. One rule with the cap.
