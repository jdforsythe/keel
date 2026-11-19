---
"@keel/router": minor
---

A shell admits a return link only while a mount request has opened the external browser: each opening is kept in `ctx.storage` `keel.return` with a deadline 600000 ms on, a new one replaces it, and a return link first takes it in one `commit`. With none pending, past its deadline or of another shape, the link sends no request and navigates nowhere. Only a chain the page starts (a `Link` click, `navigate`, `ok(href)`, a `Form`, and the redirects after it) records an opening; a chain a return link starts records none, whatever it opens. A mount answer redirecting to the shell's own scheme takes no opening and continues its chain, counting toward the 5 redirects in a row. `mountRequests` takes an optional `close`, called for an admitted link.
