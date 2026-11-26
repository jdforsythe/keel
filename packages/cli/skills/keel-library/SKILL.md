---
name: keel-library
description: "Write a Keel library: scaffold, pack, peers, ids, colour, a chart's text alternative; E1161, E1162, E1164, E1166"
---

# Writing a Keel library

Exact rules: `keel docs k.library` (how an app reads a library), `k.library-pack` (package, pack, scaffold), `k.host-element`, `k.host-code`, `k.aria`. Components, host elements and tests follow keel-client and keel-testing.

**Scaffold.** `keel scaffold library @acme/charts` writes the folder `charts/` in the working directory (E1351 when it exists). It holds `package.json` (`"keel": "library"`), `module.ts` (module id `charts`, the base in lowerCamel), `src/index.ts`, `src/Example.tsx`, `test/Example.test.ts`, `tokens.ts`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` and `README.md`. `tokens.ts` is the library's own check fixture and never ships: an app checks the library against its own. `keel scaffold` takes no `--help`; read `keel docs k.library-pack`.

**Its folder.** `keel check` and `keel test` read `module.ts`, `src/` and `unsafe/` as one module and `test/` as its tests. Every `@keel/*` package its files import is a `peerDependency`, never a dependency (E1164); a std package or library it uses is also listed in `module.ts` `deps`. `keel pack` runs the steps `kind`, `package`, `check`, `test` and `ledger`, and writes `.keel/ledger.json` alone: commit it. Until then `keel pack --check`, which `prepack` runs, is E1164 naming `ledger`. Neither command formats files: run your own formatter. An `unsafe(` call holds a cast or a platform read, never a throw, a catch or a detached scope (E1451, E1452, E1207 are reported inside it): a bug is `defect(message, code?)`, a throwing SDK `attempt(call, expect)` mapping the errors it knows to the library's `KeelError`s, and state kept for the module's life lives in a module root, a `scope` made at the top level and entered with `run`.

**Ids.** Every base element and `Part` builds its `id` on the component's `id` prop, `` id={`${props.id}.chart`} ``; a literal, a concatenation or none is E1161. `properties(Component)` generates the `id` prop like any other, from its schema (`s.string()` allows `"`).

**Colour.** A library names no token: it cannot know the app's `tokens.ts`. Draw marks in `currentColor`, which a `Host` takes from `fg`. Take an optional `styles` prop holding a `PartStyle` (`@keel/ui/aria`) per part, and spread each onto its element; the app fills it from its tokens, `styles={{ chart: { fg: 'accent' } }}`.

**A chart a person cannot see.** The drawing is a `Host role="img"` with `label`, and `describedBy` naming a visible summary `Text`. The values sit in a `Part role="table"` with `hidden`, opened by a `Part role="button"` with `expanded` and `controls` (the disclosure pattern). Every word is a prop the app fills from its message set. `Part` types its children as a thunk, so it takes `children={() => ...}`; text between its tags fails `tsc` (TS2322).

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

**Numbers.** The app formats each number a person reads and passes it in: a point is `{ name, value, shown }`, `shown` from `formatMoney` or `formatNumber`. A chart has one numeric axis, so money in several currencies is one chart per currency, `value` the amount in minor units.

**In an app.** A module lists the library in `deps` by package name; a name that resolves to no library is E1159. `keel check` checks its files as the app's, each diagnostic at `node_modules/<name>/<f>` with no `fix`. A library whose module id an app module also holds is E1166. A relative import leaving the library's folder is E1163. In a workspace, the app's `keel check` reads the library's source (the `keel` condition), while the app's `tsc` reads its built `types`: run the library's `build` first. The app's ledger counts a linked library's `unsafe` and `hostElements`; its exports and rungs show once it is installed from a tarball, whose `.keel/ledger.json` `keel check` holds to its files (E1162).
