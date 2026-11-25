// Spec: k.server-deps, the fourth Conformance clause, quoted whole:
// 4. "Under `keel dev`, with `node_modules/@acme/store` a library of `id: 'store'` whose `src/index.ts` re-exports `store` from `./store.ts`, which imports `register` from `@keel/ctx` and calls `register('store.main', ...)` inside `store`, and `modules/a/data.server.ts` importing `store` from `'@acme/store'` and calling it, editing `modules/a/data.server.ts` makes the next request run the edited code, with no E1602."
// Registration through a library: "A file registers a capability (k.data Dev) when it imports `@keel/ctx` and names `register`, or when it imports from a library (k.library) a name whose defining file in that library, followed through its re-exports, imports `@keel/ctx` and names `register`. Editing either kind of file under `keel dev` loads the server graph again whole, as k.data Dev states."
// k.data Dev: "In `keel dev`, editing an app file that registered a capability, directly or through a helper it calls, or editing that helper, loads the server graph again whole, so the next request runs the new code and the registry is empty when the file registers again: no E1602."
// Seed: 1337 (no generated input: one fixed process scenario). Binary runs: 1 (`keel dev` on a free port from a closed port-0 listener, never 8080, 5173, 5214 or 5432; the child's group is ended in `finally`).
// The library is `@acme/store` (library-support.ts `dataLibrary`, no `bin`): a made-up data battery, no stdlib package named. The project is one `node` deployable `web` serving module `a`, whose loader `a.get` (GET /api/a/one) answers `data(ctx)` of `modules/a/data.server.ts`.
// ASSUMPTIONS (spec silent): the answer is read as `data-dev-reload.test.ts` reads it (`{ results: { "a.get": { value: { title } } } }`); the edit is a change of a suffix `data.server.ts` appends to what the capability answers, written twice (as k.data's own case does);
// "no E1602" is the absence of that code in the dev process's output. UNTESTABLE as an observable: that a file registering through a library is reloaded "whole" rather than patched; the case observes the effect (the edited code runs, the registry has no duplicate).
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { setTimeout as pause } from "node:timers/promises";
import { STORE, cleanup, dataLibrary, loaderModule, materialize, serverDepsProject, write } from "./library-support.ts";
import { SLOW, freePort, startDev, stop, stopAll } from "./static-support.ts";

const CLAUSE_4 =
  "Under `keel dev`, with `node_modules/@acme/store` a library of `id: 'store'` whose `src/index.ts` re-exports `store` from `./store.ts`, which imports `register` from `@keel/ctx` and calls `register('store.main', ...)` inside `store`, and `modules/a/data.server.ts` importing `store` from `'@acme/store'` and calling it, editing `modules/a/data.server.ts` makes the next request run the edited code, with no E1602";

const DATA_FILE = "modules/a/data.server.ts";
const data = (suffix: string): string =>
  `import { store } from '${STORE}'\nconst accessor = store()\nexport const data = (ctx: Parameters<typeof accessor>[0]): string => \`\${accessor(ctx).title()}-${suffix}\`\n`;

let dir = "";
beforeAll(() => {
  dir = materialize(
    serverDepsProject({
      deployables: { web: ["a"] },
      modules: [{ id: "a", deps: [STORE], extra: loaderModule("a", data("v0")) }],
      libraries: [dataLibrary()],
    }),
  );
}, SLOW);
afterAll(() => cleanup(dir));
afterEach(async () => {
  await stopAll();
});

/** The loader's `title` from `GET /api/a/one`, or `undefined` while the server answers anything else. */
async function titleOf(port: number): Promise<string | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/a/one`, { headers: { accept: "application/json" } });
    if (res.status !== 200) return undefined;
    const body: unknown = await res.json();
    const results = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
    const entry = typeof results === "object" && results !== null ? Reflect.get(results, "a.get") : undefined;
    const value = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
    const title = typeof value === "object" && value !== null ? Reflect.get(value, "title") : undefined;
    return typeof title === "string" ? title : undefined;
  } catch {
    return undefined;
  }
}
/** Polls (bounded, fixed pause) until the loader answers `want`. */
async function until(p: { child: { exitCode: number | null } }, port: number, want: string): Promise<boolean> {
  for (let i = 0; i < 800 && p.child.exitCode === null; i++) {
    if (i > 0) await pause(50);
    if ((await titleOf(port)) === want) return true;
  }
  return false;
}

describe(`k.server-deps 4: ${CLAUSE_4}`, () => {
  test(
    "editing `modules/a/data.server.ts` twice makes each next request run the edited code, with no E1602",
    async () => {
      const port = await freePort();
      const p = startDev(dir, port);
      try {
        expect(await until(p, port, "lib-v0"), p.out()).toBe(true);
        for (const v of ["v1", "v2"]) {
          write(dir, { [DATA_FILE]: data(v) });
          expect(await until(p, port, `lib-${v}`), p.out()).toBe(true);
        }
        expect(p.child.exitCode).toBeNull();
        expect(p.out()).not.toContain("E1602");
      } finally {
        await stop(p);
      }
    },
    SLOW,
  );
});
