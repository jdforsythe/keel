// @vitest-environment node
// `keelOrigin` (k.services Encoding): a `base` origin is a Keel origin only when a URL the binding of `ctx` holds has
// that origin (path and case of the host aside); any other origin, and a ctx nothing bound, is a third party. Seed 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MODULES_KEY } from "../src/internal/MODULES_KEY.ts";
import { keelOrigin } from "../src/internal/keelOrigin.ts";

const host = fc.stringMatching(/^[a-z][a-z0-9]{0,8}\.test$/);
const seg = fc.stringMatching(/^[a-z0-9]{0,6}$/);

function bind(ctx: object, urls: readonly string[]): void {
  const found: unknown = Reflect.get(globalThis, MODULES_KEY);
  const table = found instanceof WeakMap ? found : new WeakMap<object, Map<string, unknown>>();
  Reflect.set(globalThis, MODULES_KEY, table);
  table.set(ctx, new Map(urls.map((u, i) => [`m${i}`, u])));
}

describe("keelOrigin", () => {
  test("a bound peer's origin is Keel, whatever the path; another origin is not", () => {
    fc.assert(
      fc.property(host, host, seg, (peer, other, p) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        bind(ctx, [`https://${peer}/`]);
        expect(keelOrigin(ctx, `https://${peer.toUpperCase()}/${p}`)).toBe(true);
        expect(keelOrigin(ctx, `http://${peer}/${p}`)).toBe(false);
        expect(keelOrigin(ctx, `https://${other}/${p}`)).toBe(other === peer);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  test("a ctx nothing bound, outside a browser, calls only third parties", () => {
    fc.assert(
      fc.property(host, seg, (h, p) => {
        expect(keelOrigin(createCtx({ mode: "sim", seed: 1337 }), `https://${h}/${p}`)).toBe(false);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
