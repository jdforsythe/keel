// Spec: std.report, clause "A dev `createApp` with `inspector({ id, schema: Tally, read })` serves `sections[id].value` equal to the tally `read` returns, and `keel report` against it prints that tally's compact line."
// @vitest-environment happy-dom
// Seed 1337. The inspector registry is process-global: every run uses a unique id.
// Needs `@keel/compiler`, `@keel/ctx`, `@keel/router` and `@keel/server` as devDependencies of @keel/std-report.
import { run } from "@keel/cli";
import { inspector } from "@keel/compiler/inspect/inspector";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { Tally, tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";

const BASE = "http://localhost";
const keys = fc.array(fc.stringMatching(/^[a-z]{0,4}$/), { maxLength: 20 });
let seq = 0;

test("A dev `createApp` with `inspector({ id, schema: Tally, read })` serves `sections[id].value` equal to the tally `read` returns, and `keel report` against it prints that tally's compact line.", async () => {
  const appContract = contract("app", { "app.home": { path: "/" } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: () => document.createElement("main") } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
  });
  await fc.assert(
    fc.asyncProperty(keys, async (ks) => {
      const id = `orders.status${++seq}`;
      const tally = tallyOf(id, ks);
      inspector({ id, schema: Tally, read: () => tally });
      const res = await app.fetch(new Request(`${BASE}/__keel/inspect`));
      expect(res.status).toBe(200);
      const body: unknown = await res.json();
      const section = Object(Reflect.get(Object(Reflect.get(Object(body), "sections")), id));
      expect(section.value).toEqual(tally);
      const r = await run(["report", BASE, "--format=compact"], {
        cwd: "/work/app",
        files: [],
        fetch: (url: string): Promise<Response> => Promise.resolve(app.fetch(new Request(url))),
      });
      expect(r.code).toBe(0);
      const line = tally.rows.length === 0 ? `${id} 0` : [id, ...tally.rows.map((x) => `${x.key}=${x.n}`)].join(" ");
      expect(r.stdout.split("\n")).toContain(line);
    }),
    { seed: 1337, numRuns: 10 },
  );
});
