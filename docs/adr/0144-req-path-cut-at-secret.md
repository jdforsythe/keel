# ADR-0144: the `req` path is cut at a secret segment, and a failed forward logs the error's name (RFC 0123)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** The server marks the `req` path by the route table: each segment that stands at a route's secret `params` field is `[secret]`. Only that one segment was marked, so a secret holding a raw `/` (about half of all base64 tokens), sent by a link built with string templating, left its second half in the log; the router 404s and the request reveals no value for the scrub. A failed peer forward wrote the runtime's error message, which can quote the URL and with it the path.

**Decision.**
- D1: a route lines up from the first non-empty segment to its secret param as before. When a non-empty segment follows the secret one, the path is cut there: the secret segment and the rest are one `[secret]`. The cut does not read the match result, so a front server cuts a forwarded path by the same rule.
- D2: the tail is one mark, not one per segment, so the log holds no slash count of the value.
- D3: with several routes lined up the earliest cut wins and the marks before it stay.
- D4: a path no route lines up with is logged as sent: a raw `/` in a plain param before the secret, a static typo or homoglyph, an extra leading segment, a secret search value in a link missing its `?`. Conformance asserts each, so a change needs an RFC.
- D5: a failed forward's `diag` is `peer unreachable: <name>`, the thrown error's `name` when it is a plain identifier of at most 64 characters, else `Error`, read inside a try. The message is never read.
- D6: no check rule and no startup warning: E1111 already refuses every secret route param in checked code, and the runtime marks are the backstop for tables check does not read.

**Alternatives.**
- Cut only a path no route matched: a raw-slash secret matching a longer plain route keeps its tail, and a front server would need another deployable's match result.
- Let a param take several segments to catch a raw `/` in an earlier param: every route with a param lines up with most long paths.
- Any-offset or fuzzy line-up (one-edit typos, NFKC, repeated decodes): unpredictable (principle 9).
- Run the forward message through the path marks: the marks line up a pathname, not a URL inside free text.

**Consequences.**
- A served path longer than a secret route it lines up with loses its tail in the log (`GET /reset/[secret] app.faq 200` for `/reset/help/faq` beside `/reset/:token`); the route id still names the page.
- A route whose secret param is first or follows only a prefix param (`/:token`, `/:lang/:token`) marks every path of two or more segments as one `[secret]`; such a table fails E1111.
- Marking stays linear in the path length: each route costs at most its own segments.
- A peer failure's `diag` names the error type; the runtime's message is not logged.
