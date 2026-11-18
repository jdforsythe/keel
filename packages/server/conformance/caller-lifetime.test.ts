// Spec: k.user, Caller lifetime "The caller cookie has no `Max-Age` by default: a browser quit or a shell restart is a new caller. A `node` deployable may set `caller: { days }` in `topology.ts` (an integer 1 to 400): a caller cookie it mints carries `Max-Age=<days × 86,400>`, from that write, never extended. It is still not a credential."
// Spec: k.user, Conformance "A caller cookie minted with no `caller` option has no `Max-Age`; with `caller: { days: 30 }`, `Max-Age=2592000`, and a request presenting it gets no new caller cookie."
// Seed 1337 (fc.assert below). Runs under plain Node: happy-dom strips cookie headers. Over http the name is `keel-caller`.
// A `client` deployable's refusal of `caller` is a check rule: packages/check/conformance/caller-days-e1578.test.ts.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, cookieOf, rig } from "./identity-support.ts";

const maxAge = (cookie: string | undefined): string | undefined => /;\s*max-age=(\d+)/i.exec(cookie ?? "")?.[1];

describe("k.user: caller lifetime", () => {
  test("A caller cookie minted with no `caller` option has no `Max-Age` and no `Expires`", async () => {
    const r = await rig();
    const minted = cookieOf(await r.post("/who"), "keel-caller");
    expect(minted).toBeDefined();
    expect(minted).not.toMatch(/max-age/i);
    expect(minted).not.toMatch(/expires/i);
  });

  test("with `caller: { days: 30 }`, a minted caller cookie has `Max-Age=2592000`, and a request presenting it gets no new caller cookie", async () => {
    const r = await rig({ days: 30 });
    const minted = cookieOf(await r.post("/who"), "keel-caller");
    expect(maxAge(minted)).toBe("2592000");
    const cookie = minted?.split(";")[0] ?? "";
    for (const res of [await r.get("/who", { cookie }), await r.post("/who", {}, { cookie })]) {
      expect(cookieOf(res, "keel-caller")).toBeUndefined();
    }
  });

  test("`caller: { days }` for an integer 1 to 400 carries `Max-Age=<days × 86,400>` from that write", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 400 }), async (days) => {
        const r = await rig({ days });
        expect(maxAge(cookieOf(await r.post("/who"), "keel-caller"))).toBe(String(days * 86_400));
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("the `Max-Age` counts from that write and is never extended by a later request", async () => {
    const r = await rig({ days: 1 });
    const minted = cookieOf(await r.post("/who"), "keel-caller");
    const cookie = minted?.split(";")[0] ?? "";
    r.ctx.clock.advance(3_600_000);
    const later = await r.post("/who", {}, { cookie });
    expect(cookieOf(later, "keel-caller")).toBeUndefined();
    expect(later.headers.getSetCookie()).toEqual([]);
  });

  test("the persistent caller is still not a credential: `user` is the answer of `identify` whatever caller the request presents", async () => {
    const r = await rig({ days: 30, identify: async () => "" });
    const cookie = cookieOf(await r.post("/who"), "keel-caller")?.split(";")[0] ?? "";
    await r.get("/who", { cookie });
    expect(r.seen.loader.at(-1)).toBe("");
    expect(r.seen.guard.at(-1)).toBe("");
  });
});
