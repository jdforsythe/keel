// k.defects, k.identity: `openHeld` given any value that is not a ctx, a state request or a stores factory raises a
// defect before any work starts, so the caller sees it and no promise is left to reject unread.
// Seed: 1337 (opts in kit.ts).
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isDefect } from "@keel/schema";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openHeld } from "../src/internal/index.ts";
import { opts } from "./kit.ts";

const unread: unknown[] = [];
const note = (e: unknown): void => {
  unread.push(e);
};
beforeEach(() => {
  unread.length = 0;
  process.on("unhandledRejection", note);
});
afterEach(() => {
  process.off("unhandledRejection", note);
});

const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

/** Call `openHeld` with untyped arguments, as code outside the type checker does. */
const call = (args: readonly unknown[]): unknown => {
  try {
    const r: unknown = Reflect.apply(openHeld, undefined, args);
    return r instanceof Promise ? "promise" : r;
  } catch (e) {
    return e;
  }
};

describe("openHeld refuses what it was not given to open", () => {
  it("any non-request, non-ctx or non-factory argument: a defect, thrown at the call, and no unhandled rejection", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const rq = { scope: scope(() => undefined, { detached: true }), held: new Map() };
    const factory = () => ({});
    const wrong = fc.anything().filter((v) => typeof v !== "function");
    const wrongObject = fc.oneof(wrong, fc.record({ held: wrong, scope: wrong }), fc.record({ storage: wrong }));
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 2 }), wrongObject, async (slot, bad) => {
        const args: unknown[] = [ctx, rq, factory];
        args[slot] = bad;
        const out = call(args);
        await settle();
        expect(isDefect(out)).toBe(true);
        expect(unread).toEqual([]);
      }),
      opts,
    );
    rq.scope.dispose();
  });

  it("the right arguments open: a promise, no defect", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const rq = { scope: scope(() => undefined, { detached: true }), held: new Map() };
    expect(call([ctx, rq, () => ({})])).toBe("promise");
    await settle();
    expect(unread).toEqual([]);
    rq.scope.dispose();
  });
});
