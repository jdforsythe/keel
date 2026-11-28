---
"@keel/server": patch
---

Every server log record is bounded and one line: a `diag` message and each frame, and a `req` method and path, are scrubbed, then each control character, U+2028, U+2029 and `…` is written as `\u` and four hex digits, then a message or path past 2,048 characters, or a frame or method past 256, keeps its head and ends in `…+<n>`.

When a request or runner holds a secret or `.pii()` value, a text over 2,000,000 characters is not read and is one mark, a `diag` keeping its prefix.
