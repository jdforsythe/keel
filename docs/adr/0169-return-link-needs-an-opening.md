# ADR-0169: a return link needs an opening (RFC 0147)

**Status:** proposed (for the orchestrator to accept under the operator's agreement to the restriction).

**Context.** A shell registers its `id` as a URI scheme and reads each return link as a redirect on `KEEL_ORIGIN`; under the mount that is a GET with the native cookies and `x-keel: 1`. Any app or web page can open such a link, so a library endpoint that changes state on a GET under its mount is reachable from outside the app with the person's session.

**Decision.**
- Each time a mount request opens the external browser, one opening is pending, kept in `ctx.storage` `keel.return` with a deadline 600000 ms on; a new opening replaces it.
- A return link first takes the pending opening in one `commit`; with none, or past the deadline, it is ignored and sends no request. One link per opening, page links included.
- A mount answer redirecting to the shell's own scheme is read as a return link that takes no opening.
- Enforced in the router's shell intake, the same for Capacitor and Tauri; app code does nothing. No new diagnostic.

**Alternatives.** Memory-only openings (a mobile OS killing the app mid sign-in fails the return). No lifetime (an abandoned sign-in leaves the window open). Several openings at once (a wider window per retry). A one-time value bound into the opened URL (Keel would write into and read the library's URLs; the library's `state` already binds its flow). Gating mount paths only (two rules for one intake). A warning per refused link (attacker-driven noise; recorded as an open question).

**Consequences.**
- A link sent while no sign-in is in progress does nothing.
- While one is pending, another app or page can send a link first: it takes the opening, its GET carries the native cookies, and the real return is ignored. A state change on a GET under the mount is reachable in that window only; that stays the library's to avoid.
- A flow started outside the app (an emailed link) cannot return through a return link; a deep link to a page from outside no longer navigates.
- k.return goes to `implemented` until the conformance commit covers the new bullets.
