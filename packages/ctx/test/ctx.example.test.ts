// Examples for sim net routes, the register accessor, and mode defaults.
import { describe, expect, test, vi } from "vitest";
import { createCtx } from "../src/createCtx.ts";
import { register } from "../src/register.ts";

describe("sim net", () => {
  test("unmatched request is a deterministic 404", async () => {
    const res = await createCtx({ mode: "sim" }).net.fetch(new Request("https://x.test/a"));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("sim net: no route for GET https://x.test/a");
  });

  test("exact and prefix routes; first match wins", async () => {
    const { net } = createCtx({ mode: "sim" });
    net.route("https://x.test/a", () => new Response("exact"));
    net.route("https://x.test/*", () => new Response("prefix"));
    net.route("https://x.test/a", () => new Response("shadowed"));
    expect(await (await net.fetch(new Request("https://x.test/a"))).text()).toBe("exact");
    expect(await (await net.fetch(new Request("https://x.test/b/c"))).text()).toBe("prefix");
    expect((await net.fetch(new Request("https://y.test/a"))).status).toBe(404);
  });
});

describe("register", () => {
  test("accessor returns the mode's implementation, seeded with the ctx seed", () => {
    const geo = register("example-geo", {
      real: () => ({ where: () => "real" }),
      shell: () => ({ where: () => "shell" }),
      sim: ({ seed }) => ({ where: () => `sim:${seed}` }),
    });
    expect(geo(createCtx({ mode: "sim", seed: 7 })).where()).toBe("sim:7");
    expect(geo(createCtx({ mode: "shell" })).where()).toBe("shell");
  });

  test("accessor on a ctx created before register throws", () => {
    const early = createCtx({ mode: "sim" });
    const late = register("example-late", { real: () => ({}), shell: () => ({}), sim: () => ({}) });
    expect(() => late(early)).toThrow(/absent/);
  });

  test("ctx is frozen", () => {
    expect(Object.isFrozen(createCtx({ mode: "sim" }))).toBe(true);
  });
});

describe("mode default", () => {
  test("createCtx({}) is real when KEEL_TEST is not 1", () => {
    vi.stubEnv("KEEL_TEST", "0");
    try {
      expect("advance" in createCtx({}).clock).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("seed defaults to 0", () => {
    expect(createCtx({ mode: "sim" }).random.uuid()).toBe(createCtx({ mode: "sim", seed: 0 }).random.uuid());
  });
});
