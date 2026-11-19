// @vitest-environment happy-dom
// Spec: k.return, Opening and Conformance bullets 4 to 6 (deadline, one opening per link, a mount answer to the shell's own scheme).
// Seed 1337 (fc.assert below; the sim ctx's seed is 1337). The sim clock starts at 0 and moves only through `advance` (k.sim).
// ASSUMED: `ctx.clock.advance(ms)` may return a promise or nothing (awaited either way).
// ASSUMED: the `keel.return` value is a string in `ctx.storage` that a second sim ctx accepts through `set`, read after the opening and before any link.
// ASSUMED: the link's own GET is answered 303 to the home page (`sessionAnswer`), so it opens nothing.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCHEME,
  SEED,
  START,
  beginOpening,
  closeAll,
  openShell,
  redirect,
  returned,
  sessionAnswer,
  ticks,
} from "./return-support.ts";

afterEach(closeAll);

const CALLBACK = `${SCHEME}:/api/auth/callback?code=c`;
const DEADLINE = 600000;

describe("k.return: an opening admits one return link until its deadline", () => {
  it("a link 599999 ms after the opening (sim clock) sends the GET", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const { handle, sent } = await openShell("mt.home", sessionAnswer, ctx);
    await beginOpening(handle);
    await ctx.clock.advance(DEADLINE - 1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(returned(sent).map((r) => r.url)).toEqual(["/api/auth/callback?code=c"]);
    handle.dispose();
  });

  it("a link 600000 ms after the opening (sim clock) sends nothing", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const { handle, sent } = await openShell("mt.home", sessionAnswer, ctx);
    await beginOpening(handle);
    await ctx.clock.advance(DEADLINE);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(returned(sent)).toEqual([]);
    expect(handle.route().id).toBe("mt.home");
    handle.dispose();
  });

  it("for any delay, a link is admitted exactly when the delay is under 600000 ms", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 2 * DEADLINE }), async (delay) => {
        closeAll();
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const { handle, sent } = await openShell("mt.home", sessionAnswer, ctx);
        await beginOpening(handle);
        await ctx.clock.advance(delay);
        await handle.returnLink(CALLBACK);
        await ticks();
        expect(returned(sent)).toHaveLength(delay < DEADLINE ? 1 : 0);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("after two openings, two links send one GET", async () => {
    const { handle, sent } = await openShell("mt.home", sessionAnswer);
    await beginOpening(handle);
    await beginOpening(handle);
    expect(sent.filter((r) => r.url === START)).toHaveLength(2);
    await handle.returnLink(CALLBACK);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(returned(sent)).toHaveLength(1);
    handle.dispose();
  });

  it("a new ctx given the first ctx's keel.return value admits the link once", async () => {
    const first = createCtx({ mode: "sim", seed: SEED });
    const a = await openShell("mt.home", sessionAnswer, first);
    await beginOpening(a.handle);
    const stored = await first.storage.get("keel.return");
    expect(stored).not.toBeNull();
    a.handle.dispose();

    const second = createCtx({ mode: "sim", seed: SEED });
    if (stored !== null) await second.storage.set("keel.return", stored);
    const b = await openShell("mt.home", sessionAnswer, second);
    await b.handle.returnLink(CALLBACK);
    await ticks();
    await b.handle.returnLink(CALLBACK);
    await ticks();
    expect(b.sent.map((r) => r.url)).toEqual(["/api/auth/callback?code=c"]);
    b.handle.dispose();
  });

  it("a mount answer 302 to dev.keel.golden2:/api/auth/x, with no opening, sends a second net GET of /api/auth/x", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) =>
      i === 0 ? redirect(302, `${SCHEME}:/api/auth/x`) : redirect(303, "/"),
    );
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ["GET", START],
      ["GET", "/api/auth/x"],
    ]);
    expect(sent[1]?.headers["x-keel"]).toBe("1");
    expect(handle.documents()).toEqual([]);
    handle.dispose();
  });

  it("a mount answer to the shell's own scheme records no opening, so a later link sends nothing", async () => {
    const { handle, sent } = await openShell("mt.home", (_s, i) =>
      i === 0 ? redirect(302, `${SCHEME}:/api/auth/x`) : redirect(303, "/"),
    );
    await handle.fire("mt.home.github", { type: "click" });
    await ticks();
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(sent).toHaveLength(2);
    handle.dispose();
  });

  it("over any sequence of openings and links, GETs sent never exceed openings and none is sent without a pending opening", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }), async (ops) => {
        closeAll();
        const { handle, sent } = await openShell("mt.home", sessionAnswer);
        let pending = false;
        let openings = 0;
        let expected = 0;
        for (const open of ops) {
          if (open) {
            await beginOpening(handle);
            pending = true;
            openings += 1;
          } else {
            await handle.returnLink(`${SCHEME}:/api/auth/cb${sent.length}?code=c`);
            await ticks();
            if (pending) expected += 1;
            pending = false;
          }
          expect(returned(sent)).toHaveLength(expected);
          expect(expected).toBeLessThanOrEqual(openings);
        }
        handle.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
