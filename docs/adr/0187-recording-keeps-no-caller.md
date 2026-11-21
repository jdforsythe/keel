# ADR-0187: k.user: a recorded session keeps no `meta.caller`, whatever the caller lifetime (RFC 0165)

**Status:** accepted (orchestrator, under the RFC defaults; for the user to confirm).

**Context.** k.user said std.sessions' capture replaces a recorded `meta.caller` under `caller: { days }`, but the recorder runs in the browser and cannot know `days`, a `topology.ts` field. The recorder already keeps no transaction `meta` (a `tx` event is store, name and payload; `state` comes from `snapshot()`, which drops `meta`).

**Decision.** A std.sessions recording keeps no `tx` `meta`, so no `meta.caller`, under any caller lifetime; it never learns the lifetime. A caller hash an app keeps in state is a field the app marks `.pii('network')`.

**Alternatives.** Send `days` to the page and replace only under it (a page field nobody else needs); record `meta` and replace `caller` in it always (a `Session` schema change for data no replay reads).

**Consequences.** The spec matches the code; one std-sessions conformance file is written and one cli header retagged. A std.multi group's `server` fixture keeps its `meta`: it is the test author's data under simulation.
