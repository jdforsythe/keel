# ADR-0112: a submitted `s.secret` or password-input value never returns in a response (RFC 0089)

**Status:** accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC default 4.

**Context.** A 422 re-render restored the whole submission through `#k-state`, so a mistyped form sent the password back in the page source, where caches, logs and extensions can read it.

**Decision.** The server drops submitted values for `s.secret` fields before rendering and, after rendering, those named by a rendered password input. `Field.bind` writes no markup default for an `s.secret` field. The field returns empty; the rest of the submission and the field errors are restored.

**Alternatives.**
- Restoring nothing, rejected: every field retyped for one mistake.
- Schema secrets only, rejected: a password input over `s.string` is the common case.

**Consequences.**
- A password is retyped after any failed submit.
- A hidden input still carries its value: the app chose to put it in the DOM.
