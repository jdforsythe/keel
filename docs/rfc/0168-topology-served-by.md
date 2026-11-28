# RFC 0168: k.topology: the deployable key `host` becomes `servedBy`

Status: implemented (ADR-0190). Decision D67 item 1 of the operator.

## Decisions
- D1: the key on a `client` deployable that names the `node` deployable serving it is `servedBy`, not `host`. Same value (a string literal naming a `node` deployable), same rules.
- D2: no alias. `host` is not a key of a deployable: the deployable's object is closed, so `host` is E1552 in `topology()` and in the static read. Nothing is released, so no migration text, codemod or old-shape reading exists.
- D3: the code E1566 and its meaning stay; only the key it names changes. Section ids and titles `k.hosting` ("Client hosting") and `k.host` ("Host reads") stay; the k.hosting paragraph "Host" is "Served by".
- D4: derived names that are public change with the key: the `Topology` and `DeployTopology` field, the `@keel/compiler/hosting/hostProblems` subpath (to `servedByProblems`), the client manifest key `keel:host` (to `keel:servedBy`), diagnostics, explanations, skills, READMEs, guides, apps. Names inside a package that no one imports (`hosted` locals, `hostClient`, `hostingDiags`) keep their names; they say "hosts", which stays true of the node deployable's role, and no public surface shows them.
- D5: prose that says "static host" for a file server, and the HTTP `Host` header, hostnames and `location.host`, are unchanged.

## Problem
`topology({ web: { modules, adapter: 'client', host: 'api' } })` uses `host` for "the `node` deployable that serves this client" (k.hosting Host). A host element (rfc:0159, on another branch) is a different thing that the API will call "host": a typed element a component names. With both, an app reads `host: 'api'` in `topology.ts` and a host element in a component and means two things by one word. The topology key is the one that changes, since nothing is released.

Reach, from `grep -rnw host` over `spec/ docs/ packages/*/src packages/*/conformance packages/cli/skills apps/` (1,013 hits in 205 files outside `docs/rfc` and `docs/adr`), sorted:
- The topology key or a name derived from it: 6 spec files (k.topology, k.hosting, k.mount, k.security, k.return, the map row), 15 source files, 14 unit-test files, 8 conformance files, 2 golden `topology.ts`, 2 app READMEs, `evals/tasks/golden-2/TASK.md`, 3 guides, 1 skill (`.claude/skills/keel-deploy/SKILL.md` is the same file), 4 package READMEs. Listed below.
- Unrelated, left alone: about 900 hits in 170 files. A DOM `host` element variable in ui, runtime-dom, router, ctx, forms, testing and compiler conformance and tests; `req.headers.host`, `URL.host`, `location.host` and `http.request({ host })` (server, compiler inspect middleware, std-capacitor, std-tauri, std-sessions, cli port probe); "static host" and "the host's `Intl`" prose; k.host (Zone and locale, Node globals) and its E1758/E1759 files; `ShellHost`, `hostIo` (the shell's build host).

Today an unknown deployable key is not reported anywhere: `TopologySchema` is an open `s.object` and `parseTopology` skips a key it does not know. After a rename that alone, a leftover `host: 'api'` would be ignored and the client left unserved, found only by E1581 when a page imports `identity.ts`, or by a 404 at run time. So the rename needs the closed object to hold without an alias.

## Proposal
Declaration: `topology({ <name>: { modules, adapter, servedBy?, storage?, shells?, caller? } })`.

```ts
export default topology({
  api: { modules: ['todos'], adapter: 'node' },
  web: { modules: ['todos'], adapter: 'client', servedBy: 'api' },
});
```

Everything the key did, it still does: `keel build` copies the client into `dist/api/`, `createApp` of `api` answers the document requests, `keel dev` and the CI and Docker generators read it, E1581 reads it.

Closed deployable object, new behaviour: a deployable key other than `modules`, `adapter`, `servedBy`, `storage`, `shells`, `caller` is E1552 (k.topology Rules). `topology()` throws `E1552 invalid topology at web.host` (`TopologySchema` becomes `s.object(shape, { closed: true })`, rule `unknown-key`, k.schema); the static read reports `E1552 web: host is not a deployable key; one of modules, adapter, servedBy, storage, shells, caller` at the key. No special message for `host`: an alias that guides is a half-alias.

Derived names, exhaustive:
- Types and fields: `Topology[string].host` (`packages/compiler/src/types/Topology.ts`), `DeployTopology` `host` (`packages/scaffold/src/types/DeployTopology.ts`), scaffold `DeployableNode.host` (to `servedBy`).
- Functions and constants: `hostProblems` and its subpath `@keel/compiler/hosting/hostProblems` to `servedByProblems`; `HOST_NOT_LITERAL` to `SERVED_BY_NOT_LITERAL`, message `servedBy must be a string literal`; the E1566 text of each problem (`<name>: servedBy on a <adapter> deployable; only a client names what serves it`, `<name>: servedBy <x> is not a node deployable`, `<name>: servedBy <x> already serves <first>`).
- Artifact field: the client manifest written by `keel build` into the serving deployable's `CLIENT_MANIFEST` carries the client under `keel:host`; it becomes `keel:servedBy`. `routes.json`, `surface.json`, `std.json`, `csp.txt`, `deploy/` files and `dist/<name>/` paths carry no `host`; nothing else in an artifact changes.
- Check position: E1566 is reported on the first `servedBy` after the deployable's key (`topologyDiags` looks for it with `/\bhost\b/`).
- Not renamed: `hosted` (locals in `createApp.ts`, `loadAssets.ts`, `ciWorkflow.ts`, an E1555 message "index.html of the hosted client is missing"), `hostClient`, `hostingDiags`, the `hosting/` directory, `BuiltClient` wording. They are in no public type, subpath, artifact or diagnostic key; E1555's message says "hosted client", which stays true of a client a node deployable hosts. The smallest change leaves no public `host` meaning a deployable.

## Alternatives
- `servedBy` and an alias `host` that warns: nothing is released, so the alias is a surface to remove again, and the closed object cannot be both closed and tolerant.
- `servedBy` kept open (an old `host` ignored): a silent unserved client.
- `serves` on the node deployable (`api: { serves: 'web' }`): a node deployable would list several clients; the rules (one client per node deployable, E1566) are written on the client. `servedBy` keeps the one place and the one rule.
- `from`, `origin`, `via`: say less. `servedBy` reads in the sentence the spec already uses: "names the `node` deployable that serves it".
- Rename `hosted` and `hostClient` as well: a larger diff in packages no one reads, for no public gain; rename when a package is touched for other reasons.

## Spec diff
Applied in this commit (status unchanged):
- k.topology: Declaration `host?` to `servedBy?`; Rules E1552 gains "a deployable key but `modules`, `adapter`, `servedBy`, `storage`, `shells`, `caller`".
- k.hosting: paragraph "Host" is "Served by" with `servedBy: '<name>'`, `dist/<name>/` and "that deployable's `createApp`"; E1566 names `servedBy`; the conformance bullet uses `servedBy`, and a new bullet: a deployable with `host: 'api'` is one E1552 naming `host`, and `topology()` throws E1552.
- k.mount Origins and E1581: "through its `servedBy`", "without `servedBy`" (two sentences shortened to stay under the section limit; k.mount 5,995 of 6,000).
- k.security Other deployables: "serves (`servedBy`) carries"; k.return: "the origin of the `node` deployable its `servedBy` names".
- Map: the k.hosting row's key word is `servedBy`.
No section's id or title changes; no limit is raised (k.topology 5,971, k.hosting 4,572, k.security 5,997).

## Diagnostics whose message, fix text or explanation names the key
- E1566 (k.hosting): spec rule, the three messages above, the `HOST_NOT_LITERAL` message, and its `EXPLANATIONS.ts` entry (title "servedBy on a deployable that is not client, ...", why "The `node` deployable named is the one that serves a client build's index.html and assets.", fix `web: { modules, adapter: 'client', servedBy: 'web' } -> servedBy: 'api' (a node deployable)`).
- E1581 (k.mount): `EXPLANATIONS.ts` title "a static or `servedBy`-less client deployable" and fix `adapter: 'client' -> adapter: 'client', servedBy: 'api'`; its emitted message (`<name> (<adapter>) serves module <id>, whose origin mounts no handle`) names no key.
- E1552 (k.topology): the new unknown-key case; its `EXPLANATIONS.ts` title gains "or a deployable key it does not list".
- E1555 (`loadAssets`): message "index.html of the hosted client is missing" keeps "hosted client"; unchanged.
No other code names the key; E1565, W1567, E1560 name `KEEL_PEER_<NAME>` and origins.

## Conformance diff
By the `conformance-writer` under `rfc:0168`. Each file: "key renamed, nothing else" unless stated.
- `packages/server/conformance/hosting-0087.test.ts`: key renamed in the `With host: 'api'` clause, its header quote and fixtures (lines 7, 387 to 424), including the three E1566 fixtures (`host` on a `node`, naming an unknown, naming a `static` deployable). Plus: a topology with `web: { ..., host: 'api' }` makes `topology()` throw a message starting `E1552`.
- `packages/server/conformance/mount-placement.test.ts`: key renamed.
- `packages/check/conformance/mount-rules.test.ts`: key renamed (two fixtures, `hosted` variable kept).
- `packages/check/conformance/fixtures-by-code.ts`: key renamed (lines 575 and 579, E1566 and E1581 fixtures). Plus an E1552 fixture: `web` with `host: 'api'`, one E1552 at `topology.ts` in `keel check`.
- `packages/cli/conformance/mount-rules-build.test.ts`: key renamed. Plus: `keel build` of the same fixture with `host: 'api'` prints one E1552 naming `host` and builds nothing.
- `packages/cli/conformance/boundary-support.ts` and `boundary-client.test.ts` (a comment header): key renamed.
- `packages/compiler/conformance/boundary-stubs.test.ts`: key renamed.
All other `host` hits in `packages/*/conformance` are unrelated (listed under Problem).

## Build lane
Unit tests that use the key, renamed by the build: `packages/server/test/{hosting,security,topologySchema}.test.ts`, `packages/compiler/test/{hosting,topologyRead,mountDiags}.test.ts`, `packages/check/test/topologyDiags.test.ts`, `packages/cli/test/{hostingDiags,viteTargets}.test.ts`, `packages/scaffold/test/deployHost.test.ts`; `topologySchema.test.ts` also gains the closed-object case. Source: the files named under Proposal plus `compiler/src/vite.ts`, `compiler/src/hosting/mountDiags.ts`, `compiler/src/internal/{parseTopology,hostClient}.ts`, `server/src/{topology,createApp}.ts`, `server/src/internal/TopologySchema.ts`, `scaffold/src/internal/{topologyAst,topologyOf}.ts`, `scaffold/src/templates/ciWorkflow.ts`, `check/src/internal/{topologyDiags,EXPLANATIONS}.ts`, `cli/src/internal/hostingDiags.ts`. Prose: `apps/golden-1` and `apps/golden-2` `topology.ts` and READMEs; `evals/tasks/golden-2/TASK.md`; `docs/guide/{deploy-client,build-golden-1}.md` (the code samples, the E1566 bullet, "because `topology.ts` gives `web` the `host: "api"`"); `packages/cli/skills/keel-deploy/SKILL.md` (and its description's word "host", which is the key); READMEs of check, compiler, server (two places), cli. `docs/rfc/`, `docs/adr/` and `.changeset/` are the record and stay. The golden apps are rewritten directly; there is no old-shape reading.

## Cost
Size: spec +about 130 characters in k.topology, +132 in k.hosting, none over a limit; map tokens within the file budget. The `keel-deploy` skill is 4 words longer. Runtime: none. No new diagnostic code; E1552 gains one case. Contract: `@keel/compiler/hosting/hostProblems` is a renamed subpath.

## For the operator
- The rationale in the brief says an old `host` is an unknown key "under the existing diagnostic"; there is none today, since both the schema and the static read ignore an unknown key. D2 adds it (E1552, closed object). Recommendation: keep it; the alternative is a silent unserved client.
- The unknown-key rule is a new reach of E1552 for every deployable key, so a project with a typo such as `storge` now fails; that is the point. Recommendation: accept.
- `hosted` locals, `hostClient` and `hostingDiags` keep their names (D4). Recommendation: leave until their packages are touched.
