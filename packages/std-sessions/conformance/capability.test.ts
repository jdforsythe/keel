// Spec: std.sessions, clause "The `session` capability has all three implementations; shell `put` returns `ok(null)` and sends nothing."
// Seed 1337
import { capabilities, createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Session } from "@keel/std-sessions";
import { session } from "@keel/std-sessions";

const sample = (): Session => ({
  v: 1,
  id: createCtx({ mode: "sim", seed: 1337 }).random.id("Session"),
  seed: 1337,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "000000000000",
});

// TODO 0092: unskip
describe.skip("std.sessions: capability", () => {
  afterEach(() => vi.unstubAllGlobals());
  test("The `session` capability has all three implementations", () => {
    expect(capabilities()).toContain("session");
    for (const mode of ["real", "shell", "sim"] as const) {
      const sink = session(createCtx({ mode, seed: 1337 }));
      expect(typeof sink.put).toBe("function");
      expect(typeof sink.taken).toBe("function");
    }
  });

  test("shell `put` returns `ok(null)` and sends nothing", async () => {
    const fetched = vi.fn(() => Promise.reject(new Error("network used")));
    vi.stubGlobal("fetch", fetched);
    const r = await session(createCtx({ mode: "shell", seed: 1337 })).put(
      new URL("https://example.test/sessions"),
      sample(),
    );
    expect(r).toEqual({ ok: true, value: null });
    expect(fetched).not.toHaveBeenCalled();
  });
});
