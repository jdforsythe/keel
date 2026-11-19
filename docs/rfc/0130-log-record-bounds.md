# RFC 0130: every server log record has a size bound, a cut marker the input cannot forge, and a cut after the scrub

Status: implemented. Accepted (orchestrator under the owner's standing leave, 2026-11-18), ADR-0152. For backlog 0723; 0729 is the scrub-cost side of the same input.

## Problem
No log record has a size bound. A loader, action or guard throw that echoes a request body writes a `diag` of up to `maxBodyBytes` (1 MiB by default) on one line; a runner's thrown text is as long as the runner makes it; the guard loop record (E1508) joins every URL of the loop. The scrub walks all of it (about 5 ms per 520,000 characters, `tasks/0338-s8-reach/proposed/scrub-cost-0685.md`), and only a request whose value forms pass the 2,000,000-character cap stops it. A long line is split by Docker's json-file driver at 16 KiB into partial records, refused or cut by other pipelines, and costs storage per request an attacker sends.

Two more gaps sit in the same writer (`packages/server/src/internal/diagLine.ts`, `reqLine.ts`). The compact `diag` is `` `${code} ${message}` ``, so a thrown message holding a line feed writes a second line, which can read as a forged `req` record (`Error("x\nGET /admin app.admin 200 1ms")`); an escape sequence (U+001B, U+009B) reaches a terminal tailing the log. And a cut must not undo the scrub: the scrub matches whole written forms, so text cut before it can keep a secret's head.

## Proposal
A new kernel section, k.serverlog, owns how a record is written. Each variable part (a `diag` message, each frame, a `req` method and path) goes through scrub, escape and cut, in that order.

**Scrub, with a read bound.** As k.privacy Server log says, plus: when the request or a runner's `run` holds a secret or `.pii()` value, a text over 2,000,000 characters is not read and is one mark, as past the scrub's existing cap (`[secret]` if the secret set holds a value, else `[pii]`; a message keeps its server prefix). With no value, nothing is scrubbed (today's `scrubbed` returns the text untouched) and the cut reads only its head. The number is the scrub cap's own (`SCRUB_CAP`), so one constant bounds both the forms and the text.

**Escape.** C0 controls, DEL and C1 controls (U+007F to U+009F), U+2028, U+2029 and `…` are written as `\u` plus four lowercase hex digits, in compact and json. A compact record is then always one line and carries no terminal escape, and `…` appears in a record only as a cut. In json the text holds the six characters (`"\\u000a"` on the wire); JSON's own escaping would keep line breaks off the line but would leave `…` forgeable.

**Cut.** A message or path keeps the longest head of its scrubbed text whose escaped form is at most 2,048 characters; a frame or method, 256. When text is left out, `…+<n>` follows, `n` the scrubbed characters left out. Measuring the head in escaped characters means no escape is split and a part's written length is bounded whatever it holds. A head may end on the first half of a surrogate pair: json writes it as an escape and a UTF-8 sink writes U+FFFD; neither carries information the head did not.

**Marker.** `…+<n>`, the same in both forms. The input cannot forge it because every `…` of the input is escaped before the cut adds its own. In json the marker is inside the string, so the record stays one object with the same keys; a reader that only reads `message` still sees the cut.

**Order, and why it cannot leak.** The cut keeps a head of the scrubbed text, so every character it writes is one a whole-text scrub left, and a value straddling the cut point was already one mark before the cut. Cutting first would leave a straddling value's head in the kept text, which no scrub of whole forms can find. The scrub reads at most 2,000,000 characters of a text and the cut at most 2,048, so the work per record is bounded for any input. The existing cap is met, not changed: past 2,000,000 characters of forms or 100,000 secret values, each text is one mark before the cut sees it, and a mark is shorter than any bound.

**The bounds, and why these numbers.**
- Message, 2,048: a thrown message is usually under 200 characters; 2,048 holds the head of an echoed body (enough to tell which input it was), a full E1508 loop of nine ordinary paths, and about 22 lines of the 90-character text OUTPUT.md asks of a diagnostic.
- Path, 2,048: the long-standing practical URL limit (2,083 in old browsers, 2,048 in sitemaps); a path past it is an attack or a bug, and its head names the route.
- Frame, 256: a frame is `<path>:<line>:<col>` relative to the project; app paths run under 150. A cut frame loses its position, and a 256-character relative path is itself the finding.
- Method, 256: Node's parser accepts only registered methods (all under 20 characters), but `createApp().fetch` takes any `Request`; the frame's number covers it with no new constant.
- Frames, 5: k.deploy's number, unchanged, now stated for a runner's record too.
- Record, 8,192 characters and 12,288 bytes of UTF-8 beyond a `req` record's route id: derived, not checked at run time. A json `diag` holds at most 2,066 message characters plus 5 frames of 274 (bound plus an 18-character marker); JSON doubles at most each `"` and `\`, giving about 7,000 characters with the keys; every escaped character is at most 3 bytes, giving about 10,400 bytes. 12,288 bytes is under Docker's 16 KiB line split and journald's 48 KiB line, and far under the 256 KiB entry limits of hosted log stores.

**Every record kind.** `req`, `diag` and `csp` (whose parts k.security already bounds: a directive of 64, a blocked origin of 64), the last resort's `diag` and the one stderr line, in dev and production, since each goes through `diagLine`, `reqLine` or `cspLine`. The fixed records fit their bounds as written.

## Alternatives
- Cut, then scrub: cheaper on long text and leaks a straddling value's head (above).
- Scrub the head plus a margin: needs the margin to exceed the longest form (up to 2,000,000 characters), so it saves nothing.
- Mark a text over the read bound `…+<n>` even when the request holds values: honest about the drop, but the existing cap writes `[secret]` or `[pii]` for an unread text, and two answers for one case is a second rule.
- A `cut` key in json (`"cut":{"message":1046501}`): unforgeable without escaping `…`, but compact still needs the escape, a reader of `message` misses it, and it costs more bytes.
- A run-time whole-record check that replaces an oversized line with a fixed one: the part bounds already guarantee the size; it would only fire for a route id the app made long.
- Byte bounds in place of character bounds: matches pipelines exactly, but needs an encoder per part; the 3-byte ceiling per character gives a byte bound from the character one.
- Leave json without the escape: `\n` stays a real line break in the parsed value, but `…` in input then forges a cut there.

## Spec diff
New `spec/kernel/k.serverlog.md` (3,687 characters, 922 tokens; `pnpm spec k.serverlog` prints 3,711 bytes, 928), whole text as committed, status `proposed`. It takes the text because k.server (1,499 tokens, 1,501 printed), k.privacy (1,499, 1,501 printed) and k.deploy (1,496) have no room, k.errors is at 1,500 and k.reveal, the section with room, is about revealed values; the new section follows the way std.outbox was made for std.offline.

`spec/00-map.md` (4,797 to 4,799 characters, 1,200 tokens both): a row `| k.serverlog | Server log records | proposed | bounds, cut marks |` after k.server, paid for by trimming one-line summaries, no meaning lost: k.schema drops "from one schema", k.forms "form(schema): ", k.store "pure ", k.aria "Part: ", k.sim "; simulate", k.hosting "peers, ", and the code-range line reads "Kernel E1xxx in blocks of 50, stdlib E2xxx, tooling E0xxx; `pnpm spec --for <code>` finds the owner."

`docs/OUTPUT.md` Server log, after "`csp` records are above.":
```
Each record is one line of at most 8,192 characters plus a `req` record's route id (k.serverlog): a control character, U+2028, U+2029 or `…` in a written value is `\u` and four hex digits, and a message or path past 2,048 characters, or a frame or method past 256, ends in `…+<n>`, `n` the characters left out, so `…` in a record always marks a cut.
```

k.server and k.privacy are unchanged; their Log and Sinks text defers to OUTPUT.md, which names k.serverlog.

## Conformance diff
k.serverlog's six bullets are new (the section is new); no existing bullet changes. One `rfc:0130` commit by the `conformance-writer`, citing k.serverlog clauses 1 to 6:
- `packages/server/conformance/log-record-bounds.test.ts`: in dev and production, compact and json, an action and a runner throwing 1,000,000 `a` log the 2,048-character head and `…+<n>` with the exact `n`; a 5,000-character path logs `…+2952`; a 2,000,001-character throw logs `action <id> threw: [secret]` after a reveal and the cut head without one; for 1,000,000 `"`, U+20AC or U+0001 every line is at most 8,192 characters and 12,288 bytes (`Buffer.byteLength`), and every json line parses.
- `packages/server/conformance/log-record-escape.test.ts`: the six characters of clause 3 each written as its `\u` form, one compact line per record, and the parsed json message holding the six-character texts.
- `packages/server/conformance/log-record-cut-scrub.property.test.ts`: fast-check over a 64-character secret and every offset that puts the 2,048th written character inside it, with the prefix made of ASCII, `"` and U+0001: no line holds 8 consecutive characters of the secret.

## Migration
A log consumer that splits compact records on line breaks gets one record per line. A json consumer reading a multi-line message gets `\u000a` as six characters; one that shows `…` from app text gets `…`. A message, path or frame past its bound is cut; nothing else changes. Apps change nothing.

## Build order
1. Orchestrator: the spec diff (done with this RFC). The `conformance-writer`: the conformance diff.
2. Builder, `@keel/server`: `scrubbed` returns the first held pass's mark for a text over `SCRUB_CAP` (one line, after the no-value return); `scrubbedDiag` keeps the lead in that case too; a new `internal/written.ts` (`written(text, max)`: the escape and the head loop over at most `max` escaped characters, then `…+<n>`) used by `diagLine` for the message and each frame and by `reqLine` for the method and path. README log paragraph; changeset (patch). Estimated +190 to +250 bytes gzip (the helper alone gzips to 234 standalone); 211 remain (24,365 of 24,576).
3. Orchestrator: ledger, backlog 0723, HANDOFF.

## Token impact
k.serverlog new, 922 tokens (928 printed). Map 1,200 to 1,200. k.server, k.privacy, k.deploy unchanged. OUTPUT.md grows by one sentence (about 90 tokens).

## Choices
Each is the orchestrator's call; the operator can reverse any of them.
- C1: the numbers: 2,048 for a message and a path, 256 for a frame and a method, 5 frames, and the derived 8,192 characters and 12,288 bytes per record.
- C2: the read bound is the scrub cap's 2,000,000 characters, and past it a text with values is one mark; a text without values is cut unread.
- C3: the marker is `…+<n>` inside the value in both forms, `n` counted in scrubbed characters, with no separate json key.
- C4: control characters, U+2028, U+2029 and `…` are escaped in json too, so one rule holds in both forms; json loses real line breaks inside a message.
- C5: a cut keeps the head; a cut frame loses its `:line:col`.
- C6: the text lives in a new section, k.serverlog, and the map pays for its row with six trimmed summaries.
- C7: the record bound is derived, with no run-time check; a route id is the app's text and is not cut.
- C8: `@keel/server` likely passes 24kb by up to about 40 bytes. Budgets are the owner's gate: a raise to 24.25kb is proposed; if refused, the count in `…+<n>` goes (the marker becomes `…`, about 20 bytes less) and the builder trims elsewhere.
