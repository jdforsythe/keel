// `createApp({ maxStreams })` is an integer of at least 1; anything else rejects at startup with E1560.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const app = (maxStreams: number) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({ "app.home": { path: "/", component: () => document.createElement("p") } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    maxStreams,
  });

const bad = fc.oneof(
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0),
  fc.integer({ max: -1 }),
  fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Number.isInteger(n)),
);

describe("createApp maxStreams", () => {
  it("rejects a value that is not an integer of at least 1 with E1560", async () => {
    await fc.assert(
      fc.asyncProperty(bad, async (n) => {
        await expect(app(n)).rejects.toMatchObject({
          code: "E1560",
          message: expect.stringMatching(/^E1560 maxStreams: /),
        });
      }),
      { seed: 1337 },
    );
  });

  it("accepts an integer of at least 1", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100_000 }), async (n) => {
        await expect(app(n)).resolves.toBeDefined();
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
