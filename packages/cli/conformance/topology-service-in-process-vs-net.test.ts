// @vitest-environment happy-dom
// Spec: k.topology, clause "With `a` and `b` in one deployable a `service({ module: 'b' })` call makes no `ctx.net.fetch`; with `y` at `http://y.test` it makes one, to that URL."
// Seed 1337 (fc.assert below). Calls are observed on the sim net only.
import { manifest } from "@keel/router";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  SEED,
  bClient,
  createAppLoose,
  flush,
  moduleA,
  moduleB,
  request,
  simCtx,
  writeArtifacts,
} from "./topology-modules.ts";

describe("k.topology: module calls", () => {
  test("With `a` and `b` in one deployable a `service({ module: 'b' })` call makes no `ctx.net.fetch`; with `y` at `http://y.test` it makes one, to that URL.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[0-9]{1,3}$/), async (n) => {
        const { call } = bClient();
        const a = moduleA(call);
        const b = moduleB();

        const oneCtx = simCtx();
        const fetched: string[] = [];
        oneCtx.net.route("*", (req) => {
          fetched.push(req.url);
          return new Response("", { status: 500 });
        });
        const one = await createAppLoose({
          topology: topology({ one: { modules: ["a", "b"], adapter: "node" } }),
          deployable: "one",
          routes: manifest({ ...a.routes.routes, ...b.routes.routes }),
          ctx: oneCtx,
        });
        await flush();
        const here = await one.fetch(request({ kind: "getA", n }));
        expect(here.status).toBe(200);
        const hereBody: unknown = await here.json();
        expect(fetched).toEqual([]);

        const split = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
        const y = await createAppLoose({ topology: split, deployable: "y", routes: b.routes, ctx: simCtx() });
        const xCtx = simCtx();
        const urls: string[] = [];
        xCtx.net.route("http://y.test/*", (req) => {
          urls.push(req.url);
          return y.fetch(req);
        });
        const x = await createAppLoose({
          topology: split,
          deployable: "x",
          routes: a.routes,
          ctx: xCtx,
          peers: { y: "http://y.test" },
          artifacts: writeArtifacts(b.routes),
        });
        await flush();
        const there = await x.fetch(request({ kind: "getA", n }));
        expect(there.status).toBe(200);
        expect(await there.json()).toEqual(hereBody);
        expect(JSON.stringify(hereBody)).toContain(`"n":"${n}"`);
        expect(urls).toHaveLength(1);
        expect(urls[0]?.startsWith("http://y.test/")).toBe(true);
        expect(new URL(urls[0] ?? "").pathname).toBe(`/b/${n}`);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
