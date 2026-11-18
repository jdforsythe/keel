// `user` (k.user) reaches guards, loaders and actions; a direct `run` that leaves it out gives `""`. Seed 1337.
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { action } from "../src/action.ts";
import { guard } from "../src/guard.ts";
import { runGuard } from "../src/internal/runGuard.ts";
import { loader } from "../src/loader.ts";

const ctx = createCtx({ mode: "sim", seed: 1337 });

describe("user", () => {
  it("runGuard, a loader's run and live and an action's run hand `user` to fn as given", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 40 }), async (user) => {
        const seen: string[] = [];
        const g = guard({ redirect: "x" }, async (req) => {
          seen.push(req.user);
          return ok(null);
        });
        await runGuard(g, "/u", ctx, { caller: "c", user });
        const l = loader({ output: s.object({}) }, async (a) => {
          seen.push(a.user);
          return ok({});
        });
        await l.run({ params: undefined, search: undefined, url: "/u", caller: "", user, stores: undefined }, ctx);
        const a = action({ input: s.object({}) }, async (_i, at) => {
          seen.push(at.user);
          return ok(null);
        });
        await a.run({}, { params: undefined, url: "/u", caller: "", user, stores: undefined }, ctx);
        expect(seen).toEqual([user, user, user]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it('a direct call without `user` gives fn `""`', async () => {
    const seen: string[] = [];
    const g = guard({}, async (req) => {
      seen.push(req.user);
      return ok(null);
    });
    await g.run({ url: "/u" }, ctx);
    const l = loader({ output: s.object({}) }, async function* (a) {
      seen.push(a.user);
      yield ok({});
    });
    for await (const _ of l.live?.(
      {
        params: undefined,
        search: undefined,
        url: "/u",
        caller: "",
        stores: undefined,
        signal: new AbortController().signal,
      },
      ctx,
    ) ?? [])
      break;
    const a = action({ input: s.object({}), output: s.object({}) }, async (_i, at) => {
      seen.push(at.user);
      return ok({});
    });
    await a.run({}, { params: undefined, url: "/u", caller: "", stores: undefined }, ctx);
    expect(seen).toEqual(["", "", ""]);
  });
});
