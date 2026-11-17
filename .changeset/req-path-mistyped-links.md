---
"@keel/server": patch
---

The `req` path marks a value sent for a secret route param in a mistyped link too: a route lines up by its segments up to the secret one, anywhere in the path, with empty segments skipped and static segments compared leniently (decoded, any case, a trailing dot or `;` part dropped, one edit off, or not decodable), and each segment past the route is marked. The marks come from every route in `routes`, so a path forwarded to a peer deployable is marked by the peer's routes. The last resort's `diag` names the matched route id, and when the log cannot take it, stderr gets one fixed line per process.
