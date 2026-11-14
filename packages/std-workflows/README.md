# @keel/std-workflows

**Spec:** std.workflows · **Status:** proposed · **verified:** (none)

Durable multi-step workflows: a state chart run per instance over `@keel/std-jobs`.

## Contract

- **Public API:** none yet. The package has the entries `@keel/std-workflows`, `@keel/std-workflows/tools` and `module.ts`, all empty.
- **Invariants:** none yet.
- **Dependencies:** `@keel/check`, `@keel/compiler`, `@keel/ctx`, `@keel/schema`, `@keel/server`, `@keel/std-jobs`, `@keel/std-statecharts`, `@keel/store`.
- **Rungs:** none yet.

## Extension points

Will use the **module manifest** (k.module: stdlib module `workflows`), an **inspector hook** (k.cli: section `workflows.instances`) and the **check rule registry** (k.check: E2351 to E2354 from `./tools`).

## Unsafe

count: 0
