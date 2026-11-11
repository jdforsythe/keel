// @vitest-environment happy-dom
// `service({ module })` in a browser (k.hosting Peers): a module the client entry bound to another origin is called
// there with `credentials: "include"`; one bound to the document's origin, or an unbound ctx, calls the document's
// origin without it. Seed 1337; sim ctx and net.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { MODULES_KEY } from "../src/internal/MODULES_KEY.ts";
import { service } from "../src/service.ts";

const SEED = 1337;
const schema = endpoints({ get: { method: "GET", path: "/api/x", output: s.json() } });
const bind = (ctx: object, map: Map<string, string>): void => {
  const found: unknown = Reflect.get(globalThis, MODULES_KEY);
  const table = found instanceof WeakMap ? found : new WeakMap<object, Map<string, string>>();
  Reflect.set(globalThis, MODULES_KEY, table);
  table.set(ctx, map);
};

describe("module calls in a browser", () => {
  test("another origin gets credentials include; the document's origin keeps the default", async () => {
    const here = location.origin;
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("https://api.test", "http://api.test:8080", here.replace(/^http:/, "https:"), `${here}1`),
        async (peer) => {
          const ctx = createCtx({ mode: "sim", seed: SEED });
          const sent: Request[] = [];
          ctx.net.route("*", (req) => {
            sent.push(req);
            return Response.json({});
          });
          bind(
            ctx,
            new Map([
              ["api", peer],
              ["own", here],
            ]),
          );
          await service({ module: "api", schema }).get({}, ctx);
          await service({ module: "own", schema }).get({}, ctx);
          expect(sent.map((r) => [r.url, r.credentials])).toEqual([
            [`${peer}/api/x`, "include"],
            [`${here}/api/x`, "same-origin"],
          ]);
        },
      ),
      { seed: SEED, numRuns: 3 },
    );
  });

  test("an unbound ctx calls the document's origin", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const sent: Request[] = [];
    ctx.net.route("*", (req) => {
      sent.push(req);
      return Response.json({});
    });
    await service({ module: "api", schema }).get({}, ctx);
    expect(sent.map((r) => [r.url, r.credentials])).toEqual([[`${location.origin}/api/x`, "same-origin"]]);
  });
});
