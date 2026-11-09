// rfc:0070: a guard's function always gets a caller string; `run({ url })` without one passes "". Seed 1337.
import { createCtx } from "@keel/ctx";
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { guard } from "../src/guard.ts";

test('run passes the caller through, and "" when a direct caller omits it', async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.option(fc.string(), { nil: undefined }), async (url, caller) => {
      const seen: { url: string; caller: string }[] = [];
      const g = guard({ redirect: "x" }, async (req) => {
        seen.push({ url: req.url, caller: req.caller });
        return ok(null);
      });
      await g.run(caller === undefined ? { url } : { url, caller }, ctx);
      expect(seen).toEqual([{ url, caller: caller ?? "" }]);
    }),
    { seed: 1337, numRuns: 50 },
  );
});
