---
"@keel/scaffold": minor
---

`deploy/compose.yaml` passes `KEEL_POSTGRES_URL`, required, from the environment to each `node` service serving a module whose `deps` list `@keel/std-postgres`.
