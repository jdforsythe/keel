---
name: keel-library
description: "Write a Keel library: scaffold, pack, peers, ids, colour and tokens, a chart's text alternative; E1161, E1162, E1164, E1166, E1810, E1811, E1812, E1813"
---

# Writing a Keel library

Exact rules: `keel docs libraries`; `keel docs k.library` (an app reading one), `k.library-pack` (package, pack, scaffold), `k.host-element`, `k.host-code`, `k.aria`. Components and tests: keel-client, keel-testing.

**Scaffold.** `keel scaffold library @acme/charts` writes `charts/` here (E1351 if it exists). It holds `package.json` (`"keel": "library"`), `module.ts` (id `charts`, the base in lowerCamel), `src/index.ts`, `src/Example.tsx`, `test/Example.test.ts`, `tokens.ts`, two tsconfigs, `vitest.config.ts` and `README.md`. `tokens.ts`, a check fixture, never ships: an app checks the library against its own. `keel scaffold` takes no `--help`.

**Its folder.** `keel check` and `keel test` read `module.ts`, `src/` and `unsafe/` as one module and `test/` as its tests. Each `@keel/*` package it imports is a `peerDependency` (E1164); a std package or library it uses is also in `module.ts` `deps`. `keel pack` runs `kind`, `package`, `check`, `test` and `ledger` and writes `.keel/ledger.json` alone: commit it. Until then `keel pack --check` (`prepack`) is E1164 naming `ledger`. Neither formats files. An `unsafe(` call holds only a cast or platform read: a bug is `defect(message, code?)`, a throwing SDK `attempt(call, expect)`; a maker captures `owner()` (at top level the compiler's module root) and makes state with its `run` (E1203 without one). `isStore`, `isTransaction`, `isSchema` narrow an `unknown`; a predicate claiming a signature or type parameter is E1762, in `unsafe(`.

**Ids.** Every base element and `Part` builds its `id` on the component's `id` prop, `` id={`${props.id}.chart`} ``; a literal, a concatenation or none is E1161. `properties(Component)` generates the `id` prop from its schema (`s.string()` allows `"`).

**Colour.** A library's look: `src/<id>Tokens.ts` holds `export const <id>Tokens = defineTokens({...})` and its import, one literal read as text (E1812), every name `<id>.<name>`, colors a value or `{ light, dark }`, no `base` or `schemes`; `package.json` exports it as `"./tokens"`, `keel` `./src/<id>Tokens.ts`. Its files write only those names (E1811). The root `tokens.ts` spreads `brandTokens` and `<id>Tokens` group by group, overriding nothing (E1813), so checks judge the defaults; an app spreads it alike (E1810's fix). With no `./tokens`, write no token name: draw in `currentColor` (a `Host` takes `fg`) and take `styles`, a `PartStyle` (`@keel/ui/aria`) per part.

**A chart a person cannot see.** The drawing is a `Host role="img"` with `label`, and `describedBy` naming a visible summary `Text`. The values sit in a `Part role="table"` with `hidden`, opened by a `Part role="button"` with `expanded` and `controls` (the disclosure pattern). Every word is a prop, from the app's message set. `Part`'s children are a thunk, `children={() => ...}`; text between its tags fails `tsc` (TS2322).

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

**Numbers.** The app formats each number shown and passes it in: a point is `{ name, value, shown }`, `shown` from `formatMoney` or `formatNumber`. A chart has one numeric axis, so several currencies mean one chart per currency, `value` the amount in minor units.

**In an app.** A module lists the library in `deps` by package name; one resolving to no library is E1159. `keel check` checks its files as the app's, each diagnostic at `node_modules/<name>/<f>` with no `fix`. An app module holding the library's module id is E1166. A relative import leaving the library's folder is E1163. In a workspace `keel check` reads the library's source (the `keel` condition) and `tsc` its built `types`: build the library first. The app's ledger counts a linked library's `unsafe` and `hostElements`; its exports and rungs show once it is installed from a tarball, whose `.keel/ledger.json` `keel check` holds to its files (E1162).
