# ADR-0171: std.channels: each serving module's bounds count its own channel routes' streams (RFC 0149)

**Status:** accepted (orchestrator, under the RFC defaults; for the user to confirm).

**Context.** `channelRoute` read the opener module's bounds but counted every module's open streams, so one module's streams used up another's `maxStreams` and `perCaller`.

**Decision.** A module's `perCaller`, `perAnonymous` and `maxStreams` count the streams open in the process on that module's channel routes.

**Alternatives.**
- Count every module's streams and say so: the strictest module's config decides for all.
- One process-wide config: config is per module everywhere else.

**Consequences.** Two serving modules no longer starve each other's channels; the kernel's `maxStreams` still caps the app's streams as one pool.
