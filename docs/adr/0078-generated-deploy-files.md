# ADR-0078: Dockerfile, compose and CI per deployable come from one scaffold generator (RFC 0080)

**Status:** accepted (2026-11-10), user decisions D1 and D3, under the WORKFLOW RFC defaults 3 and 6.

**Context.** Dockerfiles and compose are listed among the generated, read-only files, and the scaffold refuses to edit them, but nothing generates them. `keel check` reports E1005 only for `.keel/*.json`, and the repository checks its own generated files with `tooling/generate.mjs --check`.

**Decision.** One pure generator in `@keel/scaffold` derives the deploy files from `topology.ts`: `deploy/<name>/Dockerfile` per `node` deployable (`node:22-slim` pinned by the index digest `sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d`, `dist/<name>/` only, user `node`, volume `/data` for storage, port 8080), `deploy/compose.yaml` with a service and volume per `node` deployable and peers wired by service URL, and, outside the Keel repository, `.github/workflows/ci.yml` with a job per deployable that checks with `--base`, tests, builds and builds images without pushing. `keel build` and the scaffold operations that change modules write them; `keel check` reports a differing file as E1005 with the regenerated file as its fix; `tooling/generate.mjs --check` runs the same generator for the repository's apps. `keel codemod place <module> --to <deployable>` is the split as an operation. Runtime values are set only through `DeployEnv` where the image runs. This repository's CI builds golden-1's images.

**Alternatives.**
- Images for `client` and `static` deployables, rejected for now: it would decide backlog 0305 by the back door.
- Registry push, deferred: a later RFC adds a schema-declared registry field to a deployable in `topology.ts`.
- A separate generator for the repository, rejected: two generators for one file shape.

**Consequences.**
- The base image's digest moves with Keel releases, not with each project.
- The eval does not run Docker; the generated CI and this repository's golden-1 job build the images.
- `@keel/scaffold` grows by about 1.5 kB inside its 16 kB budget.
