# Findings from building the examples

A working file for the orchestrator. Each entry: what I tried, where, the command and its output, what I expected, and whether the docs or skills misled me. None blocked an example.

## Framework faults

None found.

## Docs or skill gaps

1. `Host` is missing from the skills. `.claude/skills/keel-client/SKILL.md` names no `Host`, `hostCode` or E1824; I found the element only through `keel docs k.host-element` and `keel docs k.host-code`. Expected: a short `Host` paragraph in keel-client, beside widgets and tables.
2. `hostCode`'s state type is undocumented. `k.host-code` says `mount` "returns the code's own state `S`" and shows `HostCode<I, E>` with two parameters. Following it, `hostCode<Infer<typeof Bars>, never>({ mount(node, value) { ...; return svg } })` in `examples/host-component/modules/app/barChart.ts` fails `keel check` with `E1751 ... TS2322 Type '(node: HTMLElement, value: ...) => SVGSVGElement' is not assignable to type '(node, value, out: HostOut<never>) => undefined'`. A third type argument, `hostCode<Infer<typeof Bars>, never, SVGSVGElement>`, fixes it. The section also leaves open whether `I` is the schema or its value (it is the value; `typeof Bars` gives a TS2345).
3. The keel-server skill says of `*.server.ts` files that "Browser builds stub those files". In a client-only app (`examples/static-client`, `adapter: "client"`) the `loadHome.server.ts` loader runs in the browser, as `keel docs k.router` (Execution) says. The skill misled me until the Chromium run showed the loader's text.

## Rough edges

4. `keel scaffold service app --openapi openapi.json` in `examples/openapi-import` writes files importing `@keel/services` and leaves `package.json` without it. `keel check` then prints `E1751 modules/app/AppApi.schema.ts:3:27 TS2307 Cannot find module '@keel/services'` twice with no fix. Expected: the scaffold adds the dependency, or `keel check` reports E1572 naming the package.
5. `keel scaffold project <name> --workspace` writes a `package.json` whose `check` script is `tsc --noEmit && biome check modules test`, without `keel check`, and with no `@keel/cli` in `devDependencies`; `apps/inspector` has both. I added both by hand in each example.
6. `keel scaffold service <module>` names the client after the module (`AppApi`, `api`), not after the service; `openapi(doc, { name })` takes a name, the command offers no flag for it.
7. After the first `keel build`, a source change that `biome check --write` makes (an import reorder in `loadHome.server.ts`) turns `keel check` into `E1005 .keel/surface.json:1:1 generated .keel/surface.json does not match its sources; run keel build`. Expected: an import order change leaves the surface unchanged, or the message says which source moved.
