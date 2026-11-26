# ADR-0293: k.derived: check sees the project as it is (RFC 0255)

**Status:** proposed

**Context.** `keel check`, `keel test`, `keel ledger` and dev's inspect document read `.keel/` files that only `keel build` and the Vite plugin write, so an edit is judged against the last build. Reproduced on `apps/household`: a page, route, contract, store or `topology.ts` edit is a wrong E1005 ("run keel build"); a dependency upgrade that breaks stored states, or a tree with no `surface.json`, passes `keel check --base` although `keel build` then shows E1563; a read-only `.keel/` makes `keel test` run no test; `keel check` beside `keel dev` disagrees with what dev serves. The guide and the `keel` skill tell people and agents to build before every check.

**Decision.**
- A derived file (the `.keel/` artifacts, `surface.json`, the deploy files) is never read from disk to judge, test or serve: each reader takes the derivation of the tree it runs over. The files are views.
- Every run that is not frozen rewrites each view whose bytes differ, by atomic rename, with no lock, skipping a write whose inputs changed during the run; the language server writes none. One trailer count, `refreshed`; a view that cannot be written is W1018.
- Frozen (`--frozen`, `CI` set, or `KEEL_FROZEN=1`): nothing is written, a differing view is E1005.
- `routes.json` and `surface.json` come from one evaluation, cached in `node_modules/.cache/keel/derived/` keyed by every file it loaded, under the type cache's rule; the evaluation runs in RFC 0251's `data` child, so the loaded set is the set that can change the result.
- `surface.json` is version 3 with no `sources`; k.compat's normal form is removed. Only `surface.json` and the deploy files are committed. W1005 is reserved.

**Alternatives.** A watcher daemon (needs starting; an agent's shell has none); "build first" documented (today's state, a rule to remember, wrong greens stay); a warning instead of E1005 (keeps every wrong green); re-derive with no cache (0.3 to 0.7 s per check); a digest written into each view (public, so forgeable, and it changes committed files on every dependency bump); no views at all (people and tools read them).

**Consequences.** Edit, `keel check`, done, for a person and an agent; the skill line telling agents to build first goes. CI derives the surface it compares, so a breaking dependency bump fails E1563. Pull requests stop conflicting on compiled views and on `surface.json`'s source hashes. `keel check` writes inside `.keel/` and `deploy/`, never a source. Slice 3 depends on RFC 0251's evaluator. k.derived's clauses hold the time bound: refresh adds at most 100 ms with nothing changed.
