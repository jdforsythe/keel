// @vitest-environment happy-dom
// Spec: k.topology, clause "Fixture modules `a` (its loader calls `service({ contract: b })`) and `b` (a runner), served in one process as `{ one: [a, b] }` and as `{ x: [a], y: [b] }` under sim ctxs of one seed: a generated request script through `one` and through `x` gets equal statuses, bodies and final store states."
// Seed 1337 (fc.assert below). Both topologies run under sim ctxs of seed 1337; no wall time.
import { routeTable } from "@keel/router";
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
  stateOf,
  writeArtifacts,
} from "./topology-modules.ts";
import type { Op } from "./topology-modules.ts";

const op = fc.record({
  kind: fc.constantFrom<Op["kind"]>("getA", "getB", "postA", "postB"),
  n: fc.stringMatching(/^[0-9]{1,3}$/),
});

describe("k.topology: one process and split", () => {
  test("Fixture modules `a` (its loader calls `service({ contract: b })`) and `b` (a runner), served in one process as `{ one: [a, b] }` and as `{ x: [a], y: [b] }` under sim ctxs of one seed: a generated request script through `one` and through `x` gets equal statuses, bodies and final store states.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 8 }), async (script) => {
        const { call } = bClient();
        const a = moduleA(call);
        const b = moduleB();
        const both = { runners: { b: [b.runner] } };

        const oneCtx = simCtx();
        const one = await createAppLoose({
          topology: topology({ one: { modules: ["a", "b"], adapter: "node" } }),
          deployable: "one",
          routes: routeTable(a.routes, b.routes),
          ctx: oneCtx,
          ...both,
        });

        const xCtx = simCtx();
        const yCtx = simCtx();
        const split = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
        const y = await createAppLoose({ topology: split, deployable: "y", routes: b.routes, ctx: yCtx, ...both });
        const x = await createAppLoose({
          topology: split,
          deployable: "x",
          routes: a.routes,
          ctx: xCtx,
          peers: { y },
          artifacts: writeArtifacts(b.routes),
        });
        await flush();

        for (const o of script) {
          const viaOne = await one.fetch(request(o));
          const viaX = await x.fetch(request(o));
          expect(viaX.status).toBe(viaOne.status);
          expect(await viaX.text()).toBe(await viaOne.text());
        }
        expect(await stateOf(xCtx, yCtx)).toEqual(await stateOf(oneCtx));
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
