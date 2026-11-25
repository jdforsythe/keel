---
"@keel/server": minor
"@keel/services": minor
---

rfc:0230: the log scrub finds a value as given, in NFC and NFD, as hex and as base64 at any alignment, in the text and in decoded views that undo `%` escapes, `+`, JSON escapes and HTML entities; its cap is 65,536 bytes of a scope's distinct values; a lost `onSecret` slot keeps a `diag`'s prefix; a `req` path mark takes in the slashes beside it; a server event over 1,048,576 bytes ends the stream with `keel.unexpected`, and a service client caps one event at `maxBytes` with `api.decode`; a 422 re-render keeps the plain siblings of an `s.secret`.
