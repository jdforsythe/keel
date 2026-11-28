# ADR-0202: k.testing: `renderRoute` with `app` runs a `node` page as the build serves it (RFC 0180)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** A built `node` page has no client router, so its `<Form>` posts natively and the reader sees the server's answer document. `renderRoute` always mounts the client router and calls the action in process, so the 422 document and the 303 are never exercised under test. A real fault in that path passed every app test.

**Decision.** `renderRoute(id, { app })`, `app` a `createApp` result, GETs the page through `app.fetch` and resumes it. A valid submit is POSTed urlencoded to `app`, a 303 is followed, and the answer is resumed in place of the page before `fire` resolves. Without `app` the router renders, as now. `state` or `shell` with `app` is E1722. `keel check` warns W1723 for a literal `renderRoute` id of a `node` deployable's module without `app`.

**Alternatives.** A `topology` option or `keel test` reading `topology.ts` (a testing-to-server dependency cycle); a default document mode with the harness's own app (the same cycle, and the test's storage and peers); manual `resumeDocument` steps (the harness keeps passing where the build fails); an error for a missing `app` (router-mode component tests stay useful).

**Consequences.** A node page's form test runs the path the build runs. k.testing reads `implemented` until four new clauses are covered. New codes E1722 and W1723.
