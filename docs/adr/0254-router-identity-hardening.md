# ADR-0254: the identity mount and the router: one mount, no shadowed assets, stated fallbacks (RFC 0232)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** Red-team passes on the identity mount, the openings gate and the router left six lines. An `identityMount` call outside `identity.ts` passes `keel check` and puts the `/__keel/user` read in the bundle. `handle` at `/assets` answers every request for the built client's files, and E1579 allows it. `Set.text` returns an unparsed entry typed as a parsed one. Three lines are bugs against sentences the spec already holds (the fallback title after resume) or are already closed by them (a link-started guard hop, a failed opening store, a raw `\` in a prefixed `navigate`), with conformance missing for some.

**Decision.**
- Only `identity.ts`'s default export is the mount. The build passes it to the router and the shell; no other call's `path` or `links` reaches either. E1593 (error, `keel check`, at the call, no fix) reports an `identityMount` call in a non-test code file of the project other than that `export default` expression.
- E1579 also refuses a `handle.path` at or under `/assets`, literal or `identity.ts`'s `.path`, in `keel check`, `keel build` and `createApp`. Message `handle.path <p> is at or under /assets (built files)`, 89 units at the bound.
- `Set.text(entry)` parses with the set; a failing locale file throws when it evaluates, the same error `Set.load` rejects with.
- k.forms states that `issueText`'s `path` holds record keys and array indexes as the input holds them.
- `settle` keeps its 200,000-turn bound (task 0963 D39).
- Regression clauses: k.opening#15 and #16 (the guard hop and its sequence property), k.head#11 (the fallback after resume, carried in `#k-state`), k.prefix#8 (a raw `\` under a prefix, and a property: every navigation stays on the origin).

**Alternatives.**
- Accepting every call's `links`: two sources of mount paths. A run-time throw outside `identity.ts`: a call cannot know its file, and tests make mounts.
- Dispatching `handle` after the assets: a mount that half works.
- A check rule against importing a locale file directly: the type stays false wherever the rule cannot see.
- `*` for record keys in `path`: it would name a path no field has.
- A short `settle` bound tied to the sim clock: trips on an unrelated deadline.

**Consequences.** A test may still call `identityMount`; a module may not. A locale file pays one parse when it evaluates. No app changes: the golden apps, household and `examples/shell-mount` call `identityMount` only in `identity.ts`.
