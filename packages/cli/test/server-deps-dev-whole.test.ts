// k.server-deps Registration through a library: under `keel dev`, an edit that adds an import of a registering library
// export to a file that held none loads the server graph again whole, so module state another server file holds starts
// again. Seed 1337 (no generated input: one process scenario). One `keel dev` on a free port, ended in `finally`.
import { setTimeout as pause } from "node:timers/promises";
import { afterAll, describe, expect, test } from "vitest";
import {
  STORE,
  cleanup,
  dataLibrary,
  loaderModule,
  materialize,
  serverDepsProject,
  write,
} from "../conformance/library-support.ts";
import { SLOW, freePort, startDev, stop } from "../conformance/static-support.ts";

const COUNT = "let n = 0\nexport const next = (): number => {\n  n += 1\n  return n\n}\n";
const PLAIN = "export const data = (_ctx: unknown): string => 'plain'\n";
const LIB = `import { store } from '${STORE}'\nconst accessor = store()\nexport const data = (ctx: Parameters<typeof accessor>[0]): string => accessor(ctx).title()\n`;
// The loader answers `<data>-<count>`: `count.server.ts` is imported by `get.server.ts` beside `data.server.ts`.
const GET =
  "import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { a } from './a.contract.ts'\nimport { next } from './count.server.ts'\nimport { data } from './data.server.ts'\nexport const get = loader(a, 'a.get', {}, (_args, ctx) => Promise.resolve(ok({ title: `${data(ctx)}-${next()}` })))\n";

let dir = "";
afterAll(() => cleanup(dir));

async function titleOf(port: number): Promise<string | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/a/one`, { headers: { accept: "application/json" } });
    const body: unknown = res.status === 200 ? await res.json() : undefined;
    const results = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
    const entry = typeof results === "object" && results !== null ? Reflect.get(results, "a.get") : undefined;
    const value = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
    const title = typeof value === "object" && value !== null ? Reflect.get(value, "title") : undefined;
    return typeof title === "string" ? title : undefined;
  } catch {
    return undefined;
  }
}

describe("k.server-deps Registration through a library, under keel dev", () => {
  test(
    "after requests answered 1 and 2, adding the import of `store` to `data.server.ts` makes the next request answer 1",
    async () => {
      const extra = { ...loaderModule("a", PLAIN), "modules/a/get.server.ts": GET, "modules/a/count.server.ts": COUNT };
      dir = materialize(
        serverDepsProject({
          deployables: { web: ["a"] },
          modules: [{ id: "a", deps: [STORE], extra }],
          libraries: [dataLibrary()],
        }),
      );
      const port = await freePort();
      const p = startDev(dir, port);
      try {
        let first: string | undefined;
        for (let i = 0; i < 800 && first === undefined && p.child.exitCode === null; i++) {
          if (i > 0) await pause(50);
          first = await titleOf(port);
        }
        expect(first, p.out()).toBe("plain-1");
        expect(await titleOf(port)).toBe("plain-2");
        write(dir, { "modules/a/data.server.ts": LIB });
        let next: string | undefined;
        for (let i = 0; i < 800 && p.child.exitCode === null; i++) {
          await pause(50);
          next = await titleOf(port);
          if (next?.startsWith("lib-")) break;
        }
        expect(next, p.out()).toBe("lib-1");
        expect(p.out()).not.toContain("E1602");
      } finally {
        await stop(p);
      }
    },
    SLOW,
  );
});
