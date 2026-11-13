---
"@keel/server": minor
---

Every response carries the six security headers, and HSTS over https; every document a fresh-nonce Content-Security-Policy (report-only in dev) with the nonce on its module script and `<meta property="csp-nonce">`; other responses `default-src 'none'; frame-ancestors 'none'`; a hosted client's `index.html` the `csp.txt` policy. `POST /__keel/csp` logs `csp` records (origin and route id only) under a 100-per-60 s window and a 16 KiB body cap. An uncaught action or loader throw is a `keel.unexpected` diag, and no diag or thrown message holds a `.pii()` value. A write behind a TLS-terminating proxy passes the same-site check by `x-forwarded-proto`. `@keel/server/csp` exports `cspPolicy` and `securityHeaders`.
