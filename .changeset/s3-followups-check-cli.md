---
"@keel/check": minor
"@keel/cli": minor
"@keel/scaffold": patch
---

k.compat: an open object accepts a field it lacks only if that field accepts any value; a GET endpoint needs a route with a loader; a route's error answer is a KeelError. E1567 reports a `service({ base })` whose endpoint a module of the same app serves. `keel check --base` with a file that is absent, unreadable or of another version is one W1568; with `topology.ts` unreadable every caller counts as split for E1562. `keel check` reports E1559. An endpoints file that throws is E1006 and fails `keel build`. The MCP `build` tool and `keel build` share one path (`Io.build`). `keel build` writes `.github/workflows/ci.yml` for a project outside a workspace, and the generated CI step always passes `--base`.
