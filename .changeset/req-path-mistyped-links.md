---
"@keel/server": patch
---

The `req` path marks a value sent for a secret route param in a mistyped link too: a route lines up by its segments up to the secret one, with a tail ignored, empty segments skipped and static segments compared decoded once in either letter case (or not decodable). The marks come from every route in `routes`, so a path forwarded to a peer deployable is marked by the peer's routes. The last resort's `diag` names the matched route id, and when the log cannot take it, stderr gets one fixed line per process.

A segment at a `.pii()` route param is `[pii]` by the same line-up, a longer path cut there, and `[secret]` wins where both marks fall on one segment. With a secret param in the table, a segment holding `%2F` or `%5C` in either case cuts the path as `[secret]`.
