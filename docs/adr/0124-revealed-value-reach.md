# ADR-0124: E1112 reads one file by syntax and reaches every sink and carrier it can see there; the server logs `[secret]` for a request's secret input (RFC 0101)

**Status:** accepted

**Context.** E1112 (ADR-0123) reports a value `reveal` returns reaching `tx`, `store`, `ctx.storage`, `console` or an `Error`. A review and a red-team found ordinary code it misses: `throw reveal(k)`, `process.stdout.write`, `node:fs` writes, `btoa` and `Buffer.from` encodings, `for...of`, member writes and `push`, an alias of `reveal`, `console.log.bind`, a renamed `ctx.storage`, `new String`. A thrown string is the `keel.unexpected` cause and lands in the server's log line verbatim, in dev and production; the `[pii]` scrub does not hold it, since a `Secret` encodes as the marker. The rule also reports code that cannot write the value: `reveal(x).length`, `startsWith`, `reveal(x) && y`, a `let` reassigned to a hash, another field of an object holding the value, a `new Map()` named `storage`. k.privacy has 36 tokens of room.

**Decision.**
- D1: E1112 stays one file, by syntax, explained in one sentence: a revealed value that reaches a log, storage, a file, store state or a throw, through bindings, literals, operators, members, methods and the standard conversions and encodings, is reported, and a call to anything else ends it. New sinks: `process.stdout.write`, `process.stderr.write`, the `node:fs` writes, `Promise.reject`, `throw`; any sink under a local name or `.bind()`; `ctx.storage` matched by origin. New flow: `for...of`, member writes, `push`, `unshift`, `set`, `add`, `append`, `Object.assign`, an alias of `reveal`, `concat`-style methods given the value.
- D2: a closed list of standard conversions and encodings carries (`String`, `new String`, `String.raw`, `JSON.stringify`, `structuredClone`, `Array.from`, `Object.assign`, `Object.values`, `Object.entries`, `btoa`, `encodeURI`, `encodeURIComponent`, `Buffer.from`); any other call ends the flow, so a hash passes.
- D3: `length`, `size`, `includes`, `startsWith`, `endsWith`, `indexOf`, `has`, a comparison and the left side of `&&` end the flow. A member or destructured key of a literal or a local reads only that field. A `name = value` statement in an enclosing block replaces what a later read sees. A revealed value into an `s.secret` payload field is still reported.
- D4: both halves for a throw. E1112 reports the thrown value, and the server replaces the revealed value of each `Secret` in the request's decoded action input with `[secret]` in every `diag` record, in every form the `[pii]` scrub matches.
- D5: E1112's text moves to a new section, k.reveal (706 tokens). k.privacy drops to 1,361 tokens; `spec/00-map.md` stays at 1,200 with four trims.
- D6: `@keel/check` re-based from 51kb to 53kb; `@keel/server` within its limit.

**Alternatives.**
- Follow same-file helpers. Rejected: a finding would depend on a function body the author is not reading.
- Every call carries unless it is a known hash. Rejected: the hash set is open, and the documented form would depend on it.
- Runtime scrub only, or check only. Rejected: `console` and file writes never reach the server, and a throw through a helper or an import never reaches the checker.
- A registry of every revealed value. Rejected, as in ADR-0123: action at a distance.
- Trim k.privacy to fit. Rejected: about 560 tokens out of text five suites quote.

**Consequences.**
- `throw reveal(k)`, `btoa(reveal(k))` into a log, and `writeFileSync(f, reveal(k))` fail `keel check`; a throw of a request's secret input through any path logs `[secret]`.
- Still not followed: a parameter (callbacks included), a helper's body, an import, a stream's `.write`, `.call`/`.apply` of a sink, and the `s.secret` payload field case.
- Correct code that writes a key to a file or prints a token once moves to `unsafe/`.
- `@keel/check` has 813 B under its new limit.
