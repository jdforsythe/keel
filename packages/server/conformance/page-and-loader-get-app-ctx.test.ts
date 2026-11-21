// @vitest-environment happy-dom
// Spec: k.router, clause "On the server a page component and its loader get the `createApp({ ctx })` object itself (`===`), on every request."
// Seed 1337.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, boot, getHtml } from "./contract-support.ts";

const c = contract("a", { "a.home": { path: "/" } });
const pages: Ctx[] = [];
const loaders: Ctx[] = [];
const routes = manifest(c, {
  "a.home": {
    component: (_p: unknown, ctx: Ctx): Node => {
      pages.push(ctx);
      return document.createElement("main");
    },
    loader: loader(c, "a.home", { output: s.object({}) }, async (_args, ctx) => {
      loaders.push(ctx);
      return ok({});
    }),
  },
});

describe("k.router: the server gives a page and its loader the app's ctx", () => {
  it("On the server a page component and its loader get the `createApp({ ctx })` object itself (`===`), on every request.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (requests) => {
        pages.length = 0;
        loaders.length = 0;
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const app = await boot(routes, ["a"], "node", ctx);
        for (let i = 0; i < requests; i++) {
          const before = { page: pages.length, loader: loaders.length };
          const res = await app.fetch(getHtml(`/?n=${i}`));
          expect(res.status).toBe(200);
          expect(pages.length).toBeGreaterThan(before.page);
          expect(loaders.length).toBeGreaterThan(before.loader);
        }
        for (const given of [...pages, ...loaders]) expect(given).toBe(ctx);
      }),
      { seed: SEED, numRuns: 5 },
    );
  });
});
