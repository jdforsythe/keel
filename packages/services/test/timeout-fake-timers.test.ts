import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { endpoints, service } from "../src/index.ts";

const api = service({
  base: "https://api.test",
  timeout: 1_000,
  schema: endpoints({ get: { method: "GET", path: "/", output: s.object({}) } }),
});

describe("sim timeout under vi.useFakeTimers()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("fires only when the sim clock advances, regardless of faked platform timers", async () => {
    vi.useFakeTimers();
    const ctx = createCtx({ mode: "sim" });
    let aborted = false;
    ctx.net.route("https://api.test/*", (req) => {
      req.signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise<Response>(() => {});
    });
    const pending = api.get({}, ctx);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(aborted).toBe(false);
    ctx.clock.advance(999);
    await vi.advanceTimersByTimeAsync(0);
    expect(aborted).toBe(false);
    ctx.clock.advance(1);
    expect(await pending).toEqual({ ok: false, error: expect.objectContaining({ code: "api.timeout" }) });
    expect(aborted).toBe(true);
  });
});
