// Same clause as packages/std-capacitor/conformance/network-error.test.ts: Conformance "A refused connection rejects with a `TypeError`, and a k.services call over it is `api.network`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: the stand-in native side rejects `plugin:http|fetch_send` with a string, as the Rust plugin does, so the driver is what makes it a `TypeError`; the ctx is `createCtx({ mode: 'shell', drivers })` (k.persist);
// the service `base` is `origin`.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import { tauriDrivers } from "@keel/std-tauri";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { begin, end, ORIGIN, OTHER, PAGES } from "./fixtures.ts";

const run = { seed: 1337, numRuns: 100 };
const chars = fc.array(fc.constantFrom(..."abcdefgh0123456789"), { minLength: 1, maxLength: 6 }).map((c) => c.join(""));

describe("std.shells: network errors", () => {
  afterEach(end);

  test.skip("a refused connection rejects with a `TypeError`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...PAGES),
        chars,
        fc.constantFrom("page", "origin", "other"),
        async (page, p, where) => {
          const world = begin(page);
          world.refuse(true);
          const { net } = tauriDrivers({ origin: ORIGIN });
          const base = where === "page" ? page : where === "origin" ? ORIGIN.origin : OTHER;
          await expect(net.fetch(new Request(`${base}/${p}`))).rejects.toBeInstanceOf(TypeError);
          end();
        },
      ),
      run,
    );
  });

  test.skip("a k.services call over a refused connection is `api.network`", async () => {
    begin(PAGES[0]).refuse(true);
    const api = service({
      base: ORIGIN.origin,
      schema: endpoints({ ping: { method: "GET", path: "/ping", output: s.object({}) } }),
    });
    const ctx = createCtx({ mode: "shell", drivers: tauriDrivers({ origin: ORIGIN }) });
    const r = await api.ping({}, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("api.network");
  });
});
