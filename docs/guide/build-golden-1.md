# Build golden-1 by hand

This guide takes you from an empty folder to a working copy of `apps/golden-1`, the todo app, typing every file yourself. No scaffold command, no agent. Each step says what to create, shows the file, and explains the Keel concept behind it.

Every code block is the real file from `apps/golden-1`, and its title is the path to create. When this guide and the app disagree, the app is right; tell us.

You need TypeScript, Vite and pnpm, and the terms in `docs/GLOSSARY.md`. Nothing else about Keel is assumed.

## What you build

golden-1 is a todo board: named lists, todos with a title, a priority and a done flag, an edit page, an undo button, a suggestions panel, and a digest that counts open and done todos every hour. Every open page follows the board live, and a write goes through an outbox that holds it while the browser is offline. A list is removed with a ten-minute Undo, run by a workflow. The edit page keeps its status in a state chart. It is three modules in two deployables, plus the `sessions` module of a stdlib package:

| Module | Deployable | Adapter | Owns |
| --- | --- | --- | --- |
| `todos` | `web` | `client` | the pages; it holds a copy of the board, follows the board channel, sends writes through an outbox and keeps the edit page's chart |
| `api` | `api` | `node` | the board itself (`api.board`), its transactions and undo log, the board channel, the suggestions, and the list removal workflow with its jobs |
| `digest` | `api` | `node` | a job that counts the board, an hourly schedule, `GET /digest` and a live feed |
| `sessions` (`@keel/std-sessions`) | `api` | `node` | `GET /sessions/tally`, the production commit counts the `api` runner `monitor` keeps; no file of yours |

The `api` deployable keeps its state in one SQLite file. `topology.ts` also declares a Capacitor and a Tauri shell for `web`; this guide builds neither (the end of the guide).

Build order follows the dependencies: project files, then `api` (the other two import its schemas and call its routes), then `todos`, then `digest`, then tests. You can run `keel check` once the three modules exist.

## 1. Before you start

Keel's packages are not published. Your app finds `@keel/*` through this repo's workspace links, so the folder must live inside the repo and see a `node_modules` with those links. Two places work:

- `apps/<name>/`. `pnpm-workspace.yaml` matches `apps/*`, so after you write `package.json` run `pnpm install` at the repo root and pnpm links every `workspace:*` dependency. Give the package a name other than `golden-1`; pnpm needs names to be unique. This adds your app to `pnpm-lock.yaml`.
- `.fixtures/<name>/`, for a throwaway. `.fixtures/` is git-ignored and no workspace glob matches it, so pnpm does not install there. Borrow golden-1's links instead, the way the repo's evals copy apps:

  ```sh
  mkdir -p .fixtures/todo-by-hand && cd .fixtures/todo-by-hand
  ln -s ../../apps/golden-1/node_modules node_modules
  ```

Run `pnpm install` at the repo root once in either case, so the packages and root tools exist.

The `keel` command comes from the `@keel/cli` dev dependency in your `package.json` (section 3). After `pnpm install`, pnpm links its binary into `node_modules/.bin`, so from the app folder you run `pnpm keel <command>`, and the app's scripts call plain `keel <command>`. In this guide, `keel <command>` means `pnpm keel <command>`. In a `.fixtures/` folder the `node_modules` symlink above carries golden-1's `.bin/keel` with it.

Run every command from your app folder unless a step says otherwise.

## 2. The finished layout

```text
todo-by-hand/
  package.json        scripts and dependencies
  tsconfig.json       strict TypeScript profile, Keel JSX
  vite.config.ts      the Keel Vite plugin
  vitest.config.ts    the same plugin for tests, happy-dom, Keel's reporter
  tokens.ts           design tokens; the CSS is generated from them
  topology.ts         which modules form which deployable
  .gitignore
  public/keel-mark.svg
  modules/
    todos/            pages, forms, the client's copy of the board, the outbox, the edit page's chart
    api/              the board, its transactions, the contract of its HTTP API, the board channel, the list removal workflow
    digest/           job, schedule, runners, live loader
  test/               vitest suites and their helpers
  # generated, never edited by hand:
  .keel/              compiler artifacts (JSON, read-only)
  dist/web/           the web client build: static files
  dist/api/           the api deployable: server.mjs, a copy of the web client and its resume entry
  dist/api/server.mjs.map  the source map beside server.mjs: project-relative paths, no source text, never served
  deploy/             Dockerfile and compose.yaml for node deployables
  .keel-dev/          storage for keel dev
  .api.sqlite*        storage for the built api server
```

## 3. Project files

### package.json

```json title="package.json"
{
  "name": "golden-1",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "tsc --noEmit && biome check modules test && keel check --quiet",
    "test": "vitest run",
    "coverage": "node ../../tooling/coverage.mjs",
    "build": "keel build",
    "dev": "keel dev",
    "api": "KEEL_DATABASE_URL=file://$PWD/.api.sqlite node --disable-warning=ExperimentalWarning dist/api/server.mjs"
  },
  "dependencies": {
    "@capacitor/core": "8.6.0",
    "@capacitor/preferences": "8.0.1",
    "@keel/compiler": "workspace:*",
    "@keel/ctx": "workspace:*",
    "@keel/forms": "workspace:*",
    "@keel/reactive": "workspace:*",
    "@keel/router": "workspace:*",
    "@keel/runtime-dom": "workspace:*",
    "@keel/schema": "workspace:*",
    "@keel/server": "workspace:*",
    "@keel/services": "workspace:*",
    "@keel/std-capacitor": "workspace:*",
    "@keel/std-channels": "workspace:*",
    "@keel/std-db": "workspace:*",
    "@keel/std-jobs": "workspace:*",
    "@keel/std-live": "workspace:*",
    "@keel/std-offline": "workspace:*",
    "@keel/std-schedules": "workspace:*",
    "@keel/std-sessions": "workspace:*",
    "@keel/std-statecharts": "workspace:*",
    "@keel/std-tauri": "workspace:*",
    "@keel/std-workflows": "workspace:*",
    "@keel/store": "workspace:*",
    "@keel/ui": "workspace:*",
    "@tauri-apps/api": "2.12.4",
    "@tauri-apps/plugin-http": "2.9.0",
    "@tauri-apps/plugin-store": "2.5.1"
  },
  "devDependencies": {
    "@capacitor/android": "8.6.2",
    "@capacitor/cli": "8.6.2",
    "@capacitor/ios": "8.6.2",
    "@keel/cli": "workspace:*",
    "@keel/std-conflicts": "workspace:*",
    "@keel/testing": "workspace:*",
    "@keel/tooling": "workspace:*",
    "@tauri-apps/cli": "2.12.4",
    "@types/node": "^22",
    "vite": "^8.3.6",
    "z3-solver": "5.3.3"
  }
}
```

The scripts:

- `check` runs three tools in turn: `tsc --noEmit`, Biome (configured by the repo root's `biome.json`) on `modules` and `test`, and `keel check --quiet`, which prints one summary line when clean.
- `test` runs vitest with `vitest.config.ts`. `keel test` runs the same suites through the CLI with compact output.
- `build` is `keel build`; `dev` is `keel dev`. Both hand bundling and serving to Vite, because `vite.config.ts` exists.
- `coverage` runs the repo's coverage script over the app.
- `api` starts the built `api` deployable. `KEEL_DATABASE_URL` names the SQLite file `.api.sqlite`, which holds `ctx.storage`. It needs `KEEL_SECRET` set (section 10).

The dependencies are the Keel packages the app's code imports. `@keel/testing` is listed with them although only tests use it. `@keel/std-channels`, `@keel/std-live` and `@keel/std-offline` carry the board channel, the page's live status and the outbox. `@keel/std-jobs` and `@keel/std-schedules` carry the queue and the hourly schedule, `@keel/std-statecharts` and `@keel/std-workflows` the charts and the removal workflow, `@keel/std-db` the SQLite storage, and `@keel/std-sessions` the `sessions` module and the `monitor` runner. `@keel/std-conflicts` is a dev dependency for race checks in tests, `z3-solver` for the proof in `test/board.prove.test.ts`. `@keel/std-capacitor`, `@keel/std-tauri` and the `@capacitor/*` and `@tauri-apps/*` packages serve the two native shells of `topology.ts`. `@keel/tooling` is this repo's internal tooling package; the app uses it for `keelConfig` in `vitest.config.ts`. vitest, happy-dom, TypeScript and Biome are not declared here: they resolve from the repo root's devDependencies.

If you build under `apps/`, change `"name"` now and run `pnpm install` at the root.

### tsconfig.json

```json title="tsconfig.json"
{
  "extends": "@keel/compiler/tsconfig.strict.json",
  "compilerOptions": {
    "jsxImportSource": "@keel/runtime-dom",
    "types": ["node", "@keel/compiler/client"]
  },
  "include": ["modules", "test", "tokens.ts", "topology.ts"]
}
```

`@keel/compiler/tsconfig.strict.json` is the strict profile every Keel package uses. `jsxImportSource` points JSX at `@keel/runtime-dom`, whose types say a JSX element is a DOM `Node`; the Keel compiler, not TypeScript, turns your JSX into DOM operations. `routes.ts` in `include` names a root file golden-1 does not have; TypeScript ignores it.

### vite.config.ts

```ts title="vite.config.ts"
import keel from "@keel/compiler/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [keel()] });
```

The Keel plugin takes no options. It compiles each app source as Vite loads it (failing the module on an error diagnostic), writes the `.keel/` artifacts, generates `/@keel/entry.ts` and `virtual:keel.css`, and under `keel dev` routes requests for `node` deployables to their dev servers. Section 4 traces what it generates.

### vitest.config.ts

```ts title="vitest.config.ts"
import keel from "@keel/compiler/vite";
import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
  },
});
```

Tests run through the same plugin, so components compile exactly as they do in the app, and a test run refreshes `.keel/`. `happy-dom` gives components a DOM. The `include` globs cover `test/`, a module's own `modules/<id>/test/`, and recorded sessions. `keelConfig` adds the Keel reporter, which prints results in the compact format from `docs/OUTPUT.md`, and the test watchdog, which kills a test that runs far past its timeout (`docs/TESTING.md`).

### The document and `styles`

golden-1 has no `index.html`. Keel writes every document, in dev and in the build: charset, viewport, a `<title>` (the deployable's name), the icon `/keel-mark.svg`, a stylesheet link per `styles` entry, `<div id="app"></div>` and the script for `/@keel/entry.ts`. The brand fonts come from `styles: ["@keel/ui/fonts"]` on each deployable in `topology.ts` (below): the deployable's entry imports that package's `.css` export, so its documents link it. App code imports no `.css`. A project `index.html` is never read, and `keel check` reports one as W1012; put markup such as a header in a layout component.

`/@keel/entry.ts` is not a file you write: the plugin answers that URL (section 4).

### public/keel-mark.svg

```xml title="public/keel-mark.svg"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 425.36 479.32">
  <path fill="#1a191e" d="M163.91,324.65l.2,48.31-66.37.06c-13.29.64-24.09-8.85-24.46-22.39l.22-222.75c.01-11.62,10.5-20.6,21.19-20.62l69.49-.16-.1,48.3-42.02.09v169.25l41.84-.08h0Z"/>
  <path fill="#1a191e" d="M352.16,203.26l-48.7.09-.02-47.84-42.06-.1v-48.29h71.14c12.13,1.7,19.71,11.67,19.7,23.7l-.06,72.45h0Z"/>
  <path fill="#1a191e" d="M330.26,372.9l-68.86.11.09-48.25,41.83-.06.13-43.36,48.71.07v70.32c-.99,11.57-9.59,21.15-21.9,21.17h0Z"/>
  <path fill="#1a191e" d="M425.34,226.81c0-5.04-3.88-8.59-9.03-8.59l-169.62.33v-.05h-68.02l-41.62-.28-.11,48.31,41.73.1h68.02s169.86-.05,169.86-.05c5.25,0,8.82-3.98,8.81-8.88l-.02-30.89Z"/>
  <path fill="#1a191e" d="M10.12,266.55c-5.91.54-9.95-3.59-10.08-8.88l-.04-30.85c.14-4.92,3.86-8.51,8.8-8.59l49.6.02.06,48.34-48.33-.05h-.01Z"/>
  <rect fill="#b8420d" x="178.2" width="67.97" height="479.32"/>
</svg>
```

Vite copies `public/` into the build. The app shell shows this mark, and the generated document uses it as the icon. You can copy it from `docs/brand/keel-mark.svg` instead of typing it.

### tokens.ts

```ts title="tokens.ts"
import { brandTokens } from "@keel/ui/brand";

/** The Keel brand (docs/BRAND.md): palette, Source Serif 4 and JetBrains Mono, radius 0, hairline dividers. */
export const tokens = brandTokens;
```

Components never write CSS. They take style props whose values are token names (`bg="card"`, `px="3"`), and the plugin emits one atomic class per prop, token, breakpoint and state it finds in your code. `tokens.ts` must export `tokens`; the plugin evaluates it in Node and validates it with `TokenSchema` (E1807 when it fails). `brandTokens` is the Keel brand from `docs/BRAND.md`. For your own palette, `defineTokens` from `@keel/ui` takes the groups `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border`, `breakpoint` and `motion`, and the style sets `base` (default styles per element role and the focus ring's color) and `look` (named sets an element takes as `look="<name>"`).

### topology.ts

```ts title="topology.ts"
import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["todos"],
    adapter: "client",
    servedBy: "api",
    styles: ["@keel/ui/fonts"],
    shells: {
      capacitor: { id: "dev.keel.golden1", name: "Golden 1" },
      tauri: { id: "dev.keel.golden1", name: "Golden 1" },
    },
  },
  api: { modules: ["api", "digest", "sessions"], adapter: "node", storage: "sqlite", styles: ["@keel/ui/fonts"] },
});
```

A deployable is a set of modules that builds to one artifact. The adapter decides how it runs:

- `client`: a browser app. Loaders and actions run in the browser with a real `ctx`; the entry mounts the router into `#app`. `keel build` writes it to `dist/<name>/`. With `servedBy: "api"`, the `api` deployable also serves it, so one process answers `GET /`.
- `node`: a server (Hono). It renders pages to HTML, answers JSON and event streams, runs runners, and ships a small resume entry for pages that have interactive parts. `keel build` writes `dist/<name>/server.mjs`.
- `static`: prerendered HTML, one document per route, written by `keel build`. golden-1 does not use it.

Each module belongs to exactly one deployable, and no other file names a deployable. Splitting `digest` into its own server is a change to this file alone (section 10). `storage: "sqlite"` gives `api` a SQLite file for `ctx.storage` (`KEEL_DATABASE_URL`); `sessions` is the stdlib module that serves the tally route. `styles` lists the package CSS each deployable's documents link. `shells` names the Capacitor and Tauri apps `keel build --target` makes from `web`. The plugin reads `topology.ts` statically, so keep it a literal.

### .gitignore

```text title=".gitignore"
dist
.turbo
node_modules
.api.storage
.api.storage*
.api.sqlite*
```

`.keel-dev/` (storage for `keel dev`) is ignored by the repo root's `.gitignore`. golden-1 commits `.keel/` and `deploy/`.

## 4. What Keel generates, and how a page reaches the screen

You write sources; the plugin and `keel build` derive everything below. Nothing here is edited by hand.

| What | Written by | From | Notes |
| --- | --- | --- | --- |
| `/@keel/entry.ts`, mount entry | Vite plugin, in memory | `topology.ts`, each module's `routes.ts` | served for a `client` deployable; `keel build` bundles it into `dist/web/assets/index-*.js`, which the generated `dist/web/index.html` scripts |
| `/@keel/entry.ts`, resume entry | Vite plugin, in memory | `topology.ts`, `routes.ts` | served for a `node` deployable's pages; built to `dist/<name>/assets/entry-*.js` |
| `/@keel/islands.ts` | Vite plugin, in memory | each `routes.ts` | route id to component, for the resume entry |
| `virtual:keel.css` (served as `/__keel.css`) | Vite plugin | `tokens.ts` and `.keel/styles.json` | one atomic rule per style usage |
| `.keel/ids.json`, `a11y.json`, `deps.json`, `styles.json` | Vite plugin (dev, test, build) and `keel build` | your components | element ids with file and line; the role and name each element must have; the reactive graph; style usages |
| `.keel/routes.json` | Vite plugin | the served deployable's `routes.ts`, evaluated in Node | path, params, search, method, actions, layout, guard per route; for golden-1, the `todos` routes |
| `.keel/std.json` | Vite plugin and `keel build` | `std` entries in `module.ts` | stdlib config per package and module; in golden-1 the `readers` of `@keel/std-sessions` in `api` |
| `.keel/surface.json` | `keel build` only | every module's contract | the HTTP surface: each API entry's method, path and schemas, and which modules import the contract; `keel check --base` compares it against a deployed one |
| `dist/web/` | `keel build` (Vite) | the generated document, the mount entry | the `web` client: static files |
| `dist/api/` | `keel build` (Vite, `KEEL_DEPLOYABLE=api`) | the `api`, `digest` and `sessions` modules, and the `web` client (`servedBy: "api"`) | `server.mjs` with every dependency bundled, the resume entry and the client's `index.html` and files in `assets/`, `routes.json` (all modules' routes, for forwarding), `std.json` |
| `deploy/api/Dockerfile`, `deploy/compose.yaml` | `keel build` | `topology.ts` | one Dockerfile per `node` deployable, one compose service each |

Every `.keel/` file is `{ data, hash }` JSON with sorted keys, written read-only (mode 0444). `keel check` recomputes them from your sources, and a file that differs is E1005. `.keel/surface.json` records each file it was built from as a hash of the file's syntax tree, not its text: a formatter's change (an import sort, a re-indent, quotes, commas, parentheses, a comment) is not stale, and an edit that can change the surface is. A project with no `.keel/` yet checks clean; once a build or test run has written it, editing a source makes `keel check` report E1005 for each stale artifact before your real error. Run `keel build` before `keel check` after edits.

### From the document to a rendered route

Follow `http://localhost:5173/lists/l1` in `keel dev`:

1. Keel serves the generated document. Its script asks for `/@keel/entry.ts`.
2. The plugin picks the deployable to serve: the one `KEEL_DEPLOYABLE` names, else the first `client` deployable by name. Here that is `web`, whose modules are `["todos"]`.
3. It generates the mount entry. For golden-1 under `keel dev` it is, minus a dev-only block that reports live state to `/__keel/inspect`:

   ```ts
   import "@keel/ui/fonts";
   import "virtual:keel.css";
   import { createCtx } from "@keel/ctx";
   import { browserHistory, createRouter, routeTable } from "@keel/router";
   import { mount } from "@keel/runtime-dom";
   import { routes as __keelRoutes0 } from "/modules/todos/routes.ts";
   const ctx = createCtx({ mode: "real" });
   const mode = "dev";
   const router = createRouter(routeTable(__keelRoutes0), { ctx, history: browserHistory(), mode });
   const el = document.getElementById("app");
   if (el === null) throw new Error("keel: the document has no #app element");
   mount(router.App, el, { ctx, mode });
   ```

   `keel build` writes `const mode = "production";` instead and drops the reporting block. With several modules in the deployable it joins their route tables with `routeTable(...)`. When a module's `module.ts` sets `std` config for a client-readable stdlib package, the entry also binds it to `ctx`.
4. `virtual:keel.css` loads: the atomic classes for every style prop your components use, built from `tokens.ts`.
5. The router matches `/lists/l1` against the route table built from `modules/todos/routes.ts`: route `todos.list`, path `/lists/:listId`. It parses the params with `ListParams` (a failure is a 404 rendered by the route's `errorElement`) and the search with `ListSearch` (failing keys are dropped).
6. It runs the chain's guards, outermost first (none here), then its loaders. `loadList` runs in the browser with the real `ctx`. It calls `GET /api/lists` through a typed client.
7. `keel dev` answers `/api/lists` from the `api` deployable's dev server on the same origin. The `api.lists` loader restores `api.board` from storage and answers `{ id, results: { "api.lists": { ok: true, value } } }`, the board with its `head`, the count of writes it has taken.
8. The typed client takes the `api.lists` result and decodes its `value` with the endpoint's `output`, `BoardView`. `loadList` stores the board in the client store `todos.view` (transaction `todos.hydrate`) and returns the list.
9. The router renders the chain, outermost first: the layout `todos.shell` (`AppShell`), with `ListPage` as its children, given `{ params, search, data }`. `ListPage` reads the todos from `todos.view`. `AppShell` also opens `GET /api/board/events`, the board channel, and sends any writes waiting in the outbox. When another page saves the board, the `api` deployable tells this one over that stream, and `AppShell` reads `GET /api/lists` into `todos.view` again.

A `node` deployable's page goes the other way. A request reaches `server.mjs`; `createApp` matches the route, runs guards and loaders on the server, and streams HTML with the request's store state in `<script type="application/json" id="k-state">`. If the page has an island (a component with an event handler, an effect, or a read of client-writable state), the HTML scripts the resume entry, which restores state from `#k-state` and attaches handlers to the server's DOM using `/@keel/islands.ts`, without rendering again. A request with `accept: application/json` gets the loader `Result` instead of HTML. golden-1's `api` routes are API routes: they answer JSON only.

## 5. Modules and file conventions

All app code lives in `modules/<id>/`. A module is a vertical slice with a manifest, `module.ts`:

- `id`: lowerCamel, equal to the folder name. It prefixes every route id, store id, transaction name and error code in the module (`todos.list`, `todos.view`, `todos.hydrate`). An unprefixed one is E1155.
- `deps`: app modules and stdlib packages this module may import from, link to or call. Anything else is E1152.
- `capabilities`: the `ctx` capabilities its code uses (`clock`, `random`, `storage`, `net`). Using one not listed is E1156.
- `public.exports`: the files other modules may import (a file's name is its export). Importing anything else is E1151. Routes are not listed: a module's contract is public to every module that has it in `deps`.
- `std` (optional): config for stdlib packages in `deps`.

A module that serves routes also has `<id>.contract.ts`, which exports the contract, and `routes.ts`, which exports `routes`, the contract bound to its components and handlers. The plugin evaluates `routes.ts` in Node, so it must not touch the browser at import time.

Keel decides what a file is from its name, and holds you to one export per file whose name equals the file name (E1752):

| File | Holds | Rule |
| --- | --- | --- |
| `Name.schema.ts` | one schema `Name` (and its type, same name) | every `s.*` schema lives in a `*.schema.ts` file (E1104) |
| `<id>.contract.ts` | one `contract` of the module's id, named as the module | the file imports `*.schema.ts` files and packages only (E1514); one per module (E1513) |
| `name.server.ts` | one `loader` or `action`, naming a contract entry | loaders and actions live only here (E1551); client-reachable code may not import them except through `routes.ts` (E1004) |
| `name.guard.ts` | one `guard` | a convention from the Keel skills; no rule enforces the suffix |
| `Name.tsx` | one component, default export, plus optional `Props` and `uses` | PascalCase; only a component file may export `Props` |
| `Name.ts` (PascalCase) | a component without JSX, written as function calls | its default export takes props |
| `name.ts` | one function, store or value | `module.ts` and `routes.ts` have fixed names |
| `jobs.server.ts`, `schedules.server.ts`, `runners.server.ts` | the stdlib queue, the schedules, the runners | fixed names; E2501, E2552, E2504 |

One export per file means every name you see in an import is also a file you can open, and the checker can point at the exact file a rule is about. `.server.ts` marks loader and action code, which the compiler keeps out of component imports. In a `client` deployable that code still runs in the browser: the suffix marks the role, not the machine.

Imports across modules name the exporting file directly (`../api/Board.schema.ts`); there are no barrel files.

## 6. The api module

`api` is a `node` deployable's module: it owns the board. Every request gets its own instance of the board store, restored from `ctx.storage` and saved back when an action succeeds.

### Manifest

```ts title="modules/api/module.ts"
import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: [
    "@keel/std-channels",
    "@keel/std-jobs",
    "@keel/std-offline",
    "@keel/std-sessions",
    "@keel/std-statecharts",
    "@keel/std-workflows",
  ],
  capabilities: ["clock", "net", "observe", "random", "storage"],
  public: {
    exports: [
      "Board",
      "BoardView",
      "FieldsReply",
      "ListDraft",
      "ListParams",
      "Suggestion",
      "Todo",
      "TodoDraft",
      "TodoList",
      "ListWrite",
      "TodoWrite",
      "ToggleWrite",
      "boardChannel",
      "Removal",
      "Nothing",
      "WriteRefusal",
    ],
  },
  std: { "@keel/std-sessions": { readers: [] } },
});
```

`api` has no app dependencies: it owns its contract. Its stdlib dependencies are `@keel/std-channels` for the board channel, `@keel/std-offline` for the `Write` schema its write bodies carry, `@keel/std-statecharts`, `@keel/std-workflows` and `@keel/std-jobs` for the list removal, and `@keel/std-sessions` for the production tally. `random` mints ids and `storage` holds the board; the channel's stream uses `clock`, `net` and `observe`. `public.exports` lists the schemas and the channel `todos` and `digest` import, and `Removal`, which `BoardView` carries. Routes are not listed: every entry of `api`'s contract (below) is public to a module that has `api` in `deps`, and importing `api.contract.ts` needs `deps` only. `digest` calls `api.lists`, and the `todos` client calls the others and follows `api.boardEvents` through the board channel. The `std` entry gives `@keel/std-sessions` its `readers`, the cookie hashes allowed to read the tally; none as shipped.

### Contract schemas

A schema is the one declaration of a data shape. From it Keel derives the TypeScript type (`s.infer`), a validator (`parse`, which returns a `Result` and never throws), a JSON encoder, generators for property tests, and the JSON Schema in `.keel/` artifacts. The pattern is always a `const` and a `type` with the same name, in a file of that name.

`s.id("Todo")` is a string branded `Todo`; a `TodoList` id does not type-check where a `Todo` id is expected. Only `ctx.random.id("Todo")` mints one.

The board schemas, the form inputs and the params that `api` routes use live in `api` and are listed in its `public.exports`, so `todos` and `digest` import them. The `api` module owns the contract; its callers depend on it.

```ts title="modules/api/Todo.schema.ts"
import { s } from "@keel/schema";

/** One todo in a list. */
export const Todo = s.object({
  id: s.id("Todo"),
  listId: s.id("TodoList"),
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
  done: s.boolean(),
});
export type Todo = s.infer<typeof Todo>;
```

```ts title="modules/api/TodoList.schema.ts"
import { s } from "@keel/schema";

/** A named list of todos; `hidden` while its removal waits (`api.hideList`, `removal`). */
export const TodoList = s.object({
  id: s.id("TodoList"),
  name: s.string({ min: 1, max: 60 }),
  hidden: s.boolean().optional(),
});
export type TodoList = s.infer<typeof TodoList>;
```

`Board` is the state of the `api.board` store.

```ts title="modules/api/Board.schema.ts"
import { s } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/** State of the `api.board` store. */
export const Board = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
});
export type Board = s.infer<typeof Board>;
```

`BoardView` is the board as `GET /api/lists` serves it, plus `canUndo` and `head`, the number of writes the board has taken when it was read. A write names that number as its `base`. It is also the state of the client store.

```ts title="modules/api/BoardView.schema.ts"
import { s } from "@keel/schema";
import { Removal } from "./Removal.schema.ts";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/**
 * The board as `GET /api/lists` serves it (`api.lists` loader data) and the `todos.view` store holds it; `head` is the
 * board's head when it was read, the `base` a write names; `removals`, the removals not yet ended (`removal`).
 */
export const BoardView = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
  canUndo: s.boolean(),
  head: s.int({ min: 0 }),
  removals: s.array(Removal).optional(),
});
export type BoardView = s.infer<typeof BoardView>;
```

Form inputs. A form takes its schema, and the action that receives it takes the same schema as `input`:

```ts title="modules/api/ListDraft.schema.ts"
import { s } from "@keel/schema";

/** Form input for a new list. */
export const ListDraft = s.object({
  name: s.string({ min: 1, max: 60 }),
});
export type ListDraft = s.infer<typeof ListDraft>;
```

```ts title="modules/api/TodoDraft.schema.ts"
import { s } from "@keel/schema";

/** Form input for a new or edited todo. */
export const TodoDraft = s.object({
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
});
export type TodoDraft = s.infer<typeof TodoDraft>;
```

Write bodies. An outbox sends every board write with a `Write`, from `@keel/std-offline`: a `key` that names the write across retries, so a write the server already took is not applied twice, a `base`, the head the writer last read, and an `owner`, the user who queued it. Each action passes the write through `writeFor` with the owner of its caller before it reaches the store, so a write queued under another user is refused 400 `offline.owner` and nothing is saved; golden-1 has no sign-in, so that owner is `""` on both sides. The three bodies add the write to the fields of a draft:

```ts title="modules/api/ListWrite.schema.ts"
import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/lists`: the new list's name and the write's `key`, `base` and `owner`. */
export const ListWrite = s.object({
  name: s.string({ min: 1, max: 60 }),
  write: Write,
});
export type ListWrite = s.infer<typeof ListWrite>;
```

```ts title="modules/api/TodoWrite.schema.ts"
import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/lists/:listId/todos` and `POST /api/todos/:todoId`: the todo's fields and the write's `key`, `base` and `owner`. */
export const TodoWrite = s.object({
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
  write: Write,
});
export type TodoWrite = s.infer<typeof TodoWrite>;
```

```ts title="modules/api/ToggleWrite.schema.ts"
import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/todos/:todoId/toggle`: the write's `key`, `base` and `owner`. */
export const ToggleWrite = s.object({ write: Write });
export type ToggleWrite = s.infer<typeof ToggleWrite>;
```

`ListDraft` and `TodoDraft` stay the inputs of the forms; the `todos` actions send them inside these bodies.

Route params and search. The contract entry holds them and the handlers read them from it. Every search field of a page must be optional (E1504).

```ts title="modules/api/ListParams.schema.ts"
import { s } from "@keel/schema";

/** Route params naming one list (`todos.list`, `api.addTodo`, `api.removeList`). */
export const ListParams = s.object({ listId: s.id("TodoList") });
export type ListParams = s.infer<typeof ListParams>;
```

```ts title="modules/api/Suggestion.schema.ts"
import { s } from "@keel/schema";

/** A suggested todo title served by `GET /api/suggestions`. */
export const Suggestion = s.object({
  title: s.string({ min: 1, max: 120 }),
});
export type Suggestion = s.infer<typeof Suggestion>;
```

### The contract

`api.contract.ts` is the one file that says what the module serves. It is client-safe: it imports `*.schema.ts` files and packages and nothing else (E1514), so a browser bundle that imports it holds schemas only. Each key is a route id; an API entry has a `method`, a `path` and an `output`, and may have `params`, `query`, `body`, `errors`, `timeout` and `events`. Its id is `<module>.<name>` with `name` one lowerCamel segment, the name of its client method (E1513), so one path with two methods (`GET` and `POST /api/lists`) is two ids. The contract is read without running it: keys are literal; each entry's `method`, `path`, `layout` and `events` are literals; `params`, `search` and `query` are schemas reached through consts and imports. A spread or call in place of the entries or of an entry is W1005 and E1111. So the board channel's event stream is written out as a GET entry with `events: true`.

```ts title="modules/api/api.contract.ts"
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { BoardView } from "./BoardView.schema.ts";
import { FlowParams } from "./FlowParams.schema.ts";
import { ListParams } from "./ListParams.schema.ts";
import { ListWrite } from "./ListWrite.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { Suggestion } from "./Suggestion.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { TodoWrite } from "./TodoWrite.schema.ts";
import { ToggleWrite } from "./ToggleWrite.schema.ts";
import { WriteRefusal } from "./WriteRefusal.schema.ts";
import { boardChannel } from "./boardChannel.schema.ts";

/** What a refused board write answers: a 409 `keel.conflict` with the board's head, or a 422 `keel.fields`. */
const refused = { 409: s.json(), 422: WriteRefusal };

/**
 * The `api` module's routes: the board read and its writes (each body carries the write's `key` and `base`), undo, the
 * removal of a list and its undo, the suggested titles, and the board channel's event stream.
 */
export const api = contract("api", {
  "api.boardEvents": {
    method: "GET",
    path: "/api/board/events",
    query: Nothing,
    events: true,
    output: boardChannel.events,
  },
  "api.lists": { method: "GET", path: "/api/lists", output: BoardView },
  "api.createList": { method: "POST", path: "/api/lists", body: ListWrite, output: Nothing, errors: refused },
  "api.addTodo": {
    method: "POST",
    path: "/api/lists/:listId/todos",
    params: ListParams,
    body: TodoWrite,
    output: Nothing,
    errors: refused,
  },
  "api.editTodo": {
    method: "POST",
    path: "/api/todos/:todoId",
    params: TodoIdParams,
    body: TodoWrite,
    output: Nothing,
    errors: refused,
  },
  "api.toggleTodo": {
    method: "POST",
    path: "/api/todos/:todoId/toggle",
    params: TodoIdParams,
    body: ToggleWrite,
    output: Nothing,
    errors: refused,
  },
  "api.undo": { method: "POST", path: "/api/undo", output: Nothing },
  "api.removeList": { method: "POST", path: "/api/lists/:listId/remove", params: ListParams, output: Nothing },
  "api.undoRemoval": { method: "POST", path: "/api/removals/:flow/undo", params: FlowParams, output: Nothing },
  "api.suggestions": { method: "GET", path: "/api/suggestions", output: s.array(Suggestion) },
});
```

The contract holds the schemas of both sides, so the handlers below and every caller read one declaration: there is no second description of a route to keep in step. A write route's `output` is `Nothing` and its action answers `ok({})`.

### Server state: the board and its transactions

On a `node` deployable, a loader or action can name `stores`: a factory that builds stores (with explicit ids) and transactions. Per request, Keel runs the factory once, restores each store from `ctx.storage` key `keel.store.<id>`, passes the result to `fn` as `stores`, and on an action's `ok` saves the stores that changed. Two overlapping writes to the same store: the later one is 409 `keel.conflict`.

```ts title="modules/api/TodoIdParams.schema.ts"
import { s } from "@keel/schema";

/** Route params of `api.editTodo` and `api.toggleTodo`. */
export const TodoIdParams = s.object({ todoId: s.id("Todo") });
export type TodoIdParams = s.infer<typeof TodoIdParams>;
```

The answers of the write routes are schemas too: `Nothing` is the empty object an action returns when it has no data (`ok({})`), and `FieldsReply` is the error body a refused write carries, a 422 `keel.fields` with a field path to message in `data`, which `WriteRefusal` names for the outbox.

```ts title="modules/api/Nothing.schema.ts"
import { s } from "@keel/schema";

/** The output of an API action that answers no data: an empty object. */
export const Nothing = s.object({});

export type Nothing = s.infer<typeof Nothing>;
```

```ts title="modules/api/FieldsReply.schema.ts"
import { s } from "@keel/schema";

/**
 * The `api` deployable's error answer to an action (k.server): a public KeelError. A 422 carries `keel.fields`
 * (field path to message in `data`), which the Form shows next to the field.
 */
export const FieldsReply = s.object({ code: s.string(), message: s.string(), data: s.json() });
export type FieldsReply = s.infer<typeof FieldsReply>;
```

```ts title="modules/api/WriteRefusal.schema.ts"
import type { s } from "@keel/schema";
import { FieldsReply } from "./FieldsReply.schema.ts";

/** A refused write's 422 error as the outbox reads it (the `api` write entries): the `api` action's `keel.fields` error. */
export const WriteRefusal: typeof FieldsReply = FieldsReply;
export type WriteRefusal = s.infer<typeof WriteRefusal>;
```

`invariant` declares what must hold after every transaction; a transaction that breaks it is rolled back with `store.invariant`, and `properties()` in tests generates payloads to try to break it.

```ts title="modules/api/board.ts"
import { invariant, store } from "@keel/store";
import { Board } from "./Board.schema.ts";

/**
 * A fresh `api.board` (all lists and todos) with its invariant: ids unique, every todo in a known list. Call inside a
 * scope; `boardStores` creates one per request (k.server Server state), with the `api.*` transactions bound to it.
 */
export function board() {
  const b = store(Board, { lists: [], todos: [] }, { id: "api.board" });
  invariant(b, (state) => {
    const listIds = new Set(state.lists.map((l) => l.id));
    const todoIds = new Set(state.todos.map((t) => t.id));
    return (
      listIds.size === state.lists.length &&
      todoIds.size === state.todos.length &&
      state.todos.every((t) => listIds.has(t.listId))
    );
  });
  return b;
}
```

Each transaction is a function of the store, so the factory can bind it to that request's board. Transaction functions are pure: no `ctx`, no globals (E1302).

A write names the head it was based on. When the board has moved past that head, the transaction's `concurrent` policy decides. `"rebase"` runs the write over the newer board, which is right when the payload holds nothing the writer read: a list or todo with a fresh id, or a flip of `done`. `"reject"`, the default, refuses it with `keel.conflict`. `api.addList`, `api.addTodo` and `api.toggleTodo` rebase; `api.editTodo` rejects, because its payload carries the title and priority as the editor saw them.

```ts title="modules/api/addList.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.addList` on `board` (`boardStores`): append a list; a duplicate id leaves the board unchanged. A concurrent write
 * rebases: a list with a fresh id holds on any board.
 */
export const addList = (board: Store<Board>) =>
  transaction(
    board,
    "api.addList",
    s.object({ id: s.id("TodoList"), name: s.string({ min: 1, max: 60 }) }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? state
        : { ...state, lists: [...state.lists, { id: p.id, name: p.name }] },
    { concurrent: "rebase" },
  );
```

```ts title="modules/api/addTodo.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.addTodo` on `board` (`boardStores`): append an open todo to list `listId`; an unknown list or a duplicate id
 * leaves the board unchanged. A concurrent write rebases: a todo with a fresh id holds on any board.
 */
export const addTodo = (board: Store<Board>) =>
  transaction(
    board,
    "api.addTodo",
    s.object({
      id: s.id("Todo"),
      listId: s.id("TodoList"),
      title: s.string({ min: 1, max: 120 }),
      priority: s.enum(["low", "normal", "high"]),
    }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id) || !state.lists.some((l) => l.id === p.listId)
        ? state
        : { ...state, todos: [...state.todos, { ...p, done: false }] },
    { concurrent: "rebase" },
  );
```

```ts title="modules/api/toggleTodo.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.toggleTodo` on `board` (`boardStores`): flip `done` of todo `id`; an unknown id leaves the board unchanged. A
 * concurrent write rebases: a flip carries no value the writer read.
 */
export const toggleTodo = (board: Store<Board>) =>
  transaction(
    board,
    "api.toggleTodo",
    s.object({ id: s.id("Todo") }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id)
        ? { ...state, todos: state.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }
        : state,
    { concurrent: "rebase" },
  );
```

```ts title="modules/api/editTodo.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.editTodo` on `board` (`boardStores`): replace title and priority of todo `id`; an unknown id leaves the board
 * unchanged. A concurrent write is refused (`reject`, the default): its payload holds both fields as the editor read them.
 */
export const editTodo = (board: Store<Board>) =>
  transaction(
    board,
    "api.editTodo",
    s.object({
      id: s.id("Todo"),
      title: s.string({ min: 1, max: 120 }),
      priority: s.enum(["low", "normal", "high"]),
    }),
    (state, p) =>
      state.todos.some((t) => t.id === p.id)
        ? {
            ...state,
            todos: state.todos.map((t) => (t.id === p.id ? { ...t, title: p.title, priority: p.priority } : t)),
          }
        : state,
  );
```

```ts title="modules/api/boardStores.ts"
import { addList } from "./addList.ts";
import { addTodo } from "./addTodo.ts";
import { board } from "./board.ts";
import { editTodo } from "./editTodo.ts";
import { hideList } from "./hideList.ts";
import { purgeList } from "./purgeList.ts";
import { showList } from "./showList.ts";
import { toggleTodo } from "./toggleTodo.ts";

/**
 * The `api` deployable's server state (k.server Server state): the board and the `api.*` transactions bound
 * to it. Loaders and actions name it as `stores: boardStores`; each request gets its own instance, restored from and
 * saved to `ctx.storage` (`keel.store.api.board`).
 */
export function boardStores() {
  const b = board();
  return {
    board: b,
    addList: addList(b),
    addTodo: addTodo(b),
    toggleTodo: toggleTodo(b),
    editTodo: editTodo(b),
    hideList: hideList(b),
    showList: showList(b),
    purgeList: purgeList(b),
  };
}
```

### Removing a list

A list is not deleted when someone removes it. `api.removeList` hides it and starts an instance of a workflow (`@keel/std-workflows`, store `api.removal`); ten minutes later the workflow deletes the list and its todos unless `api.undoRemoval` came first. The board gets three more transactions, the schemas of the workflow's data, a state chart, two steps and a queue. `boardStores` (above) already binds the three transactions, so write them first. Each one rebases a concurrent write (`concurrent: "rebase"`), since hiding, showing or deleting carries no value the writer read.

```ts title="modules/api/hideList.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.hideList` on `board` (`boardStores`): mark list `id` hidden while its removal waits (`removal`); an unknown id
 * leaves the board unchanged. A concurrent write rebases: hiding carries no value the writer read.
 */
export const hideList = (board: Store<Board>) =>
  transaction(
    board,
    "api.hideList",
    s.object({ id: s.id("TodoList") }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: true } : l)) }
        : state,
    { concurrent: "rebase" },
  );
```

```ts title="modules/api/showList.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.showList` on `board` (`boardStores`): mark list `id` shown again (a removal undone or compensated, `removal`); an
 * unknown id leaves the board unchanged. A concurrent write rebases: showing carries no value the writer read.
 */
export const showList = (board: Store<Board>) =>
  transaction(
    board,
    "api.showList",
    s.object({ id: s.id("TodoList") }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: false } : l)) }
        : state,
    { concurrent: "rebase" },
  );
```

```ts title="modules/api/purgeList.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.purgeList` on `board` (`boardStores`): delete list `id` and every todo in it, the `purging` step of a removal
 * (`purge`); an unknown id leaves the board unchanged. A concurrent write rebases: deleting carries no value the
 * writer read.
 */
export const purgeList = (board: Store<Board>) =>
  transaction(
    board,
    "api.purgeList",
    s.object({ id: s.id("TodoList") }),
    (state, p) => ({
      lists: state.lists.filter((l) => l.id !== p.id),
      todos: state.todos.filter((t) => t.listId !== p.id),
    }),
    { concurrent: "rebase" },
  );
```

The workflow's schemas. A `Removal` is what the board read reports for a removal still running; `RemovalData` is the data of one instance; `StepFailure` is what a failed step sends the chart; `FlowParams` names an instance in a route.

```ts title="modules/api/Removal.schema.ts"
import { s } from "@keel/schema";

/** A removal still running (`BoardView.removals`): its instance id, its list and its state in `removalChart`. */
export const Removal = s.object({
  flow: s.string({ min: 1 }),
  list: s.id("TodoList"),
  state: s.enum(["hidden", "purging", "restoring"]),
});
export type Removal = s.infer<typeof Removal>;
```

```ts title="modules/api/RemovalData.schema.ts"
import { s } from "@keel/schema";

/**
 * The data of one removal instance (`removalChart`, `removal`): the list it removes. Optional only because a chart's
 * own `start` holds no list; `api.removeList` always starts an instance with one.
 */
export const RemovalData = s.object({ list: s.id("TodoList").optional() });
export type RemovalData = s.infer<typeof RemovalData>;
```

```ts title="modules/api/StepFailure.schema.ts"
import { s } from "@keel/schema";

/**
 * The payload of a removal step's `failed` event (`removalChart`): `workflows.attempts` when its attempts ran out
 * (std.workflows), else the code its step returned (`purge`, `restore`).
 */
export const StepFailure = s.object({ code: s.enum(["workflows.attempts", "api.purgeFailed", "api.restoreFailed"]) });
export type StepFailure = s.infer<typeof StepFailure>;
```

```ts title="modules/api/FlowParams.schema.ts"
import { s } from "@keel/schema";

/** Route params naming one removal instance (`api.undoRemoval`). */
export const FlowParams = s.object({ flow: s.string({ min: 1 }) });
export type FlowParams = s.infer<typeof FlowParams>;
```

`chart` (`@keel/std-statecharts`) declares a state machine: its data, its events and their payload schemas, and for each state the events it takes. The chart is the whole life of a removal: `hidden` waits, `purging` deletes, `restoring` shows the list again, and `removed`, `kept` and `stuck` end it.

```ts title="modules/api/removalChart.ts"
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { RemovalData } from "./RemovalData.schema.ts";
import { StepFailure } from "./StepFailure.schema.ts";

/**
 * A list removal (`removal`): `hidden` until it `expired` (600,000 ms, the wait) or someone sends `undo`; `purging`
 * deletes the list and its todos, `purged` ends it `removed`, `purgeFailed` compensates in `restoring`; `restoring`
 * shows the list again, `restored` ends it `kept`, `restoreFailed` ends it `stuck`.
 */
export const removalChart = chart("api.removalChart", {
  data: RemovalData,
  start: {},
  events: {
    expired: s.object({}),
    undo: s.object({}),
    purged: s.object({}),
    purgeFailed: StepFailure,
    restored: s.object({}),
    restoreFailed: StepFailure,
  },
  initial: "hidden",
  states: {
    hidden: { on: { expired: "purging", undo: "restoring" } },
    purging: { on: { purged: "removed", purgeFailed: "restoring" } },
    restoring: { on: { restored: "kept", restoreFailed: "stuck" } },
    removed: { final: true },
    kept: { final: true },
    stuck: { final: true },
  },
});
```

A step is a function from the instance's data and `ctx` to a `Result`. `purge` and `restore` each commit one board transaction through `commitStores`; an `err` is the step's failure.

```ts title="modules/api/PurgeFailed.schema.ts"
import { s } from "@keel/schema";

export const PurgeFailed = s.error("api.purgeFailed", s.object({ cause: s.string() }));
```

```ts title="modules/api/purge.server.ts"
import type { Ctx } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { tx } from "@keel/store";
import { PurgeFailed } from "./PurgeFailed.schema.ts";
import type { RemovalData } from "./RemovalData.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * The `purging` step of `removal`: delete the list and its todos in one commit of the board (`api.purgeList`). Its
 * `ok` is the `purged` payload; any failure is `api.purgeFailed`, which `removal` retries and then compensates.
 */
export const purge = async (data: RemovalData, ctx: Ctx) => {
  const id = data.list;
  if (id === undefined) return ok({});
  const r = await commitStores(ctx, boardStores, (S) => {
    const t = tx(S.purgeList, { id });
    return t.ok ? ok(null) : err(t.error);
  });
  return r.ok
    ? ok({})
    : err(PurgeFailed.make({ cause: r.error.code }));
};
```

```ts title="modules/api/RestoreFailed.schema.ts"
import { s } from "@keel/schema";

export const RestoreFailed = s.error("api.restoreFailed", s.object({ cause: s.string() }));
```

```ts title="modules/api/restore.server.ts"
import type { Ctx } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { tx } from "@keel/store";
import type { RemovalData } from "./RemovalData.schema.ts";
import { RestoreFailed } from "./RestoreFailed.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * The `restoring` step of `removal`, after an undo or a failed purge: show the list again in one commit of the board
 * (`api.showList`). Its `ok` is the `restored` payload; any failure is `api.restoreFailed`.
 */
export const restore = async (data: RemovalData, ctx: Ctx) => {
  const id = data.list;
  if (id === undefined) return ok({});
  const r = await commitStores(ctx, boardStores, (S) => {
    const t = tx(S.showList, { id });
    return t.ok ? ok(null) : err(t.error);
  });
  return r.ok
    ? ok({})
    : err(RestoreFailed.make({ cause: r.error.code }));
};
```

`workflow` joins the chart to the steps: `purging` and `restoring` run a step and send `done` or `failed` to the chart, and `hidden` waits 600,000 ms before it sends `expired`. A failed step is tried 3 times first.

```ts title="modules/api/removal.server.ts"
import { workflow } from "@keel/std-workflows";
import { purge } from "./purge.server.ts";
import { removalChart } from "./removalChart.ts";
import { restore } from "./restore.server.ts";

/**
 * The list removal workflow (std.workflows), store `api.removal`: `api.removeList` hides a list and starts an
 * instance; after 600,000 ms in `hidden` it purges the list (`purge`), and an undo, or a purge that failed 3 times,
 * shows it again (`restore`).
 */
export const removal = workflow("api.removal", {
  chart: removalChart,
  steps: {
    purging: { run: purge, done: "purged", failed: "purgeFailed" },
    restoring: { run: restore, done: "restored", failed: "restoreFailed" },
  },
  waits: { hidden: { ms: 600_000, event: "expired" } },
});
```

The two actions use one stores factory, the board and `api.removal` together, so hiding the list and starting its removal are one commit.

```ts title="modules/api/removalStores.server.ts"
import type { Ctx } from "@keel/ctx";
import { boardStores } from "./boardStores.ts";
import { removal } from "./removal.server.ts";

/**
 * The board (`boardStores`) and the removal instances (`api.removal`) as one request's server state: hiding a list and
 * starting its removal is one `commit`, and `loadBoard` reads both from one cut.
 */
export function removalStores(ctx: Ctx) {
  return { ...boardStores(), removal: removal.stores(ctx) };
}
```

```ts title="modules/api/postRemove.server.ts"
import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `POST /api/lists/:listId/remove`: hide the list and start its removal (`removal`) in one commit, recorded with this
 * caller. An unknown or already hidden list is `keel.notFound`.
 */
export const postRemove = action(
  api,
  "api.removeList",
  { stores: removalStores },
  (_input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    const list = stores.board.get("lists").find((l) => l.id === listId);
    if (list === undefined || list.hidden === true)
      return err(keelError.notFound.make({}));
    const hidden = tx(stores.hideList, { id: listId }, { meta: { caller } });
    if (!hidden.ok) return err(hidden.error);
    const started = tx(
      stores.removal.start,
      { id: ctx.random.id("Flow"), data: { list: listId } },
      { meta: { caller } },
    );
    return started.ok ? ok({}) : err(started.error);
  },
);
```

```ts title="modules/api/postUndoRemoval.server.ts"
import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `POST /api/removals/:flow/undo`: send `undo` to a removal still `hidden`, which then shows its list again
 * (`restore`). A removal past `hidden`, or none, is `keel.notFound`.
 */
export const postUndoRemoval = action(
  api,
  "api.undoRemoval",
  { stores: removalStores },
  (_input, { params, caller, stores }) => {
    const { flow } = params;
    const at = stores.removal.store.get("instances")[flow];
    if (at?.state !== "hidden")
      return err(keelError.notFound.make({}));
    const r = tx(stores.removal.events.undo, { id: flow, payload: {} }, { meta: { caller } });
    return r.ok ? ok({}) : err(r.error);
  },
);
```

The workflow runs its steps and waits as jobs. `jobs.server.ts` is the module's queue, and `runners.server.ts` lists what runs in the background wherever `topology.ts` places `api`: the `monitor` runner of `@keel/std-sessions` (commit counts by transaction name, for `sessions.tally`), the queue, and `flows`, which enqueues each instance's next job. Every step result is an entry of the `api.removal` log, so a restart resumes an instance where its last commit left it.

```ts title="modules/api/jobs.server.ts"
import { queue } from "@keel/std-jobs";
import { removal } from "./removal.server.ts";

/** The `api` module's job queue (std.jobs): the step, wake and forget jobs of `removal`. */
export const jobs = queue({ ...removal.jobs });
```

```ts title="modules/api/runners.server.ts"
import { monitor } from "@keel/std-sessions/monitor";
import { flows } from "@keel/std-workflows";
import { jobs } from "./jobs.server.ts";
import { removal } from "./removal.server.ts";

/**
 * The `api` module's background work (k.topology Runners): `monitor` counts each `api.*` commit into `sessions.tally`;
 * `jobs` runs the removal jobs that `flows` enqueues for each `api.removal` instance.
 */
export const runners = [monitor, jobs, flows(jobs, [removal])];
```

### Loaders and actions

A handler names the contract entry it answers: `loader(api, "api.lists", { stores }, fn)` and `action(api, "api.createList", { stores }, fn)`. `fn` is never annotated: its `params`, `query` and body, and the `Result` it returns, are typed from the entry, and a handler written for one id and bound under another does not compile (E1515). `caller` identifies the browser: a hash of a signed `keel-caller` cookie the server sets on the first write. Actions record it as transaction `meta`, so undo can stay per client. `loadBoard` and the removal actions name `removalStores` instead, so one read or commit covers the board and the removals. Each write action also spreads the body's `write` (`key` and `base`) into the options of `tx`, so the store takes the key and applies the policy.

```ts title="modules/api/loadBoard.server.ts"
import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import type { Removal } from "./Removal.schema.ts";
import { api } from "./api.contract.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `GET /api/lists` (`api.lists`): every list and todo, whether `POST /api/undo` would undo this caller's last write, the head, and
 * the removals not yet ended, in one read of the board and `api.removal`.
 */
export const loadBoard = loader(api, "api.lists", { stores: removalStores }, async ({ caller, stores }) => {
  const { board } = stores;
  const canUndo = board.log().at(-1)?.meta?.caller === caller;
  const removals: Removal[] = [];
  for (const [flow, i] of Object.entries(stores.removal.store.get("instances"))) {
    const list = i.data.list;
    if (list !== undefined && (i.state === "hidden" || i.state === "purging" || i.state === "restoring"))
      removals.push({ flow, list, state: i.state });
  }
  return ok({ lists: board.get("lists"), todos: board.get("todos"), canUndo, head: board.head(), removals });
});
```

```ts title="modules/api/loadSuggestions.server.ts"
import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { api } from "./api.contract.ts";

const TITLES = ["Bread", "Eggs", "Milk"];

/** Suggested todo titles for `GET /api/suggestions`, sorted by title; the same list on every request. */
export const loadSuggestions = loader(api, "api.suggestions", {}, async () =>
  ok([...TITLES].sort().map((title) => ({ title }))),
);
```

```ts title="modules/api/postList.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/lists`: add a list with a ctx-minted id, recorded with this caller (undo, `postUndo`) and the write's key
 * and base; a write queued under an owner other than `""` (golden-1 has no sign-in) is `offline.signin`.
 */
export const postList = action(api, "api.createList", { stores: boardStores }, (input, { caller, stores }, ctx) => {
  const w = writeFor(input.write, "");
  if (!w.ok) return err(w.error);
  const r = tx(stores.addList, { id: ctx.random.id("TodoList"), name: input.name }, { meta: { caller }, ...w.value });
  return r.ok ? ok({}) : err(r.error);
});
```

```ts title="modules/api/postTodo.server.ts"
import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id, with the write's key and base; an unknown
 * list is `keel.notFound`; a write queued under an owner other than `""` (golden-1 has no sign-in) is
 * `offline.signin`.
 */
export const postTodo = action(
  api,
  "api.addTodo",
  { stores: boardStores },
  (input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    if (!stores.board.get("lists").some((l) => l.id === listId))
      return err(keelError.notFound.make({}));
    const { write, ...draft } = input;
    const w = writeFor(write, "");
    if (!w.ok) return err(w.error);
    const r = tx(stores.addTodo, { ...draft, id: ctx.random.id("Todo"), listId }, { meta: { caller }, ...w.value });
    return r.ok ? ok({}) : err(r.error);
  },
);
```

```ts title="modules/api/postToggle.server.ts"
import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/todos/:todoId/toggle`: flip `done`, with the write's key and base; an unknown todo is `keel.notFound`;
 * a write queued under an owner other than `""` (golden-1 has no sign-in) is `offline.signin`. */
export const postToggle = action(
  api,
  "api.toggleTodo",
  { stores: boardStores },
  (input, { params, caller, stores }) => {
    const { todoId } = params;
    const todo = stores.board.get("todos").find((t) => t.id === todoId);
    if (todo === undefined) return err(keelError.notFound.make({}));
    const w = writeFor(input.write, "");
    if (!w.ok) return err(w.error);
    const r = tx(stores.toggleTodo, { id: todoId }, { meta: { caller }, ...w.value });
    return r.ok ? ok({}) : err(r.error);
  },
);
```

```ts title="modules/api/postEdit.server.ts"
import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/todos/:todoId`: replace title and priority, with the write's key and base. `keel.fields` `{ title }` when
 * another todo in the same list has the title; an unknown todo is `keel.notFound`; a write whose base is not the
 * board's head is `keel.conflict` (409, `api.editTodo` refuses concurrent writes); a write queued under an owner
 * other than `""` (golden-1 has no sign-in) is `offline.signin`.
 */
export const postEdit = action(api, "api.editTodo", { stores: boardStores }, (input, { params, caller, stores }) => {
  const { todoId } = params;
  const todos = stores.board.get("todos");
  const todo = todos.find((t) => t.id === todoId);
  if (todo === undefined) return err(keelError.notFound.make({}));
  const { write, ...draft } = input;
  const w = writeFor(write, "");
  if (!w.ok) return err(w.error);
  if (todos.some((t) => t.listId === todo.listId && t.id !== todoId && t.title === draft.title))
    return err(keelError.fields.make({ title: "Another todo has this title" }, "Duplicate title"));
  const r = tx(stores.editTodo, { ...draft, id: todoId }, { meta: { caller }, ...w.value });
  return r.ok ? ok({}) : err(r.error);
});
```

`postEdit` returns the store's `keel.conflict` as a 409 when the edit's base is not the head. `undoWhere` undoes the newest log entry only when the predicate holds:

```ts title="modules/api/postUndo.server.ts"
import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/undo`: undo the board's last transaction when this caller (its `keel-caller` cookie) committed it (its
 * entry's `meta.caller`, k.store `undoWhere`); else nothing changes and the reply is `keel.denied` (403): one client
 * never undoes another's write.
 */
export const postUndo = action(api, "api.undo", { stores: boardStores }, (_input, { caller, stores }) =>
  stores.board.undoWhere((e) => e.meta?.caller === caller)
    ? ok({})
    : err(keelError.denied.make({})),
);
```

### The board channel

A channel is a named event stream with a schema for what it carries. `boardChannel` has a name, a path and no params (`params: Nothing`, the empty object schema), and declares no message, so nothing is published on it: its one event tells a page that `api.board` was saved.

```ts title="modules/api/boardChannel.schema.ts"
import { channel } from "@keel/std-channels";
import { Nothing } from "./Nothing.schema.ts";

/**
 * The board's channel: `GET /api/board/events` tells every open page that `api.board` was saved, so it re-reads. It
 * declares no message, so nothing is published on it.
 */
export const boardChannel = channel("api.board", { path: "/api/board/events", params: Nothing });
```

The contract writes the channel's entry out: a `GET /api/board/events` entry with `events: true`, `query: Nothing` and `output: boardChannel.events`. (A channel with a message adds a POST entry with `body: boardChannel.body` and `output: s.object({})`.) `channelRoute(api, boardChannel, { id, stores, member })` takes that contract and declares the handler for the entry, returning `{ loader }`; an entry whose `method`, `path`, `events`, `query` or `output` differs from the channel's is E1515. It names the stores it watches, the board's and the removal's (below), so it sees their saves, and `member` decides per open stream whether a caller may listen. The board is public, so every caller is a member.

```ts title="modules/api/boardEvents.server.ts"
import type { Ctx } from "@keel/ctx";
import { channelRoute } from "@keel/std-channels/server";
import { api } from "./api.contract.ts";
import { boardChannel } from "./boardChannel.schema.ts";
import { boardStores } from "./boardStores.ts";
import { removal } from "./removal.server.ts";

/**
 * The stores the board channel watches: the board and the store of `api.removal`. `channelRoute` looks for stores among
 * the values of this object, so the workflow's store is listed itself, not inside its `removal.stores(ctx)`.
 */
function watched(ctx: Ctx) {
  return { ...boardStores(), removal: removal.stores(ctx).store };
}

/** The board channel's event stream: every caller is a member, since the board is public. A save of the board or of `api.removal` reaches it. */
export const boardEvents = channelRoute(api, boardChannel, {
  id: "api.boardEvents",
  stores: watched,
  member: () => true,
});
```

### The binding

An entry of the contract is an API route: it answers JSON whatever the request's `accept` says, the loader `Result` for a GET and the action `Result` for a write, and no `component` is allowed on it (E1510). `routes.ts` binds every entry of the contract and nothing else (E1515): a GET entry takes a `loader`, a write entry an `action`, each with an optional `guard`. The loader of `api.boardEvents`, an `events: true` entry, is the only live one: an async generator that streams events. `api` has no pages, so its contract has no `href`: `href` takes a page id.

```ts title="modules/api/routes.ts"
import { manifest } from "@keel/router";
import { api } from "./api.contract.ts";
import { boardEvents } from "./boardEvents.server.ts";
import { loadBoard } from "./loadBoard.server.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";
import { postEdit } from "./postEdit.server.ts";
import { postList } from "./postList.server.ts";
import { postRemove } from "./postRemove.server.ts";
import { postTodo } from "./postTodo.server.ts";
import { postToggle } from "./postToggle.server.ts";
import { postUndo } from "./postUndo.server.ts";
import { postUndoRemoval } from "./postUndoRemoval.server.ts";

/**
 * The `api` deployable (node): it owns the board (`api.lists`); `todos` reads and writes it over HTTP and follows the
 * board channel (`api.boardEvents`) to re-read after each save; `api.removeList` and `api.undoRemoval` start and undo a
 * list's removal (`removal`). `sessions.tally` answers the commit counts of the `monitor` runner to a caller in
 * `readers` (`module.ts`); the `sessions` module binds it.
 */
export const routes = manifest(api, {
  "api.boardEvents": { loader: boardEvents.loader },
  "api.lists": { loader: loadBoard },
  "api.createList": { action: postList },
  "api.addTodo": { action: postTodo },
  "api.editTodo": { action: postEdit },
  "api.toggleTodo": { action: postToggle },
  "api.undo": { action: postUndo },
  "api.removeList": { action: postRemove },
  "api.undoRemoval": { action: postUndoRemoval },
  "api.suggestions": { loader: loadSuggestions },
});
```

`boardEvents.loader` is the live loader `channelRoute` returned for `api.boardEvents`. `manifest(contract, binding)` returns the module's route table; a deployable that serves several modules joins their tables with `routeTable(...)`.

## 7. The todos module

`todos` is the `web` deployable: every page, every form, and a client-side copy of the board. It never owns data; it reads `GET /api/lists`, follows the board channel, and sends every write to a `POST` route of the `api` deployable through an outbox.

### Manifest

```ts title="modules/todos/module.ts"
import { module } from "@keel/compiler";

export default module({
  id: "todos",
  deps: ["api", "@keel/std-statecharts"],
  capabilities: ["net", "storage"],
  public: { exports: [] },
});
```

`deps: ["api", "@keel/std-statecharts"]` lets it import `api`'s contract and schemas, call its routes and declare the editor's chart. `net` is for the HTTP calls; `storage` is for the edit guard and the outbox. Nothing is public, because nothing outside `todos` imports its files or links to its pages.

### Schemas

`todos` imports the contract schemas and the channel from `api` (`Todo`, `TodoList`, `BoardView`, `ListDraft`, `TodoDraft`, `ListParams`, `ListWrite`, `TodoWrite`, `ToggleWrite`, `Suggestion`, `boardChannel`; section 6). The schemas below are its own: the route params and search of its pages.


```ts title="modules/todos/TodoParams.schema.ts"
import { s } from "@keel/schema";

/** Route params naming one todo in its list (`todos.edit`). */
export const TodoParams = s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") });
export type TodoParams = s.infer<typeof TodoParams>;
```

```ts title="modules/todos/ListSearch.schema.ts"
import { s } from "@keel/schema";

/** Search of `todos.list`: which todos the page shows. */
export const ListSearch = s.object({ filter: s.enum(["all", "active", "done"]).optional() });
export type ListSearch = s.infer<typeof ListSearch>;
```

### The contract

The module's pages are a contract too. A page entry has a `path` and optional `params` and `search`; a layout is `{ layout: true }`. A page's component, loader and actions are bound in `routes.ts`, and the layout a page uses is named there, never here. The contract is also where links come from: `todos.href("todos.list", { listId })` returns an `Href` for a page of this module, and a page of another module is linked through that module's contract.

```ts title="modules/todos/todos.contract.ts"
import { contract } from "@keel/router/contract";
import { ListParams } from "../api/ListParams.schema.ts";
import { ListSearch } from "./ListSearch.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";

/** The `todos` module's pages: the lists, one list and the edit page of one todo, inside the app shell. */
export const todos = contract("todos", {
  "todos.shell": { layout: true },
  "todos.index": { path: "/" },
  "todos.list": { path: "/lists/:listId", params: ListParams, search: ListSearch },
  "todos.edit": { path: "/lists/:listId/todos/:todoId/edit", params: TodoParams },
});
```

### The client store and its transaction

A store holds state of one schema. The only way to change it is a transaction: a named, typed, pure function `(state, payload) => state` that Keel validates, logs and can undo. You run one with `tx(transaction, payload)`, which returns a `Result`.

```ts title="modules/todos/view.ts"
import { store } from "@keel/store";
import { BoardView } from "../api/BoardView.schema.ts";

/** The board as the `api` deployable last served it. Changes only through `todos.hydrate` (`refreshView`, `live`). */
export const view = store(BoardView, { lists: [], todos: [], canUndo: false, head: 0 }, { id: "todos.view" });
```

```ts title="modules/todos/hydrate.ts"
import { transaction } from "@keel/store";
import { BoardView } from "../api/BoardView.schema.ts";
import { view } from "./view.ts";

/** Replace the client's copy of the board with what the `api` deployable served. */
export const hydrate = transaction(view, "todos.hydrate", BoardView, (_state, data) => data);
```

`todos.view` changes only when a fresh board arrives, with the `head` it was read at: the client never edits todos locally, it asks `api` and re-reads.

### Talking to the api deployable

`service({ contract: api })` turns the `api` contract into a typed client: one method per API entry, named by the id after the module (`api.lists` is `todosApi.lists`), taking `({ params, query, body }, ctx)` and returning `Result<output, ApiError>`. The entries' schemas are the contract's own, so the client and the handler cannot disagree, and a method of an entry the contract lacks does not compile. The methods never throw. `ApiError` codes are `api.status` (with `status` and the decoded error body), `api.network`, `api.timeout`, `api.decode` and `api.input`. Requests go through `ctx.net`, never `fetch` (E1601, E1651).

The client names no origin. The topology resolves it per call from `contract.module`: in a browser, the origin of the `api` peer when the build sets `KEEL_PEER_API`, else the page's origin, which is the `api` origin because `api` hosts `web`; on a `ctx` that no `createApp` bound, `http://api.keel.invalid`. Importing `api.contract.ts` needs `api` in `deps` (E1152). Board writes carry a key and a base, so they go through the outbox (below) instead of through the client's methods. The client is one value:

```ts title="modules/todos/todosApi.ts"
import { service } from "@keel/services";
import { api } from "../api/api.contract.ts";

/** A typed client for the `api` module's routes, resolved per call by the topology (k.services): in a browser, the page's origin or the `api` peer. */
export const todosApi = service({ contract: api });
```

Every loader and Undo end by re-reading the board into `todos.view`. Offline, the read cannot go out; `refreshView` then answers the board as last served, so a page still opens while writes wait in the outbox:

```ts title="modules/todos/refreshView.ts"
import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, ok } from "@keel/schema";
import { tx } from "@keel/store";
import type { BoardView } from "../api/BoardView.schema.ts";
import { hydrate } from "./hydrate.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

/**
 * Read the board from `GET /api/lists` into `todos.view` (`todos.hydrate`); loaders and Undo end here. Offline, the
 * read cannot go out and the answer is the board as last served, so a page still opens while writes wait in the outbox.
 */
export async function refreshView(ctx: Ctx): Promise<Result<BoardView, KeelError<string, unknown>>> {
  const r = await todosApi.lists({}, ctx);
  if (!r.ok && r.error.code === "api.network" && !ctx.net.online())
    return ok({
      lists: view.get("lists"),
      todos: view.get("todos"),
      canUndo: view.get("canUndo"),
      head: view.get("head"),
    });
  if (!r.ok) return r;
  const h = tx(hydrate, r.value);
  return h.ok ? ok(r.value) : h;
}
```

### Writing through the outbox

An outbox holds this client's writes in the order sent. `send` posts one when the client is online and queues it when it is not; `drain` sends the waiting ones; `resolve` settles a write the server refused. The outbox keeps its entries in `ctx.storage`, so they survive a reload. Each write carries a fresh `key`, which lets the server drop a retry it already took, and a `base`, the board `head` the client last read.

`outbox(id, contract)` sends the contract's API write entries through its service, so the entries describe what each route's `Result` holds, as every `api` client does. A success is the empty object the action returns. A 409 is a refusal the outbox reads itself: `keel.conflict`, with the board's head. A 422 is the `keel.fields` error. `send` names an entry by its name after the module (`"addTodo"` for `api.addTodo`); a GET entry, an `events` entry or a page does not compile.

Each write also carries an owner: the signed-in user's id, so that a write one user queued is never sent under the next user's cookie. golden-1 has no sign-in, so every write's owner is `""`. An app with sign-in passes the user's id to `send` and `drain`, and a stored write of another owner becomes `failed` with `offline.owner`; its actions pass `writeFor` the id of the user the caller is signed in as, so the server refuses a write another tab queued under someone else.

The outbox is a store, so it lives in a scope. A module-level one needs a scope of its own, and `lifetime` is it:

```ts title="modules/todos/boardOutbox.ts"
import { scope } from "@keel/reactive";
import { outbox } from "@keel/std-offline";
import { api } from "../api/api.contract.ts";

/** The scope the outbox lives in: as long as the module, as the compiler gives a module-level store. */
const lifetime = scope(() => undefined);

/**
 * This client's board writes, in the order sent (store `todos.outbox`, kept in `ctx.storage`), sent to the `api`
 * module's write routes through its service: each waits here while the client is offline, and a write the board refused
 * stays until the user keeps theirs or the other one. golden-1 has no sign-in, so every write's owner is `""`.
 */
export const boardOutbox = lifetime.run(() => outbox("todos.outbox", api));
```

The live stream needs the `api` origin, which is the page's, because `api` hosts `web`. It is undefined off a browser page:

```ts title="modules/todos/pageOrigin.ts"
/** The page's origin, where the `api` deployable answers (`web` is hosted by `api`); undefined off a browser page. */
export const pageOrigin = (): string | undefined => (typeof location === "undefined" ? undefined : location.origin);
```

A Form action cannot leave a write in the outbox the way a checkbox can, because the Form shows its result. `formAnswer` turns an `OutboxResult` into the action's answer: a write that was sent, queued or held as a conflict is `ok(null)`, and the outbox panel shows the last two. A failed write is dropped from the outbox, since the Form reports it: a 422's `keel.fields` goes to the fields, any other error to the Form.

```ts title="modules/todos/formAnswer.ts"
import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, err, ok } from "@keel/schema";
import { type OutboxResult, resolve } from "@keel/std-offline";
import { WriteRefusal } from "../api/WriteRefusal.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";

/**
 * What a Form action answers after sending through `boardOutbox`: `ok(null)` once the write is sent, queued or held as
 * a conflict (the outbox panel shows the last two). A failed write leaves the outbox, since the Form shows it: a 422's
 * `keel.fields` goes to its fields, any other error to the Form.
 */
export async function formAnswer<O>(
  ctx: Ctx,
  endpoint: string,
  r: OutboxResult<O>,
): Promise<Result<null, KeelError<string, unknown>>> {
  if (r.state !== "failed") return ok(null);
  const entry = boardOutbox
    .get("entries")
    .filter((e) => e.state === "failed" && e.endpoint === endpoint)
    .at(-1);
  if (entry !== undefined) await resolve(ctx, boardOutbox, entry.key, "theirs");
  const e = r.error;
  const refusal = e.code === "api.status" ? WriteRefusal.parse(e.data.body) : undefined;
  return err(refusal?.ok === true ? refusal.value : e);
}
```

### Loaders, actions and the guard

A loader reads the data a route renders. `loader(contract, id, { output, stores? }, fn)`: `fn` gets `({ params, search, url, caller, stores }, ctx)` and returns `Promise<Result<T, KeelError>>`. A page's loader declares the `output` of its view; `params` and `search` come from the contract entry. Never annotate `fn`; its argument types come from the entry and the declaration. An `err` with `keel.notFound` renders the route's `errorElement` (404 on a server); `keel.denied` is 403; other codes are 400.

```ts title="modules/todos/loadIndex.server.ts"
import { loader } from "@keel/router";
import { BoardView } from "../api/BoardView.schema.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";

/** Loader of `todos.index`: the board from the `api` deployable, hydrated into `todos.view`. */
export const loadIndex = loader(todos, "todos.index", { output: BoardView }, async (_, ctx) => refreshView(ctx));
```

```ts title="modules/todos/loadList.server.ts"
import { loader } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { TodoList } from "../api/TodoList.schema.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";

/** The list named by `listId` from a fresh board (`refreshView`), else `keel.notFound`. */
export const loadList = loader(todos, "todos.list", { output: TodoList }, async ({ params }, ctx) => {
  const board = await refreshView(ctx);
  if (!board.ok) return board;
  const list = board.value.lists.find((l) => l.id === params.listId);
  return list === undefined
    ? err(keelError.notFound.make({}))
    : ok(list);
});
```

```ts title="modules/todos/loadTodo.server.ts"
import { loader } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Todo } from "../api/Todo.schema.ts";
import { editorChart } from "./editorChart.ts";
import { editorFollow } from "./editorFollow.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";

/**
 * The todo `todoId` of list `listId` from a fresh board (`refreshView`), else `keel.notFound`. Opening it brings
 * `editorChart` up to the outbox (`editorFollow`), then moves it from `viewing` to `editing`.
 */
export const loadTodo = loader(todos, "todos.edit", { output: Todo }, async ({ params }, ctx) => {
  const board = await refreshView(ctx);
  if (!board.ok) return board;
  const todo = board.value.todos.find((t) => t.id === params.todoId && t.listId === params.listId);
  if (todo === undefined)
    return err(keelError.notFound.make({}));
  const followed = editorFollow();
  if (!followed.ok) return err(followed.error);
  const opened = tx(editorChart.events.edit, {});
  return opened.ok ? ok(todo) : err(opened.error);
});
```

An action handles a form post. `action(contract, id, { input, stores? }, fn)`: `fn` gets `(input, { params, url, caller, stores }, ctx)`, with `input` already decoded and validated by its schema (a failure is 422 `keel.fields`, and `fn` is not called). `ok(null)` re-runs the chain's loaders once; `ok(href)` navigates there.

The three form actions send through the outbox: `send(ctx, boardOutbox, endpoint, call, { base, owner: "" })`, where `base` is the `head` in `todos.view`. Each ends in `formAnswer`.

```ts title="modules/todos/createList.server.ts"
import { action } from "@keel/router";
import { send } from "@keel/std-offline";
import { ListDraft } from "../api/ListDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

/** POST on `todos.index`: send `POST /api/lists` through the outbox, based on the board as last read; then revalidate. */
export const createList = action(todos, "todos.index", { input: ListDraft }, async (input, _req, ctx) => {
  const r = await send(ctx, boardOutbox, "createList", { body: input }, { base: view.get("head"), owner: "" });
  return formAnswer(ctx, "createList", r);
});
```

```ts title="modules/todos/createTodo.server.ts"
import { action } from "@keel/router";
import { send } from "@keel/std-offline";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

/** POST on `todos.list`: send `POST /api/lists/:listId/todos` through the outbox, based on the board as last read. */
export const createTodo = action(todos, "todos.list", { input: TodoDraft }, async (input, { params }, ctx) => {
  const r = await send(ctx, boardOutbox, "addTodo", { params, body: input }, { base: view.get("head"), owner: "" });
  return formAnswer(ctx, "addTodo", r);
});
```

`updateTodo` shows a 422 `keel.fields` from `api` (a duplicate title) under the title field. Sent, queued or refused as a conflict, the edit returns the list's `Href`; the outbox panel shows a conflict. It links with `todos.href`, which reads the contract, so it never imports `routes.ts`. It also moves `editorChart` (below): `save` before the send and the outbox's answer after it. `loadTodo` brings the chart up to the outbox (`editorFollow`) and sends `edit` when the page opens.

```ts title="modules/todos/updateTodo.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { send } from "@keel/std-offline";
import { tx } from "@keel/store";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { editorChart } from "./editorChart.ts";
import { editorOutcome } from "./editorOutcome.ts";
import { formAnswer } from "./formAnswer.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

/**
 * POST on `todos.edit`: send `POST /api/todos/:todoId` through the outbox, based on the board as last read, moving
 * `editorChart` to `saving` and then by the outbox's answer (`editorOutcome`). Sent, queued or refused as a conflict
 * (the outbox panel shows it), it goes to the list; the api's 422 `keel.fields` (`{ title }` when another todo in the
 * list has the title) goes to the Form.
 */
export const updateTodo = action(todos, "todos.edit", { input: TodoDraft }, async (input, { params }, ctx) => {
  const call = { params: { todoId: params.todoId }, body: input };
  const saving = tx(editorChart.events.save, {});
  if (!saving.ok) return err(saving.error);
  const r = await send(ctx, boardOutbox, "editTodo", call, { base: view.get("head"), owner: "" });
  const moved = editorOutcome(r.state);
  if (!moved.ok) return err(moved.error);
  const answer = await formAnswer(ctx, "editTodo", r);
  return answer.ok ? ok(todos.href("todos.list", { listId: params.listId })) : answer;
});
```

A guard runs before any loader in the chain. `ok(null)` lets the request through; `err` redirects to the `redirect` route.

```ts title="modules/todos/editable.guard.ts"
import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

/** Stub edit permission: denied while `ctx.storage` key `todos.readOnly` is `"1"`; redirects to `todos.index`. */
export const editable = guard({ redirect: "todos.index" }, async (_req, ctx) =>
  (await ctx.storage.get("todos.readOnly")) === "1"
    ? err(keelError.denied.make({}))
    : ok(null),
);
```

### The editor chart

The edit page keeps its status in a chart, `todos.editor`: `viewing` until a todo's edit page opens, `editing` until Save, `saving` until the outbox answers. A sent edit goes back to `viewing`, a refused one to `conflict`, a failed one to `saving` again for at most 3 sends and then `gaveUp`. The files around the chart are small. `idPart` turns a record id into one part of an element id, so a page can put it in `todos.row.<id>` safely.

```ts title="modules/todos/EditorData.schema.ts"
import { s } from "@keel/schema";

/** The editor chart's own data: how many times the current edit has been sent, at most 3. */
export const EditorData = s.object({ attempts: s.int({ min: 0, max: 3 }) });
export type EditorData = s.infer<typeof EditorData>;
```

```ts title="modules/todos/editorChart.ts"
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { EditorData } from "./EditorData.schema.ts";

/**
 * The todo editor's status (store `todos.editor`): `viewing` until a todo's edit page opens (`edit`), `editing` until
 * Save (`save`), `saving` until the outbox answers: `saved` back to `viewing`, `refused` to `conflict`, `failed` to
 * `saving` again while fewer than 3 sends were made, else `gaveUp`. In `conflict` the outbox panel's Keep mine sends
 * it again (`mine`, within the same 3) and Keep theirs drops it (`theirs`).
 */
export const editorChart = chart("todos.editor", {
  data: EditorData,
  start: { attempts: 0 },
  events: {
    edit: s.object({}),
    save: s.object({}),
    saved: s.object({}),
    refused: s.object({}),
    failed: s.object({}),
    mine: s.object({}),
    theirs: s.object({}),
    cancel: s.object({}),
  },
  guards: { canRetry: (d) => d.attempts < 3 },
  actions: { count: (d) => ({ attempts: Math.min(3, d.attempts + 1) }), reset: () => ({ attempts: 0 }) },
  initial: "viewing",
  states: {
    viewing: { on: { edit: "editing" } },
    editing: { on: { save: { to: "saving", do: "count" }, cancel: "viewing" } },
    saving: {
      on: {
        saved: { to: "viewing", do: "reset" },
        refused: "conflict",
        failed: [{ to: "saving", guard: "canRetry", do: "count" }, { to: "gaveUp" }],
      },
    },
    conflict: {
      on: { mine: { to: "saving", guard: "canRetry", do: "count" }, theirs: { to: "viewing", do: "reset" } },
    },
    gaveUp: { final: true },
  },
});
```

`editorOutcome` moves the chart by what the outbox did with an edit. `editorFollow` brings a chart still in `saving` up to the outbox, for an edit the outbox sent after its page moved on. `editorStuck` says whether Keep mine is still allowed, and `resolveEdit` is the outbox panel's choice for an edit, made through the chart.

```ts title="modules/todos/editorOutcome.ts"
import { type KeelError, type Result, ok } from "@keel/schema";
import type { OutboxEntry, OutboxResult } from "@keel/std-offline";
import { tx } from "@keel/store";
import { editorChart } from "./editorChart.ts";

/**
 * Moves `editorChart` by what the outbox did with an edit: sent is `saved`, a conflict `refused`, a failure `failed`.
 * A queued or sending edit leaves the chart in `saving` until the outbox sends it. Answers the chart's `tx` result.
 */
export function editorOutcome(
  state: OutboxResult<unknown>["state"] | OutboxEntry["state"],
): Result<unknown, KeelError<string, unknown>> {
  if (state === "sent") return tx(editorChart.events.saved, {});
  if (state === "conflict") return tx(editorChart.events.refused, {});
  if (state === "failed") return tx(editorChart.events.failed, {});
  return ok(null);
}
```

```ts title="modules/todos/editorFollow.ts"
import { type KeelError, type Result, ok } from "@keel/schema";
import { boardOutbox } from "./boardOutbox.ts";
import { editorChart } from "./editorChart.ts";
import { editorOutcome } from "./editorOutcome.ts";

/**
 * Brings `editorChart` up to the outbox: an edit the chart still holds in `saving` that the outbox has since sent
 * (no edit left in it) is `saved`, one it refused `refused`, one that failed `failed`; a queued or sending edit stays
 * `saving`. The outbox sends a queued edit, or one sent again by Keep mine, after the page that made it moved on.
 */
export function editorFollow(): Result<unknown, KeelError<string, unknown>> {
  if (editorChart.store.get("state") !== "saving") return ok(null);
  const edit = boardOutbox
    .get("entries")
    .filter((e) => e.endpoint === "editTodo")
    .at(-1);
  return editorOutcome(edit === undefined ? "sent" : edit.state);
}
```

```ts title="modules/todos/editorStuck.ts"
import { editorChart } from "./editorChart.ts";

/** True when `editorChart` holds a refused edit that has used its 3 tries: Keep mine is off, Keep theirs remains. */
export function editorStuck(): boolean {
  const state = editorChart.store.get("state");
  const now = { state, data: editorChart.store.get("data") };
  return state === "conflict" && !editorChart.enabled(now, "mine", {});
}
```

```ts title="modules/todos/resolveEdit.ts"
import type { Ctx } from "@keel/ctx";
import { type Resolution, resolve } from "@keel/std-offline";
import { tx } from "@keel/store";
import { boardOutbox } from "./boardOutbox.ts";
import { editorChart } from "./editorChart.ts";
import { editorFollow } from "./editorFollow.ts";
import { editorStuck } from "./editorStuck.ts";

/**
 * Keep mine or Keep theirs on a refused edit (`key` in `boardOutbox`), through `editorChart`: an edit still `saving`
 * learns of the refusal first (`refused`), then `mine` sends it again within the chart's 3 tries and `theirs` drops
 * it. Keep mine does nothing once the edit has used its tries (`editorStuck`). Keep mine returns once the outbox has
 * answered the re-send (or holds it queued), and the chart follows that answer (`editorFollow`). Resolves true when
 * the outbox applied the choice.
 */
export async function resolveEdit(ctx: Ctx, key: string, resolution: Resolution): Promise<boolean> {
  const refused = tx(editorChart.events.refused, {});
  if (!refused.ok || (resolution === "mine" && editorStuck())) return false;
  const chosen = tx(resolution === "mine" ? editorChart.events.mine : editorChart.events.theirs, {});
  if (!chosen.ok) return false;
  const applied = await resolve(ctx, boardOutbox, key, resolution);
  return applied !== false && editorFollow().ok;
}
```

```ts title="modules/todos/idPart.ts"
/**
 * A record id as one part of an element id: percent-encoded, so it holds no whitespace or quote and two ids stay
 * two parts. Minted ids (uuids) and fixture ids such as `t1` pass through unchanged.
 */
export function idPart(id: string): string {
  return encodeURIComponent(id);
}
```

`loadTodo` and `updateTodo` (above) send the chart's `edit` and `save` events, `OutboxPanel` and `EditTodoPage` (below) read it.

### Components

A component file has one default export, a function `(props)` or `(props, ctx: Ctx)`, and may also export `Props`, a schema of its props, and `uses`, the transactions it may run. The rules you will meet first:

- Use the base elements from `@keel/ui` (`Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `Select`, `Checkbox`, `TextArea`). A lowercase tag such as `<div>` is E1805; a `style` attribute is E1803.
- Style props take token names. `px={{ base: "3", md: "6" }}` is responsive; `states={{ hover: { bg: "surfaceLow" } }}` styles states. A raw value such as `gap="12px"` fails the type check.
- Accessibility props are required: `Heading level`, `Image alt` or `decorative`, `label` on form controls, text inside `Button` and `Link` (E1802).
- `Link to` and `Form action` take an `Href` from `<contract>.href(id, params, search)` (`todos.href(...)`), never a string (E1501).
- A component that reaches an effect declares `ctx: Ctx` as its second parameter, never optional, defaulted or followed by another (E1407); every caller passes one. A component that reaches none is `(props)`.
- Read props as `props.x`; destructuring them is E1401, because props are getters that stay reactive.
- Control flow is `<If>`, `<For each key>` and `<Match on>` with one `<Case tag>` per variant, from `@keel/runtime-dom`. `{a && <X />}`, a ternary of elements, or `.map()` returning elements is E1403.
- Children arrive as a thunk: render them with `{props.children?.()}`.
- `ctx` arrives as the third argument from the mount, the island root or the test harness. It is the only way a component reaches an effect, so it is optional in the signature and checked before use.
- Give elements a stable `id`; tests and `.keel/ids.json` address elements by id, and a duplicate is E1404. golden-1 prefixes ids with the module id by convention.
- Stores, `computed` and `resource` read inside JSX update the DOM when they change. Components never touch `document` or `window` (E1252).

`AppShell` is the layout every page renders inside. It declares `uses = [hydrate]` because its Undo button re-reads the board through `refreshView`, and `live` commits each board it reads with `hydrate`; a component that declares `uses` may run only those transactions (E1301).

`live(ctx, origin, boardChannel, {}, { read, hydrate })` opens the board channel from inside the component. After the stream opens, and after every save, its own included, it runs `read` and commits the board to `todos.view` with `hydrate`. It returns the stream's status, read as `status()`: `live`, `connecting`, `offline` or `denied`. The header shows it as a label. `drain` sends the writes waiting in the outbox, and runs again when the client reconnects. Off a browser page, where there is no `ctx` or origin, the status stays `connecting` and nothing opens.

```tsx title="modules/todos/AppShell.tsx"
import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { type LiveStatus, live } from "@keel/std-live";
import { drain } from "@keel/std-offline";
import { Box, Button, Image, Link, Text } from "@keel/ui";
import { boardChannel } from "../api/boardChannel.schema.ts";
import OutboxPanel from "./OutboxPanel.tsx";
import { boardOutbox } from "./boardOutbox.ts";
import { hydrate } from "./hydrate.ts";
import { pageOrigin } from "./pageOrigin.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

export const Props = s.object({});
export const uses = [hydrate];

const LABELS: { readonly [K in LiveStatus]: string } = {
  live: "Live",
  connecting: "Connecting",
  offline: "Offline",
  denied: "No access",
};

/**
 * Layout `todos.shell`: home link, Undo, the board's live status, the outbox panel and the page in `main`. On a page it
 * follows the board channel (`live`): after every save, its own included, it re-reads the board into `todos.view`;
 * and it sends the outbox's waiting writes, again on each reconnect (`drain`). Undo posts `/api/undo` (the `api`
 * deployable owns the log and undoes only this client's own last write) and re-reads the board even when refused
 * (another client wrote last), so `canUndo` turns it off; it is disabled while the served board says there is
 * nothing to undo.
 */
export default function AppShell(props: Infer<typeof Props> & { readonly children?: () => Node }, ctx: Ctx) {
  const origin = pageOrigin();
  const status =
    origin === undefined
      ? (): LiveStatus => "connecting"
      : live(ctx, origin, boardChannel, {}, { read: (c) => todosApi.lists({}, c), hydrate });
  if (origin !== undefined) void drain(ctx, boardOutbox, { owner: "" });
  const empty = computed(() => !view.get("canUndo"));
  const undo = (): void => {
    void todosApi.undo({}, ctx).then(() => refreshView(ctx));
  };
  return (
    <Box id="todos.shell" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
      <Box
        as="header"
        direction={{ base: "column", md: "row" }}
        align={{ base: "start", md: "center" }}
        justify="between"
        gap="3"
        px={{ base: "3", md: "6" }}
        py="4"
      >
        <Box direction="row" align="center" gap="3">
          <Image src="/keel-mark.svg" decorative h="mark" />
          <Text fontSize="lg" weight="semibold">
            Keel
          </Text>
          <Text font="mono" fontSize="xs" fg="textSecondary">
            golden-1 / todos
          </Text>
        </Box>
        <Box as="nav" id="todos.nav" label="Main" direction="row" align="center" gap="4">
          <Text
            id="todos.live"
            font="mono"
            fontSize="xs"
            px="2"
            py="1"
            fg={status() === "live" ? "verified" : status() === "offline" ? "error" : "textSecondary"}
            border={status() === "live" ? "verified" : status() === "offline" ? "error" : "hairline"}
          >
            {LABELS[status()]}
          </Text>
          <Link id="todos.home" to={todos.href("todos.index")} fg="text">
            Home
          </Link>
          <Button
            id="todos.undo"
            disabled={empty}
            onClick={undo}
            font="mono"
            fontSize="sm"
            px="3"
            py="2"
            bg="card"
            fg="text"
            border="rule"
            radius="none"
            states={{ hover: { bg: "surfaceLow" }, disabled: { fg: "textSecondary", border: "control" } }}
          >
            Undo
          </Button>
        </Box>
      </Box>
      <Box h="hairline" bg="divider" />
      <OutboxPanel />
      <Box as="main" id="todos.main" w={{ md: "measure" }} mx={{ md: "auto" }} px={{ base: "3", md: "4" }} py="6">
        {props.children?.()}
      </Box>
    </Box>
  );
}
```

`OutboxPanel` lists the writes the outbox holds, in the order sent, and renders nothing while it is empty. A write is `queued` or `sending`, or the outbox holds it as a `conflict` (the board changed first and the server refused it) or as `failed`. A conflict offers Keep mine, which sends the write again over the newer board, and Keep theirs, which drops it. A failed write offers Dismiss. Both buttons call `resolve`, except for an edit, whose choice goes through the editor chart (`resolveEdit`); Keep mine is off once the edit has used its 3 tries (`editorStuck`). Element ids hold the entry's key through `idPart`. The panel reads `boardOutbox` directly, so `AppShell` mounts it with no props.

```tsx title="modules/todos/OutboxPanel.tsx"
import type { Ctx } from "@keel/ctx";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { type OutboxEntry, type Resolution, resolve } from "@keel/std-offline";
import { Box, Button, Heading, Text } from "@keel/ui";
import { boardOutbox } from "./boardOutbox.ts";
import { editorStuck } from "./editorStuck.ts";
import { idPart } from "./idPart.ts";
import { resolveEdit } from "./resolveEdit.ts";

export const Props = s.object({});

const WRITES: { readonly [endpoint: string]: string } = {
  createList: "Add list",
  addTodo: "Add todo",
  toggleTodo: "Mark todo",
  editTodo: "Edit todo",
};

const STATES: { readonly [K in OutboxEntry["state"]]: string } = {
  queued: "Waiting to send",
  sending: "Sending",
  conflict: "Someone changed this board first",
  failed: "Not saved",
};

/**
 * The outbox panel (`todos.outbox`, shown while the outbox holds a write): each waiting, refused or failed board
 * write in the order sent. A refused write offers Keep mine (send it again over the newer board) and Keep theirs
 * (drop it); a failed one offers Dismiss. An edit's choice goes through the editor chart (`resolveEdit`), which turns
 * Keep mine off once the edit has used its 3 tries.
 */
export default function OutboxPanel(_props: Infer<typeof Props>, ctx: Ctx) {
  const choose = (entry: OutboxEntry, resolution: Resolution): void => {
    if (entry.endpoint === "editTodo") void resolveEdit(ctx, entry.key, resolution);
    else void resolve(ctx, boardOutbox, entry.key, resolution);
  };
  return (
    <If when={boardOutbox.get("entries").length > 0}>
      {() => (
        <Box
          as="aside"
          id="todos.outbox"
          label="Outbox"
          direction="column"
          gap="3"
          w={{ md: "measure" }}
          mx={{ md: "auto" }}
          px={{ base: "3", md: "4" }}
          py="4"
        >
          <Heading id="todos.outbox.title" level={2} fontSize="xl" weight="semibold" m="0">
            Outbox
          </Heading>
          <Box
            as="ul"
            id="todos.outbox.items"
            direction="column"
            gap="hairline"
            bg="divider"
            border="hairline"
            p="0"
            m="0"
          >
            <For each={boardOutbox.get("entries")} key="key">
              {(entry) => (
                <Box
                  as="li"
                  id={`todos.outbox.entry.${idPart(entry.key)}`}
                  direction="row"
                  align="center"
                  justify="between"
                  gap="3"
                  px="3"
                  py="2"
                  bg="card"
                >
                  <Text id={`todos.outbox.write.${idPart(entry.key)}`} font="mono" fontSize="sm">
                    {WRITES[entry.endpoint] ?? entry.endpoint}
                  </Text>
                  <Text
                    id={`todos.outbox.state.${idPart(entry.key)}`}
                    font="mono"
                    fontSize="xs"
                    px="2"
                    py="1"
                    fg={entry.state === "queued" || entry.state === "sending" ? "textSecondary" : "error"}
                    border={entry.state === "queued" || entry.state === "sending" ? "hairline" : "error"}
                  >
                    {STATES[entry.state]}
                  </Text>
                  <If when={entry.state === "conflict"}>
                    {() => (
                      <Box direction="row" gap="2">
                        <Button
                          id={`todos.outbox.mine.${idPart(entry.key)}`}
                          disabled={entry.endpoint === "editTodo" && editorStuck()}
                          onClick={() => choose(entry, "mine")}
                          font="mono"
                          fontSize="sm"
                          px="3"
                          py="2"
                          bg="text"
                          fg="card"
                          border="rule"
                          radius="none"
                        >
                          Keep mine
                        </Button>
                        <Button
                          id={`todos.outbox.theirs.${idPart(entry.key)}`}
                          onClick={() => choose(entry, "theirs")}
                          font="mono"
                          fontSize="sm"
                          px="3"
                          py="2"
                          bg="card"
                          fg="text"
                          border="rule"
                          radius="none"
                        >
                          Keep theirs
                        </Button>
                      </Box>
                    )}
                  </If>
                  <If when={entry.state === "failed"}>
                    {() => (
                      <Button
                        id={`todos.outbox.theirs.${idPart(entry.key)}`}
                        onClick={() => choose(entry, "theirs")}
                        font="mono"
                        fontSize="sm"
                        px="3"
                        py="2"
                        bg="card"
                        fg="text"
                        border="rule"
                        radius="none"
                      >
                        Dismiss
                      </Button>
                    )}
                  </If>
                </Box>
              )}
            </For>
          </Box>
        </Box>
      )}
    </If>
  );
}
```

`ListsPage` is the index route. `form(ListDraft)` creates a form handle; `f.field("name")` binds an `Input` to it, with validation from the schema on blur and submit. The router's `Form` posts to the route's `POST` action and shows any non-field error in its `error` slot. The page writes `<Form method="POST" action={...} form={f} error={...}>` with the controls as its JSX children; the children stay a thunk, so a served page resumes them in place.

The page also removes lists. Each shown list has a Remove button, which calls `todosApi.removeList` and re-reads the board; the list is hidden at once. A bar for each removal that still waits says so and offers Undo, which calls `todosApi.undoRemoval`. The api deletes the list ten minutes later unless Undo comes first (section 6). The ids put the list's id through `idPart`.

```tsx title="modules/todos/ListsPage.tsx"
import type { Ctx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import { ListDraft } from "../api/ListDraft.schema.ts";
import type { TodoList } from "../api/TodoList.schema.ts";
import { idPart } from "./idPart.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

export const Props = s.object({});

const openCount = (listId: string): number => view.get("todos").filter((t) => t.listId === listId && !t.done).length;
const shown = () => view.get("lists").filter((l) => l.hidden !== true);
const nameOf = (listId: string): string => view.get("lists").find((l) => l.id === listId)?.name ?? listId;
/** The removals someone can still undo: their list is hidden and waits (`hidden`). */
const waiting = () => (view.get("removals") ?? []).filter((r) => r.state === "hidden");

/**
 * Route `todos.index`: every shown list with its open-todo count and a Remove button, a bar per removal that still
 * waits with its Undo, and a Form adding a list. Remove hides the list at once; the `api` deployable deletes it 10
 * minutes later unless Undo comes first. Both re-read the board.
 */
export default function ListsPage(_props: Infer<typeof Props>, ctx: Ctx) {
  const remove = (listId: TodoList["id"]): void => {
    void todosApi.removeList({ params: { listId } }, ctx).then(() => refreshView(ctx));
  };
  const undo = (flow: string): void => {
    void todosApi.undoRemoval({ params: { flow } }, ctx).then(() => refreshView(ctx));
  };
  const f = form(ListDraft);
  return (
    <Box as="section" id="todos.lists" direction="column" gap="5">
      <Heading id="todos.lists.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Lists
      </Heading>
      <For each={waiting()} key="flow">
        {(r) => (
          <Box
            id={`todos.removal.${idPart(r.flow)}`}
            direction="row"
            justify="between"
            align="center"
            gap="3"
            px="3"
            py="2"
            bg="surfaceLow"
            border="hairline"
          >
            <Text fontSize="sm">{`${nameOf(r.list)} is removed in 10 minutes.`}</Text>
            <Button
              id={`todos.undo.${idPart(r.flow)}`}
              onClick={() => undo(r.flow)}
              font="mono"
              fontSize="sm"
              px="3"
              py="1"
              bg="card"
              fg="text"
              border="rule"
              radius="none"
            >
              Undo
            </Button>
          </Box>
        )}
      </For>
      <Box as="ul" id="todos.lists.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={shown()} key="id">
          {(list) => (
            <Box
              as="li"
              id={`todos.listItem.${idPart(list.id)}`}
              direction="row"
              justify="between"
              align="baseline"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Link
                id={`todos.listLink.${idPart(list.id)}`}
                to={todos.href("todos.list", { listId: list.id })}
                fg="text"
              >
                {list.name}
              </Link>
              <Text
                id={`todos.openCount.${idPart(list.id)}`}
                font="mono"
                fontSize="xs"
                fg="accent"
                border="accent"
                px="2"
                py="1"
              >{`${openCount(list.id)} open`}</Text>
              <Button
                id={`todos.remove.${idPart(list.id)}`}
                onClick={() => remove(list.id)}
                font="mono"
                fontSize="xs"
                px="2"
                py="1"
                bg="card"
                fg="text"
                border="rule"
                radius="none"
              >
                Remove
              </Button>
            </Box>
          )}
        </For>
      </Box>
      <Form
        method="POST"
        action={todos.href("todos.index")}
        form={f}
        error={(e) => <Text fg="error">{e.message}</Text>}
      >
        <Input
          field={f.field("name")}
          label="List name"
          font="serif"
          fontSize="md"
          px="2"
          py="2"
          mx="2"
          my="1"
          bg="card"
          fg="text"
          border="control"
          radius="none"
        />
        <Button
          id="todos.addList"
          type="submit"
          font="mono"
          fontSize="sm"
          px="4"
          py="2"
          my="2"
          bg="text"
          fg="card"
          border="rule"
          radius="none"
        >
          Add list
        </Button>
      </Form>
    </Box>
  );
}
```

`ListPage` filters by the search param, lists rows with `For` (each row in a `todos.row.<id>` list item), and adds a todo with a form. `form` takes an `id` (`todos.addForm`), which prefixes the field ids in place of a hash of the schema's shape:

```tsx title="modules/todos/ListPage.tsx"
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Select, Text } from "@keel/ui";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { TodoList } from "../api/TodoList.schema.ts";
import Suggestions from "./Suggestions.tsx";
import TodoRow from "./TodoRow.tsx";
import { idPart } from "./idPart.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

export const Props = s.object({
  params: s.object({ listId: s.id("TodoList") }),
  search: s.object({ filter: s.enum(["all", "active", "done"]).optional() }),
  data: TodoList,
});

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

/** Route `todos.list`: the list's todos filtered by `search.filter`, filter links, an add-todo Form, Suggestions. */
export default function ListPage(props: Infer<typeof Props>) {
  const f = form(TodoDraft, { id: "todos.addForm", initial: { priority: "normal" } });
  const shown = () =>
    view
      .get("todos")
      .filter(
        (t) =>
          t.listId === props.params.listId &&
          (props.search.filter === "done" ? t.done : props.search.filter === "active" ? !t.done : true),
      );
  return (
    <Box as="section" id="todos.list" direction="column" gap="5">
      <Heading id="todos.list.title" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.name}
      </Heading>
      <Box as="section" id="todos.filters" direction="row" gap="4" font="mono" fontSize="sm">
        <Link
          id="todos.filter.all"
          to={todos.href("todos.list", { listId: props.params.listId }, { filter: "all" })}
          fg="text"
        >
          All
        </Link>
        <Link
          id="todos.filter.active"
          to={todos.href("todos.list", { listId: props.params.listId }, { filter: "active" })}
          fg="text"
        >
          Active
        </Link>
        <Link
          id="todos.filter.done"
          to={todos.href("todos.list", { listId: props.params.listId }, { filter: "done" })}
          fg="text"
        >
          Done
        </Link>
      </Box>
      <Box as="ul" id="todos.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={shown()} key="id">
          {(todo) => (
            <Box as="li" id={`todos.row.${idPart(todo.id)}`}>
              <TodoRow todo={todo} />
            </Box>
          )}
        </For>
      </Box>
      <Form
        method="POST"
        action={todos.href("todos.list", { listId: props.params.listId })}
        form={f}
        error={(e) => <Text fg="error">{e.message}</Text>}
      >
        <Input
          field={f.field("title")}
          label="Title"
          font="serif"
          fontSize="md"
          px="2"
          py="2"
          mx="2"
          my="1"
          bg="card"
          fg="text"
          border="control"
          radius="none"
        />
        <Select
          field={f.field("priority")}
          label="Priority"
          options={PRIORITIES}
          font="serif"
          fontSize="md"
          px="2"
          py="2"
          mx="2"
          my="1"
          bg="card"
          fg="text"
          border="control"
          radius="none"
        />
        <Button
          id="todos.addTodo"
          type="submit"
          font="mono"
          fontSize="sm"
          px="4"
          py="2"
          my="2"
          bg="text"
          fg="card"
          border="rule"
          radius="none"
        >
          Add todo
        </Button>
      </Form>
      <Suggestions />
    </Box>
  );
}
```

`TodoRow` sends the toggle through the outbox and does not re-read the board. The save reaches every open page over the board channel, this one included, and the checkbox follows `todos.view`. So it declares no `uses`:

```tsx title="modules/todos/TodoRow.tsx"
import type { Ctx } from "@keel/ctx";
import { type Infer, s } from "@keel/schema";
import { send } from "@keel/std-offline";
import { Box, Checkbox, Link, Text } from "@keel/ui";
import { Todo } from "../api/Todo.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { idPart } from "./idPart.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

export const Props = s.object({ todo: Todo });

/**
 * One todo: a done Checkbox (sends `/api/todos/:todoId/toggle` through the outbox, based on the board as last read;
 * the live board shows the result), priority, Edit link. The list that shows it owns the list item
 * (`todos.row.<id>` in `ListPage`), so a row renders on its own as well.
 */
export default function TodoRow(props: Infer<typeof Props>, ctx: Ctx) {
  const toggle = (): void => {
    const call = { params: { todoId: props.todo.id }, body: {} };
    void send(ctx, boardOutbox, "toggleTodo", call, { base: view.get("head"), owner: "" });
  };
  return (
    <Box direction="row" align="center" gap="3" px="3" py="2" bg="card">
      <Checkbox
        id={`todos.toggle.${idPart(props.todo.id)}`}
        label={`Done: ${props.todo.title}`}
        checked={props.todo.done}
        onChange={toggle}
      />
      <Text
        id={`todos.priority.${idPart(props.todo.id)}`}
        font="mono"
        fontSize="xs"
        px="2"
        py="1"
        fg={props.todo.priority === "high" ? "accent" : "textSecondary"}
        border={props.todo.priority === "high" ? "accent" : "hairline"}
      >
        {props.todo.priority}
      </Text>
      <Link
        id={`todos.editLink.${idPart(props.todo.id)}`}
        to={todos.href("todos.edit", { listId: props.todo.listId, todoId: props.todo.id })}
        fg="text"
        fontSize="sm"
      >
        Edit {props.todo.title}
      </Link>
    </Box>
  );
}
```

`Suggestions` fetches with `resource`, whose state is the union `loading | error | ready`. A resource is always consumed through `Match`, one `Case` per state (E1204, E1402):

```tsx title="modules/todos/Suggestions.tsx"
import type { Ctx } from "@keel/ctx";
import { type ResourceState, resource } from "@keel/reactive";
import { Case, For, Match } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import type { ApiError } from "@keel/services";
import { Box, Heading, Text } from "@keel/ui";
import type { Suggestion } from "../api/Suggestion.schema.ts";
import { todosApi } from "./todosApi.ts";

export const Props = s.object({});

type State = ResourceState<Suggestion[]>;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : "Suggestions failed");

/** `api.status` names the HTTP status; any other ApiError (network, timeout, decode) only that it failed. */
const failure = (e: ApiError): Error =>
  new Error(e.code === "api.status" ? `Suggestions failed (${e.data.status})` : "Suggestions failed");

async function fetchSuggestions(ctx: Ctx): Promise<Suggestion[]> {
  const r = await todosApi.suggestions({}, ctx);
  return r.ok ? r.value : Promise.reject(failure(r.error));
}

/** Suggested titles from `GET /api/suggestions` through the typed `api` client, shown by resource state. */
export default function Suggestions(_props: Infer<typeof Props>, ctx: Ctx) {
  const list = resource(() => fetchSuggestions(ctx));
  return (
    <Box as="section" id="todos.suggestions" direction="column" gap="3">
      <Heading id="todos.suggestions.title" level={2} fontSize="xl" weight="semibold" m="0">
        Suggestions
      </Heading>
      <Match on={list.get()}>
        <Case<State> tag="loading">
          {() => (
            <Text id="todos.suggestions.loading" as="p" m="0" font="mono" fontSize="sm" fg="textSecondary">
              Loading suggestions
            </Text>
          )}
        </Case>
        <Case<State> tag="error">
          {(v) => (
            <Text id="todos.suggestions.error" as="p" m="0" font="mono" fontSize="sm" fg="error">
              {messageOf(v.error)}
            </Text>
          )}
        </Case>
        <Case<State> tag="ready">
          {(v) => (
            <Box
              as="ul"
              id="todos.suggestions.list"
              direction="column"
              gap="hairline"
              bg="divider"
              border="hairline"
              p="0"
              m="0"
            >
              <For each={v.value} key="title">
                {(item) => (
                  <Box as="li" direction="row" px="3" py="2" bg="card">
                    {item.title}
                  </Box>
                )}
              </For>
            </Box>
          )}
        </Case>
      </Match>
    </Box>
  );
}
```

`EditTodoPage` starts its form, `todos.editForm`, from the loader's todo. The action's 422 `{ title }` lands on the title field. A status line, `todos.edit.status`, names a failed try, a refused edit or a given-up one from `editorChart`, and Save is off in `conflict` and `gaveUp`:

```tsx title="modules/todos/EditTodoPage.tsx"
import { form } from "@keel/forms";
import { computed } from "@keel/reactive";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Select, Text } from "@keel/ui";
import { Todo } from "../api/Todo.schema.ts";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { editorChart } from "./editorChart.ts";
import { todos } from "./todos.contract.ts";

export const Props = s.object({
  params: s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") }),
  data: Todo,
});

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

/** What `todos.edit.status` says for each `editorChart` state; empty says nothing. */
function statusOf(state: string, attempts: number): string {
  if (state === "saving" && attempts > 1) return "Not saved. Save to try again.";
  if (state === "conflict") return "Someone changed this todo first. Choose Keep mine or Keep theirs in the outbox.";
  if (state === "gaveUp") return "Not saved after 3 tries. Reload the page to edit again.";
  return "";
}

/**
 * Route `todos.edit`: a Form editing the todo's title and priority; success returns to `todos.list`. Its status is
 * `editorChart`'s: `todos.edit.status` names a failed try, a refused edit or a given-up one, and Save is off while
 * the chart holds a refused edit (`conflict`) or has given up (`gaveUp`).
 */
export default function EditTodoPage(props: Infer<typeof Props>) {
  const status = computed(() => statusOf(editorChart.store.get("state"), editorChart.store.get("data").attempts));
  const blocked = computed(() => {
    const state = editorChart.store.get("state");
    return state === "conflict" || state === "gaveUp";
  });
  const f = form(TodoDraft, {
    id: "todos.editForm",
    initial: { title: props.data.title, priority: props.data.priority },
  });
  return (
    <Box as="section" id="todos.edit" direction="column" gap="5">
      <Heading id="todos.edit.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Edit todo
      </Heading>
      <If when={status.get() !== ""}>
        {() => (
          <Text id="todos.edit.status" font="mono" fontSize="sm" fg="error">
            {status.get()}
          </Text>
        )}
      </If>
      <Form
        method="POST"
        action={todos.href("todos.edit", props.params)}
        form={f}
        error={(e) => <Text fg="error">{e.message}</Text>}
      >
        <Input
          field={f.field("title")}
          label="Title"
          font="serif"
          fontSize="md"
          px="2"
          py="2"
          mx="2"
          my="1"
          bg="card"
          fg="text"
          border="control"
          radius="none"
        />
        <Select
          field={f.field("priority")}
          label="Priority"
          options={PRIORITIES}
          font="serif"
          fontSize="md"
          px="2"
          py="2"
          mx="2"
          my="1"
          bg="card"
          fg="text"
          border="control"
          radius="none"
        />
        <Button
          id="todos.save"
          type="submit"
          disabled={blocked}
          states={{ disabled: { fg: "textSecondary", border: "control" } }}
          font="mono"
          fontSize="sm"
          px="4"
          py="2"
          my="2"
          bg="text"
          fg="card"
          border="rule"
          radius="none"
        >
          Save
        </Button>
      </Form>
    </Box>
  );
}
```

`ListError` is the `errorElement` of two routes; it receives `{ error }`:

```tsx title="modules/todos/ListError.tsx"
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { todos } from "./todos.contract.ts";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `todos.index`, `todos.list` and `todos.edit`: names the error and links home. */
export default function ListError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="todos.error" direction="column" gap="3" p="4" bg="card" border="error">
      <Text font="mono" fontSize="xs" fg="accent">
        {props.error.code}
      </Text>
      <Heading id="todos.error.title" level={1} fontSize="2xl" weight="semibold" m="0" fg="error">
        Not found
      </Heading>
      <Text as="p" id="todos.error.message" m="0" font="mono" fontSize="sm">
        {props.error.message}
      </Text>
      <Link id="todos.error.home" to={todos.href("todos.index")} fg="text">
        Back to lists
      </Link>
    </Box>
  );
}
```

### Routes

`manifest(todos, binding)` binds each entry of the contract and nothing else. A page binds its `component`, and optionally a `loader`, a `guard`, an `errorElement`, a `title` and its actions by verb (`POST`); the shell is a layout entry, and a page names it with `layout`, which may be a layout of this module or of another. An action file links with `todos.href`, which the contract provides, so no file imports `routes.ts` back and no declaration is circular.

```ts title="modules/todos/routes.ts"
import { manifest } from "@keel/router";
import AppShell from "./AppShell.tsx";
import EditTodoPage from "./EditTodoPage.tsx";
import ListError from "./ListError.tsx";
import ListPage from "./ListPage.tsx";
import ListsPage from "./ListsPage.tsx";
import { createList } from "./createList.server.ts";
import { createTodo } from "./createTodo.server.ts";
import { editable } from "./editable.guard.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadList } from "./loadList.server.ts";
import { loadTodo } from "./loadTodo.server.ts";
import { todos } from "./todos.contract.ts";
import { updateTodo } from "./updateTodo.server.ts";

export const routes = manifest(todos, {
  "todos.shell": { component: AppShell },
  "todos.index": {
    loader: loadIndex,
    component: ListsPage,
    layout: "todos.shell",
    title: () => "Lists",
    errorElement: ListError,
    POST: createList,
  },
  "todos.list": {
    loader: loadList,
    component: ListPage,
    layout: "todos.shell",
    title: (p) => p.data.name,
    errorElement: ListError,
    POST: createTodo,
  },
  "todos.edit": {
    loader: loadTodo,
    component: EditTodoPage,
    layout: "todos.shell",
    guard: editable,
    title: (p) => `Edit ${p.data.title}`,
    errorElement: ListError,
    POST: updateTodo,
  },
});
```

## 8. The digest module

`digest` shows background work: a job queue, a schedule, the runners that drive both, a call to another module, and a live loader that streams.

### Manifest

```ts title="modules/digest/module.ts"
import { module } from "@keel/compiler";

export default module({
  id: "digest",
  deps: ["api", "@keel/std-jobs", "@keel/std-schedules"],
  capabilities: ["clock", "random", "storage", "net"],
  public: { exports: [] },
});
```

`deps` names the two stdlib packages it uses and `api` (it calls `api.lists`).

### Schemas and storage helpers

```ts title="modules/digest/Digest.schema.ts"
import { s } from "@keel/schema";

/** Open and done todo counts across the board, and the `ctx.clock` time `digest.recount` counted them. */
export const Digest = s.object({ open: s.int({ min: 0 }), done: s.int({ min: 0 }), at: s.number() });
export type Digest = s.infer<typeof Digest>;
```

```ts title="modules/digest/RecountInput.schema.ts"
import { s } from "@keel/schema";

/** Input of the `digest.recount` job and of `POST /digest/refresh`: nothing, the job reads the whole board. */
export const RecountInput = s.object({});
export type RecountInput = s.infer<typeof RecountInput>;
```

```ts title="modules/digest/LATEST_KEY.ts"
/** The `ctx.storage` key of the newest digest: written by `digest.recount`, read by `digest.show` and `digest.feed`. */
export const LATEST_KEY = "digest.latest";
```

Stored text is read with the schema's `parseJson`: it returns a `Result`, and a text that is no JSON is `err` like any other value the schema refuses. A bare `JSON.parse` is E1457, since it throws on bad text. App code never writes `throw` (E1451) or `try`/`catch` (E1452), inside `unsafe(` or out; a bug is `defect(message)`, which reaches the nearest `Boundary` as a throw does, and `try`/`finally` cleans up.

```ts title="modules/digest/readLatest.ts"
import type { Ctx } from "@keel/ctx";
import { Digest } from "./Digest.schema.ts";
import { LATEST_KEY } from "./LATEST_KEY.ts";

/** Nothing counted yet. */
const NONE: Digest = { open: 0, done: 0, at: 0 };

/**
 * The newest digest in `ctx.storage`. Before the first count, or when the stored text does not parse as a `Digest`,
 * it is zero counts at time 0: a digest is derived data, and the next `digest.recount` writes it again.
 */
export async function readLatest(ctx: Ctx): Promise<Digest> {
  const raw = await ctx.storage.get(LATEST_KEY);
  if (raw === null) return NONE;
  const parsed = Digest.parseJson(raw);
  return parsed.ok ? parsed.value : NONE;
}
```

```ts title="modules/digest/writeLatest.ts"
import type { Ctx } from "@keel/ctx";
import type { Digest } from "./Digest.schema.ts";
import { LATEST_KEY } from "./LATEST_KEY.ts";

/** Store `digest` as the newest digest (`readLatest` reads it back). */
export async function writeLatest(ctx: Ctx, digest: Digest): Promise<void> {
  await ctx.storage.set(LATEST_KEY, JSON.stringify(digest));
}
```

### The contract

```ts title="modules/digest/digest.contract.ts"
import { contract } from "@keel/router/contract";
import { Nothing } from "../api/Nothing.schema.ts";
import { Digest } from "./Digest.schema.ts";
import { RecountInput } from "./RecountInput.schema.ts";

/** The `digest` module's routes: the newest digest, a request to recount, and a live feed of each new digest. */
export const digest = contract("digest", {
  "digest.show": { method: "GET", path: "/digest", output: Digest },
  "digest.refresh": { method: "POST", path: "/digest/refresh", body: RecountInput, output: Nothing },
  "digest.feed": { method: "GET", path: "/digest/feed", output: Digest, events: true },
});
```

`digest.feed` has `events: true`: its loader is live (below). `digest.refresh` answers `Nothing`, the empty object that `api` exports.

### Calling another module

`service({ contract })` calls a module's routes wherever `topology.ts` puts it: in process when `api` is in the same deployable, through the peer's URL when it is not. The code is the same in both topologies. `digest` imports `api`'s contract, which needs `api` in its `deps`, and the client has one method per entry of it:

```ts title="modules/digest/boardApi.ts"
import { service } from "@keel/services";
import { api } from "../api/api.contract.ts";

/**
 * The `api` module's board routes, resolved per call by the topology: in process when `api` is served beside
 * `digest`, else through its peer.
 */
export const boardApi = service({ contract: api });
```

### Job, queue, schedule, runners

A job is an idempotent unit of work with a schema-typed input: `job({ input }, fn(input, ctx, signal))`. It runs at least once and retries with backoff (3 attempts by default), so a rerun must be harmless.

```ts title="modules/digest/recount.server.ts"
import { err, ok } from "@keel/schema";
import { job } from "@keel/std-jobs";
import { RecountInput } from "./RecountInput.schema.ts";
import { boardApi } from "./boardApi.ts";
import { writeLatest } from "./writeLatest.ts";

/**
 * Job `digest.recount`: read the board through the `api` module's `GET /api/lists`, count open and done todos, and
 * store them with the `ctx.clock` time. Idempotent: a rerun counts the board again.
 */
export const recount = job({ input: RecountInput }, async (_input, ctx, signal) => {
  const r = await boardApi.lists({ signal }, ctx);
  if (!r.ok) return err(r.error);
  const todos = r.value.todos;
  const done = todos.filter((t) => t.done).length;
  await writeLatest(ctx, { open: todos.length - done, done, at: ctx.clock.now() });
  return ok(null);
});
```

The queue lives in `modules/<id>/jobs.server.ts` and maps prefixed job names to jobs. Its state is in `ctx.storage`, so pending jobs survive a restart.

```ts title="modules/digest/jobs.server.ts"
import { queue } from "@keel/std-jobs";
import { recount } from "./recount.server.ts";

/** The `digest` module's job queue (std.jobs). */
export const jobs = queue({ "digest.recount": recount });
```

A schedule enqueues a job on a five-field cron in a time zone:

```ts title="modules/digest/schedules.server.ts"
import { schedule } from "@keel/std-schedules";
import { jobs } from "./jobs.server.ts";

/** Recount the board at the start of every hour, UTC. */
export const schedules = schedule(jobs, {
  "digest.hourly": { cron: "0 * * * *", zone: "UTC", job: "digest.recount", input: {} },
});
```

Neither runs by itself. `runners.server.ts` exports the module's runners; the generated server entry imports it and `createApp` starts each runner once after startup, in the deployable that holds the module. Leaving `jobs` out of `runners` is E2504; leaving `schedules` out is E2553.

```ts title="modules/digest/runners.server.ts"
import { jobs } from "./jobs.server.ts";
import { schedules } from "./schedules.server.ts";

/** The `digest` module's background work (k.topology Runners): its job queue and its hourly schedule. */
export const runners = [jobs, schedules];
```

### Loaders, action, views, routes

```ts title="modules/digest/loadDigest.server.ts"
import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { digest } from "./digest.contract.ts";
import { readLatest } from "./readLatest.ts";

/** `GET /digest`: the newest digest. */
export const loadDigest = loader(digest, "digest.show", {}, async (_args, ctx) => ok(await readLatest(ctx)));
```

The loader of an `events: true` entry is live: its `fn` is an async generator, and a plain function there is E1515. A document or JSON GET takes its first yield; a GET with `accept: text/event-stream` gets every yield as a `data:` line until the request ends. Live loaders need a `node` deployable (E1558).

`attempt(fn, expect)` is the one catch. `expect` is given what `fn` threw and returns the `KeelError` it stands for, or `undefined` for a value it does not expect, which goes on as thrown. Here the only expected throw is the wait ending because the request closed; the error it becomes is declared like any other:

```ts title="modules/digest/FeedClosed.schema.ts"
import { s } from "@keel/schema";

/** `digest.feedClosed`: the feed's wait for the next read ended because the request or the deployable closed. */
export const FeedClosed = s.error("digest.feedClosed", s.object({}));
```

```ts title="modules/digest/feedDigest.server.ts"
import { loader } from "@keel/router";
import { attempt, ok } from "@keel/schema";
import { FeedClosed } from "./FeedClosed.schema.ts";
import { digest } from "./digest.contract.ts";
import { readLatest } from "./readLatest.ts";

/** How often the feed reads the stored digest, in `ctx.clock` ms. */
const POLL_MS = 1000;

/**
 * `GET /digest/feed`, a live loader: the newest digest, then each different digest a later count stores, read every
 * second until the request ends or the deployable closes.
 */
export const feedDigest = loader(digest, "digest.feed", {}, async function* ({ signal }, ctx) {
  let last = await readLatest(ctx);
  yield ok(last);
  while (!signal.aborted) {
    const waited = await attempt(
      () => ctx.clock.after(POLL_MS, signal),
      (x) => (signal.aborted && x === signal.reason ? FeedClosed.make({}) : undefined),
    );
    if (!waited.ok) return;
    const now = await readLatest(ctx);
    if (now.at !== last.at || now.open !== last.open || now.done !== last.done) {
      last = now;
      yield ok(now);
    }
  }
});
```

Another module never imports a queue; it calls the owning module's action, which enqueues:

```ts title="modules/digest/refresh.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { digest } from "./digest.contract.ts";
import { jobs } from "./jobs.server.ts";

/** `POST /digest/refresh`: enqueue one `digest.recount`; `GET /digest` shows its count once it has run. */
export const refresh = action(digest, "digest.refresh", {}, async (input, _args, ctx) => {
  const r = await jobs.enqueue(ctx, "digest.recount", input);
  return r.ok ? ok({}) : err(r.error);
});
```

```ts title="modules/digest/routes.ts"
import { manifest } from "@keel/router";
import { digest } from "./digest.contract.ts";
import { feedDigest } from "./feedDigest.server.ts";
import { loadDigest } from "./loadDigest.server.ts";
import { refresh } from "./refresh.server.ts";

/** The `digest` module: board counts that `digest.recount` keeps, on request and every hour. */
export const routes = manifest(digest, {
  "digest.show": { loader: loadDigest },
  "digest.refresh": { action: refresh },
  "digest.feed": { loader: feedDigest },
});
```

With the three modules written, `keel check` should print `ok check` with `0 errors, 0 warnings`; the file count depends on the tests and artifacts present.

## 9. Tests

Tests use `@keel/testing` under a simulated `ctx` (`createCtx({ mode: "sim", seed })`): its clock moves only when a test advances it, its random ids follow the seed, its storage is in memory, and `ctx.net.route(pattern, handler)` answers requests. Tests find elements by id, never by DOM query (E1701), and an id missing from `.keel/ids.json` is E1705.

Five helpers come first. `at.ts` builds the `{ params, url, caller, stores }` argument a loader or action gets, for calling one directly:

```ts title="test/at.ts"
import type { Schema } from "@keel/schema";
import { Board } from "../modules/api/Board.schema.ts";

/** A `Board` from plain fixtures: their ids parse into the branded ones. */
export const boardOf = (raw: unknown): Board => {
  const r = Board.parse(raw);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

/**
 * `{ params, url, caller, stores }` as the router passes them: `value` parsed by the route's `params` schema, `url` the
 * test page's. Loaders and actions off the node deployable have no stores; spread another `caller`/`stores` over it.
 */
export function at<T>(
  params: Schema<T>,
  value: unknown,
): { readonly params: T; readonly url: string; readonly caller: string; readonly stores: undefined } {
  const r = params.parse(value);
  if (!r.ok) throw new Error(`route params do not parse: ${JSON.stringify(value)}`);
  return { params: r.value, url: location.href, caller: "c1", stores: undefined };
}
```

`apiRoutes.ts` joins the `api` deployable modules' route tables with `routeTable`, as the generated server entry does:

```ts title="test/apiRoutes.ts"
import { routeTable } from "@keel/router";
import { routes as sessions } from "@keel/std-sessions/routes";
import { routes as api } from "../modules/api/routes.ts";
import { routes as digest } from "../modules/digest/routes.ts";

/** The `api` deployable's route table as its generated entry merges it: the `api`, `digest` and `sessions` modules' routes. */
export const apiRoutes = routeTable(api, digest, sessions);
```

`simApi.ts` serves the real `api` deployable in process with `createApp`, over one sim `ctx` whose storage is the board's, and gives client code a sim `ctx` whose `/api/*` requests reach it:

```ts title="test/simApi.ts"
import { type SimCtx, createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { Board } from "../modules/api/Board.schema.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";

/** Where the api deployable keeps `api.board` (k.server Server state: `ctx.storage` key `keel.store.<id>`). */
export const BOARD_KEY = "keel.store.api.board";

let server: SimCtx = createCtx({ mode: "sim", seed: 7 });

/** Forget the api's storage: the next `apiApp`/`simApi` serves an empty board (call in `afterEach`). */
export function resetApi(): void {
  server = createCtx({ mode: "sim", seed: 7 });
}

/** The api's sim ctx: its `storage` is the board's persistence, shared by every `apiApp` until `resetApi`. */
export const apiCtx = (): SimCtx => server;

/** Serve the real `api` deployable over the api's sim ctx, as its generated entry does over the real one. */
export const apiApp = () => createApp({ topology, routes: apiRoutes, ctx: server, deployable: "api", secret: SECRET });

/** The api's signing secret in tests: fixed, so one seed mints the same caller ids run after run. */
export const SECRET = "golden-1 tests sign callers with this";

/** Store `state` as the api's board (empty log), for apps built after this call. */
export const seedBoard = (state: Board): Promise<void> =>
  server.storage.set(BOARD_KEY, JSON.stringify({ state, log: [], initial: state }));

/** The api's saved board: what every later request restores (empty when nothing was saved). */
export async function readBoard(): Promise<Board> {
  const raw = await server.storage.get(BOARD_KEY);
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  const state = typeof snap === "object" && snap !== null && "state" in snap ? snap.state : { lists: [], todos: [] };
  const parsed = Board.parse(state);
  if (!parsed.ok) throw new Error(`saved board does not parse: ${parsed.error.message}`);
  return parsed.value;
}

/**
 * A sim ctx whose net sends every `/api/*` request to the real `api` deployable, so client code gets the k.server
 * runtime `Result` bodies; `sent` records `METHOD /path` of each request. It keeps the `keel-caller` cookie the api
 * sets, as a browser would, so undo is scoped to this client. happy-dom drops `cookie` and `set-cookie` passed at
 * construction, but not set on the headers afterwards.
 */
export async function simApi(seed = 1) {
  return client(await apiApp(), seed);
}

/**
 * `count` clients of one `api` app (seeds `seed`, `seed + 1`, ...), each a sim ctx with its own cookie jar and `sent`
 * list, as browsers of different users: a save by one reaches the board stream of every other.
 */
export async function simUsers(count: number, seed = 1) {
  const app = await apiApp();
  return Array.from({ length: count }, (_, i) => client(app, seed + i));
}

function client(app: { fetch(req: Request): Promise<Response> }, seed: number) {
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  let jar = "";
  ctx.net.route(new URL("/api/*", location.href).href, async (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    if (jar !== "") req.headers.set("cookie", jar);
    const res = await app.fetch(req);
    jar = res.headers.get("set-cookie")?.split(";")[0] ?? jar;
    return res;
  });
  return { ctx, sent };
}
```

`simApi` gives one client. `simUsers(count)` gives several clients of one `api` app, each with its own cookie jar and `sent` list, as browsers of different users: a save by one reaches the board stream of every other. The app takes a fixed `secret`, so one seed mints the same caller ids on every run.

`write.ts` builds the `Write` an outbox sends, for a test that plays the other user and posts to the `api` deployable directly:

```ts title="test/write.ts"
import { Write } from "@keel/std-offline";

/** A `Write` (`key`, `base`, owner `""`) as an outbox sends it: `key` parses into the branded id. */
export function write(key: string, base: number): Write {
  const r = Write.parse({ key, base, owner: "" });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
```

`user.ts` names the module a session group runs for each user (`@keel/std-sessions`): the `todos` routes, each user starting at `todos.index`. A group of two users replays against one `api`, and `@keel/std-conflicts` can then look for a race between their writes.

```ts title="test/user.ts"
import { routes } from "../modules/todos/routes.ts";

/** A session group's user module (std.multi): the `todos` routes, each user starting at `todos.index`. */
export { routes };
export const base = { id: "todos.index", params: {}, search: {} };
```

The suites themselves are long and repetitive, so this guide does not reprint them. Copy them from golden-1:

```sh
cp ../../apps/golden-1/test/*.test.ts test/
```

| File | What it shows |
| --- | --- |
| `test/routes.test.ts` | `renderRoute` per page: loaders, filters, `fire` on forms, the guard redirect, `errorElement` |
| `test/components.test.ts` | `render` per component, `properties` for components, the suggestions `resource` states |
| `test/board.test.ts` | schemas, the todos loaders and actions called directly, `todosApi` against the sim api |
| `test/api.test.ts` | `properties` on each `api` transaction (invariants, undo, the rebase and reject policies), the `api` HTTP surface, per-caller undo |
| `test/realtime.test.ts` | two users on one `api`: the board channel, a write made offline and sent on reconnect, a refused edit in the outbox panel with Keep mine and Keep theirs, one seed giving equal logs |
| `test/blankRequired.test.ts` | a blank list name or todo title shows Required and adds nothing, on the forms and at the `api` |
| `test/digest.test.ts` | the job, the schedule on the sim clock, the event-stream feed, a restart with a job left in the queue |
| `test/ssrNode.test.ts` | the `api` deployable's GET routes answered as JSON in plain Node, no DOM global; the `todos` pages are client-only |
| `test/host.test.ts` | the `api` app answers `GET /` and an unmatched page with the client's `index.html` |
| `test/writeSchemas.test.ts` | the three write-body schemas at their limits: what each accepts and refuses |
| `test/boardEvents.test.ts` | the board channel's route, and a subscriber's `reset` then `saved` after another caller's write |
| `test/formAnswer.test.ts` | a form action's answer for a sent, queued, conflicting and failed outbox write |
| `test/editor.test.ts` | the edit page on `editorChart`: a sent, queued, refused, re-sent and given-up edit, `editorOutcome`, `editorFollow`, the status line |
| `test/editorChart.test.ts` | `explore` over every state of `editorChart` and `properties` on each event's transaction |
| `test/idPart.test.ts` | `idPart` keeps minted and fixture ids and encodes any other |
| `test/removal.test.ts` | the removal workflow through the `api` deployable on the sim clock: the 10-minute wait, an undo, three failed purges compensated, a restart while a purge runs |
| `test/removalParts.test.ts` | the removal's schemas, `api.purgeList`, `purge`, `restore`, the `removal` store, the `jobs` queue and the two actions, called directly |
| `test/removalChart.explore.test.ts` | `explore` over every state of `removalChart`, no unreached or dead state |
| `test/board.explore.test.ts` | the board's transactions explored three writes deep from a small board, each state keeping the invariant |
| `test/board.prove.test.ts` | Z3 proves (`prove`) that each board transaction keeps the invariant from every state it allows |
| `test/outbox.sim.test.ts` | 100 generated schedules of delays, drops, lost and unavailable requests and offline windows through `boardOutbox`: a write that left the outbox was applied once |
| `test/monitor.test.ts` | the `api` runners: the `monitor` tallies each committed `api.*` write by name into `sessions.tally` |
| `test/serverSqlite.test.ts` | the built `server.mjs` on `storage: "sqlite"`: it keeps the board across a restart, and exits 1 with E2153 on a file it cannot open |

The shape of a route test, trimmed from the first test in `test/routes.test.ts`:

```ts
await seedBoard(boardOf(seeded));
const { ctx, sent } = await simApi();
const r = await renderRoute("todos.index", { routes, ctx });
expect(r.find("todos.openCount.l1").text).toBe("1 open");
await r.fire(controlId(r.a11y(), "List name"), { type: "input", value: "Work" });
await r.fire("todos.addList", { type: "click" });
expect((await readBoard()).lists.map((l) => l.name)).toEqual(["Home", "Work"]);
r.dispose();
```

`renderRoute` runs guards and loaders and resolves when the page is ready; `fire` resolves once effects, resources and actions settle; `find` returns `{ id, role, name, text, state }`. After the first render and after every `fire`, the harness compares each element's role and name with `.keel/a11y.json` and runs an axe-compatible subset of rules. `properties(transaction)` checks that generated payloads keep every invariant, that equal inputs give equal outputs, and that `undo` restores the input.

## 10. Run it

### Check and test

```sh
pnpm test        # or: keel test
keel build
keel check
```

A clean run prints `ok 166 tests, 0 failed, 0 skipped (…)` (`keel test` prints `ok test 166 tests, 0 failed, 0 skipped`), then `ok build 101 files, 14 artifacts, 0 errors`, then `ok check 139 files, 0 errors, 0 warnings`; the check counts the `.keel/` artifacts too. `pnpm check` adds `tsc` and Biome in front of `keel check --quiet`. Output follows `docs/OUTPUT.md`: one line per diagnostic, `fix:` and `see:` lines under it, a summary line last, `--format=pretty` for people. `keel explain <code>` prints what a code means and its fix pattern.

### Develop

```sh
keel dev
```

One Vite server at `http://localhost:5173` serves the `web` client and answers every `api` and `digest` path from the `api` deployable's dev server on the same origin, with its runners. A source edit reloads the dev servers on the next request and reloads the page in the browser; there is no hot module replacement, so component state does not survive an edit. `keel dev` takes no flags, so it has no port option.

The dev servers keep `ctx.storage` in `.keel-dev/`, so a board survives a restart of `keel dev`. `.keel-dev/` is git-ignored by the repo root.

### Build and run the server

`keel build` compiles and checks every source, writes `.keel/` and `.keel/surface.json`, runs Vite once for the `web` client into `dist/web/` and once per `node` deployable into `dist/<name>/`, and writes `deploy/`. It prints one summary line on success.

`dist/api/server.mjs` is the generated production entry. It installs a server DOM, imports `topology.ts`, each of its modules' `routes.ts` and `runners.server.ts`, and serves them. It reads its settings from the environment and exits 1 with one E1560 line naming the key when one is missing or invalid:

| Variable | Meaning |
| --- | --- |
| `KEEL_SECRET` | 32 or more random bytes. It signs the caller cookie; give every deployable of the app the same value. |
| `PORT` | default 8080 |
| `KEEL_ORIGIN` | the public origin, such as `https://todo.example`. Loaders see it in `url`, the same-site check uses it, and on https the caller cookie becomes `Secure` (`__Host-keel-caller`). |
| `KEEL_DATABASE_URL` | the SQLite file as a `file:` URL, default `file:/data/keel.sqlite`; `pnpm api` sets `file://$PWD/.api.sqlite`. A file that cannot be opened prints E2153 and exits 1 |
| `KEEL_PEER_<NAME>` | the URL of each other `node` deployable; none in golden-1's topology |

```sh
export KEEL_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')
KEEL_ORIGIN=https://todo.example pnpm api
```

Docker Desktop listens on 8080; if it runs, set `PORT` to another port and use it in the requests below. `ctx.storage`, which holds the board, the digest and the job queue, is the SQLite file `KEEL_DATABASE_URL` names (`.api.sqlite`): the only state that survives a restart. Each request prints one log line such as `GET /api/lists api.lists 200 2ms`. Without `KEEL_ORIGIN` it also prints W1557 at startup: the cookie is `Secure` only for https requests. With `KEEL_ORIGIN` set, `server.mjs` prints nothing at startup. On SIGTERM or SIGINT it stops listening, lets runners settle and exits 0. An uncaught exception or unhandled rejection prints one E1577 line naming the route whose work threw (never the error's text); the server then stops listening, lets requests in flight finish for at most 10 seconds, closes its storage and exits 1. Run it under a supervisor that restarts it: a container restart policy, systemd or the platform's own.

Try it with curl. A write needs `x-keel: 1` with `accept: application/json` to pass the same-site check, and a `write` with a `key` of your choosing, the `base` you read (the `head` of `GET /api/lists`) and an `owner`, here empty:

```sh
curl -s -H 'accept: application/json' localhost:8080/api/lists
curl -s -X POST -H 'accept: application/json' -H 'content-type: application/json' -H 'x-keel: 1' \
  -d '{"name":"Home","write":{"key":"w1","base":0,"owner":""}}' localhost:8080/api/lists
curl -s localhost:8080/api/lists          # JSON too: an API route has no document view
```

`server.mjs` serves the `api` deployable's routes, its own `dist/api/assets/` and, because `topology.ts` gives `web` the `servedBy: "api"`, the `web` client: `GET /` returns `index.html`, and so does any other page request that no route matches. A request to an unmatched API or event-stream path stays 404. `dist/web/` holds the same client as static files for a static host; `docs/guide/deploy-client.md` shows the three ways to ship it.

In a second terminal, `curl -s localhost:8080/ | head -c 15` prints `<!doctype html>`, and the browser at `http://localhost:8080/` shows the app on the same origin as its API. Open it in two browsers: a todo added in one appears in the other, and the header of each reads Live. The board's server state lives in one process, so every user of a board must reach the same `api` server.

### Deploy files

`deploy/api/Dockerfile` builds an image from `dist/api/` alone on `node:22-slim`, runs as `node`, keeps the SQLite file on the `/data` volume and exposes 8080. `deploy/compose.yaml` runs one service per `node` deployable and takes `KEEL_SECRET`, `KEEL_ORIGIN` and `KEEL_DATABASE_URL` from your environment:

```sh
KEEL_SECRET=… KEEL_ORIGIN=… KEEL_DATABASE_URL=file:/data/keel.sqlite docker compose -f deploy/compose.yaml up
```

Both are regenerated by every `keel build`; a hand edit is E1005.

### Split digest into its own server

Edit `topology.ts` alone:

```ts
api: { modules: ["api"], adapter: "node" },
digest: { modules: ["digest"], adapter: "node" },
```

`keel build` then writes `dist/digest/server.mjs` and `deploy/digest/Dockerfile`, and `compose.yaml` gives each service the other's URL as `KEEL_PEER_API` and `KEEL_PEER_DIGEST`. `digest`'s `service({ contract: api })` client goes to its peer over HTTP, and `api` forwards `/digest` requests to `digest`, using the route table in `dist/api/routes.json`.

## 11. Diagnostics you will meet first

Every line is `CODE path:line:col message`. Errors start with `E`, warnings with `W`; only errors fail. These are the ones a hand author hits early, with the fix:

| Code | You did | Fix |
| --- | --- | --- |
| E1005 | edited a source after `.keel/` was written, then ran `keel check`; or edited a generated file | run `keel build`, then `keel check` again; never edit `.keel/` or `deploy/` |
| E1752 | two exports in one file, or a file name that differs from its export | one export per file, named after it |
| E1104 | declared an `s.*` schema outside `*.schema.ts` | move it to `<Name>.schema.ts` |
| E1551 | declared `loader` or `action` outside `*.server.ts` | move it to `<name>.server.ts` |
| E1004 | imported a `*.server.ts` file from a component | import it only from `routes.ts` |
| E1155 | a route id, store id, transaction name or error code without the module prefix | prefix it: `todos.list` |
| E1156 | used a `ctx` capability the manifest does not list | add it to `capabilities` (the fix line shows the edit) |
| E1151, E1152 | imported a non-public export, or anything (a contract included) from a module not in `deps` | add it to the other module's `public.exports`, or the module to `deps` |
| E1805, E1803 | `<div>` or `style` in a component | `<Box>` and style props |
| E1802 | a `Heading` without `level`, an `Image` without `alt`, a control without `label` | add the prop |
| E1501 | a string in `Link to` or `Form action` | `todos.href(id, params)` |
| E1401 | destructured props | `props.x` |
| E1403 | `{cond && <X />}`, a ternary of elements, or `.map()` to elements | `<If>`, `<For>`, `<Match>` |
| E1808 | eager children on a base element | `children: () => …` |
| E1258 | gave a component an element made before the call, as `children` or another prop | make it inside a thunk: `icon: () => <Icon />` |
| E1301 | ran a transaction a component's `uses` does not list | add it to `uses` |
| E1302 | read `ctx` or a global in a transaction | pass the value in the payload |
| E1451, E1452 | `throw`, or `try`/`catch` | `return err(…)` or `defect(…)`, `attempt(fn, expect)` |
| E1601 | `Date`, `Math.random`, `fetch`, `localStorage` in app code | `ctx.clock`, `ctx.random`, an endpoint, `ctx.storage` |
| E1515 | a binding that misses an entry of the contract, names one it lacks, or holds a handler written for another id | bind every entry once, under the id its handler names |
| E1514 | a contract file importing a component, handler or `routes.ts` | import `*.schema.ts` files and packages only |
| E1407 | a component's `ctx` parameter optional, defaulted or followed by another | `(props, ctx: Ctx)` |
| E1751 | a TypeScript error with no Keel code, such as a raw style value | read the `TS` code in the message |
| E1560 | started `server.mjs` without `KEEL_SECRET`, or with a short one | set it to 32+ random bytes |

A style prop with a raw value (`gap="12px"`) shows up as E1751 with the TypeScript message `Type '"12px"' is not assignable to type 'Token<…>'`.

## 12. Where to read more

Retrieve a spec section with `pnpm spec <id>` from the repo root; `pnpm spec --for <code>` finds the section that owns a code. The files are `spec/kernel/<id>.md` and `spec/std/<id>.md`.

| Topic | Read |
| --- | --- |
| terms | `docs/GLOSSARY.md` |
| why Keel is shaped this way | `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md` |
| output format and codes | `docs/OUTPUT.md` |
| testing rungs and thresholds | `docs/TESTING.md` |
| brand, tokens and copy | `docs/BRAND.md`, `docs/VOICE.md` |
| deployables, builds, runners, peers, `keel dev` | `k.topology`; `docs/adr/0073-topology-placement-generated-entry.md`, `docs/adr/0074-module-calls-peers-forwarding.md`, `docs/adr/0075-runners-and-close.md`, `docs/adr/0078-generated-deploy-files.md` |
| loaders, actions, server state, status codes, caller | `k.server`; `docs/adr/0033-per-request-server-stores.md` |
| generated entries, mount and resume | `k.runtime`, `k.compiler`; `docs/adr/0006-islands-ssr.md`, `docs/adr/0035-node-resume-entry-topology-owner.md` |
| manifests and module rules | `k.module` |
| contracts, bindings, handlers, `href` | `k.contract`, `k.routes`, `k.api`; `docs/rfc/0157-module-contract.md` |
| layouts, guards, `Form` | `k.router`; `docs/adr/0004-route-manifest.md` |
| schemas, `Result`, errors | `k.schema`, `k.errors` |
| stores, transactions, undo, invariants | `k.store`, `k.reactive`; `docs/adr/0003-transactions.md` |
| components, JSX rules, ids | `k.component`, `k.ui` |
| forms | `k.forms` |
| services and `ApiError` | `k.services` |
| `ctx` and capabilities | `k.ctx`; `docs/adr/0007-ctx-capabilities.md` |
| CLI commands and flags | `k.cli`, `k.check` |
| test harness | `k.testing` |
| HTTP surface compatibility | `k.compat`; `docs/adr/0077-surface-compatibility.md` |
| statecharts and workflows | `std.statecharts`, `std.workflows` |
| production tallies, session recording | `std.sessions` |
| SQLite and Postgres storage | `std.db`, `k.deploy` |
| jobs and schedules | `std.jobs`, `std.schedules`; `docs/adr/0079-jobs-and-schedules.md` |
| live loaders | `k.server`; `docs/adr/0076-live-loaders-event-streams.md` |
| store heads, `concurrent` policies, writes | `k.sync`; `docs/adr/0080-store-heads-concurrent-writes.md` |
| channels, `live`, the outbox | `std.channels`, `std.live`, `std.offline`; `docs/adr/0081-push-invalidation-live-loaders.md`, `docs/adr/0082-live-views-are-stores.md`, `docs/adr/0084-offline-outbox.md` |
| races between users, session groups | `std.conflicts`, `std.multi`; `docs/adr/0085-races-session-groups.md` |

The Keel skills in `.claude/skills/keel*/SKILL.md` are terse API cards for the same material.

## What this guide leaves out

- The test suites, copied from `apps/golden-1/test/` in section 9 rather than reprinted.
- `README.md`; golden-1's own is at `apps/golden-1/README.md`.
- The native shells: `keel build --target tauri` and `--target capacitor` build `web` for desktop and mobile from the `shells` of `topology.ts` (`apps/golden-1/README.md`, Native shells).
- The shell session helpers in `test/` (`shellSession.ts`, `shellOutboxSession.ts`) and the production tally check (`node tooling/smoke/monitor.mjs`).
- Inspecting a running app (`keel inspect`, `/__keel/inspect`), recorded sessions, and `keel check --base` against a deployed `surface.json`.
- Shipping the `web` client to a static host or across origins; `docs/guide/deploy-client.md` covers it.

subject: apps/golden-1/
verified: b8e3fb6c7219acfdc4bba61aebbeb0abb8a6a308
