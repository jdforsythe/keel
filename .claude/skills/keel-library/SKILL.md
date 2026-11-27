---
name: keel-library
description: "Write a Keel library: scaffold, pack, peers, ids, colour and tokens, a chart's text alternative; E1161, E1162, E1164, E1166, E1810, E1811, E1812, E1813"
---

# Writing a Keel library

`keel docs libraries` lists the rules; `k.library` (app side), `k.library-pack` (package, pack, scaffold), `k.host-element`, `k.host-code`, `k.aria`. Components, host elements, tests: keel-client, keel-testing.

**Scaffold.** `keel scaffold library @acme/charts` writes `charts/` in the current directory (E1351 if it exists). It holds `package.json` (`"keel": "library"`), `module.ts` (module id `charts`, base in lowerCamel), `src/index.ts`, `src/Example.tsx`, `test/Example.test.ts`, `test/Example.e2e.ts`, `.gitignore`, `tokens.ts`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `README.md`. `tokens.ts` is its own check fixture, never shipped: an app checks it against its own. `keel scaffold` has no `--help`: `keel docs k.library-pack`.

**Tests.** `keel test --e2e` runs `test/*.e2e.ts` in a browser; `serve({ page: 'src/Example.tsx', props: { id: 'lib' } })` from `@keel/testing/e2e` builds a host per call (`.keel/e2e-host-*/`, ignored); `wrap`, `tokens` under `test/`; more in keel-e2e. Needs `@keel/router`, `@keel/server`, `playwright-core` in `devDependencies` (E1737, E1734). A server part is tested in an app.

**Folder.** `keel check`/`keel test` read `module.ts`, `src/`, `unsafe/` as one module, `test/` its tests. Each `@keel/*` package its files import is a `peerDependency`, not a dependency (E1164); a std package or library it uses is in `module.ts` `deps` too. `keel pack` runs `kind`, `package`, `check`, `test`, `ledger`, writing `.keel/ledger.json` alone: commit it, or `keel pack --check` (`prepack` runs it) is E1164 naming `ledger`. Neither formats files.

**Ids.** Every base element and `Part` builds its `id` on the component's `id`, `` id={`${props.id}.chart`} ``; a literal, concatenation or none is E1161. `properties(Component)` generates `id` from its schema like any prop (`s.string()` allows `"`).

**Colour.** A library's look: `src/<id>Tokens.ts` holds `export const <id>Tokens = defineTokens({...})` and its import, a literal read as text (E1812), every name `<id>.<name>` (`look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } }`), colors a value or `{ light, dark }`, no `base`/`schemes`; `package.json` exports `"./tokens"`, `keel` `./src/<id>Tokens.ts`. Its files write only those names (E1811). Root `tokens.ts` spreads `brandTokens` and `<id>Tokens` group by group, overriding nothing (E1813), so checks judge defaults; an app does alike (E1810's fix). With no `./tokens`, write no token name: draw in `currentColor` (`Host` takes `fg`), take `styles`, a `PartStyle` (`@keel/ui/aria`) per part.

**A chart a person cannot see.** The drawing: `Host role="img"` with `label` and `describedBy` naming a visible summary `Text`. Values sit in a `Part role="table"` `hidden`, opened by a `Part role="button"` with `expanded`, `controls` (disclosure pattern). Every word is a prop from the app's messages. `Part`'s children are a thunk, `children={() => ...}`; text between tags fails `tsc` (TS2322).

```tsx
import { signal } from '@keel/reactive'
import { type Infer, s } from '@keel/schema'
import { Box, Text } from '@keel/ui'
import { Part, type PartStyle } from '@keel/ui/aria'

export const Props = s.object({ id: s.string(), summary: s.string({ min: 1 }), show: s.string({ min: 1 }) })

export default function ChartNumbers(props: Infer<typeof Props> & { readonly styles?: { readonly button?: PartStyle } }) {
  const open = signal(false)
  return (
    <Box id={`${props.id}.numbers`}>
      <Text id={`${props.id}.summary`}>{props.summary}</Text>
      <Part {...props.styles?.button} id={`${props.id}.button`} role="button" expanded={open.get()}
        controls={`${props.id}.table`} onClick={() => open.set(!open.get())} children={() => props.show} />
    </Box>
  )
}
```

**Numbers.** The app formats each number and passes it: a point is `{ name, value, shown }`, `shown` from `formatMoney`/`formatNumber`. One numeric axis: several currencies mean one chart each, `value` in minor units.

**In an app.** A module lists the library in `deps` by package name (unresolved: E1159). `keel check` checks its files as the app's: diagnostics at `node_modules/<name>/<f>`, no `fix`. A library module id an app module holds is E1166. A relative import out of its folder is E1163. In a workspace the app's `keel check` reads its source (the `keel` condition), its `tsc` the built `types`: build the library first. The app's ledger counts a linked library's `unsafe` and `hostElements`; exports and rungs show once installed from a tarball, whose `.keel/ledger.json` `keel check` holds to its files (E1162).
