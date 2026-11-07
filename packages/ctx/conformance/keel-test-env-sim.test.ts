// Spec: k.ctx Conformance, "`keel test` runs under sim by default" (KEEL_TEST=1 contract for every capability).
// The cli half (that `keel test` sets KEEL_TEST=1) cannot be tested from ctx. Default seed 0 is documented in packages/ctx/README.md.
import { expect, test } from "vitest";
import { createCtx, register } from "@keel/ctx";

function withEnv<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.KEEL_TEST;
  if (value === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
  else process.env.KEEL_TEST = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
    else process.env.KEEL_TEST = prev;
  }
}

const probe = register("keelTestEnvProbe", {
  real: () => ({ mode: "real" }),
  shell: () => ({ mode: "shell" }),
  sim: () => ({ mode: "sim" }),
});

test("with KEEL_TEST=1 createCtx({}) clock is the sim clock starting at 0", () => {
  withEnv("1", () => {
    const clock = createCtx({}).clock;
    expect("advance" in clock).toBe(true);
    expect(clock.now()).toBe(0);
  });
});

test("with KEEL_TEST=1 createCtx({}) random is deterministic and equals sim with seed 0", () => {
  withEnv("1", () => {
    const a = createCtx({});
    const b = createCtx({});
    const c = createCtx({ mode: "sim", seed: 0 });
    for (let i = 0; i < 20; i++) {
      const u = a.random.id("Probe");
      expect(b.random.id("Probe")).toBe(u);
      expect(c.random.id("Probe")).toBe(u);
      const f = a.random.float();
      expect(b.random.float()).toBe(f);
      expect(c.random.float()).toBe(f);
    }
  });
});

test("with KEEL_TEST=1 createCtx({}) net is the sim net and storage is isolated in memory", async () => {
  const [a, b] = withEnv("1", () => [createCtx({}), createCtx({})] as const);
  expect("route" in a.net).toBe(true);
  expect((await a.net.fetch(new Request("https://example.test/none"))).status).toBe(404);
  expect(await a.storage.get("k")).toBeNull();
  await a.storage.set("k", "v");
  expect(await a.storage.get("k")).toBe("v");
  expect(await b.storage.get("k")).toBeNull();
});

test("with KEEL_TEST=1 a registered capability resolves its sim factory", () => {
  withEnv("1", () => {
    expect(probe(createCtx({})).mode).toBe("sim");
  });
});

test("without KEEL_TEST createCtx({}) is not sim: real clock, real net, real capability", () => {
  withEnv(undefined, () => {
    const ctx = createCtx({});
    expect("advance" in ctx.clock).toBe(false);
    expect("route" in ctx.net).toBe(false);
    expect(probe(ctx).mode).toBe("real");
  });
});
