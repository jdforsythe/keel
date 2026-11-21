---
"@keel/compiler": minor
"@keel/server": minor
"@keel/scaffold": minor
"@keel/check": minor
"@keel/cli": minor
---

The `topology.ts` key that names the `node` deployable serving a `client` is `servedBy`, not `host`: `topology({ web: { modules, adapter: 'client', servedBy: 'api' } })`. A deployable takes `modules`, `adapter`, `servedBy`, `storage`, `shells`, `caller` and `origins`; any other key, a leftover `host` included, is E1552 from `topology()`, `keel check` and `keel build`. `Topology` and `DeployTopology` carry `servedBy`; `@keel/compiler/hosting/hostProblems` is `servedByProblems`; the client manifest key `keel:host` is `keel:servedBy`; E1566 and its explanation name `servedBy`.
