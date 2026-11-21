# k.bundle: Browser bundles
status: conformance-covered

Which bundles, file names and handler uses k.boundary's stubs, Assertion and Reach cover, and how a build keeps every environment value out of a browser asset.

**Bundles.** Each bundle a browser build emits is a browser build for k.boundary, with the stubs and the Assertion: the entry's, each Web Worker's and shared worker's (`new Worker(new URL(<literal>, import.meta.url))`, `new SharedWorker(…)`, an import with `?worker` or `?sharedworker`) and any other chunk Vite bundles in a pass of its own. A worker's chain runs through the file that names it: `<entry> -> <page> -> <worker> -> … -> <file>`.
- Reach (E1004 and E1571) follows `new URL(<literal>, import.meta.url)` and `?worker`, `?sharedworker` and `?url` specifiers as it follows a literal `import()`; a worker file a client entry reaches is a client entry.

**Names.** A file is server-only by its name on disk, matched case-insensitively, whatever its extension: `notes.Server.ts`, `keys.server.json`, `copy.server.txt`, `logo.guard.svg`.
- A server-only file named `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts` or `.cts` gets a stub. Any other (data, styles, text, an image) gets none: in a browser build's graph, with or without a query, it fails the build with E1007 reason `server-only file`; named from client-reachable code it is E1004.
- A specifier whose path differs in case from the file's name on disk is E1010, in `keel check` and in every build, on any file system.

**Handlers.** `loader`, `action` and `guard` are the exports of `@keel/router`, known by binding, not by spelling: through a named import (with `as` or not), a namespace import's member (`R.loader`, `R['loader']`), a dynamic `import()`'s, a re-export through any module (`export { loader } from`, `export *`), and any specifier of the package, a subpath too.
- A file uses one when it calls it or reads it as a value (passes, assigns, destructures or re-exports it); a namespace object of the package read other than by a literal member uses all three. A type-only use is none.
- E1551, E1009 and E1007's reason `handler` use this one definition.

**Node built-ins.** The Assertion's Node built-ins are every `node:` specifier and every bare name a supported Node version (22 and later) lists, from a list Keel ships, not the running Node's; so `node:sqlite` fails a browser build on every supported version, which maps no built-in.

**Environment.** No value of a variable set for a build is in a browser asset, whatever the project's Vite config says (`envPrefix` as a string or an array, `define`, a plugin), but k.boundary's public origins and `NODE_ENV`.
- A project config that sets `envPrefix` or `define` fails each browser build before bundling with E1007 reason `environment config`, chain `vite.config.<ext>`. A value a browser reads comes through `clientStd` (k.leave).
- After bundling, an emitted browser file holding the value of a `KEEL_*` variable of 8 characters or more, the public origins excepted, fails the build with E1007 reason `environment value`.

**Types.** `@keel/compiler/client` declares what a browser build promises: `import.meta.env` as `{ BASE_URL: string; MODE: string; DEV, PROD, SSR: boolean }` (k.boundary Environment), any other key a type error, and the default import of `*?worker` and `*?sharedworker` (a `Worker` or `SharedWorker` constructor) and of `*?url` (a `string`). `keel check` loads it when it resolves from the project root, and the scaffold's `tsconfig.json` lists it in `types` beside `node`; app code writes no reference. A `/// <reference types>` in project code adds that package's ambient types (`vite/client` adds Vite's), the app's, not Keel's promise; under it any other `import.meta.env` key is still a type error.

**Limits.** A script a project plugin bundles in a pass of its own, or a file copied from `public/`, is not walked; it is the project's. So is a project plugin that writes the value of a variable not named `KEEL_*`.

**Rules.** E1011 a client bundle holds a module its service map omits · E1010 a specifier naming a file in a case other than its name on disk (fix: the name on disk) · E1007 reasons `environment config` and `environment value`, beside k.boundary's.

**Conformance.**
- In a `node` fixture whose `lib/notes.server.ts` holds a canary and `lib/w.ts` imports it: a page starting `new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })`, and one importing `../../lib/w.ts?worker`, ship no canary under `dist/<name>/`; `keel check` reports E1004 at `lib/w.ts` naming the chain; a worker importing `notes.server.ts?raw` fails `vite build` with one E1007 whose chain runs through the worker.
- `keys.server.json` and `copy.server.txt?raw` imported by a page fail `vite build` with one E1007 `server-only file` each, and are E1004 in `keel check`; a file on disk `Notes.SERVER.ts` is stubbed.
- An import `./notes.Server.ts` of `notes.server.ts` is one E1010 in `keel check`, and on a case-insensitive file system `vite build` ships no canary.
- In a plain file, `R.loader(...)` through `import * as R from '@keel/router'`, `loader` re-exported through `lib/r.ts`, `const L = loader`, and `R.guard(...)`: each one E1551 (E1009 for the guard) in `keel check` and one E1007 `handler` in `vite build`.
- A project `vite.config` with `envPrefix: ['KEEL_']`, with `envPrefix: 'KEEL_'`, or with a `define`: `vite build` fails with E1007 `environment config` and writes nothing; a project plugin writing `KEEL_TEST_VALUE`'s value into a page fails it with E1007 `environment value`.
- A page importing `node:sqlite` fails `vite build` with E1007 `node built-in`, with or without `sqlite` in the running Node's built-in list; the server build maps it.
- With no type reference, a page reading `import.meta.env.MODE` and `DEV` and importing `./w.ts?worker` and `./a.svg?url` checks clean; `import.meta.env.VITE_X` is one E1751, also with `/// <reference types="vite/client" />`.
