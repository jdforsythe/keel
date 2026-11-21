// @vitest-environment happy-dom
// `record` lifetime: the recorder outlives the component that called it, `stop()` ends it, a later `record` starts a
// fresh one, and a failed upload is recorded as `sessions.putFailed`, never an unhandled rejection. Seed 1337.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { afterEach, describe, expect, test, vi } from "vitest";
import { record } from "../src/index.ts";
import type { Recorder } from "../src/index.ts";

const nav = (ctx: Ctx): void =>
  report(ctx, {
    kind: "nav",
    href: "/memo",
    route: { id: "memo.edit", path: "/memo", params: {}, search: {}, schemas: {} },
  });
const fail = (ctx: Ctx, message: string): void =>
  report(ctx, { kind: "error", error: { code: "memo.failed", message, data: null } });

/** Every recorder a test started; `afterEach` stops them, so none outlives its test. */
const started: Recorder[] = [];

/** `record` called from inside a component's scope, which is then disposed, as a bound component's unmount does. */
function fromComponent(ctx: Ctx, upload?: URL): Recorder {
  const out: Recorder[] = [];
  const component = scope(() => void out.push(record(ctx, upload === undefined ? {} : { upload })));
  component.dispose();
  const [rec] = out;
  if (rec === undefined) throw new Error("record returned nothing");
  started.push(rec);
  return rec;
}

const counter = (() => {
  const made: { add?: () => void } = {};
  scope(() => {
    const st = store(s.object({ n: s.int() }), { n: 0 }, { id: "lifetime" });
    const inc = transaction(st, "lifetime.inc", s.object({}), (v) => ({ n: v.n + 1 }));
    made.add = () => void tx(inc, {});
  });
  return () => made.add?.();
})();

afterEach(() => {
  for (const rec of started.splice(0)) rec.stop();
  vi.unstubAllGlobals();
});

describe("record lifetime", () => {
  test("recording continues after the component that started it is disposed", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    nav(ctx);
    const rec = fromComponent(ctx);
    counter();
    fail(ctx, "after unmount");
    expect(rec.events().map((e) => e.kind)).toEqual(["tx", "error"]);
    expect(rec.errors().map((e) => e.message)).toEqual(["after unmount"]);
    expect(record(ctx)).toBe(rec);
    rec.stop();
  });

  test("stop() ends the recorder and a later record starts a fresh one", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    nav(ctx);
    const first = fromComponent(ctx);
    counter();
    const done = first.stop();
    expect(done.events.map((e) => e.kind)).toEqual(["tx"]);
    counter();
    expect(first.events()).toHaveLength(1);
    const second = record(ctx);
    started.push(second);
    expect(second).not.toBe(first);
    expect(second.events()).toEqual([]);
    counter();
    expect(second.events().map((e) => e.kind)).toEqual(["tx"]);
    second.stop();
  });

  test("an upload that fails after the component is disposed is recorded as sessions.putFailed", async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown): void => void rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
      const ctx = createCtx({ mode: "real" });
      nav(ctx);
      const rec = fromComponent(ctx, new URL("/sessions", location.origin));
      fail(ctx, "boom");
      await vi.waitFor(() => expect(rec.errors().map((e) => e.code)).toEqual(["memo.failed", "sessions.putFailed"]));
      expect(rec.errors()[1]?.data).toEqual({ status: 500 });
      rec.stop();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  test("a rejected fetch is recorded as sessions.putFailed with status 0", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network down");
    });
    const ctx = createCtx({ mode: "real" });
    nav(ctx);
    const rec = fromComponent(ctx, new URL("/sessions", location.origin));
    fail(ctx, "boom");
    await vi.waitFor(() => expect(rec.errors().map((e) => e.code)).toContain("sessions.putFailed"));
    expect(rec.errors()[1]?.data).toEqual({ status: 0 });
    rec.stop();
  });

  test("an error reported before record, after the current nav, reaches the late recorder", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    nav(ctx);
    fail(ctx, "first load");
    const rec = record(ctx);
    started.push(rec);
    expect(rec.events().map((e) => e.kind)).toEqual(["error"]);
    expect(rec.stop().error?.message).toBe("first load");
  });
});
