# ADR-0168: `keel report` reads an app's own route (RFC 0146)

**Status:** proposed (for the orchestrator to accept).

**Context.** `keel report [url]` reads `<url>/__keel/inspect`, which only a dev server answers, so a built app has no way to hand a tally to a person. Keel must not add a production endpoint or hold a credential. The one credential mechanism in the CLI is `keel session ingest`'s: a token from the caller's environment sent as the caller cookie, admitted by a guard that lists callers.

**Decision.**
- C1: the URL decides the form before any request. No path and no query: the inspect form, unchanged. A path beyond `/` or a query: the route form, one request to the URL as given.
- C2: a route answers 2xx JSON that parses with `Tally` or `s.array(Tally)`; the app serves it from its own route behind its own guard.
- C3: an array is emitted in the order given.
- C4: any other answer in the route form is E1056, exit 1: not 2xx, not JSON, an inspect document, an array with one bad item.
- C5: `KEEL_REPORT_TOKEN` in the environment is sent as the caller cookie on the route-form request, the way `keel session ingest` sends its token. Keel stores nothing and adds no flag.
- C6: the E1056 message names the URL without its query.
- C7: no new code; k.cli is unchanged; std.report is `implemented` until its conformance lands.

**Alternatives.** Trying the URL and falling back to the inspect path (two requests, and one answer's meaning depends on another). Telling the forms apart by the body (the default URL would ask a dev app for its page). A `--route` flag (says what the URL says). Sorting an array by id (an array has an order, and ids may repeat). Skipping bad items (hides a broken route). A `--header` flag (a secret on the command line, new surface). No credential (a guarded route readable only from inside the network; the runner-up). Reusing `KEEL_SESSIONS_TOKEN` (one credential for two packages' routes). A Keel route in the build (a production endpoint Keel would own).

**Consequences.**
- A build serves tallies from a route the app writes and guards; `keel report <that url>` prints them.
- Every invocation that works today is in the inspect form and behaves the same; std.report bullet 12 holds for it.
- `keel report http://host/base` no longer appends `/__keel/inspect`.
- The guard of a tally route admits a listed `caller` or relies on the network; a `user`-only guard is not readable from the CLI.
- std.report sits at its 1,500-token limit.
