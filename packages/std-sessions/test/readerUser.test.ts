// Guard `sessions.reader` (std.sessions Ingest) admits a request whose `user` or `caller` is in `readers`; `""` never.
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";
import { reader } from "../src/routes/reader.guard.ts";

test('admits a listed user with any caller, a listed caller with any user, and nothing for `""`', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.stringMatching(/^[a-z0-9]{1,12}$/),
      fc.stringMatching(/^[A-Z0-9]{1,12}$/),
      async (user, caller) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        bindStd(ctx, { "@keel/std-sessions": { ops: { readers: [user, caller, ""] } } });
        const ok = async (u: string, c: string) => (await reader.run({ url: "/", user: u, caller: c }, ctx)).ok;
        expect(await ok(user, "other")).toBe(true);
        expect(await ok("", caller)).toBe(true);
        expect(await ok("", "")).toBe(false);
        expect(await ok("x", "Y")).toBe(false);
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});
