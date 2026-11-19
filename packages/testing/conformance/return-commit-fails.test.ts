// @vitest-environment happy-dom
// Spec: k.opening, clause "With a `ctx.storage` whose `commit` fails, the link sends nothing; a new ctx given that ctx's `keel.return` value then admits the link once."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts.
// ASSUMED: `ctx.storage` has `commit`, replaced here as the other storage tests replace `set`; the `keel.return` value is a string a second sim ctx accepts through `set`.
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count, opening } from "./link-helpers.ts";
import { SEED, closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

describe("k.opening: a take whose commit fails sends nothing and leaves keel.return as stored", () => {
  it("with a ctx.storage whose commit fails, the link sends nothing; a new ctx given that ctx's keel.return value then admits the link once", async () => {
    const first = createCtx({ mode: "sim", seed: SEED });
    const a = await openShellOver(routes, "ac.home", base, first);
    await opening(a.handle);
    const stored = await first.storage.get("keel.return");
    expect(stored).not.toBeNull();
    const fails = async (): Promise<never> => {
      throw new Error("disk full");
    };
    Object.assign(first.storage, { commit: fails });
    await a.handle.returnLink(CALLBACK);
    await ticks();
    expect(count(a.sent, CB_PATH)).toBe(0);
    expect(await first.storage.get("keel.return")).toBe(stored);
    a.handle.dispose();

    const second = createCtx({ mode: "sim", seed: SEED });
    if (stored !== null) await second.storage.set("keel.return", stored);
    const b = await openShellOver(routes, "ac.home", base, second);
    await b.handle.returnLink(CALLBACK);
    await ticks();
    await b.handle.returnLink(CALLBACK);
    await ticks();
    expect(count(b.sent, CB_PATH)).toBe(1);
    b.handle.dispose();
  });
});
