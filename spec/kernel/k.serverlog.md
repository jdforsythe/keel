# k.serverlog: Server log records
status: conformance-covered

**Purpose.** How the server writes each record of its log (k.server Log, docs/OUTPUT.md), so that no request or thrown value makes a record long, splits it across lines or fakes a cut, and no cut shows what the scrub (k.privacy Server log) marked.

**Parts.** A record's variable parts are a `diag` record's message and each of its `frames`, and a `req` record's method and path. Lengths count UTF-16 code units, called characters here. Each part is written in three steps, in this order:
1. Scrub, as k.privacy Server log says. When the request, or a runner's `run`, holds a secret or `.pii()` value, a text over 2,000,000 characters is not read: it is one mark as past the scrub's cap, a message keeping its prefix (`loader <id> threw: `). With no such value nothing is scrubbed.
2. Escape. Each control character (U+0000 to U+001F, U+007F to U+009F), U+2028, U+2029 and `…` (U+2026) is written as `\u` and four lowercase hex digits, in compact and json alike; a parsed json value holds those six characters.
3. Cut. A message or path keeps the longest head of its scrubbed text whose escaped form is at most 2,048 characters; a frame or method, 256. When text is left out, `…+<n>` follows the head, `n` the scrubbed characters left out: `action app.save threw: Error: bad {"q":"aaaa…+1046501`. Only that head is read.

**Marker.** After the escape a part holds no `…` of its own, so `…` in a record, compact or json, is always a cut. In json the marker is inside the string and the record stays one valid object; a head that ends in the first half of a surrogate pair is written as its escape there.

**Order.** The cut runs after the scrub and keeps a head of the scrubbed text, so each character it writes is one a whole-text scrub left, and a value straddling the cut point is already one mark. Cutting first would keep a straddling value's head, which a scrub of whole forms cannot find. The scrub reads at most 2,000,000 characters of a text and the cut at most 2,048, so a record's cost is bounded for any input.

**Record.** A `diag` holds at most 5 frames (k.deploy), a runner's too. A record is then at most 8,192 characters and 12,288 bytes of UTF-8 in either form, plus a `req` record's route id: its other text is the server's own (code, `see`, status, time) or a `csp` record's parts, which k.security bounds. The bounds hold for every record the server writes, in dev and production: `req`, `diag`, `csp`, the last resort's `diag` and its one stderr line.

**Rules.** None.

**Conformance.**
- An action throwing an `Error` whose message is 1,000,000 `a`, and a runner rejecting with it, log in compact and json a `diag` whose message is its first 2,048 characters then `…+<n>`, `n` the characters left out; every json line parses.
- With a revealed 64-character secret in a thrown message at each offset that puts the 2,048th written character inside it, no logged line holds 8 consecutive characters of the secret, in compact and json.
- A thrown message holding a line feed, a carriage return, U+001B, U+0085, U+2028 and U+2026 logs one line per record in compact, with `\u000a`, `\u000d`, `\u001b`, `\u0085`, `\u2028` and `\u2026` in their places; the parsed json message holds those texts.
- A request for a 5,000-character path logs a `req` path of its first 2,048 characters then `…+2952`, in compact and json.
- An action that reveals a secret and throws 2,000,001 characters logs `action <id> threw: [secret]`; with no secret or `.pii()` value it logs the first 2,048 characters then `…+<n>`.
- For a thrown message of 1,000,000 `"`, U+20AC or U+0001, every logged line is at most 8,192 characters and 12,288 bytes of UTF-8.
