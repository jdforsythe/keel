// @vitest-environment happy-dom
// Spec: k.head, clause "After a push or replace to another route scroll is 0, after a search-only one it is unchanged; back and forward restore each entry's position, also for two entries with one URL." (scroll is saved per router-minted history key) Seed 1337.
// Relies on happy-dom window.scrollTo updating window.scrollY.
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appContract, now, resetObservations, SEED, settle, start, submit } from "./fixtures.ts";

describe("k.router scroll and focus", () => {
  beforeEach(resetObservations);
  it("after a push to another route the scroll position is 0", async () => {
    const app = await start("/", { render: true });
    window.scrollTo(0, 300);
    await app.router.navigate(appContract.href("app.ordersList"));
    await settle();
    expect(window.scrollY).toBe(0);
    app.stop();
  });
  it("after a search-only push the scroll position is unchanged", async () => {
    const app = await start("/orders", { render: true });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 0, max: 1000 }), async (y, page) => {
        window.scrollTo(0, y);
        await app.router.navigate(appContract.href("app.ordersList", {}, { page }));
        await settle();
        expect(now(app.router)).toMatchObject({ id: "app.ordersList", search: { page } });
        expect(window.scrollY).toBe(y);
      }),
      { seed: SEED, numRuns: 25 },
    );
    app.stop();
  });
  it("after a replace to another route the scroll position is 0", async () => {
    const app = await start("/", { render: true });
    window.scrollTo(0, 300);
    await app.router.navigate(appContract.href("app.ordersList"), { replace: true });
    await settle();
    expect(window.scrollY).toBe(0);
    app.stop();
  });
  it("after a search-only replace the scroll position is unchanged", async () => {
    const app = await start("/orders", { render: true });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 0, max: 1000 }), async (y, page) => {
        window.scrollTo(0, y);
        await app.router.navigate(appContract.href("app.ordersList", {}, { page }), { replace: true });
        await settle();
        expect(now(app.router)).toMatchObject({ id: "app.ordersList", search: { page } });
        expect(window.scrollY).toBe(y);
      }),
      { seed: SEED, numRuns: 25 },
    );
    app.stop();
  });
  it("back restores the previous entry's scroll position", async () => {
    const app = await start("/", { render: true });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), async (y) => {
        await app.router.navigate(appContract.href("app.ordersList"));
        await settle();
        window.scrollTo(0, y);
        await app.router.navigate(appContract.href("app.ordersNew"));
        await settle();
        expect(window.scrollY).toBe(0);
        app.history.back();
        await settle();
        expect(now(app.router)).toMatchObject({ id: "app.ordersList" });
        expect(window.scrollY).toBe(y);
      }),
      { seed: SEED, numRuns: 25 },
    );
    app.stop();
  });
  describe("per-entry scroll", () => {
    let y = 0;
    const original = Object.getOwnPropertyDescriptor(window, "scrollY");
    beforeEach(() => {
      y = 0;
      vi.spyOn(window, "scrollTo").mockImplementation((...args: unknown[]) => {
        const v = args.length >= 2 ? args[1] : undefined;
        if (typeof v === "number") y = v;
        else if (typeof args[0] === "object" && args[0] !== null && "top" in args[0]) {
          const top = args[0].top;
          if (typeof top === "number") y = top;
        }
      });
      Object.defineProperty(window, "scrollY", { get: () => y, configurable: true });
    });
    afterEach(() => {
      vi.restoreAllMocks();
      if (original !== undefined) Object.defineProperty(window, "scrollY", original);
      else Reflect.deleteProperty(window, "scrollY");
    });
    it("back and forward restore each entry's own position, also for two entries with one URL", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 1, max: 5000 }),
            fc.integer({ min: 1, max: 5000 }),
            fc.integer({ min: 1, max: 5000 }),
          ),
          async ([a1, b1, a2]) => {
            const app = await start("/", { render: true });
            const go = async (to: Parameters<typeof app.router.navigate>[0], leaveAt: number): Promise<void> => {
              window.scrollTo(0, leaveAt);
              await app.router.navigate(to);
              await settle();
            };
            const A = appContract.href("app.ordersList");
            const B = appContract.href("app.ordersNew");
            await go(A, 11); // "/" left at 11
            await go(B, a1); // A left at a1
            await go(A, b1); // B left at b1
            await go(B, a2); // second A left at a2
            expect(y).toBe(0);
            app.history.back();
            await settle();
            expect(now(app.router)).toMatchObject({ id: "app.ordersList" });
            expect(y).toBe(a2);
            app.history.back();
            await settle();
            expect(now(app.router)).toMatchObject({ id: "app.ordersNew" });
            expect(y).toBe(b1);
            app.history.back();
            await settle();
            expect(now(app.router)).toMatchObject({ id: "app.ordersList" });
            expect(y).toBe(a1);
            app.history.forward();
            await settle();
            expect(now(app.router)).toMatchObject({ id: "app.ordersNew" });
            expect(y).toBe(b1);
            app.history.forward();
            await settle();
            expect(now(app.router)).toMatchObject({ id: "app.ordersList" });
            expect(y).toBe(a2);
            app.stop();
          },
        ),
        { seed: SEED, numRuns: 10 },
      );
    });
  });
  it("revalidation changes neither scroll nor focus", async () => {
    const app = await start("/orders/7", { render: true });
    const input = app.host.querySelector("#note");
    if (!(input instanceof HTMLElement)) throw new Error("fixture: note input missing");
    input.focus();
    window.scrollTo(0, 77);
    await submit(app.host);
    expect(document.activeElement).toBe(input);
    expect(window.scrollY).toBe(77);
    app.stop();
  });
});
