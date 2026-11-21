# RFC 0167: k.bundle: `@keel/compiler/client` types `import.meta.env` and the worker and url imports

Status: implemented (ADR-0189). For backlog 0884.

## Decisions
- D1: Keel owns the ambient types of what a browser build promises: a types-only entry `@keel/compiler/client` declares `import.meta.env` with exactly k.boundary's five keys, and the default imports of `*?worker`, `*?sharedworker` and `*?url` that k.bundle's Reach names.
- D2: `keel check` loads it as it loads Node's types, when it resolves from the project root; the scaffold's `tsconfig.json` sets `"types": ["node", "@keel/compiler/client"]` so the editor and `tsc` agree. App code writes no reference.
- D3: a `/// <reference types>` in project code stays allowed and adds that package's types, which are the app's. The entry sets Vite's `ViteTypeOptions.strictImportMetaEnv`, so with `vite/client` referenced too, a key other than the five is still a type error.
- D4: not chosen: naming `/// <reference types="vite/client" />` as the way.

## Problem
k.check step 1: "The only ambient types are Node's". Without another reference `import.meta.env` does not type-check (TS2339 on `ImportMeta`), so app code that reads `import.meta.env.DEV`, or imports `./w.ts?worker` (k.bundle), needs Vite's types. `/// <reference types="vite/client" />` gives them, and `keel check` accepts it (`typeCheck.ts` resolves type references with TypeScript's default), contradicting step 1. The cli conformance depends on it: `boundary-env.test.ts` and `build-production-mode.test.ts` prepend it to page files, and `bundle-support.ts` exports the same `REF` for the bundle suites. A rule refusing every reference but `node` broke 15 of those tests (D33).

What `vite/client` (Vite 8.3.6) declares: `ImportMetaEnv extends Record<string, any>` unless `ViteTypeOptions` has `strictImportMetaEnv`, so `import.meta.env.VITE_X` is `any`, while k.boundary says a browser build exposes no variable by prefix; `import.meta.hot` and `import.meta.glob`, which no spec section names; and module types for CSS, images, `?raw`, `?inline` and the rest. Naming it as the way would put a Vite major's surface, `any` included, into what Keel promises.

## Proposal
`packages/compiler/src/client.d.ts`, exported as `"./client": { "types": "./src/client.d.ts" }`:
```ts
interface ViteTypeOptions { strictImportMetaEnv: unknown }
interface ImportMetaEnv { BASE_URL: string; MODE: string; DEV: boolean; PROD: boolean; SSR: boolean }
interface ImportMeta { readonly env: ImportMetaEnv }
declare module '*?worker' { const W: { new (options?: { name?: string }): Worker }; export default W }
declare module '*?sharedworker' { const W: { new (options?: { name?: string }): SharedWorker }; export default W }
declare module '*?url' { const src: string; export default src }
```
Members carry Vite's modifiers (none on `ImportMetaEnv`, `readonly env`), so the declarations merge with `vite/client`'s; the duplicate module declarations sit in `.d.ts` files, which `skipLibCheck` (the strict profile's) leaves unchecked. Verified with TypeScript 5 under the check's options: a page reading `MODE` and `DEV`, importing `./w.ts?worker` and `./a.svg?url`, has exactly one error, TS2339 on `import.meta.env.VITE_X`, with this file alone and with `vite/client` added.

A page under the proposal, no reference line:
```tsx
import { Text } from '@keel/ui'
import Sum from './sum.worker.ts?worker'
export default function Page() {
  if (import.meta.env.DEV) console.log('dev build')
  const w = new Sum({ name: 'sum' })
  return <Text>{import.meta.env.MODE}</Text>
}
```
`typeCheck.ts` adds the entry's file to the program's root names when `ts.resolveTypeReferenceDirective('@keel/compiler/client', ...)` resolves from the project root, beside Node's.

## Alternatives
- Name `vite/client` as the way (D4): no change today, but the promise becomes Vite's, `any` and unspecified APIs included, and moves with each Vite major.
- Keel's type and refuse every other reference: the strict option already removes the `any`, and a project may want a package's ambient types for its own reasons; refusing breaks the bundle suites for no gain.
- Keel's type without `strictImportMetaEnv`: no conformance file changes, but a file referencing `vite/client` reads any key as `any`.

## Spec diff
- k.check Pipeline step 1: "The only ambient types are Node's, loaded when `@types/node` resolves from the project root." becomes "Ambient types: Node's when `@types/node` resolves from the project root, and k.bundle's Types."
- k.bundle, new paragraph **Types** before Limits (the text in the section), and one Conformance bullet: "With no type reference, a page reading `import.meta.env.MODE` and `DEV` and importing `./w.ts?worker` and `./a.svg?url` checks clean; `import.meta.env.VITE_X` is one E1751, also with `/// <reference types="vite/client" />`."
- To fit, the Types paragraph is written short; k.bundle is at 1,497 of 1,500 tokens.

## Conformance diff
By the `conformance-writer`, under `rfc:0167`:
- `packages/check/conformance/` (new): the k.bundle bullet, over a temporary project whose `node_modules` resolves `@keel/compiler` and `vite`.
- `packages/cli/conformance/boundary-env.test.ts`: the probe's literal reads `import.meta.env.VITE_TEST_VALUE` and `KEEL_TEST_VALUE` become E1751, which stops `keel build`; read them as `Reflect.get(import.meta.env, 'VITE_TEST_VALUE')` (and `KEEL_TEST_VALUE`), keep `Object.keys(import.meta.env)`, and drop `REF`. The quoted spec text is unchanged.
- `build-production-mode.test.ts` and `bundle-support.ts` may drop `REF`; with it they still pass (D3).

## Migration
None for the golden and example apps: none reads `import.meta.env` or references `vite/client`. A project that reads another key through `vite/client` gets E1751; the fix is `clientStd` (k.leave), the one way a browser gets config. A project made before the build adds `"types": ["node", "@keel/compiler/client"]` to its `tsconfig.json` for its editor; `keel check` needs nothing.

## Token impact
k.check 1,495 tokens (unchanged); k.bundle 1,267 to 1,497, 7 Conformance clauses (`docs/freeze-review.md`). Map unchanged. `@keel/compiler` gains a `.d.ts` only, no bytes in any bundle; `@keel/check` a few lines in `typeCheck.ts` (468 bytes of headroom).

## Build order
1. This commit. 2. `conformance-writer`. 3. Build: `client.d.ts` and its export; `typeCheck.ts` root names; scaffold `tsconfigJson.ts` `types`; run the cli suite (D33), since `@keel/check` changes.

## For the operator
- Should `@keel/compiler/client` declare `?raw` and `?inline` too? Recommendation: no; k.bundle names them only as build failures for server-only files, and a type for them would be a promise no section makes.
- The entry name: `@keel/compiler/client` mirrors `vite/client`. Recommendation: keep it; the compiler's Vite plugin is what fills `import.meta.env`.
