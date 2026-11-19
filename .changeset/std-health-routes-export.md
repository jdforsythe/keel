---
"@keel/std-health": patch
---

`package.json` names the `./routes` export, so a deployable that places `health` in `topology.ts` gets `health.status` in its route table from `keel build` and `keel dev`.
