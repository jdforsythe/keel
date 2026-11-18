// The `session` capability's real and shell sinks hold no window listener of their own. Seed 1337
import { createCtx } from "@keel/ctx";
import { afterEach, expect, test, vi } from "vitest";
import { session } from "../src/index.ts";

afterEach(() => vi.unstubAllGlobals());

test.each(["real", "shell"] as const)(
  "a %s sink adds no window listener: only the app ctx's two are live, and those end with its signal",
  (mode) => {
    const live = new Set<string>();
    let next = 0;
    const addEventListener = vi.fn((type: string, _fn: unknown, options?: AddEventListenerOptions) => {
      const signal = options?.signal;
      if (signal?.aborted === true) return;
      const key = `${type}:${next++}`;
      live.add(key);
      signal?.addEventListener("abort", () => live.delete(key), { once: true });
    });
    vi.stubGlobal("window", { addEventListener, removeEventListener: vi.fn() });
    vi.stubGlobal("navigator", { onLine: true });
    const owner = new AbortController();
    const ctx = createCtx({ mode, seed: 1337, signal: owner.signal });
    expect(live.size).toBe(2);
    const sink = session(ctx);
    expect(sink.id()).toMatch(/^[0-9a-f-]{36}$/);
    expect(live.size).toBe(2);
    owner.abort();
    expect(live.size).toBe(0);
  },
);
