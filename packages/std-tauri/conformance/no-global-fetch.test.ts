// Same clause as packages/std-capacitor/conformance/no-global-fetch.test.ts: Conformance "Neither package replaces the global `fetch`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: `globalThis.fetch` is replaced by a function that fails the test for the duration of each test and restored in `finally`; the driver's requests, cookies and storage must not call it.
// "Replaces" is held to `globalThis.fetch` being the same function before the drivers exist, after they are made and after they ran.
import { tauriDrivers } from "@keel/std-tauri";
import { afterEach, describe, expect, test } from "vitest";
import { begin, end, ORIGIN, OTHER, PAGES } from "./fixtures.ts";

describe("std.shells: the global fetch stays unpatched", () => {
  afterEach(end);

  test("Neither package replaces the global `fetch`, and every request goes through the shell's HTTP plugin", async () => {
    const original = globalThis.fetch;
    const calls: string[] = [];
    const guard = (input: unknown): never => {
      calls.push(String(input));
      throw new Error("the global fetch was used");
    };
    globalThis.fetch = guard;
    try {
      const world = begin(PAGES[0]);
      world.backend((req) =>
        req.url.endsWith("/login")
          ? { status: 200, headers: { "set-cookie": "sid=1; Path=/" } }
          : { status: 200, body: "ok" },
      );
      const { storage, net } = tauriDrivers({ origin: ORIGIN, connect: [OTHER] });
      expect(globalThis.fetch).toBe(guard);
      await storage.set("k", "v");
      await storage.get("k");
      await net.fetch(new Request(`${PAGES[0]}/login`, { method: "POST", body: "x" }));
      await net.fetch(new Request(`${OTHER}/x`));
      expect(world.wire.map((w) => w.url)).toEqual([`${ORIGIN.origin}/login`, `${OTHER}/x`]);
      expect(globalThis.fetch).toBe(guard);
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
