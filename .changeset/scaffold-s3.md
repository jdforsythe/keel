---
"@keel/scaffold": minor
---

`deployFiles(topology, { ci })` generates the deploy files of a topology: a Dockerfile per `node` deployable on `node:22-slim` pinned by digest, `deploy/compose.yaml` with peers wired by service URL, and a CI workflow with a job per deployable that checks against the base surface, tests, builds and builds an image it never pushes. `deployDrift(files, always?)` lists the deploy files of a tree that differ from it. New codemod `place {module, to, adapter?}` moves a module between deployables in `topology.ts`, creating or removing deployables, and regenerates the deploy files. `project`, `module` and `rename module` write the deploy files and the topology-derived CI workflow; `topology.ts` holds one deployable per line with sorted module lists.
