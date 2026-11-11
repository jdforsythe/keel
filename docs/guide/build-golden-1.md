# Build golden-1 by hand

This guide takes you from an empty folder to a working copy of `apps/golden-1`, the todo app, typing every file yourself. No scaffold command, no agent. Each step says what to create, shows the file, and explains the Keel concept behind it.

Every code block is the real file from `apps/golden-1`, and its title is the path to create. When this guide and the app disagree, the app is right; tell us.

You need TypeScript, Vite and pnpm, and the terms in `docs/GLOSSARY.md`. Nothing else about Keel is assumed.

## What you build

golden-1 is a todo board: named lists, todos with a title, a priority and a done flag, an edit page, an undo button, a suggestions panel, and a digest that counts open and done todos every hour. It is three modules in two deployables:

| Module | Deployable | Adapter | Owns |
| --- | --- | --- | --- |
| `todos` | `web` | `client` | the pages; it holds a copy of the board and reads and writes it over HTTP |
| `api` | `api` | `node` | the board itself (`api.board`), its transactions and undo log, the suggestions |
| `digest` | `api` | `node` | a job that counts the board, an hourly schedule, `GET /digest` and a live feed |

Build order follows the dependencies: project files, then `todos` (the other two import its schemas), then `api`, then `digest`, then tests. You can run `keel check` once the three modules exist.

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
  index.html          the page shell the client deployable mounts into
  tokens.ts           design tokens; the CSS is generated from them
  topology.ts         which modules form which deployable
  .gitignore
  public/keel-mark.svg
  modules/
    todos/            pages, forms, the client's copy of the board
    api/              the board, its transactions, the HTTP API
    digest/           job, schedule, runners, live loader
  test/               vitest suites and their helpers
  # generated, never edited by hand:
  .keel/              compiler artifacts (JSON, read-only)
  dist/               the web client build
  dist/api/           the api deployable: server.mjs and its client build
  deploy/             Dockerfile and compose.yaml for node deployables
  .keel-dev/          storage for keel dev
  .api.storage*       storage for the built api server
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
    "build": "keel build",
    "dev": "keel dev",
    "api": "node --experimental-webstorage --localstorage-file=.api.storage --disable-warning=ExperimentalWarning dist/api/server.mjs"
  },
  "dependencies": {
    "@keel/compiler": "workspace:*",
    "@keel/ctx": "workspace:*",
    "@keel/forms": "workspace:*",
    "@keel/reactive": "workspace:*",
    "@keel/router": "workspace:*",
    "@keel/runtime-dom": "workspace:*",
    "@keel/schema": "workspace:*",
    "@keel/server": "workspace:*",
    "@keel/services": "workspace:*",
    "@keel/std-jobs": "workspace:*",
    "@keel/std-schedules": "workspace:*",
    "@keel/store": "workspace:*",
    "@keel/testing": "workspace:*",
    "@keel/ui": "workspace:*"
  },
  "devDependencies": {
    "@keel/cli": "workspace:*",
    "@types/node": "^22",
    "@keel/tooling": "workspace:*",
    "vite": "^8.3.6"
  }
}
```

The scripts:

- `check` runs three tools in turn: `tsc --noEmit`, Biome (configured by the repo root's `biome.json`) on `modules` and `test`, and `keel check --quiet`, which prints one summary line when clean.
- `test` runs vitest with `vitest.config.ts`. `keel test` runs the same suites through the CLI with compact output.
- `build` is `keel build`; `dev` is `keel dev`. Both hand bundling and serving to Vite, because `vite.config.ts` exists.
- `api` starts the built `api` deployable. Node's Web Storage flags make `localStorage` exist and persist to `.api.storage`; `ctx.storage` is that `localStorage`. It needs `KEEL_SECRET` set (section 10).

The dependencies are the Keel packages the app's code imports. `@keel/testing` is listed with them although only tests use it. `@keel/tooling` is this repo's internal tooling package; the app uses it for `KeelReporter` in `vitest.config.ts`. vitest, happy-dom, TypeScript and Biome are not declared here: they resolve from the repo root's devDependencies.

If you build under `apps/`, change `"name"` now and run `pnpm install` at the root.

### tsconfig.json

```json title="tsconfig.json"
{
  "extends": "@keel/compiler/tsconfig.strict.json",
  "compilerOptions": {
    "jsxImportSource": "@keel/runtime-dom"
  },
  "include": ["modules", "test", "tokens.ts", "routes.ts", "topology.ts"]
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
import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
    reporters: [new KeelReporter()],
  },
});
```

Tests run through the same plugin, so components compile exactly as they do in the app, and a test run refreshes `.keel/`. `happy-dom` gives components a DOM. The `include` globs cover `test/`, a module's own `modules/<id>/test/`, and recorded sessions. `KeelReporter` prints results in the compact format from `docs/OUTPUT.md`.

### index.html

```html title="index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>golden-1</title>
    <link rel="icon" href="/keel-mark.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/node_modules/@keel/ui/fonts/fonts.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/@keel/entry.ts"></script>
  </body>
</html>
```

`#app` is where the client deployable mounts; the generated entry throws `keel: index.html has no #app element` without it. `/@keel/entry.ts` is not a file you write: the plugin answers that URL (section 4). The stylesheet is the brand fonts shipped inside `@keel/ui`, linked through `node_modules`.

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

Vite copies `public/` into the build. The app shell shows this mark, and `index.html` uses it as the icon. You can copy it from `docs/brand/keel-mark.svg` instead of typing it.

### tokens.ts

```ts title="tokens.ts"
import { brandTokens } from "@keel/ui/brand";

/** The Keel brand (docs/BRAND.md): palette, Source Serif 4 and JetBrains Mono, radius 0, hairline dividers. */
export const tokens = brandTokens;
```

Components never write CSS. They take style props whose values are token names (`bg="card"`, `px="3"`), and the plugin emits one atomic class per prop, token, breakpoint and state it finds in your code. `tokens.ts` must export `tokens`; the plugin evaluates it in Node and validates it with `TokenSchema` (E1807 when it fails). `brandTokens` is the Keel brand from `docs/BRAND.md`. For your own palette, `defineTokens` from `@keel/ui` takes the groups `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border`, `breakpoint` and `motion`.

### topology.ts

```ts title="topology.ts"
import { topology } from "@keel/server";

export default topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api", "digest"], adapter: "node" },
});
```

A deployable is a set of modules that builds to one artifact. The adapter decides how it runs:

- `client`: a browser app. Loaders and actions run in the browser with a real `ctx`; the entry mounts the router into `#app`. `keel build` writes it to `dist/`.
- `node`: a server (Hono). It renders pages to HTML, answers JSON and event streams, runs runners, and ships a small resume entry for pages that have interactive parts. `keel build` writes `dist/<name>/server.mjs`.
- `static`: prerendered HTML. golden-1 does not use it.

Each module belongs to exactly one deployable, and no other file names a deployable. Splitting `digest` into its own server is a change to this file alone (section 10). The plugin reads `topology.ts` statically, so keep it a literal.

### .gitignore

```text title=".gitignore"
dist
.turbo
node_modules
.api.storage
.api.storage*
```

`.keel-dev/` (storage for `keel dev`) is ignored by the repo root's `.gitignore`. golden-1 commits `.keel/` and `deploy/`.

## 4. What Keel generates, and how a page reaches the screen

You write sources; the plugin and `keel build` derive everything below. Nothing here is edited by hand.

| What | Written by | From | Notes |
| --- | --- | --- | --- |
| `/@keel/entry.ts`, mount entry | Vite plugin, in memory | `topology.ts`, each module's `routes.ts` | served for a `client` deployable; `keel build` bundles it into `dist/assets/index-*.js`, which `dist/index.html` scripts |
| `/@keel/entry.ts`, resume entry | Vite plugin, in memory | `topology.ts`, `routes.ts` | served for a `node` deployable's pages; built to `dist/<name>/assets/entry-*.js` |
| `/@keel/islands.ts` | Vite plugin, in memory | each `routes.ts` | route id to component, for the resume entry |
| `virtual:keel.css` (served as `/__keel.css`) | Vite plugin | `tokens.ts` and `.keel/styles.json` | one atomic rule per style usage |
| `.keel/ids.json`, `a11y.json`, `deps.json`, `styles.json` | Vite plugin (dev, test, build) and `keel build` | your components | element ids with file and line; the role and name each element must have; the reactive graph; style usages |
| `.keel/routes.json` | Vite plugin | the served deployable's `routes.ts`, evaluated in Node | path, params, search, actions, layout, guard per route; for golden-1, the `todos` routes |
| `.keel/std.json` | Vite plugin and `keel build` | `std` entries in `module.ts` | stdlib config per package and module; `{}` in golden-1 |
| `.keel/surface.json` | `keel build` only | every module's routes and `service({ module })` calls | the HTTP surface; `keel check --base` compares it against a deployed one |
| `dist/` | `keel build` (Vite) | `index.html`, the mount entry | the `web` client: static files |
| `dist/api/` | `keel build` (Vite, `KEEL_DEPLOYABLE=api`) | the `api` and `digest` modules | `server.mjs` with every dependency bundled, the resume entry in `assets/`, `routes.json` (all modules' routes, for forwarding), `std.json` |
| `deploy/api/Dockerfile`, `deploy/compose.yaml` | `keel build` | `topology.ts` | one Dockerfile per `node` deployable, one compose service each |

Every `.keel/` file is `{ data, hash }` JSON with sorted keys, written read-only (mode 0444). `keel check` recomputes them from your sources, and a file that differs is E1005. A project with no `.keel/` yet checks clean; once a build or test run has written it, editing a source makes `keel check` report E1005 for each stale artifact before your real error. Run `keel build` before `keel check` after edits.

### From index.html to a rendered route

Follow `http://localhost:5173/lists/l1` in `keel dev`:

1. Vite serves `index.html`. Its script asks for `/@keel/entry.ts`.
2. The plugin picks the deployable to serve: the one `KEEL_DEPLOYABLE` names, else the first `client` deployable by name. Here that is `web`, whose modules are `["todos"]`.
3. It generates the mount entry. For golden-1 it is, minus a dev-only block that reports live state to `/__keel/inspect`:

   ```ts
   import "virtual:keel.css";
   import { createCtx } from "@keel/ctx";
   import { browserHistory, createRouter } from "@keel/router";
   import { mount } from "@keel/runtime-dom";
   import { routes as __keelRoutes0 } from "/modules/todos/routes.ts";
   const ctx = createCtx({ mode: "real" });
   const router = createRouter(__keelRoutes0, { ctx, history: browserHistory() });
   const el = document.getElementById("app");
   if (el === null) throw new Error("keel: index.html has no #app element");
   mount(router.App, el, { ctx });
   ```

   With several modules in the deployable it merges their manifests into one table. When a module's `module.ts` sets `std` config for a client-readable stdlib package, the entry also binds it to `ctx`.
4. `virtual:keel.css` loads: the atomic classes for every style prop your components use, built from `tokens.ts`.
5. The router matches `/lists/l1` against the manifest in `modules/todos/routes.ts`: route `todos.list`, path `/lists/:listId`. It parses the params with `ListParams` (a failure is a 404 rendered by the route's `errorElement`) and the search with `ListSearch` (failing keys are dropped).
6. It runs the chain's guards, outermost first (none here), then its loaders. `loadList` runs in the browser with the real `ctx`. It calls `GET /api/lists` through a typed client.
7. `keel dev` answers `/api/lists` from the `api` deployable's dev server on the same origin. The `api.lists` loader restores `api.board` from storage and answers `{ id, results: { "api.lists": { ok: true, value } } }`.
8. `loadList` stores the board in the client store `todos.view` (transaction `todos.hydrate`) and returns the list.
9. The router renders the chain, outermost first: the layout `todos.shell` (`AppShell`), with `ListPage` as its children, given `{ params, search, data }`. `ListPage` reads the todos from `todos.view`.

A `node` deployable's page goes the other way. A request reaches `server.mjs`; `createApp` matches the route, runs guards and loaders on the server, and streams HTML with the request's store state in `<script type="application/json" id="k-state">`. If the page has an island (a component with an event handler, an effect, or a read of client-writable state), the HTML scripts the resume entry, which restores state from `#k-state` and attaches handlers to the server's DOM using `/@keel/islands.ts`, without rendering again. golden-1's `api` pages are static lists, so they ship no script. A request with `accept: application/json` gets the loader `Result` instead of HTML.

## 5. Modules and file conventions

All app code lives in `modules/<id>/`. A module is a vertical slice with a manifest, `module.ts`:

- `id`: lowerCamel, equal to the folder name. It prefixes every route id, store id, transaction name and error code in the module (`todos.list`, `todos.view`, `todos.hydrate`). An unprefixed one is E1155.
- `deps`: app modules and stdlib packages this module may import from, link to or call. Anything else is E1152.
- `capabilities`: the `ctx` capabilities its code uses (`clock`, `random`, `storage`, `net`). Using one not listed is E1156.
- `public.exports`: the files other modules may import (a file's name is its export). Importing anything else is E1151.
- `public.routes`: the routes other modules may link to or call. Calling another is E1157.
- `std` (optional): config for stdlib packages in `deps`.

`routes.ts` exports `routes`, the module's route manifest. The plugin evaluates it in Node, so it must not touch the browser at import time.

Keel decides what a file is from its name, and holds you to one export per file whose name equals the file name (E1752):

| File | Holds | Rule |
| --- | --- | --- |
| `Name.schema.ts` | one schema `Name` (and its type, same name) | every `s.*` schema lives in a `*.schema.ts` file (E1104) |
| `name.server.ts` | one `loader` or `action` | loaders and actions live only here (E1551); client-reachable code may not import them except through `routes.ts` (E1004) |
| `name.guard.ts` | one `guard` | a convention from the Keel skills; no rule enforces the suffix |
| `name.service.ts` | one `endpoints` declaration | golden-1's convention; k.services names this file `<Name>Api.schema.ts` |
| `Name.tsx` | one component, default export, plus optional `Props` and `uses` | PascalCase; only a component file may export `Props` |
| `Name.ts` (PascalCase) | a component without JSX, written as function calls | its default export takes props; golden-1's `api` and `digest` document views |
| `name.ts` | one function, store or value | `module.ts` and `routes.ts` have fixed names |
| `jobs.server.ts`, `schedules.server.ts`, `runners.server.ts` | the stdlib queue, the schedules, the runners | fixed names; E2501, E2552, E2504 |

One export per file means every name you see in an import is also a file you can open, and the checker can point at the exact file a rule is about. `.server.ts` marks loader and action code, which the compiler keeps out of component imports. In a `client` deployable that code still runs in the browser: the suffix marks the role, not the machine.

Imports across modules name the exporting file directly (`../todos/Board.schema.ts`); there are no barrel files.

## 6. The todos module

`todos` is the `web` deployable: every page, every form, and a client-side copy of the board. It never owns data; it reads `GET /api/lists` and writes through `POST` routes of the `api` deployable.

### Manifest

```ts title="modules/todos/module.ts"
import { module } from "@keel/compiler";

export default module({
  id: "todos",
  deps: [],
  capabilities: ["net", "storage"],
  public: { exports: ["Suggestion", "Board", "BoardView", "ListDraft", "TodoDraft", "ListParams"], routes: [] },
});
```

`net` is for the HTTP calls; `storage` is for the edit guard. `public.exports` lists the schemas `api` and `digest` import. No route is public, because nothing outside `todos` links to its pages.

### Schemas

A schema is the one declaration of a data shape. From it Keel derives the TypeScript type (`s.infer`), a validator (`parse`, which returns a `Result` and never throws), a JSON encoder, generators for property tests, and the JSON Schema in `.keel/` artifacts. The pattern is always a `const` and a `type` with the same name, in a file of that name.

`s.id("Todo")` is a string branded `Todo`; a `TodoList` id does not type-check where a `Todo` id is expected. Only `ctx.random.id("Todo")` mints one.

```ts title="modules/todos/Todo.schema.ts"
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

```ts title="modules/todos/TodoList.schema.ts"
import { s } from "@keel/schema";

/** A named list of todos. */
export const TodoList = s.object({
  id: s.id("TodoList"),
  name: s.string({ min: 1, max: 60 }),
});
export type TodoList = s.infer<typeof TodoList>;
```

`Board` is the state of the `api.board` store. It lives in `todos` because `api` and the tests both need it, and `api` may import from `todos` (its `deps`) while `todos` may not import from `api`.

```ts title="modules/todos/Board.schema.ts"
import { s } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/** State of the `todos.board` store. */
export const Board = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
});
export type Board = s.infer<typeof Board>;
```

`BoardView` is the board as `GET /api/lists` serves it, plus `canUndo`. It is also the state of the client store.

```ts title="modules/todos/BoardView.schema.ts"
import { s } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { TodoList } from "./TodoList.schema.ts";

/** The board as `GET /api/lists` serves it (`api.lists` loader data) and the `todos.view` store holds it. */
export const BoardView = s.object({
  lists: s.array(TodoList),
  todos: s.array(Todo),
  canUndo: s.boolean(),
});
export type BoardView = s.infer<typeof BoardView>;
```

Form inputs. A form takes its schema, and the action that receives it takes the same schema as `input`:

```ts title="modules/todos/ListDraft.schema.ts"
import { s } from "@keel/schema";

/** Form input for a new list. */
export const ListDraft = s.object({
  name: s.string({ min: 1, max: 60 }),
});
export type ListDraft = s.infer<typeof ListDraft>;
```

```ts title="modules/todos/TodoDraft.schema.ts"
import { s } from "@keel/schema";

/** Form input for a new or edited todo. */
export const TodoDraft = s.object({
  title: s.string({ min: 1, max: 120 }),
  priority: s.enum(["low", "normal", "high"]),
});
export type TodoDraft = s.infer<typeof TodoDraft>;
```

Route params and search. Loaders, actions and the route share one schema value; E1507 reports a loader whose `params` is not its route's own. Every search field must be optional (E1504).

```ts title="modules/todos/ListParams.schema.ts"
import { s } from "@keel/schema";

/** Route params naming one list (`todos.list`, `api.listTodos`); loaders and actions type `params` as its Infer. */
export const ListParams = s.object({ listId: s.id("TodoList") });
export type ListParams = s.infer<typeof ListParams>;
```

```ts title="modules/todos/TodoParams.schema.ts"
import { s } from "@keel/schema";

/** Route params naming one todo in its list (`todos.edit`); loaders and actions type `params` as its Infer. */
export const TodoParams = s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") });
export type TodoParams = s.infer<typeof TodoParams>;
```

```ts title="modules/todos/ListSearch.schema.ts"
import { s } from "@keel/schema";

/** Search of `todos.list`: which todos the page shows. */
export const ListSearch = s.object({ filter: s.enum(["all", "active", "done"]).optional() });
export type ListSearch = s.infer<typeof ListSearch>;
```

```ts title="modules/todos/Suggestion.schema.ts"
import { s } from "@keel/schema";

/** A suggested todo title served by `GET /api/suggestions`. */
export const Suggestion = s.object({
  title: s.string({ min: 1, max: 120 }),
});
export type Suggestion = s.infer<typeof Suggestion>;
```

The reply schemas describe what a `node` deployable sends over the wire, so the typed client can decode it. A GET answers `{ id, results: { [routeId]: Result } }`, one `Result` per loader in the route's chain. An action answers its bare `Result`. A failed action input answers 422 with `keel.fields`.

```ts title="modules/todos/BoardReply.schema.ts"
import { s } from "@keel/schema";
import { BoardView } from "./BoardView.schema.ts";

/** The `api` deployable's runtime answer to `GET /api/lists` (k.server): the `api.lists` loader `Result`. */
export const BoardReply = s.object({
  id: s.literal("api.lists"),
  results: s.object({
    "api.lists": s.object({ ok: s.literal(true), value: BoardView }),
  }),
});
export type BoardReply = s.infer<typeof BoardReply>;
```

```ts title="modules/todos/SuggestionsReply.schema.ts"
import { s } from "@keel/schema";
import { Suggestion } from "./Suggestion.schema.ts";

/** The `api` deployable's runtime answer to `GET /api/suggestions` (k.server): the `api.suggestions` loader `Result`. */
export const SuggestionsReply = s.object({
  id: s.literal("api.suggestions"),
  results: s.object({
    "api.suggestions": s.object({ ok: s.literal(true), value: s.array(Suggestion) }),
  }),
});
export type SuggestionsReply = s.infer<typeof SuggestionsReply>;
```

```ts title="modules/todos/ActionReply.schema.ts"
import { s } from "@keel/schema";

/** The `api` deployable's runtime answer to an action that succeeded (k.server): `ok(null)`, or `ok(href)`. */
export const ActionReply = s.object({
  ok: s.literal(true),
  value: s.string().nullable(),
});
export type ActionReply = s.infer<typeof ActionReply>;
```

```ts title="modules/todos/FieldsReply.schema.ts"
import { s } from "@keel/schema";

/** The `api` deployable's 422 answer to an action (k.server): `err` `keel.fields`, field path to message. */
export const FieldsReply = s.object({
  ok: s.literal(false),
  error: s.object({ code: s.literal("keel.fields"), message: s.string(), data: s.record(s.string()) }),
});
export type FieldsReply = s.infer<typeof FieldsReply>;
```

### The client store and its transaction

A store holds state of one schema. The only way to change it is a transaction: a named, typed, pure function `(state, payload) => state` that Keel validates, logs and can undo. You run one with `tx(transaction, payload)`, which returns a `Result`.

```ts title="modules/todos/view.ts"
import { store } from "@keel/store";
import { BoardView } from "./BoardView.schema.ts";

/** The board as the `api` deployable last served it. Changes only through `todos.hydrate` (`refreshView`). */
export const view = store(BoardView, { lists: [], todos: [], canUndo: false }, { id: "todos.view" });
```

```ts title="modules/todos/hydrate.ts"
import { transaction } from "@keel/store";
import { BoardView } from "./BoardView.schema.ts";
import { view } from "./view.ts";

/** Replace the client's copy of the board with what the `api` deployable served. */
export const hydrate = transaction(view, "todos.hydrate", BoardView, (_state, data) => data);
```

`todos.view` changes only when a fresh board arrives: the client never edits todos locally, it asks `api` and re-reads.

### Talking to the api deployable

`endpoints` declares an HTTP API as schemas: method, path, params, body, output, and the error bodies by status. `service({ base, schema })` turns it into a typed client whose methods take `({ params, body }, ctx)` and return `Result<output, ApiError>`. They never throw. `ApiError` codes are `api.status` (with `status` and the decoded error body), `api.network`, `api.timeout`, `api.decode` and `api.input`. Requests go through `ctx.net`, never `fetch` (E1601, E1651).

```ts title="modules/todos/todos.service.ts"
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { ActionReply } from "./ActionReply.schema.ts";
import { BoardReply } from "./BoardReply.schema.ts";
import { FieldsReply } from "./FieldsReply.schema.ts";
import { ListDraft } from "./ListDraft.schema.ts";
import { TodoDraft } from "./TodoDraft.schema.ts";

/**
 * The board endpoints of the golden-1 `api` deployable (it owns the data; k.server runtime `Result` bodies),
 * served from the page's origin (vite proxies `/api`). Build the client at call time with `todosApi(origin)`.
 */
export const todos = endpoints({
  lists: { method: "GET", path: "/api/lists", output: BoardReply },
  createList: { method: "POST", path: "/api/lists", body: ListDraft, output: ActionReply },
  addTodo: {
    method: "POST",
    path: "/api/lists/:listId/todos",
    params: s.object({ listId: s.id("TodoList") }),
    body: TodoDraft,
    output: ActionReply,
  },
  toggleTodo: {
    method: "POST",
    path: "/api/todos/:todoId/toggle",
    params: s.object({ todoId: s.id("Todo") }),
    output: ActionReply,
  },
  editTodo: {
    method: "POST",
    path: "/api/todos/:todoId",
    params: s.object({ todoId: s.id("Todo") }),
    body: TodoDraft,
    output: ActionReply,
    errors: { 422: FieldsReply },
  },
  undo: { method: "POST", path: "/api/undo", output: ActionReply },
});
```

```ts title="modules/todos/suggestions.service.ts"
import { endpoints } from "@keel/services";
import { SuggestionsReply } from "./SuggestionsReply.schema.ts";

/**
 * Endpoints of the golden-1 `api` deployable, served from the page's origin (vite proxies `/api`). The client is
 * built at call time with `service({ base: location.origin, schema: suggestions })`: `location` does not exist
 * when the compiler evaluates the route manifests in Node.
 */
export const suggestions = endpoints({
  list: { method: "GET", path: "/api/suggestions", output: SuggestionsReply },
});
```

The `base` is the page's origin. A loader or action reads it from its `url` argument; a component reads `location.origin`. Server-side code never reads `location`, and `routes.ts` is evaluated in Node where `location` does not exist, so the client is built per call:

```ts title="modules/todos/todosApi.ts"
import { service } from "@keel/services";
import { todos } from "./todos.service.ts";

/**
 * A typed client for the `todos` endpoints at `origin`: `new URL(url).origin` in a loader or action (server code never
 * reads `location`, k.server API), `location.origin` in a component. Built per call.
 */
export function todosApi(origin: string) {
  return service({ base: origin, schema: todos });
}
```

Every loader and every write ends by re-reading the board into `todos.view`:

```ts title="modules/todos/refreshView.ts"
import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, ok } from "@keel/schema";
import { tx } from "@keel/store";
import type { BoardView } from "./BoardView.schema.ts";
import { hydrate } from "./hydrate.ts";
import { todosApi } from "./todosApi.ts";

/** Read the board from `GET /api/lists` at `origin` into `todos.view` (`todos.hydrate`); every loader and write ends here. */
export async function refreshView(origin: string, ctx: Ctx): Promise<Result<BoardView, KeelError<string, unknown>>> {
  const r = await todosApi(origin).lists({}, ctx);
  if (!r.ok) return r;
  const data = r.value.results["api.lists"].value;
  const h = tx(hydrate, data);
  return h.ok ? ok(data) : h;
}
```

```ts title="modules/todos/syncAfter.ts"
import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import type { BoardView } from "./BoardView.schema.ts";
import { refreshView } from "./refreshView.ts";

/** Await one write a component sent to the `api` deployable; when it succeeded, re-read the board (`refreshView`) at the page's origin. */
export async function syncAfter(
  ctx: Ctx,
  write: Promise<Result<unknown, KeelError<string, unknown>>>,
): Promise<Result<BoardView, KeelError<string, unknown>>> {
  const w = await write;
  return w.ok ? refreshView(location.origin, ctx) : w;
}
```

### Loaders, actions and the guard

A loader reads the data a route renders. `loader({ output, params?, search? }, fn)`: `fn` gets `({ params, search, url, caller, stores }, ctx)` and returns `Promise<Result<T, KeelError>>`. Never annotate `fn`; its argument types come from the declaration. An `err` with `keel.notFound` renders the route's `errorElement` (404 on a server); `keel.denied` is 403; other codes are 400.

```ts title="modules/todos/loadIndex.server.ts"
import { loader } from "@keel/router";
import { BoardView } from "./BoardView.schema.ts";
import { refreshView } from "./refreshView.ts";

/** Loader of `todos.index`: the board from the `api` deployable, hydrated into `todos.view`. */
export const loadIndex = loader({ output: BoardView }, async ({ url }, ctx) => refreshView(new URL(url).origin, ctx));
```

```ts title="modules/todos/loadList.server.ts"
import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { ListParams } from "./ListParams.schema.ts";
import { TodoList } from "./TodoList.schema.ts";
import { refreshView } from "./refreshView.ts";

/** The list named by `listId` from a fresh board (`refreshView`), else `keel.notFound`. */
export const loadList = loader({ output: TodoList, params: ListParams }, async ({ params, url }, ctx) => {
  const board = await refreshView(new URL(url).origin, ctx);
  if (!board.ok) return board;
  const list = board.value.lists.find((l) => l.id === params.listId);
  return list === undefined
    ? err({ code: "keel.notFound", message: `No list ${params.listId}`, data: { listId: params.listId } })
    : ok(list);
});
```

```ts title="modules/todos/loadTodo.server.ts"
import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Todo } from "./Todo.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";
import { refreshView } from "./refreshView.ts";

/** The todo `todoId` of list `listId` from a fresh board (`refreshView`), else `keel.notFound`. */
export const loadTodo = loader({ output: Todo, params: TodoParams }, async ({ params, url }, ctx) => {
  const board = await refreshView(new URL(url).origin, ctx);
  if (!board.ok) return board;
  const todo = board.value.todos.find((t) => t.id === params.todoId && t.listId === params.listId);
  return todo === undefined
    ? err({ code: "keel.notFound", message: `No todo ${params.todoId} in list ${params.listId}`, data: params })
    : ok(todo);
});
```

An action handles a form post. `action({ input, params? }, fn)`: `fn` gets `(input, { params, url, caller, stores }, ctx)`, with `input` already decoded and validated by its schema (a failure is 422 `keel.fields`, and `fn` is not called). `ok(null)` re-runs the chain's loaders once; `ok(href)` navigates there.

```ts title="modules/todos/createList.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { ListDraft } from "./ListDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

/** POST on `todos.index`: `POST /api/lists` on the `api` deployable, then revalidate (`loadIndex` re-reads). */
export const createList = action({ input: ListDraft }, async (input, { url }, ctx) => {
  const r = await todosApi(new URL(url).origin).createList({ body: input }, ctx);
  return r.ok ? ok(null) : err(r.error);
});
```

```ts title="modules/todos/createTodo.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { ListParams } from "./ListParams.schema.ts";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

/** POST on `todos.list`: `POST /api/lists/:listId/todos` on the `api` deployable, then revalidate. */
export const createTodo = action({ input: TodoDraft, params: ListParams }, async (input, { params, url }, ctx) => {
  const r = await todosApi(new URL(url).origin).addTodo({ params, body: input }, ctx);
  return r.ok ? ok(null) : err(r.error);
});
```

`updateTodo` forwards a 422 `keel.fields` from `api` (a duplicate title) so the form shows it under the title field, and on success returns the list's `Href`. It imports `routes.ts` back for `routes.href`; see the import-order note in section 9.

```ts title="modules/todos/updateTodo.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { TodoParams } from "./TodoParams.schema.ts";
import { routes } from "./routes.ts";
import { todosApi } from "./todosApi.ts";

/**
 * POST on `todos.edit`: `POST /api/todos/:todoId` on the `api` deployable. Its 422 `keel.fields` (`{ title }` when
 * another todo in the list has the title) is passed on to the Form; success goes to the list.
 */
export const updateTodo = action({ input: TodoDraft, params: TodoParams }, async (input, { params, url }, ctx) => {
  const r = await todosApi(new URL(url).origin).editTodo({ params: { todoId: params.todoId }, body: input }, ctx);
  if (!r.ok) return err(r.error.data.body?.error ?? r.error);
  return ok(routes.href("todos.list", { listId: params.listId }));
});
```

A guard runs before any loader in the chain. `ok(null)` lets the request through; `err` redirects to the `redirect` route.

```ts title="modules/todos/editable.guard.ts"
import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

/** Stub edit permission: denied while `ctx.storage` key `todos.readOnly` is `"1"`; redirects to `todos.index`. */
export const editable = guard({ redirect: "todos.index" }, async (_req, ctx) =>
  (await ctx.storage.get("todos.readOnly")) === "1"
    ? err({ code: "keel.denied", message: "todos are read-only", data: null })
    : ok(null),
);
```

### Components

A component file has one default export, a function `(props, slots?, ctx?)`, and may also export `Props`, a schema of its props, and `uses`, the transactions it may run. The rules you will meet first:

- Use the base elements from `@keel/ui` (`Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `Select`, `Checkbox`, `TextArea`). A lowercase tag such as `<div>` is E1805; a `style` attribute is E1803.
- Style props take token names. `px={{ base: "3", md: "6" }}` is responsive; `states={{ hover: { bg: "surfaceLow" } }}` styles states. A raw value such as `gap="12px"` fails the type check.
- Accessibility props are required: `Heading level`, `Image alt` or `decorative`, `label` on form controls, text inside `Button` and `Link` (E1802).
- `Link to` and `Form action` take an `Href` from `routes.href(id, params, search)`, never a string (E1501).
- Read props as `props.x`; destructuring them is E1401, because props are getters that stay reactive.
- Control flow is `<If>`, `<For each key>` and `<Match on>` with one `<Case tag>` per variant, from `@keel/runtime-dom`. `{a && <X />}`, a ternary of elements, or `.map()` returning elements is E1403.
- Children arrive as a thunk: render them with `{props.children?.()}`.
- `ctx` arrives as the third argument from the mount, the island root or the test harness. It is the only way a component reaches an effect, so it is optional in the signature and checked before use.
- Give elements a stable `id`; tests and `.keel/ids.json` address elements by id, and a duplicate is E1404. golden-1 prefixes ids with the module id by convention.
- Stores, `computed` and `resource` read inside JSX update the DOM when they change. Components never touch `document` or `window` (E1252).

`AppShell` is the layout every page renders inside. It declares `uses = [hydrate]` because its Undo button re-reads the board through `refreshView`, which runs `todos.hydrate`; a component that declares `uses` may run only those transactions (E1301).

```tsx title="modules/todos/AppShell.tsx"
import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Image, Link, Text } from "@keel/ui";
import { hydrate } from "./hydrate.ts";
import { refreshView } from "./refreshView.ts";
import { routes } from "./routes.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

export const Props = s.object({});
export const uses = [hydrate];

/**
 * Layout `todos.shell`: home link, Undo, and the page in `main`. Undo posts `/api/undo` (the `api` deployable owns
 * the log and undoes only this client's own last write) and re-reads the board even when refused (another client
 * wrote last), so `canUndo` turns it off; it is disabled while the served board says there is nothing to undo.
 */
export default function AppShell(
  props: Infer<typeof Props> & { readonly children?: () => Node },
  _slots?: Slots,
  ctx?: Ctx,
) {
  const empty = computed(() => !view.get("canUndo"));
  const undo = (): void => {
    if (ctx !== undefined)
      void todosApi(location.origin)
        .undo({}, ctx)
        .then(() => refreshView(location.origin, ctx));
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
        <Box as="nav" id="todos.nav" direction="row" align="center" gap="4">
          <Link id="todos.home" to={routes.href("todos.index")} fg="text">
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
      <Box as="main" id="todos.main" w={{ md: "measure" }} mx={{ md: "auto" }} px={{ base: "3", md: "4" }} py="6">
        {props.children?.()}
      </Box>
    </Box>
  );
}
```

`ListsPage` is the index route. `form(ListDraft)` creates a form handle; `f.field("name")` binds an `Input` to it, with validation from the schema on blur and submit. The router's `Form` posts to the route's `POST` action and shows any non-field error in its `error` slot. golden-1 calls `Form` as a function inside a helper named `children` and inserts it with `{children()}`; the compiler inserts a call of a binding named `children` as a node. Writing `<Form method="POST" action={...} form={f} error={...}>...</Form>` in JSX compiles as well.

```tsx title="modules/todos/ListsPage.tsx"
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import { ListDraft } from "./ListDraft.schema.ts";
import { routes } from "./routes.ts";
import { view } from "./view.ts";

export const Props = s.object({});

const openCount = (listId: string): number => view.get("todos").filter((t) => t.listId === listId && !t.done).length;

/** Route `todos.index`: every list with its open-todo count, and a Form adding a list. */
export default function ListsPage(_props: Infer<typeof Props>) {
  const f = form(ListDraft);
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const name = (
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
    );
    const submit = (
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
    );
    return Form({
      method: "POST",
      action: routes.href("todos.index"),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [name, submit],
    });
  };
  return (
    <Box as="section" id="todos.lists" direction="column" gap="5">
      <Heading id="todos.lists.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Lists
      </Heading>
      <Box as="ul" id="todos.lists.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={view.get("lists")} key="id">
          {(list) => (
            <Box
              as="li"
              id={`todos.listItem.${list.id}`}
              direction="row"
              justify="between"
              align="baseline"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Link id={`todos.listLink.${list.id}`} to={routes.href("todos.list", { listId: list.id })} fg="text">
                {list.name}
              </Link>
              <Text
                id={`todos.openCount.${list.id}`}
                font="mono"
                fontSize="xs"
                fg="accent"
                border="accent"
                px="2"
                py="1"
              >{`${openCount(list.id)} open`}</Text>
            </Box>
          )}
        </For>
      </Box>
      {children()}
    </Box>
  );
}
```

`ListPage` filters by the search param, lists rows with `For`, and adds a todo with a form:

```tsx title="modules/todos/ListPage.tsx"
import type { Ctx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For, type Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Select, Text } from "@keel/ui";
import Suggestions from "./Suggestions.tsx";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { TodoList } from "./TodoList.schema.ts";
import TodoRow from "./TodoRow.tsx";
import { routes } from "./routes.ts";
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
export default function ListPage(props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const f = form(TodoDraft, { initial: { priority: "normal" } });
  const shown = () =>
    view
      .get("todos")
      .filter(
        (t) =>
          t.listId === props.params.listId &&
          (props.search.filter === "done" ? t.done : props.search.filter === "active" ? !t.done : true),
      );
  const listId = props.params.listId;
  // `Form` is a function component returning an element; inserted through a `children()` binding (compiler D31).
  const children = (): Node =>
    Form({
      method: "POST",
      action: routes.href("todos.list", { listId }),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: () => [
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
        />,
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
        />,
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
        </Button>,
      ],
    });
  return (
    <Box as="section" id="todos.list" direction="column" gap="5">
      <Heading id="todos.list.title" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.name}
      </Heading>
      <Box as="nav" id="todos.filters" direction="row" gap="4" font="mono" fontSize="sm">
        <Link id="todos.filter.all" to={routes.href("todos.list", { listId }, { filter: "all" })} fg="text">
          All
        </Link>
        <Link id="todos.filter.active" to={routes.href("todos.list", { listId }, { filter: "active" })} fg="text">
          Active
        </Link>
        <Link id="todos.filter.done" to={routes.href("todos.list", { listId }, { filter: "done" })} fg="text">
          Done
        </Link>
      </Box>
      <Box as="ul" id="todos.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={shown()} key="id">
          {(todo) => <TodoRow todo={todo} />}
        </For>
      </Box>
      {children()}
      <Suggestions />
    </Box>
  );
}
```

`TodoRow` posts the toggle straight to `api` with the typed client and re-reads the board:

```tsx title="modules/todos/TodoRow.tsx"
import type { Ctx } from "@keel/ctx";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Checkbox, Link, Text } from "@keel/ui";
import { Todo } from "./Todo.schema.ts";
import { hydrate } from "./hydrate.ts";
import { routes } from "./routes.ts";
import { syncAfter } from "./syncAfter.ts";
import { todosApi } from "./todosApi.ts";

export const Props = s.object({ todo: Todo });
export const uses = [hydrate];

/** One todo: a done Checkbox (posts `/api/todos/:todoId/toggle`, then re-reads the board), priority, Edit link. */
export default function TodoRow(props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const toggle = (): void => {
    if (ctx !== undefined)
      void syncAfter(ctx, todosApi(location.origin).toggleTodo({ params: { todoId: props.todo.id } }, ctx));
  };
  return (
    <Box as="li" id={`todos.row.${props.todo.id}`} direction="row" align="center" gap="3" px="3" py="2" bg="card">
      <Checkbox
        id={`todos.toggle.${props.todo.id}`}
        label={`Done: ${props.todo.title}`}
        checked={props.todo.done}
        onChange={toggle}
      />
      <Text
        id={`todos.priority.${props.todo.id}`}
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
        id={`todos.editLink.${props.todo.id}`}
        to={routes.href("todos.edit", { listId: props.todo.listId, todoId: props.todo.id })}
        fg="text"
        fontSize="sm"
      >
        Edit
      </Link>
    </Box>
  );
}
```

`Suggestions` fetches with `resource`, whose state is the union `loading | error | ready`. A resource is always consumed through `Match`, one `Case` per state (E1204, E1402):

```tsx title="modules/todos/Suggestions.tsx"
import type { Ctx } from "@keel/ctx";
import { type ResourceState, resource } from "@keel/reactive";
import { Case, For, Match, type Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { type ApiError, service } from "@keel/services";
import { Box, Heading, Text } from "@keel/ui";
import type { Suggestion } from "./Suggestion.schema.ts";
import { suggestions } from "./suggestions.service.ts";

export const Props = s.object({});

type State = ResourceState<Suggestion[]>;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : "Suggestions failed");

/** `api.status` names the HTTP status; any other ApiError (network, timeout, decode) only that it failed. */
const failure = (e: ApiError): Error =>
  new Error(e.code === "api.status" ? `Suggestions failed (${e.data.status})` : "Suggestions failed");

async function fetchSuggestions(ctx: Ctx | undefined): Promise<Suggestion[]> {
  if (ctx === undefined) return Promise.reject(new Error("Suggestions need a ctx"));
  const r = await service({ base: location.origin, schema: suggestions }).list({}, ctx);
  return r.ok ? r.value.results["api.suggestions"].value : Promise.reject(failure(r.error));
}

/** Suggested titles from `GET /api/suggestions` through a typed `suggestions` client, shown by resource state. */
export default function Suggestions(_props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
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

`EditTodoPage` starts its form from the loader's todo. The action's 422 `{ title }` lands on the title field:

```tsx title="modules/todos/EditTodoPage.tsx"
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Select, Text } from "@keel/ui";
import { Todo } from "./Todo.schema.ts";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({
  params: s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") }),
  data: Todo,
});

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

/** Route `todos.edit`: a Form editing the todo's title and priority; success returns to `todos.list`. */
export default function EditTodoPage(props: Infer<typeof Props>) {
  const f = form(TodoDraft, { initial: { title: props.data.title, priority: props.data.priority } });
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const title = (
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
    );
    const priority = (
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
    );
    const submit = (
      <Button
        id="todos.save"
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
        Save
      </Button>
    );
    return Form({
      method: "POST",
      action: routes.href("todos.edit", props.params),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [title, priority, submit],
    });
  };
  return (
    <Box as="section" id="todos.edit" direction="column" gap="5">
      <Heading id="todos.edit.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Edit todo
      </Heading>
      {children()}
    </Box>
  );
}
```

`ListError` is the `errorElement` of two routes; it receives `{ error }`:

```tsx title="modules/todos/ListError.tsx"
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { routes } from "./routes.ts";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `todos.list` and `todos.edit`: names the error and links home. */
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
      <Link id="todos.error.home" to={routes.href("todos.index")} fg="text">
        Back to lists
      </Link>
    </Box>
  );
}
```

### Routes

The manifest maps route ids to routes. An entry without `path` is a layout (`todos.shell`); others name it with `layout`. Actions attach afterwards with `routes.actions`, by route id and HTTP method. Two steps let an action file import `routes.ts` for `routes.href` without a cycle at declaration time.

```ts title="modules/todos/routes.ts"
import { manifest } from "@keel/router";
import AppShell from "./AppShell.tsx";
import EditTodoPage from "./EditTodoPage.tsx";
import ListError from "./ListError.tsx";
import ListPage from "./ListPage.tsx";
import { ListParams } from "./ListParams.schema.ts";
import { ListSearch } from "./ListSearch.schema.ts";
import ListsPage from "./ListsPage.tsx";
import { TodoParams } from "./TodoParams.schema.ts";
import { createList } from "./createList.server.ts";
import { createTodo } from "./createTodo.server.ts";
import { editable } from "./editable.guard.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadList } from "./loadList.server.ts";
import { loadTodo } from "./loadTodo.server.ts";
import { updateTodo } from "./updateTodo.server.ts";

export const routes = manifest({
  "todos.shell": { component: AppShell },
  "todos.index": {
    path: "/",
    loader: loadIndex,
    component: ListsPage,
    layout: "todos.shell",
  },
  "todos.list": {
    path: "/lists/:listId",
    params: ListParams,
    search: ListSearch,
    loader: loadList,
    component: ListPage,
    layout: "todos.shell",
    errorElement: ListError,
  },
  "todos.edit": {
    path: "/lists/:listId/todos/:todoId/edit",
    params: TodoParams,
    loader: loadTodo,
    component: EditTodoPage,
    layout: "todos.shell",
    guard: editable,
    errorElement: ListError,
  },
});
routes.actions({
  "todos.index": { POST: createList },
  "todos.list": { POST: createTodo },
  "todos.edit": { POST: updateTodo },
});
```

## 7. The api module

`api` is a `node` deployable's module: it owns the board. Every request gets its own instance of the board store, restored from `ctx.storage` and saved back when an action succeeds.

### Manifest

```ts title="modules/api/module.ts"
import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: ["todos"],
  capabilities: ["random"],
  public: { exports: [], routes: ["api.lists"] },
});
```

`deps: ["todos"]` lets it import the board schemas. `random` mints ids. `public.routes` lists `api.lists` because `digest` calls it through `service({ module: "api" })`. The `todos` pages call the other `api` routes too, but over plain HTTP with `service({ base })`, which the module rules do not see.

### Server state: the board and its transactions

On a `node` deployable, a loader or action can name `stores`: a factory that builds stores (with explicit ids) and transactions. Per request, Keel runs the factory once, restores each store from `ctx.storage` key `keel.store.<id>`, passes the result to `fn` as `stores`, and on an action's `ok` saves the stores that changed. Two overlapping writes to the same store: the later one is 409 `keel.conflict`.

```ts title="modules/api/TodoIdParams.schema.ts"
import { s } from "@keel/schema";

/** Route params of `api.todo` and `api.todoToggle`; their actions type `params` as its Infer. */
export const TodoIdParams = s.object({ todoId: s.id("Todo") });
export type TodoIdParams = s.infer<typeof TodoIdParams>;
```

`invariant` declares what must hold after every transaction; a transaction that breaks it is rolled back with `store.invariant`, and `properties()` in tests generates payloads to try to break it.

```ts title="modules/api/board.ts"
import { invariant, store } from "@keel/store";
import { Board } from "../todos/Board.schema.ts";

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

```ts title="modules/api/addList.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "../todos/Board.schema.ts";

/** `api.addList` on `board` (`boardStores`): append a list; a duplicate id leaves the board unchanged. */
export const addList = (board: Store<Board>) =>
  transaction(
    board,
    "api.addList",
    s.object({ id: s.id("TodoList"), name: s.string({ min: 1, max: 60 }) }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? state
        : { ...state, lists: [...state.lists, { id: p.id, name: p.name }] },
  );
```

```ts title="modules/api/addTodo.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "../todos/Board.schema.ts";

/** `api.addTodo` on `board` (`boardStores`): append an open todo to list `listId`; an unknown list or a duplicate id leaves the board unchanged. */
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
  );
```

```ts title="modules/api/toggleTodo.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "../todos/Board.schema.ts";

/** `api.toggleTodo` on `board` (`boardStores`): flip `done` of todo `id`; an unknown id leaves the board unchanged. */
export const toggleTodo = (board: Store<Board>) =>
  transaction(board, "api.toggleTodo", s.object({ id: s.id("Todo") }), (state, p) =>
    state.todos.some((t) => t.id === p.id)
      ? { ...state, todos: state.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }
      : state,
  );
```

```ts title="modules/api/editTodo.ts"
import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "../todos/Board.schema.ts";

/** `api.editTodo` on `board` (`boardStores`): replace title and priority of todo `id`; an unknown id leaves the board unchanged. */
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
import { toggleTodo } from "./toggleTodo.ts";

/**
 * The `api` deployable's server state (k.server Server state, RFC 0044): the board and the `api.*` transactions bound
 * to it. Loaders and actions name it as `stores: boardStores`; each request gets its own instance, restored from and
 * saved to `ctx.storage` (`keel.store.api.board`).
 */
export function boardStores() {
  const b = board();
  return { board: b, addList: addList(b), addTodo: addTodo(b), toggleTodo: toggleTodo(b), editTodo: editTodo(b) };
}
```

### Loaders and actions

`caller` identifies the browser: a hash of a signed `keel-caller` cookie the server sets on the first write. Actions record it as transaction `meta`, so undo can stay per client.

```ts title="modules/api/loadBoard.server.ts"
import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { BoardView } from "../todos/BoardView.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `GET /api/lists`: every list and todo, and whether `POST /api/undo` would undo this caller's last write. */
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ caller, stores }) => {
  const { board } = stores;
  const canUndo = board.log().at(-1)?.meta?.caller === caller;
  return ok({ lists: board.get("lists"), todos: board.get("todos"), canUndo });
});
```

```ts title="modules/api/loadSuggestions.server.ts"
import { loader } from "@keel/router";
import { ok, s } from "@keel/schema";
import { Suggestion } from "../todos/Suggestion.schema.ts";

const TITLES = ["Bread", "Eggs", "Milk"];

/** Suggested todo titles for `GET /api/suggestions`, sorted by title; the same list on every request. */
export const loadSuggestions = loader({ output: s.array(Suggestion) }, async () =>
  ok([...TITLES].sort().map((title) => ({ title }))),
);
```

```ts title="modules/api/postList.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListDraft } from "../todos/ListDraft.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/lists`: add a list with a ctx-minted id, recorded with this caller (undo, `postUndo`). */
export const postList = action({ input: ListDraft, stores: boardStores }, (input, { caller, stores }, ctx) => {
  const r = tx(stores.addList, { id: ctx.random.id("TodoList"), name: input.name }, { meta: { caller } });
  return r.ok ? ok(null) : err(r.error);
});
```

```ts title="modules/api/postTodo.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListParams } from "../todos/ListParams.schema.ts";
import { TodoDraft } from "../todos/TodoDraft.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id; an unknown list is `keel.notFound`. */
export const postTodo = action(
  { input: TodoDraft, params: ListParams, stores: boardStores },
  (input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    if (!stores.board.get("lists").some((l) => l.id === listId))
      return err({ code: "keel.notFound", message: `No list ${listId}`, data: { listId } });
    const r = tx(stores.addTodo, { ...input, id: ctx.random.id("Todo"), listId }, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
```

```ts title="modules/api/postToggle.server.ts"
import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/todos/:todoId/toggle`: flip `done`; an unknown todo is `keel.notFound`. */
export const postToggle = action(
  { input: s.object({}), params: TodoIdParams, stores: boardStores },
  (_input, { params, caller, stores }) => {
    const { todoId } = params;
    const todo = stores.board.get("todos").find((t) => t.id === todoId);
    if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
    const r = tx(stores.toggleTodo, { id: todoId }, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
```

```ts title="modules/api/postEdit.server.ts"
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { TodoDraft } from "../todos/TodoDraft.schema.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/todos/:todoId`: replace title and priority. `keel.fields` `{ title }` when another todo in the same list
 * has the title; an unknown todo is `keel.notFound`.
 */
export const postEdit = action(
  { input: TodoDraft, params: TodoIdParams, stores: boardStores },
  (input, { params, caller, stores }) => {
    const { todoId } = params;
    const todos = stores.board.get("todos");
    const todo = todos.find((t) => t.id === todoId);
    if (todo === undefined) return err({ code: "keel.notFound", message: `No todo ${todoId}`, data: { todoId } });
    if (todos.some((t) => t.listId === todo.listId && t.id !== todoId && t.title === input.title))
      return err({ code: "keel.fields", message: "Duplicate title", data: { title: "Another todo has this title" } });
    const r = tx(stores.editTodo, { ...input, id: todoId }, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
```

`undoWhere` undoes the newest log entry only when the predicate holds:

```ts title="modules/api/postUndo.server.ts"
import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/undo`: undo the board's last transaction when this caller (its `keel-caller` cookie) committed it (its
 * entry's `meta.caller`, k.store `undoWhere`); else nothing changes and the reply is `keel.denied` (403): one client
 * never undoes another's write.
 */
export const postUndo = action({ input: s.object({}), stores: boardStores }, (_input, { caller, stores }) =>
  stores.board.undoWhere((e) => e.meta?.caller === caller)
    ? ok(null)
    : err({ code: "keel.denied", message: "Nothing of yours to undo", data: {} }),
);
```

### Document views

Every route needs a `component`, even one that clients call for JSON. A browser that opens `/api/lists` gets this HTML; a request with `accept: application/json` gets the loader `Result`. These are PascalCase `.ts` files without JSX: base elements called as functions.

```ts title="modules/api/BoardApi.ts"
import { Box } from "@keel/ui";
import type { BoardView } from "../todos/BoardView.schema.ts";

/**
 * Document view of `api.lists` (list names); runtime requests (`accept: application/json`) get the loader `Result`.
 * Plain `.ts` (no JSX).
 */
export default function BoardApi(props: { readonly data: BoardView }): Node {
  return Box({ as: "ul", id: "api.lists", children: props.data.lists.map((l) => Box({ as: "li", children: l.name })) });
}
```

```ts title="modules/api/SuggestionsApi.ts"
import { Box } from "@keel/ui";
import type { Suggestion } from "../todos/Suggestion.schema.ts";

/**
 * Document view of `api.suggestions`; runtime requests (`accept: application/json`) get the loader `Result`.
 * Plain `.ts` (no JSX).
 */
export default function SuggestionsApi(props: { readonly data: readonly Suggestion[] }): Node {
  return Box({
    as: "ul",
    id: "api.suggestions",
    children: props.data.map((x) => Box({ as: "li", children: x.title })),
  });
}
```

```ts title="modules/api/ActionApi.ts"
import { Box } from "@keel/ui";

/**
 * Document view of the `api` routes that only take actions (POST with `accept: application/json` gets the action
 * `Result`). Plain `.ts` (no JSX).
 */
export default function ActionApi(): Node {
  return Box({ id: "api.action", children: "POST only" });
}
```

### Routes

```ts title="modules/api/routes.ts"
import { manifest } from "@keel/router";
import { ListParams } from "../todos/ListParams.schema.ts";
import ActionApi from "./ActionApi.ts";
import BoardApi from "./BoardApi.ts";
import SuggestionsApi from "./SuggestionsApi.ts";
import { TodoIdParams } from "./TodoIdParams.schema.ts";
import { loadBoard } from "./loadBoard.server.ts";
import { loadSuggestions } from "./loadSuggestions.server.ts";
import { postEdit } from "./postEdit.server.ts";
import { postList } from "./postList.server.ts";
import { postTodo } from "./postTodo.server.ts";
import { postToggle } from "./postToggle.server.ts";
import { postUndo } from "./postUndo.server.ts";

/** The `api` deployable (node): it owns the board (`api.board`); `todos` reads and writes it over HTTP. */
export const routes = manifest({
  "api.lists": { path: "/api/lists", loader: loadBoard, component: BoardApi },
  "api.listTodos": {
    path: "/api/lists/:listId/todos",
    params: ListParams,
    component: ActionApi,
  },
  "api.todo": {
    path: "/api/todos/:todoId",
    params: TodoIdParams,
    component: ActionApi,
  },
  "api.todoToggle": {
    path: "/api/todos/:todoId/toggle",
    params: TodoIdParams,
    component: ActionApi,
  },
  "api.undo": { path: "/api/undo", component: ActionApi },
  "api.suggestions": { path: "/api/suggestions", loader: loadSuggestions, component: SuggestionsApi },
});
routes.actions({
  "api.lists": { POST: postList },
  "api.listTodos": { POST: postTodo },
  "api.todo": { POST: postEdit },
  "api.todoToggle": { POST: postToggle },
  "api.undo": { POST: postUndo },
});
```

## 8. The digest module

`digest` shows background work: a job queue, a schedule, the runners that drive both, a call to another module, and a live loader that streams.

### Manifest

```ts title="modules/digest/module.ts"
import { module } from "@keel/compiler";

export default module({
  id: "digest",
  deps: ["api", "todos", "@keel/std-jobs", "@keel/std-schedules"],
  capabilities: ["clock", "random", "storage", "net"],
  public: { exports: [], routes: [] },
});
```

`deps` names the two stdlib packages it uses, `api` (it calls `api.lists`) and `todos` (it imports `BoardView`).

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

```ts title="modules/digest/ListsReply.schema.ts"
import { s } from "@keel/schema";
import { BoardView } from "../todos/BoardView.schema.ts";

/** The `api` module's runtime answer to `GET /api/lists` (k.server): the `api.lists` loader `Result`. */
export const ListsReply = s.object({
  id: s.literal("api.lists"),
  results: s.object({
    "api.lists": s.object({ ok: s.literal(true), value: BoardView }),
  }),
});
export type ListsReply = s.infer<typeof ListsReply>;
```

```ts title="modules/digest/LATEST_KEY.ts"
/** The `ctx.storage` key of the newest digest: written by `digest.recount`, read by `digest.show` and `digest.feed`. */
export const LATEST_KEY = "digest.latest";
```

`attempt` is the one sanctioned way to catch: it turns a throw into `err` with `keel.unexpected`. App code never writes `throw` (E1451) or `try`/`catch` (E1452).

```ts title="modules/digest/readLatest.ts"
import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
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
  const json = attempt((): unknown => JSON.parse(raw));
  const parsed = json.ok ? Digest.parse(json.value) : undefined;
  return parsed?.ok ? parsed.value : NONE;
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

### Calling another module

`service({ module: "api", schema })` calls a module's routes wherever `topology.ts` puts it: in process when `api` is in the same deployable, through the peer's URL when it is not. The code is the same in both topologies. The route must be in `api`'s `public.routes` and `api` in `digest`'s `deps`.

```ts title="modules/digest/board.service.ts"
import { endpoints } from "@keel/services";
import { ListsReply } from "./ListsReply.schema.ts";

/** The `api` route `digest.recount` reads: `api.lists` (in the `api` module's `public.routes`). */
export const board = endpoints({
  lists: { method: "GET", path: "/api/lists", output: ListsReply },
});
```

```ts title="modules/digest/boardApi.ts"
import { service } from "@keel/services";
import { board } from "./board.service.ts";

/**
 * The `api` module's board routes, resolved per call by the topology: in process when `api` is served beside
 * `digest`, else through its peer.
 */
export const boardApi = service({ module: "api", schema: board });
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
  const todos = r.value.results["api.lists"].value.todos;
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
import { Digest } from "./Digest.schema.ts";
import { readLatest } from "./readLatest.ts";

/** `GET /digest`: the newest digest. */
export const loadDigest = loader({ output: Digest }, async (_args, ctx) => ok(await readLatest(ctx)));
```

A loader whose `fn` is an async generator is live. A document or JSON GET takes its first yield; a GET with `accept: text/event-stream` gets every yield as a `data:` line until the request ends. Live loaders need a `node` deployable (E1558).

```ts title="modules/digest/feedDigest.server.ts"
import { loader } from "@keel/router";
import { attempt, ok } from "@keel/schema";
import { Digest } from "./Digest.schema.ts";
import { readLatest } from "./readLatest.ts";

/** How often the feed reads the stored digest, in `ctx.clock` ms. */
const POLL_MS = 1000;

/**
 * `GET /digest/feed`, a live loader: the newest digest, then each different digest a later count stores, read every
 * second until the request ends or the deployable closes.
 */
export const feedDigest = loader({ output: Digest }, async function* ({ signal }, ctx) {
  let last = await readLatest(ctx);
  yield ok(last);
  while (!signal.aborted) {
    const waited = await attempt(() => ctx.clock.after(POLL_MS, signal));
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
import { RecountInput } from "./RecountInput.schema.ts";
import { jobs } from "./jobs.server.ts";

/** `POST /digest/refresh`: enqueue one `digest.recount`; `GET /digest` shows its count once it has run. */
export const refresh = action({ input: RecountInput }, async (input, _args, ctx) => {
  const r = await jobs.enqueue(ctx, "digest.recount", input);
  return r.ok ? ok(null) : err(r.error);
});
```

```ts title="modules/digest/DigestApi.ts"
import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";
import { Digest } from "./Digest.schema.ts";

export const Props = s.object({ data: Digest });

/**
 * Document view of `digest.show` and `digest.feed`: the open and done counts. Runtime requests
 * (`accept: application/json`) get the loader `Result`, event-stream requests every yield.
 */
export default function DigestApi(props: Infer<typeof Props>): Node {
  return Box({
    as: "ul",
    id: "digest.counts",
    children: () => [
      Box({ as: "li", id: "digest.open", children: String(props.data.open) }),
      Box({ as: "li", id: "digest.done", children: String(props.data.done) }),
    ],
  });
}
```

```ts title="modules/digest/RefreshApi.ts"
import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";

export const Props = s.object({});

/** Document view of `digest.refresh`, which only takes POST (`accept: application/json` gets the action `Result`). */
export default function RefreshApi(_props: Infer<typeof Props>): Node {
  return Box({ id: "digest.action", children: "POST only" });
}
```

```ts title="modules/digest/routes.ts"
import { manifest } from "@keel/router";
import DigestApi from "./DigestApi.ts";
import RefreshApi from "./RefreshApi.ts";
import { feedDigest } from "./feedDigest.server.ts";
import { loadDigest } from "./loadDigest.server.ts";
import { refresh } from "./refresh.server.ts";

/** The `digest` module: board counts that `digest.recount` keeps, on request and every hour. */
export const routes = manifest({
  "digest.show": { path: "/digest", loader: loadDigest, component: DigestApi },
  "digest.refresh": { path: "/digest/refresh", component: RefreshApi },
  "digest.feed": { path: "/digest/feed", loader: feedDigest, component: DigestApi },
});
routes.actions({ "digest.refresh": { POST: refresh } });
```

With the three modules written, `keel check` should print `ok check 80 files, 0 errors, 0 warnings`.

## 9. Tests

Tests use `@keel/testing` under a simulated `ctx` (`createCtx({ mode: "sim", seed })`): its clock moves only when a test advances it, its random ids follow the seed, its storage is in memory, and `ctx.net.route(pattern, handler)` answers requests. Tests find elements by id, never by DOM query (E1701), and an id missing from `.keel/ids.json` is E1705.

Three helpers come first. `at.ts` builds the `{ params, url, caller, stores }` argument a loader or action gets, for calling one directly:

```ts title="test/at.ts"
import type { Schema } from "@keel/schema";
import { Board } from "../modules/todos/Board.schema.ts";

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

`apiRoutes.ts` merges the two `api` deployable modules' routes, as the generated server entry does:

```ts title="test/apiRoutes.ts"
import { manifest } from "@keel/router";
import { routes as api } from "../modules/api/routes.ts";
import { routes as digest } from "../modules/digest/routes.ts";

/** The `api` deployable's route table as its generated entry merges it: the `api` and `digest` modules' routes. */
export const apiRoutes = manifest({ ...api.routes, ...digest.routes });
```

`simApi.ts` serves the real `api` deployable in process with `createApp`, over one sim `ctx` whose storage is the board's, and gives client code a sim `ctx` whose `/api/*` requests reach it:

```ts title="test/simApi.ts"
import { type SimCtx, createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { Board } from "../modules/todos/Board.schema.ts";
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
export const apiApp = () => createApp({ topology, routes: apiRoutes, ctx: server, deployable: "api" });

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
  const app = await apiApp();
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

The suites themselves are long and repetitive, so this guide does not reprint them. Copy them from golden-1:

```sh
cp ../../apps/golden-1/test/*.test.ts test/
```

| File | What it shows |
| --- | --- |
| `test/routes.test.ts` | `renderRoute` per page: loaders, filters, `fire` on forms, the guard redirect, `errorElement` |
| `test/components.test.ts` | `render` per component, `properties` for components, the suggestions `resource` states |
| `test/board.test.ts` | schemas, the todos loaders and actions called directly, `todosApi` against the sim api |
| `test/api.test.ts` | `properties` on each `api` transaction (invariants, undo), the `api` HTTP surface, per-caller undo |
| `test/digest.test.ts` | the job, the schedule on the sim clock, the event-stream feed, a restart with a job left in the queue |
| `test/ssrNode.test.ts` | the `todos` pages rendered by a `node` adapter in plain Node, no DOM global |

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

A test that imports a `*.server.ts` file whose module imports `routes.ts` back (`updateTodo`) must import `routes.ts` first. Otherwise `routes.actions` receives `undefined` for that action and throws E1505. `board.test.ts` and `components.test.ts` open with that import.

## 10. Run it

### Check and test

```sh
pnpm test        # or: keel test
keel build
keel check
```

A clean run prints `ok 72 tests, 0 failed, 0 skipped (…)` (`keel test` prints `ok test 72 tests, 0 failed, 0 skipped`), then `ok build 77 files, 7 artifacts, 0 errors` (the first build; a later build prints `5 artifacts`, because deploy files are counted only when they change), then `ok check 93 files, 0 errors, 0 warnings`; the check counts the `.keel/` artifacts too. `pnpm check` adds `tsc` and Biome in front of `keel check --quiet`. Output follows `docs/OUTPUT.md`: one line per diagnostic, `fix:` and `see:` lines under it, a summary line last, `--format=pretty` for people. `keel explain <code>` prints what a code means and its fix pattern.

### Develop

```sh
keel dev
```

One Vite server at `http://localhost:5173` serves the `web` client and answers every `api` and `digest` path from the `api` deployable's dev server on the same origin, with its runners. A source edit reloads the dev servers on the next request and reloads the page in the browser; there is no hot module replacement, so component state does not survive an edit. `keel dev` takes no flags, so it has no port option.

The dev servers keep `ctx.storage` in Node's `localStorage`, which exists only when Node runs with `--localstorage-file`. `keel dev` does not pass it, so with a bare `keel dev` every `api` request answers 500 `keel.unexpected` "ctx.storage: localStorage is unavailable in this runtime" and the runners log the same error each second. In the browser that shows as an unstyled "status 500" on every page that needs the `api` module, while the terminal repeats the runner error every second. Pass the flags through `NODE_OPTIONS`:

```sh
mkdir -p .keel-dev
NODE_OPTIONS="--experimental-webstorage --localstorage-file=.keel-dev/storage --disable-warning=ExperimentalWarning" \
  pnpm keel dev
```

### Build and run the server

`keel build` compiles and checks every source, writes `.keel/` and `.keel/surface.json`, runs Vite once for the `web` client into `dist/` and once per `node` deployable into `dist/<name>/`, and writes `deploy/`. It prints one summary line on success.

`dist/api/server.mjs` is the generated production entry. It installs a server DOM, imports `topology.ts`, each of its modules' `routes.ts` and `runners.server.ts`, and serves them. It reads its settings from the environment and exits 1 with one E1560 line naming the key when one is missing or invalid:

| Variable | Meaning |
| --- | --- |
| `KEEL_SECRET` | 32 or more random bytes. It signs the caller cookie; give every deployable of the app the same value. |
| `PORT` | default 8080 |
| `KEEL_ORIGIN` | the public origin, such as `https://todo.example`. Loaders see it in `url`, the same-site check uses it, and on https the caller cookie becomes `Secure` (`__Host-keel-caller`). |
| `KEEL_PEER_<NAME>` | the URL of each other `node` deployable; none in golden-1's topology |

```sh
export KEEL_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')
KEEL_ORIGIN=https://todo.example pnpm api
```

Docker Desktop listens on 8080; if it runs, set `PORT` to another port and use it in the requests below. `ctx.storage`, which holds the board, the digest and the job queue, is the file `--localstorage-file` names (`.api.storage`): the only state that survives a restart. Each request prints one log line such as `GET /api/lists api.lists 200 2ms`. Without `KEEL_ORIGIN` it also prints W1557 at startup: the cookie is `Secure` only for https requests. With `KEEL_ORIGIN` set, `server.mjs` prints nothing at startup. On SIGTERM or SIGINT it stops listening, lets runners settle and exits 0.

Try it with curl. A write needs `x-keel: 1` with `accept: application/json` to pass the same-site check:

```sh
curl -s -H 'accept: application/json' localhost:8080/api/lists
curl -s -X POST -H 'accept: application/json' -H 'content-type: application/json' -H 'x-keel: 1' \
  -d '{"name":"Home"}' localhost:8080/api/lists
curl -s localhost:8080/api/lists          # the BoardApi document view
```

`server.mjs` serves the `api` deployable's routes and its own `dist/api/assets/`. It does not serve the `web` client: `GET /` is 404. `dist/` is static files that expect `/api` and `/digest` on their own origin, so in production put a static host and a reverse proxy in front of both. Keel writes no deploy file for a `client` deployable.

`vite preview` cannot show the client build: it answers 404 for `/api` and `/digest`. To see the client build in production, start the `api` server on a high port (`PORT=18080 KEEL_SECRET=… pnpm api`) and run this script from the app folder with `node client-proxy.mjs`. It serves `dist/` with an `index.html` fallback for client routes and proxies `/api` and `/digest` to the node deployable, piping each response so the event stream is not buffered. Both ports come from the environment (`WEB_PORT`, default 15173; `API_PORT`, default 18080).

```js title="client-proxy.mjs"
import { createServer, request } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const root = new URL('./dist/', import.meta.url).pathname
const upstream = Number(process.env.API_PORT ?? 18080)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  if (/^\/(api|digest)(\/|$)/.test(pathname)) {
    const hop = request({ port: upstream, path: req.url, method: req.method, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    })
    hop.on('error', () => res.writeHead(502).end())
    req.pipe(hop)
    return
  }
  const file = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''))
  const body = await readFile(file).catch(() => null)
  const found = body !== null && file.startsWith(root) && !pathname.endsWith('/')
  res.writeHead(200, { 'content-type': types[found ? extname(file) : '.html'] ?? 'application/octet-stream' })
  res.end(found ? body : await readFile(join(root, 'index.html')))
}).listen(Number(process.env.WEB_PORT ?? 15173))
```

This is a stopgap you write yourself. Keel generates no deploy file for the client deployable, and the script does no caching, compression or error pages.

### Deploy files

`deploy/api/Dockerfile` builds an image from `dist/api/` alone on `node:22-slim`, runs as `node`, keeps storage on the `/data` volume and exposes 8080. `deploy/compose.yaml` runs one service per `node` deployable and takes `KEEL_SECRET` and `KEEL_ORIGIN` from your environment:

```sh
KEEL_SECRET=… KEEL_ORIGIN=… docker compose -f deploy/compose.yaml up
```

Both are regenerated by every `keel build`; a hand edit is E1005.

### Split digest into its own server

Edit `topology.ts` alone:

```ts
api: { modules: ["api"], adapter: "node" },
digest: { modules: ["digest"], adapter: "node" },
```

`keel build` then writes `dist/digest/server.mjs` and `deploy/digest/Dockerfile`, and `compose.yaml` gives each service the other's URL as `KEEL_PEER_API` and `KEEL_PEER_DIGEST`. `digest`'s `service({ module: "api" })` call goes to its peer over HTTP, and `api` forwards `/digest` requests to `digest`, using the route table in `dist/api/routes.json`.

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
| E1151, E1152, E1157 | imported a non-public export, from a module not in `deps`, or called a non-public route | add it to the other module's `public`, or the module to `deps` |
| E1805, E1803 | `<div>` or `style` in a component | `<Box>` and style props |
| E1802 | a `Heading` without `level`, an `Image` without `alt`, a control without `label` | add the prop |
| E1501 | a string in `Link to` or `Form action` | `routes.href(id, params)` |
| E1401 | destructured props | `props.x` |
| E1403 | `{cond && <X />}`, a ternary of elements, or `.map()` to elements | `<If>`, `<For>`, `<Match>` |
| E1808 | eager children on a base element | `children: () => …` |
| E1301 | ran a transaction a component's `uses` does not list | add it to `uses` |
| E1302 | read `ctx` or a global in a transaction | pass the value in the payload |
| E1451, E1452 | `throw`, or `try`/`catch` | `return err(…)`, `attempt(…)` |
| E1601 | `Date`, `Math.random`, `fetch`, `localStorage` in app code | `ctx.clock`, `ctx.random`, an endpoint, `ctx.storage` |
| E1507 | a loader or action whose `params` or `search` is not the route's own schema, or an annotated `fn` | pass the route's schema value; leave `fn` unannotated |
| E1505 | `routes.actions` got `undefined`, usually a test importing a `*.server.ts` before `routes.ts` | import `routes.ts` first |
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
| routes, layouts, guards, `Form`, `href` | `k.router`; `docs/adr/0004-route-manifest.md`, `docs/adr/0052-two-phase-manifest-actions.md` |
| schemas, `Result`, errors | `k.schema`, `k.errors` |
| stores, transactions, undo, invariants | `k.store`, `k.reactive`; `docs/adr/0003-transactions.md` |
| components, JSX rules, ids | `k.component`, `k.ui` |
| forms | `k.forms` |
| services and `ApiError` | `k.services`; `docs/adr/0028-service-schema-filename.md` |
| `ctx` and capabilities | `k.ctx`; `docs/adr/0007-ctx-capabilities.md` |
| CLI commands and flags | `k.cli`, `k.check` |
| test harness | `k.testing` |
| HTTP surface compatibility | `k.compat`; `docs/adr/0077-surface-compatibility.md` |
| jobs and schedules | `std.jobs`, `std.schedules`; `docs/adr/0079-jobs-and-schedules.md` |
| live loaders | `k.server`; `docs/adr/0076-live-loaders-event-streams.md` |

The Keel skills in `.claude/skills/keel*/SKILL.md` are terse API cards for the same material.

## What this guide leaves out

- The six test suites, copied from `apps/golden-1/test/` in section 9 rather than reprinted.
- `README.md`; golden-1's own is at `apps/golden-1/README.md`.
- Inspecting a running app (`keel inspect`, `/__keel/inspect`), recorded sessions, and `keel check --base` against a deployed `surface.json`.
- Running the `web` client in production behind a proxy; Keel has no generated file for it.

verified: 4b7a637f563daa2284f10170ce2824a4dd55798e
