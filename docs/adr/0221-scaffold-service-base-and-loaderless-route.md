# ADR-0221: k.scaffold: a service by its base, a route with no loader, a refresh in place of a build (RFC 0199)

**Status:** accepted (operator; under D103 and D104).

**Context.** A front end with no back end that calls a declared third-party origin is a first-class app. `keel scaffold service` took only an OpenAPI document and, in a module on a `client` deployable, wrote a file that fails E1571. `keel scaffold route` always wrote a loader. In a built project every scaffold ran a whole `keel build`, bundles included, so that `keel check` found no stale artifact. `examples/client-only-api` took 11 hand edits after the scaffold.

**Decision.**
- `service` takes `--openapi <file>` or `--base <url>` and writes `<Id>Api.schema.ts`, `api.server.ts` and the `@keel/services` dependency, the same files on every adapter. With `--base` the schema file is an empty `endpoints({})` the author fills.
- Where the module's deployable is `client`, `service` also declares the origin under that deployable's `origins.connect`, with the reason given as `--reason`. With no reason it is E1358 and writes nothing; the scaffold writes no reason of its own. An origin already declared needs none.
- `route --no-loader` writes a page route with no loader file, bound as `{ component }`. The default keeps its loader on every adapter.
- After an applied operation in a built project the scaffold refreshes what `keel check` reads: `keel build`'s check, the `.keel/` artifacts and the generated deploy files. No bundle, nothing under `dist/`, no flag. Nothing prints while it runs; the trailer counts `artifacts`.

**Alternatives.**
- Refuse `service` in a `client` module: leaves the client-only app its hand edits.
- A generated reason: a declared `connect` origin is a high-danger escape, and its reason is what a reviewer reads.
- File names or a loader default that follow placement: the same command would write different files, and `codemod place` changes nothing else.
- Keep the build, or leave it to the person: bundles `keel check` never reads (half of 7.1 s on `apps/golden-2`), or E1005 after every scaffold.

**Consequences.** A scaffold's output never fails E1571. `service` with no `--reason` in the default project is refused, which corrects ten k.scaffold conformance cases. The example's eleven hand edits become seven, all app content. A scaffold in a built project costs the check and two evaluations (1.4 s on `examples/client-only-api`, 3.8 s on `apps/golden-2`, summed from the build's measured steps), and `dist/` is rewritten by `keel build` alone. `@keel/cli` splits the build's disk half before its Vite builds.
