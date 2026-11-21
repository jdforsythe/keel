# 0653: an unreadable subfolder `topology.ts` is not a project root

Choice: (b). The spec never says what a project root is. `spec/kernel/k.check.md` speaks of "the project" and "that project's `topology.ts`" without defining it. The only definition is in `docs/rfc/0059` (Project): "a `.keel/` artifact or a `topology.ts` that parses as one", which is what `projectDirs` (`packages/compiler/src/projectDirs.ts`) implements. So the code matches the one written rule, and the rule itself is the gap.

Reproduced: `packages/check/test/topologyUnreadable.test.ts`, the workspace case, is `it.fails`. A root `topology.ts` plus `apps/web/topology.ts` (`const t = {...}; export default topology(t)`) gives no E1552; `apps/web/` is folded into the root project.

## Sentence to add

Section `spec/kernel/k.topology.md`, Rules, E1552. `k.check.md` is 5,987 chars (1,497 tokens), so it cannot take a sentence. `k.topology.md` is 5,377 chars today; after about 230 added chars it is about 5,610 chars, 1,403 tokens (limit 1,500).

Today: "E1552 `topology.ts` not statically readable, a name not `[a-z][a-z0-9-]*`, a module unknown or in two deployables"

Change: append after the Rules paragraph's E1552 clause: "A project root is the root or any folder without a `modules` segment that holds a `.keel/` artifact or a `topology.ts`, readable or not; an unreadable one is E1552 at its path and the folder's files are checked as that project's."

## Conformance headers that quote a sentence changed

None quote the E1552 line verbatim for project roots: `packages/server/conformance/e1552-topology-modules.test.ts` pins createApp only. `packages/cli/conformance/workspace-same-diagnostics.test.ts` and `workspace-artifacts*` pin workspace parity and should be re-read by the writer for fixtures with an unreadable topology (none known).

## Conformance cases wanted

1. Files: `topology.ts` (literal, `web` serves `a`), `modules/a/module.ts`, `apps/web/topology.ts` = `const t = { web: { modules: ['a'], adapter: 'node' } }\nexport default topology(t)`, `apps/web/main.ts`. `check` gives exactly one E1552, path `apps/web/topology.ts`.
2. Same, plus a rule-visible fault in `apps/web/main.ts` (for example an E1004 route fault): reported with the `apps/web/`-relative project, not the root's.
3. Same with the unreadable file at `modules/a/ui/topology.ts`: no E1552 and no project (module code is never a root).
4. `keel build` at the root does not include `apps/web/` files in the root project (same `projectDirs`).

## Code change in outline

`@keel/compiler` `projectDirs`: drop the `parseTopology(...).problems.length === 0` test (a `topology.ts` outside `modules/` is a root). `@keel/check` needs no change: `check.ts` already runs `topologyDiags` per dir and `topologyOf` yields no topology for an unreadable one. `keel build` shares `projectDirs`, so a stray unparsable `topology.ts` in a subfolder now removes that folder from the root build: this is the user's call (below). The `@keel/check` size is untouched; compiler budget not measured.

## The user's to decide

Whether an unreadable nested `topology.ts` should detach its folder from the root build (the proposal) or only be reported while the folder stays in the root project (smaller, but E1552 would then name a path no project owns).

## Recommendation

Adopt the sentence and the `projectDirs` change. A file named `topology.ts` that the tool cannot read should be reported where it is, and its folder should stay its own project, so the diagnostics tell the truth.
