// Spec: k.user, Identity source "A throw is 500 `keel.unexpected` with a `diag` `identify threw: <name>` (the error's `name` only); an answer that is not a string of at most 256 characters is 500 with `identify returned: invalid`; past 5,000 ms on `ctx.clock`, 503 `keel.busy` (`data: { limit: 5000 }`). No guard, loader or action then runs."
// Spec: k.user, Conformance "`identify` throwing `TypeError('t-123')`: 500 `keel.unexpected`, a `diag` naming `TypeError` without `t-123`, no guard, loader or action called; answering `42`: 500; never settling: 503 `keel.busy` at 5,000 ms on the sim clock."
// Seed 1337 (fc.assert below). The bound is observed on the sim clock only (`ctx.clock.advance`), no timers.
// @vitest-environment node
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, answers, rig, settled } from "./identity-support.ts";

const nothingRan = (seen: Awaited<ReturnType<typeof rig>>["seen"]): void => {
  expect(seen.guard).toEqual([]);
  expect(seen.loader).toEqual([]);
  expect(seen.action).toEqual([]);
  expect(seen.api).toEqual([]);
  expect(seen.live).toEqual([]);
};

describe("k.user: identify fails closed", () => {
  test("`identify` throwing `TypeError('t-123')`: 500 `keel.unexpected`, a `diag` naming `TypeError` without `t-123`, no guard, loader or action called", async () => {
    const r = await rig({
      identify: async () => {
        throw new TypeError("t-123");
      },
      log: true,
    });
    for (const res of [await r.get("/who"), await r.post("/who"), await r.get("/api/who")]) {
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toContain("keel.unexpected");
      expect(body).not.toContain("t-123");
    }
    nothingRan(r.seen);
    expect(r.lines.join("\n")).toContain("identify threw: TypeError");
    expect(r.lines.join("\n")).not.toContain("t-123");
  });

  test("a rejection of any error name is 500 and its `diag` holds the error's `name` only, never its message, header or cookie values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Z][A-Za-z]{2,12}Error$/),
        fc.stringMatching(/^[a-z0-9]{8,16}$/),
        async (name, message) => {
          const r = await rig({
            identify: async () => {
              const e = new Error(message);
              e.name = name;
              throw e;
            },
            log: true,
          });
          const res = await r.get("/who", {
            cookie: "session=cookie-secret-77",
            authorization: "Bearer header-secret-88",
          });
          expect(res.status).toBe(500);
          const text = r.lines.join("\n");
          expect(text).toContain(`identify threw: ${name}`);
          expect(text).not.toContain(message);
          expect(text).not.toContain("cookie-secret-77");
          expect(text).not.toContain("header-secret-88");
          expect(await res.text()).not.toContain(message);
          nothingRan(r.seen);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("answering `42`: 500 with `identify returned: invalid`", async () => {
    const r = await rig({ identify: () => answers(42), log: true });
    const res = await r.get("/who");
    expect(res.status).toBe(500);
    expect(r.lines.join("\n")).toContain("identify returned: invalid");
    nothingRan(r.seen);
  });

  test("an answer that is not a string of at most 256 characters is 500 and none of guard, loader or action runs; a string of 256 is served", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constantFrom<unknown>(42, null, true, {}, [], ["u1"], { id: "u1" }),
          fc.string({ minLength: 257, maxLength: 400 }),
        ),
        async (bad) => {
          const r = await rig({ identify: () => answers(bad), log: true });
          expect((await r.get("/who")).status).toBe(500);
          expect((await r.post("/who")).status).toBe(500);
          expect(r.lines.join("\n")).toContain("identify returned: invalid");
          nothingRan(r.seen);
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
    const edge = await rig({ identify: async () => "x".repeat(256) });
    expect((await edge.get("/who")).status).toBe(200);
    expect(edge.seen.loader).toEqual(["x".repeat(256)]);
  });

  test("never settling: 503 `keel.busy` at 5,000 ms on the sim clock, with `data: { limit: 5000 }`", async () => {
    const r = await rig({ identify: () => new Promise<string>(() => undefined) });
    const pending = r.get("/who");
    expect(await settled(pending)).toBe(false);
    r.ctx.clock.advance(4_999);
    expect(await settled(pending)).toBe(false);
    r.ctx.clock.advance(1);
    expect(await settled(pending)).toBe(true);
    const res = await pending;
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).toContain("keel.busy");
    expect(body).toContain("5000");
    nothingRan(r.seen);
  });

  test("an `identify` that answers after up to 4,999 ms of the sim clock is served", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 4_999 }), async (ms) => {
        let answer: (id: string) => void = () => undefined;
        const r = await rig({
          identify: () =>
            new Promise<string>((resolve) => {
              answer = resolve;
            }),
        });
        const p = r.get("/who");
        await settled(p);
        r.ctx.clock.advance(ms);
        answer("u1");
        const res = await p;
        expect(res.status).toBe(200);
        expect(r.seen.loader).toEqual(["u1"]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
