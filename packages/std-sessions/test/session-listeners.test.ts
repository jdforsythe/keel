// The `session` capability's real and shell sinks hold no window listener of their own. Seed 1337
import { createCtx } from "@keel/ctx";
import { afterEach, expect, test, vi } from "vitest";
import { session } from "../src/index.ts";

afterEach(() => vi.unstubAllGlobals());

test.each(["real", "shell"] as const)(
  "a %s sink leaves only the app ctx's listeners, and those go with its dispose",
  (mode) => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, removeEventListener });
    vi.stubGlobal("navigator", { onLine: true });
    const ctx = createCtx({ mode, seed: 1337 });
    const sink = session(ctx);
    expect(sink.id()).toMatch(/^[0-9a-f-]{36}$/);
    expect(addEventListener.mock.calls.length - removeEventListener.mock.calls.length).toBe(2);
    ctx.dispose();
    expect(addEventListener.mock.calls.length - removeEventListener.mock.calls.length).toBe(0);
  },
);
