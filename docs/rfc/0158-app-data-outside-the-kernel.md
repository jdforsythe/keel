# RFC 0158: k.data and std.postgres: app data outside the kernel

Status: proposed (ADR-0180), for the operator to read (W14 step 1, decision D43). Spec text applied at status `proposed`: `spec/kernel/k.data.md`, `spec/std/std.postgres.md`, one sentence of k.persist, the map rows.

## Decisions
- D1: the kernel neither stores nor fetches app data. It validates what crosses a boundary (`input`, `params`, `search`, `output`) and nothing else, as it signs no one in (k.user). New kernel section k.data states it; new glossary term **app data**.
- D2: the seam is the capability registry that exists (`register(name, { real, shell, sim })`, k.ctx). No second mechanism, no data driver in `createCtx`, no kernel data type. The `T` of `register<T>` is the contract the three sides and every handler meet, so "Keel checks that the types line up" is `tsc` over one interface, and the boundary schemas at the HTTP edge.
- D3: an app-registered capability is named `<moduleId>.<name>`, a string literal, one file per name (E1607), so names stay addressable (principle 3) and two modules never collide; E1602 keeps guarding kernel and stdlib names.
- D4: in `keel dev`, an edit to a file that calls `register` loads the server graph again whole, so the registry is empty when the file registers again. This extends the reload the Vite plugin already does for a linked package; `register`'s E1602 is unchanged.
- D5: a server-only data capability lives in a `*.server.ts` file; its `shell` side is its real side, since no shell ctx reaches a server-only file (k.boundary). No kernel lifecycle hook: a capability that holds connections lets idle ones end (a `pg` pool with `allowExitOnIdle`), and the server entry exits after `close()` (k.deploy).
- D6: `read` and `commit` (k.persist) keep Keel's own state: store snapshots with their logs, std.jobs queues, std.schedules marks, std.workflows instances, the outbox. A server store holds bounded state read whole per request; records that grow with use are app data.
- D7: simulation, replay and the ledger. Under sim a data capability answers from its sim side, which keeps k.sim's rule (deterministic by seed and plan, no timer). Data reached any other way is not simulated, and the spec says what that costs. The ledger gains no record kind: rungs stay read from tests, and k.data states what a rung earned under sim is evidence of.
- D8: `@keel/std-postgres`, section std.postgres, is the battery, the one exception to "no new stdlib packages". First scope: `database(name, { migrations })` (a capability per call), the `sql(schema)` tag with a schema on every statement, `fragment`, `query`, `one`, `run`, `transaction`, PGlite for dev (`pglite:`), tests and simulation, forward-only SQL migrations. Out of scope until a second store asks: a store-neutral core, a seed engine, a build-time SQL check against the database schema, row ownership.
- D9: std.postgres is specified in full here, as a second section, rather than in a follow-up RFC. The seam is only proven by a worked case whose API is fixed: the golden-2 move below needs `sql`, `one`, `run` and the error codes to type-check, and W14 step 2's conformance-writer starts from section text. The section fits its 1,500-token limit (1,496).
- D10 (refining the orchestrator's first scope): "a result schema on every query" holds literally. A statement with no result rows names `NoRows`, a closed empty object, and `run` returns the count of rows changed; any row it returns fails `NoRows`. One tag, no unchecked path.
- D11: migrations are module-local (`modules/<id>/migrations/NNNN-<kebab>.sql`) and reach the capability through Vite's `import.meta.glob(..., { query: '?raw', eager: true })`, so the SQL travels inside `server.mjs` and nothing copies files at build. Each `database` capability owns its tables and its rows of `keel_migrations`; several capabilities may share one database.
- D12: the data URL is `KEEL_POSTGRES_URL`, distinct from `KEEL_DATABASE_URL` (Keel's own state, std.db), because a deployable may keep Keel's state in `file` or `sqlite` and its app data in Postgres. They may name one database: std.db leaves other tables alone.

## Problem
Every record golden-2 keeps lives in a server store: `kitchen.box` (every recipe), `accounts.tokens` (every API token) and `accounts.profiles` (every signed-in user's id and email). A request restores each store whole from `ctx.storage` (`keel.store.<id>`, k.persist), and an action saves its snapshot whole, log included. That is sound for bounded state and wrong for records: each request reads and writes every row, any two writes to one store conflict (409), and the storage holds one value per store, so no index, query or join exists. `docs/ARCHITECTURE.md` says "no query layer"; std.db's Postgres driver writes snapshots into `keel_kv` and "App schemas never become columns".

A real app keeps its records in a database it chooses, through a library it chooses. Today nothing in the spec says how: the capability registry exists (`register`, k.ctx) and one app library already holds its own data (golden-2's sign-in library, `better-auth`, keeps users and sessions in its own `node:sqlite` file, reached through `identity.server.ts`, outside simulation, as its README says), but there is no stated stance, no name rule for an app capability, no statement of what simulation and the ledger mean once data leaves `ctx.storage`, and `keel dev` would throw E1602 when an app file that calls `register` is edited: the plugin re-evaluates the file and `@keel/ctx`'s registry still holds the earlier object.

Constraints: k.ctx's capability factories are synchronous and receive only `{ seed }` (and `plan` under sim); `register` throws E1602 for a second object under one name; `keel test` makes sim ctxs (seed 0) and `settle` runs microtask rounds with no timers (k.testing); the server's ctx takes no `signal` (k.owner).

## Proposal

### The stance (k.data Stance)
App data is the records an app keeps for its users. The kernel validates what crosses a boundary: a request by `input`, `params` and `search`, an answer by `output` (E1554). It never stores or fetches app data. The app plugs in any store through any library, reached from a capability.

### The seam (k.data The seam)
A data capability is a `register<T>` call in one app `*.server.ts` file, named `<moduleId>.<name>`, its accessor the file's one export. `T` is an interface whose values come from schemas: the real side parses what its library returns with them; the sim side is a fake that keeps k.sim's rule and starts empty per sim ctx; the shell side is the real side. Expected failures are `Result` `err`s with module codes or the kernel's `keel.notFound`, `keel.conflict`, `keel.unreachable`, so k.server's status table answers them (404, 409, 502). The module lists the name in `capabilities`.

What Keel checks: `tsc` checks the three sides and every handler against `T` (a sim side missing a member does not type-check); the boundary schemas check every request and answer at runtime; E1607 checks the name. What Keel does not check: that the real side and the fake behave alike. For std.postgres both sides are Postgres (PGlite under sim), which narrows that gap to the server version and extensions; for an app's own fake it is the app's risk, and k.data says so.

### Handlers (k.data Handlers)
A loader or action calls `<accessor>(ctx)` and returns what it read or wrote. It names no `stores` for app data. A write that must be atomic is one capability call (a database transaction). An action that both saves stores and writes app data has two commits that cannot be made one, so an action writes to one of them.

Assumption about RFC 0157 (the module contract, written concurrently): a handler is a function that receives the request's `ctx` and returns a `Result` its declared `output` schema encodes. Where 0157 binds it (a contract file, `routes.actions` or another place) changes nothing here; the samples below use today's `loader(...)` and `action(...)` and move with 0157 like every other handler.

### Keel's own state (k.data Keel's own state; k.persist Storage)
`ctx.storage` with `read` and `commit` stays exactly as specified, and k.persist's first sentence says what it is for: "`ctx.storage` keeps Keel's own state (k.data): stores' snapshots and what stdlib packages version through it, never app data." Heads, `keel.conflict` on stale snapshots, undo and the log (k.sync, k.store) cover stores; over app data an app that needs a stale-write check keeps a version column and answers `keel.conflict`.

### Simulation, replay and the ledger (k.data Simulation and evidence)
- Under sim every capability answers from its sim side, so a run and a shrunk `SimRun` read the same data again. A session replay starts each sim side empty, as it starts a missing store at `initial` (std.sessions); replaying production data was never the session's job.
- Not simulated: a library called outside a capability (an identity source's library included), or a sim side that calls a real store. Keel cannot see such a call. The spec states the cost: the run reads whatever that store holds, a shrunk `SimRun` may pass when run again, and `explore` and `prove` reach stores only.
- The ledger reads rungs from tests and claims nothing more. It cannot tell a simulated store from a real one, so k.data says what a rung means: a rung earned under sim is evidence about the code with each capability's sim side; a real side holds the rung of the tests that run it against its store. No new rung or record kind is added (principle 11: claims lag machinery).

### Dev reload (k.data Dev)
The Vite plugin already invalidates the whole server graph when a linked package changes, "so a registry and its registrations agree" (`packages/compiler/src/vite.ts`, `watchChange`). The same reload runs when the changed app file calls `register` (or `database`), found statically when the file is compiled. If `@keel/ctx` resolves outside Vite's server module graph in an installed app, the build lane makes it resolve inside it in dev (`ssr.noExternal` for `@keel/*`); the conformance case is observable either way.

### std.postgres: the battery
Package `@keel/std-postgres`, section std.postgres, codes E2451 to E2458 (block E245x, free). Entries: `@keel/std-postgres` (client-safe: `sql`, `fragment`, `NoRows`, types), `/server` (`database`), `/testing` (`ready`), `/tools` (rules).

- `database(name, { migrations })` calls `register` with a real, shell and sim side and returns the accessor; `name` follows E1607 (E2458 is the same rule, reported by the package's tools, since the kernel rule reads `register` calls only).
- `sql(schema)` makes a tag: each `${value}` is a parameter, a `fragment` is spliced with renumbered parameters, nothing else is spliced. Parameters are JSON values; a `Secret`, `undefined`, a `Date` or a non-finite number throws E2457. Rows arrive as JSON values (numbers for integer and float types, `int8` past 2^53 - 1 as text, parsed `json`, arrays, text for every other type) and are parsed with the schema, so a `Money` column pair is selected as `json_build_object(...)` and a `PlainDate` as a `date`.
- `query`, `one` (none is `keel.notFound`), `run` (count; `sql(NoRows)`), `transaction(fn, { isolation })` (rerun on serialization failure or deadlock, at most 3 runs, then `keel.conflict`, the commitStores rule).
- Errors in `Result`: `postgres.result` (a row fails its schema: paths and rules, no value), `postgres.constraint` (`{ constraint, kind }`), `keel.unreachable`, `keel.conflict`. Any other database error throws (a programming error: 500 `keel.unexpected`) with its SQLSTATE. No parameter or row value reaches an error, log line or diagnostic (k.privacy).
- Migrations: forward only, numbered from 0001 without a gap (E2453 when `database` runs), applied at a database's first query on a ctx, each in its own transaction with its `keel_migrations` row, under an advisory lock per capability; an applied file changed or gone is E2454. `create index concurrently` cannot run inside a migration's transaction; it is outside the first scope.
- Modes: `KEEL_POSTGRES_URL` `postgres:`/`postgresql:` (`pg`, a pool of 10 per URL per process, `sslmode`, idle connections let the process exit) or `pglite:<folder>` (PGlite on disk, one process; `keel dev` scripts set `pglite:.keel-dev/postgres`); missing or another scheme is E2455. Under sim: PGlite in memory, migrated, one database per sim ctx and capability, `setseed` from the capability seed, settling without a timer after `await ready()`; a plan of `{ delay, fault }` steps (`none`, `unavailable`, `conflict`) feeds `simulate`.
- W2456: `now()`, `current_timestamp`, `clock_timestamp()`, `random()` and `gen_random_uuid()` in template text or a migration do not replay under sim; the fix is a parameter from `ctx`. This is a text scan, not the deferred build-time SQL check.

Out of scope until a second store asks (D43): a store-neutral core (std.postgres' types are its own; a Mongo or SQLite battery would show what is common), a seed engine (tests insert through the capability), a build-time SQL check (queries checked against the migrated schema), row ownership (a query names its owner column itself). Also outside the first scope: `create extension` and objects outside the current schema in a migration, `listen`/`notify`, cursors and streaming rows, a query builder.

## Worked case 1: golden-2's app data on std.postgres

`modules/kitchen/migrations/0001-recipes.sql`:
```sql
create table recipes (
  id text primary key,
  title text not null,
  minutes integer not null check (minutes between 1 and 600),
  favorite boolean not null default false,
  price_amount bigint not null,
  price_currency text not null,
  added_on date not null
);
create unique index recipes_title_key on recipes (lower(title));
```

`modules/kitchen/kitchenDb.server.ts`:
```ts
import { database } from "@keel/std-postgres/server";

/** The kitchen's database: the `recipes` table, from `./migrations/`. */
export const kitchenDb = database("kitchen.db", {
  migrations: import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
});
```

`modules/kitchen/recipeColumns.ts`, one fragment every read shares, shaped as `Recipe`:
```ts
import { fragment } from "@keel/std-postgres";

export const recipeColumns = fragment`select id, title, minutes, favorite,
  json_build_object('amount', price_amount, 'currency', price_currency) as price, added_on as "addedOn" from recipes`;
```

`modules/kitchen/loadRecipes.server.ts`:
```ts
import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { Box } from "./Box.schema.ts";
import { Recipe } from "./Recipe.schema.ts";
import { currencyTally } from "./currencyTally.server.ts";
import { kitchenDb } from "./kitchenDb.server.ts";
import { recipeColumns } from "./recipeColumns.ts";

/** Every recipe, oldest first; the read is tallied by currency (`currencyTally`). */
export const loadRecipes = loader({ output: Box }, async (_at, ctx) => {
  const recipes = await kitchenDb(ctx).query(sql(Recipe)`${recipeColumns} order by added_on, id`);
  if (!recipes.ok) return recipes;
  currencyTally(ctx, recipes.value);
  return ok({ recipes: recipes.value });
});
```

`modules/kitchen/postRecipe.server.ts`: the uniqueness the store's invariant and the action's pre-check held is now the index, so two concurrent posts of one title cannot both land:
```ts
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { UTC, instantOf, plainDateOf } from "@keel/std-temporal";
import { Nothing } from "./Nothing.schema.ts";
import { RecipeDraft } from "./RecipeDraft.schema.ts";
import { kitchenDb } from "./kitchenDb.server.ts";

const taken = { code: "keel.fields", message: "Already in the box", data: { title: "Already in the box" } };

/** Adds a draft dated today in UTC; a title already in the box (ignoring case) is a `keel.fields` error on `title`. */
export const postRecipe = action({ input: RecipeDraft, output: Nothing }, async (input, _at, ctx) => {
  const now = instantOf(ctx.clock.now());
  if (!now.ok) return err(now.error);
  const added = await kitchenDb(ctx).run(sql(NoRows)`
    insert into recipes (id, title, minutes, price_amount, price_currency, added_on)
    values (${ctx.random.id("Recipe")}, ${input.title}, ${input.minutes}, ${input.price.amount},
            ${input.price.currency}, ${plainDateOf(now.value, UTC)})`);
  if (added.ok) return ok({});
  const dup = added.error.code === "postgres.constraint" && added.error.data.constraint === "recipes_title_key";
  return err(dup ? taken : added.error);
});
```

`modules/kitchen/postFavorite.server.ts`: one statement, and an unknown id is `one`'s `keel.notFound` (404):
```ts
export const postFavorite = action(
  { input: Nothing, params: RecipeRef, output: Nothing },
  async (_input, { params }, ctx) => {
    const toggled = await kitchenDb(ctx).one(
      sql(RecipeRef)`update recipes set favorite = not favorite where id = ${params.recipeId} returning id as "recipeId"`,
    );
    return toggled.ok ? ok({}) : err(toggled.error);
  },
);
```

`loadCatalog.server.ts` reads `recipeColumns` the same way and keeps `applyQuery` over the rows, so a page still holds five rows; moving the sort and filter into SQL is the app's later choice, not the seam's. `boxStores.ts`, `addRecipe.ts`, `toggleFavorite.ts` and `NewRecipe.schema.ts` go; the manifest's `capabilities` become `['clock', 'random', 'kitchen.db']` and `deps` add `@keel/std-postgres`.

`accounts`: `accountsDb` (`accounts.db`) with `0001-profiles.sql` (`user_id text primary key, email text not null`) and `0002-api-tokens.sql` (`id text primary key, digest text not null, user_id text not null`). `identity.server.ts` replaces its `commitStores` with one upsert:
```ts
const saved = await accountsDb(ctx).run(
  sql(NoRows)`insert into profiles (user_id, email) values (${id}, ${email})
              on conflict (user_id) do update set email = excluded.email`,
);
```
and `loadMe` reads `one(sql(Me)`select email from profiles where user_id = ${user}`)`, mapping `keel.notFound` to `keel.denied`. `postToken` inserts the minted `{ id, digest, userId }`. `bearerUser` needs the row for the presented token before `tokens(ctx).check(token, find)`, whose `find` is synchronous; see For the operator 1.

Tests: `vitest.config.ts` adds `setupFiles: ['test/setup.ts']`, a file holding `await ready()` (`@keel/std-postgres/testing`); each test's sim ctx starts with migrated, empty tables, and a test that needs recipes posts them through the route or inserts through `kitchenDb(ctx)`. `package.json`'s `dev` script adds `KEEL_POSTGRES_URL=pglite:.keel-dev/postgres`; `pnpm api` and the compose file need a `postgres:` URL. The W14 gate holds: no golden-2 record is in a server store.

## Worked case 2: a library with no Keel module (MongoDB)

A `notes` module keeps each user's notes in MongoDB through the official `mongodb` driver. No Keel package is involved; the app writes the seam.

`modules/notes/Note.schema.ts`:
```ts
import { s } from "@keel/schema";

export const Note = s.object(
  {
    id: s.id("Note"),
    owner: s.string({ min: 1, max: 256 }).pii("identifier"),
    text: s.string({ min: 1, max: 2000 }),
    at: s.int({ min: 0 }),
  },
  { closed: true },
);

export type Note = s.infer<typeof Note>;
```

`modules/notes/NoteStore.ts`, the contract both sides and every handler meet:
```ts
import type { KeelError, Result, SchemaError } from "@keel/schema";
import type { Note } from "./Note.schema.ts";

export interface NoteStore {
  forOwner(owner: string): Promise<Result<Note[], KeelError<"keel.unreachable", null> | SchemaError>>;
  add(note: Note): Promise<Result<null, KeelError<"keel.unreachable", null>>>;
}
```

`modules/notes/notes.server.ts`:
```ts
import { register } from "@keel/ctx";
import { attempt, err, ok } from "@keel/schema";
import type { KeelError } from "@keel/schema";
import { MongoClient } from "mongodb";
import { Note } from "./Note.schema.ts";
import type { NoteStore } from "./NoteStore.ts";

const unreachable: KeelError<"keel.unreachable", null> = {
  code: "keel.unreachable",
  message: "The notes store did not answer",
  data: null,
};

/** MongoDB through its driver; every document read is parsed with `Note`. The client connects at its first call. */
const real = (): NoteStore => {
  const url = process.env.NOTES_MONGO_URL;
  if (url === undefined) throw new Error("notes: NOTES_MONGO_URL is not set");
  const docs = new MongoClient(url).db("app").collection("notes");
  return {
    async forOwner(owner) {
      const found = await attempt(() => docs.find({ owner }, { projection: { _id: 0 } }).toArray());
      if (!found.ok) return err(unreachable);
      const notes: Note[] = [];
      for (const doc of found.value) {
        const note = Note.parse(doc);
        if (!note.ok) return err(note.error);
        notes.push(note.value);
      }
      return ok(notes);
    },
    async add(note) {
      const done = await attempt(() => docs.insertOne({ ...note }));
      return done.ok ? ok(null) : err(unreachable);
    },
  };
};

/** An in-memory fake, one per sim ctx: no clock, network or timer, so a seed replays it. */
const sim = (): NoteStore => {
  const rows: Note[] = [];
  return {
    async forOwner(owner) {
      return ok(rows.filter((n) => n.owner === owner));
    },
    async add(note) {
      rows.push(note);
      return ok(null);
    },
  };
};

export const notes = register<NoteStore>("notes.mongo", { real, shell: real, sim });
```

`modules/notes/loadNotes.server.ts`:
```ts
import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { NoteList } from "./NoteList.schema.ts";
import { notes } from "./notes.server.ts";

export const loadNotes = loader({ output: NoteList }, async ({ user }, ctx) => {
  if (user === "") return err({ code: "keel.denied", message: "Sign in first", data: null });
  const found = await notes(ctx).forOwner(user);
  return found.ok ? ok({ notes: found.value }) : err(found.error);
});
```

The module's manifest lists `capabilities: ['clock', 'random', 'notes.mongo']`. Under `keel test` the sim side answers; a `plan` schema on the `register` call would let `simulate` schedule `keel.unreachable` faults, as std.postgres does. What the ledger says of it: the handlers' rungs are evidence about them over the fake; the real side has the rung of whatever test runs it against a MongoDB, and none if none does. If `sim` returned an object without `add`, or `forOwner` returned rows typed `Document`, `tsc` refuses the `register` call: that is the type line-up D43 asks for.

## Alternatives
- **A kernel data API (`ctx.data`, a repository interface, a query builder).** Makes a library choice for every app and grows the frozen surface; D43 rules it out.
- **Drivers for app data (`createCtx({ drivers: { data } })`).** Drivers swap a kernel capability's implementation and are refused under sim (E1605); app data needs its own fake under sim, which is what a capability's sim side is.
- **Let app files register under any name, and relax E1602 to "replace".** Fixes the dev reload but drops the duplicate check for every name; the reload (D4) fixes dev without weakening it.
- **A ledger mark for tests that reach a real store.** The ledger cannot see which side ran without instrumenting every capability; a mark it cannot back is a claim ahead of machinery (principle 11).
- **Migrations read from disk at runtime (`new URL('./migrations/', import.meta.url)`).** Breaks once `server.mjs` is bundled, unless `keel build` learns to copy a stdlib package's files; the glob puts the SQL in the bundle with no kernel change.
- **std.postgres in a follow-up RFC.** Leaves this RFC's worked case unchecked against a fixed API (D9).
- **One database URL for both.** `KEEL_DATABASE_URL` is a `file:` URL under `storage: 'sqlite'` (D12).

## Spec diff
- New `spec/kernel/k.data.md` (App data, `proposed`): Stance, The seam, Handlers, Keel's own state, Simulation and evidence, Dev, Rules (E1607), Conformance (6 clauses).
- `spec/kernel/k.persist.md` Storage, first sentence: "`ctx.storage` keeps Keel's own state (k.data): stores' snapshots and what stdlib packages version through it, never app data. It holds string values by string key, ..."
- New `spec/std/std.postgres.md` (Postgres app data, `proposed`).
- `spec/00-map.md`: row `| k.data | App data | proposed | seam |`; code ranges `E160x` adds k.data, `E245x` std.postgres. `spec/std/README.md`: the std.postgres row.
- `docs/GLOSSARY.md`: **app data**.

## Conformance diff
By the `conformance-writer`, under `rfc:0158`. k.data, in `packages/ctx/conformance/` (E1607 in `packages/check/conformance/`, the dev reload in `packages/compiler/conformance/`):
- An app file at `modules/notes/notes.server.ts` calling `register('notes.mongo', ...)` is no E1607; `register('mongo', ...)`, `register('other.mongo', ...)`, `register(name, ...)` with `name` a variable, and a second file registering `notes.mongo` are each one E1607.
- A capability registered as `register<T>` whose `sim` returns an object missing a member of `T` does not typecheck.
- Under two sim ctxs of one seed, the same calls to an app-registered capability's accessor give equal answers, and a sim ctx made after another sees none of the other's writes.
- A loader whose capability answers `err` `keel.unreachable`, `keel.conflict` or `keel.notFound` is 502, 409 or 404; a value that fails the loader's `output` is E1554.
- Under `keel dev`, editing and saving `modules/notes/notes.server.ts` twice serves the next request with no E1602 and the edited code.
- `capabilities()` lists an app-registered name after its file is imported.

std.postgres, in `packages/std-postgres/conformance/` (PGlite; the Postgres 17 cases on the CI service std.db already uses): the eight clauses of the section, each checkable from its text: parameters never spliced, `fragment` renumbering; schema on every row, `one` and `run`; constraint mapping and E2457; transaction reruns; migrations once across two processes, E2453, E2454; sim isolation and plan faults; value decoding on both engines; the rule fixtures and E2455.

## Migration
Kernel: no app breaks. `register` gains a name rule for app code only (no app registers today; the golden apps and scaffold templates hold no `register` call). k.persist changes no behaviour.

golden-2 (W14 step 3): `kitchen.box`, `accounts.tokens` and `accounts.profiles` move to `kitchen.db` and `accounts.db` as in Worked case 1; data in an existing `.api.storage` is dropped (golden-2 has no production data; a real app with records in server stores would copy them with a one-off script reading the snapshots, which is outside this RFC). `docs/ARCHITECTURE.md`, the keel-data and keel-server skills and the guides follow, with this wording for ARCHITECTURE's Storage paragraph: "App data is the app's: Keel validates it at a boundary and neither stores nor fetches it. An app reaches its records through a capability it registers, or through `@keel/std-postgres` (`database`, `sql` with a schema on every statement, forward-only migrations, PGlite in dev, tests and simulation). `ctx.storage` keeps Keel's own state." The Borrow vs build row "Durable storage" becomes "Keel's own state: borrow `node:sqlite` and `pg`, build the driver contract; app data: the app's choice, with `pg` and PGlite in std-postgres".

## Token impact
- k.data: new section, 1,214 tokens of 1,500.
- std.postgres: new section, 1,496 of 1,500. Full: a later addition goes to a new section.
- k.persist: +29 tokens, 1,343 of 1,500.
- Map: +17 tokens, 1,223 of 1,250.
- Glossary: +45 tokens.
- Size budgets: none for client bundles (std-postgres is server-only, E2451/E2452); `server.mjs` grows by `pg` (already bundled for `storage: 'postgres'`) and the package. PGlite is loaded by `import()` only for a `pglite:` URL and under sim, so a `postgres:` production server never loads its WASM.

## Build order
1. This commit: RFC, ADR, spec text, glossary.
2. `conformance-writer` from k.data and std.postgres (after W13 step 2, since handlers change shape there).
3. Build (opus designs, sonnet builds): `tooling/docs-owners.json` lists k.data under `@keel/ctx` and, until the package exists, std.postgres under `@keel/std-db`; the build moves it to `@keel/std-postgres`. E1607 in `@keel/check`; the dev reload in `@keel/compiler`'s plugin; `packages/std-postgres` (new package, `tooling/deps.json` after `ctx`, dependencies `pg` and `@electric-sql/pglite` pinned); the scaffold's vitest setup and dev script.
4. golden-2 moves (W14 step 3); the example with an outside library (Worked case 2) passes `keel check` and `keel test`.

For the build lane:
- Verify PGlite's per-ctx isolation settles in microtask rounds after `ready()`. Two routes: one PGlite per process with one schema per sim ctx and capability (migrations run with that `search_path`), or a clone of a migrated data directory per ctx. Pick the one that settles without a timer and record it.
- `pg` and PGlite both get type parsers for the Values bullet (`int8` to number within 2^53 - 1, `date` and timestamps as text, `json` parsed), so the two engines return equal values.
- The server build bundles `pg`; PGlite's WASM and data files stay outside the bundle (external, resolved from `node_modules`) or are copied beside `server.mjs`; measure which `keel build` already supports.

## For the operator
1. **std.tokens `check` takes a synchronous `find`.** Moving `accounts.tokens` into the database needs the row before `check` runs. Recommendation: an additive `idOf(token): Result<string, credentials.mismatch>` in `@keel/std-tokens/server`, its own small RFC (std.tokens has no room: 5,906 of 6,000 characters), landing with W14 step 3. The alternative, an async `find`, makes `check` asynchronous for every caller.
2. **A check for records in a server store.** k.data says records that grow with use are app data, and nothing checks it. Recommendation: no rule now (schemas have no array bound to read, so a rule would guess); the W14 gate checks golden-2, and the keel-data skill teaches it. Revisit if a real app puts records in a store.
3. **The identity source's library is outside simulation.** k.data names it as data not simulated. Recommendation: leave it so; better-auth takes a Postgres adapter, and an app that wants its users in the app's database passes it std.postgres' URL, outside this RFC.
4. **A shared contract test for a fake and its real side.** An app's fake can drift from the library it stands for. Recommendation: not in 1.0's kernel; record in `tasks/FUTURE.md` a `@keel/testing` helper that runs one scenario against both sides when a URL is set, built only if a real app asks.
