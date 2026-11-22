# Findings from building the examples

## Status

| Finding | Status |
| --- | --- |
| 1 | answered in the skills (keel-client, Host and hostCode): docs(skills): Host and hostCode in keel-client, client-only server files in keel-server, hostCode's three type parameters |
| 2 | answered in the skills (keel-client, hostCode's three type parameters) |
| 3 | answered in the skills (keel-server, client-only server files) |
| 4 | fixed: fix(scaffold): scaffold service adds @keel/services to the project's dependencies |
| 5 | fixed: fix(scaffold): a workspace project's scripts call keel and its package.json names @keel/cli; a fresh scaffold passes its own scripts |
| 6 | filed as backlog 1013 |
| 7 | fixed: fix(check): a stale surface.json names the source that changed (hashing what the build evaluated is backlog 1015) |
| 8 | open: the spec ties link delivery to `identity.ts` in k.shell and not in k.links; needs an RFC or a k.shell edit, then the entry change |
| 9 | open: rough edge, documented |

Fixed 3, answered in the skills 3, filed as backlog 1, open 2.

Each entry: what I tried, where, the command and its output, what I expected, and whether the docs or skills misled me. None blocked an example; 8 leaves `examples/links-in` proven under the test harness and not in a built shell.

## Framework faults

8. A built shell with no `identity.ts` takes no link from outside. `examples/links-in` is a `client` deployable with `shells.tauri` (`id: 'dev.keel.linksin'`) and two pages, and no identity mount. `test/linksIn.test.ts` runs `renderRoute('places.home', { routes, shell: { id } })`, then `t.returnLink('dev.keel.linksin:/places/oslo')` and `t.launch([...])`: each lands on `places.place`, and `keel test` passes (3 tests). The build disagrees. `packages/compiler/src/vite.ts` passes the shell to `entryCode` as `shellOf(exists("identity.ts") ? all[d.name]?.shells : undefined)`, so without `identity.ts` the shell entry never calls `shellMount`, the only code that calls `@tauri-apps/plugin-deep-link` `getCurrent` and `onOpenUrl` (`packages/std-tauri/src/shellMount.ts`; Capacitor the same). The generated `tauri.conf.json` still registers the scheme and `lib.rs` the deep-link plugin, so the OS opens the app on the link and the page stays where it was. Expected, from `pnpm spec k.links`: "A link from outside reaches a page as a web link does", and of a return link whose path is "A page the router matches: a client-side navigation there, at any time". `pnpm spec k.shell` (Shell ctx) says only "With `identity.ts` the entry calls the package's `shellMount(...)` ... then delivers return links (k.links)", so the two sections disagree and I did not change the entry: the fix is an always-on link intake in the shell entry (a `shellMount` with no mount, or a links-only call over `mountRequests` with `mounts: []`), a k.shell sentence, and a conformance clause owed in k.shell: "a shell build of a project with no `identity.ts` delivers a page link to the router". The test harness hides it because `renderRoute(..., { shell })` delivers links whatever the project holds.

## Docs or skill gaps

1. `Host` is missing from the skills. `.claude/skills/keel-client/SKILL.md` names no `Host`, `hostCode` or E1824; I found the element only through `keel docs k.host-element` and `keel docs k.host-code`. Expected: a short `Host` paragraph in keel-client, beside widgets and tables.
2. `hostCode`'s state type is undocumented. `k.host-code` says `mount` "returns the code's own state `S`" and shows `HostCode<I, E>` with two parameters. Following it, `hostCode<Infer<typeof Bars>, never>({ mount(node, value) { ...; return svg } })` in `examples/host-component/modules/app/barChart.ts` fails `keel check` with `E1751 ... TS2322 Type '(node: HTMLElement, value: ...) => SVGSVGElement' is not assignable to type '(node, value, out: HostOut<never>) => undefined'`. A third type argument, `hostCode<Infer<typeof Bars>, never, SVGSVGElement>`, fixes it. The section also leaves open whether `I` is the schema or its value (it is the value; `typeof Bars` gives a TS2345).
3. The keel-server skill says of `*.server.ts` files that "Browser builds stub those files". In a client-only app (`examples/static-client`, `adapter: "client"`) the `loadHome.server.ts` loader runs in the browser, as `keel docs k.router` (Execution) says. The skill misled me until the Chromium run showed the loader's text.

## Rough edges

4. `keel scaffold service app --openapi openapi.json` in `examples/openapi-import` writes files importing `@keel/services` and leaves `package.json` without it. `keel check` then prints `E1751 modules/app/AppApi.schema.ts:3:27 TS2307 Cannot find module '@keel/services'` twice with no fix. Expected: the scaffold adds the dependency, or `keel check` reports E1572 naming the package.
5. `keel scaffold project <name> --workspace` writes a `package.json` whose `check` script is `tsc --noEmit && biome check modules test`, without `keel check`, and with no `@keel/cli` in `devDependencies`; `apps/inspector` has both. I added both by hand in each example.
6. `keel scaffold service <module>` names the client after the module (`AppApi`, `api`), not after the service; `openapi(doc, { name })` takes a name, the command offers no flag for it.
7. After the first `keel build`, a source change that `biome check --write` makes (an import reorder in `loadHome.server.ts`) turns `keel check` into `E1005 .keel/surface.json:1:1 generated .keel/surface.json does not match its sources; run keel build`. Expected: an import order change leaves the surface unchanged, or the message says which source moved.
9. A `node` peer that calls no other still needs every other peer's URL. In `examples/compose-peers`, `api` serves `/api/hello` and calls nothing; `PORT=8391 KEEL_SECRET=... node dist/api/server.mjs` exits with `E1560 KEEL_PEER_WEB fails DeployEnv (required); set it where the image runs`. `pnpm spec k.deploy` says so ("`KEEL_PEER_<NAME>` ... required per other `node` deployable"), and the reason is forwarding: a request for a path a peer serves goes to that peer (k.topology Calls and peers). So two peers started by hand each need the other's port before either starts; `tooling/smoke/examples.mjs` picks both ports first. The docs did not mislead me; the README says it.
