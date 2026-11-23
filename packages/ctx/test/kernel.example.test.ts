// What kernel producers and the harness rely on: a browser's ctx beside another, plan schemas, muted `fire` reports,
// route calls in flight, the default mode, the kernel capability names, the schedule's schemas and the sim net's
// faults, in this copy of the package and in a second one. Property seed 1337.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type Ctx,
  type CtxEvent,
  type NetStep,
  Schedule,
  type SimCtx,
  createCtx,
  observe,
  register,
  seedOf,
} from "../src/index.ts";
import { browserCtx, netInFlight, planSchemas, quiet, report } from "../src/internal/index.ts";
import { fileStorage } from "../src/node/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL_A = "https://kernel.example.test/a";
const fire: CtxEvent = { kind: "fire", id: "a", event: { type: "focus" } };
const online: CtxEvent = { kind: "net", online: true };

/** How `p` ended once the microtasks and one macrotask have run. */
async function outcome(p: Promise<unknown>): Promise<unknown> {
  let state: unknown = "pending";
  p.then(
    (value) => {
      state = { resolved: value };
    },
    (reason: unknown) => {
      state = { rejected: reason };
    },
  );
  await new Promise<void>((done) => setTimeout(done, 0));
  return state;
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (reason) {
    return reason;
  }
  throw new Error("expected a rejection");
}

/** A second copy of the package, as a harness's fresh module graph evaluates one. */
async function fresh(): Promise<typeof import("../src/index.ts")> {
  vi.resetModules();
  return await import("../src/index.ts");
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a throw");
}

const sample = register("test.kernel.sample", {
  sim: ({ seed }) => ({ mode: "sim", seed }),
  real: ({ seed }) => ({ mode: "real", seed }),
  shell: ({ seed }) => ({ mode: "shell", seed }),
});

describe("browserCtx", () => {
  test("shares the ctx's clock and random, takes the given net and a fresh storage of its own", async () => {
    const ctx = createCtx({ mode: "sim", seed: 5 });
    const net = createCtx({ mode: "sim", seed: 6 }).net;
    const made = browserCtx(ctx, { net });
    expect(made.clock).toBe(ctx.clock);
    expect(made.random).toBe(ctx.random);
    expect(made.net).toBe(net);
    expect(made.storage).not.toBe(ctx.storage);
    expect(Object.isFrozen(made)).toBe(true);
    await made.storage.set("k", "browser");
    expect(await made.storage.get("k")).toBe("browser");
    expect(await ctx.storage.get("k")).toBeNull();
  });

  test("uses the storage it is given", () => {
    const ctx = createCtx({ mode: "sim", seed: 5 });
    const storage = createCtx({ mode: "sim", seed: 6 }).storage;
    expect(browserCtx(ctx, { net: ctx.net, storage }).storage).toBe(storage);
  });

  test("has the ctx's mode and seed, and builds one capability instance of its own", () => {
    const ctx = createCtx({ mode: "sim", seed: 5 });
    const made = browserCtx(ctx, { net: ctx.net });
    expect(seedOf(made)).toBe(5);
    expect(sample(made)).toEqual(sample(ctx));
    expect(sample(made).mode).toBe("sim");
    expect(sample(made)).not.toBe(sample(ctx));
    expect(sample(made)).toBe(sample(made));
  });

  test("beside a real ctx its storage is the platform's", async () => {
    vi.stubGlobal("localStorage", undefined);
    const ctx = createCtx({ mode: "real", seed: 5 });
    const made = browserCtx(ctx, { net: ctx.net });
    expect(sample(made).mode).toBe("real");
    const reason = await rejection(made.storage.get("k"));
    expect(reason).toBeInstanceOf(Error);
    expect(String(reason)).toContain("this runtime has no localStorage");
    expect(String(reason)).toContain("createCtx({ drivers: { storage } })");
  });

  test("beside a ctx createCtx did not make it is a sim ctx", async () => {
    const plain: Ctx = { ...createCtx({ mode: "real", seed: 5, drivers: { storage: fileStorage("/unused") } }) };
    const made = browserCtx(plain, { net: plain.net });
    expect(sample(made).mode).toBe("sim");
    expect(await made.storage.get("k")).toBeNull();
  });

  test("what is reported on it reaches the ctx's observers", () => {
    const ctx = createCtx({ mode: "sim", seed: 5 });
    const heard: CtxEvent[] = [];
    observe(ctx, (e) => void heard.push(e));
    report(browserCtx(ctx, { net: ctx.net }), online);
    expect(heard).toEqual([online]);
  });
});

describe("planSchemas", () => {
  test("lists each capability registered with a plan, in registration order, and no other", () => {
    const first = s.object({ n: s.int({ min: 0, max: 9 }) });
    const second = s.string();
    const impls = { sim: () => ({}), real: () => ({}), shell: () => ({}) };
    register("test.kernel.plan.first", { ...impls, plan: first });
    register("test.kernel.plan.none", { ...impls });
    register("test.kernel.plan.second", { ...impls, plan: second });
    const mine = planSchemas().filter(([name]) => name.startsWith("test.kernel."));
    expect(mine.map(([name]) => name)).toEqual(["test.kernel.plan.first", "test.kernel.plan.second"]);
    expect(mine[0]?.[1]).toBe(first);
    expect(mine[1]?.[1]).toBe(second);
  });
});

describe("quiet", () => {
  test("mutes fire reports while it runs, nested too, and nothing else", () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const heard: CtxEvent[] = [];
    observe(ctx, (e) => void heard.push(e));
    const result = quiet(() => {
      report(ctx, fire);
      quiet(() => report(ctx, fire));
      report(ctx, fire);
      report(ctx, online);
      return "done";
    });
    expect(result).toBe("done");
    expect(heard).toEqual([online]);
    report(ctx, fire);
    expect(heard).toEqual([online, fire]);
  });

  test("a throw inside ends the muting", () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const heard: CtxEvent[] = [];
    observe(ctx, (e) => void heard.push(e));
    const boom = new Error("boom");
    expect(
      thrown(() =>
        quiet(() => {
          throw boom;
        }),
      ),
    ).toBe(boom);
    report(ctx, fire);
    expect(heard).toEqual([fire]);
  });
});

describe("netInFlight", () => {
  test("counts the route calls not yet answered, and none during a step's delay", async () => {
    const ctx = createCtx({
      mode: "sim",
      seed: 1,
      schedule: { net: [{ delay: 50, fault: "none" }], storage: [], offline: [], plans: {} },
    });
    const gates: (() => void)[] = [];
    ctx.net.route(URL_A, () => new Promise<Response>((done) => gates.push(() => done(new Response("ok")))));
    expect(netInFlight(ctx.net)).toBe(0);
    const delayed = ctx.net.fetch(new Request(URL_A));
    await outcome(delayed);
    expect(netInFlight(ctx.net)).toBe(0);
    ctx.clock.advance(50);
    const second = ctx.net.fetch(new Request(URL_A));
    await outcome(second);
    expect(netInFlight(ctx.net)).toBe(2);
    gates[0]?.();
    await outcome(delayed);
    expect(netInFlight(ctx.net)).toBe(1);
    gates[1]?.();
    expect(await (await second).text()).toBe("ok");
    expect(netInFlight(ctx.net)).toBe(0);
  });

  test("a route that throws is no longer in flight", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const boom = new Error("route failed");
    ctx.net.route(URL_A, () => Promise.reject(boom));
    expect(await rejection(ctx.net.fetch(new Request(URL_A)))).toBe(boom);
    expect(netInFlight(ctx.net)).toBe(0);
  });

  test("is 0 for a net that is no sim net", () => {
    expect(netInFlight({})).toBe(0);
    expect(netInFlight(createCtx({ mode: "real", seed: 1, drivers: { storage: fileStorage("/unused") } }).net)).toBe(0);
  });
});

describe("default mode", () => {
  const modeWith = (proc: unknown): string => {
    vi.stubGlobal("process", proc);
    try {
      return "advance" in createCtx({ seed: 1 }).clock ? "sim" : "real";
    } finally {
      vi.unstubAllGlobals();
    }
  };

  test.each<[string, unknown, string]>([
    ["no process", undefined, "real"],
    ["a null process", null, "real"],
    ["a process that is a string", "process", "real"],
    ["a process without env", {}, "real"],
    ["a null env", { env: null }, "real"],
    ["an env that is a string", { env: "KEEL_TEST" }, "real"],
    ["no KEEL_TEST", { env: {} }, "real"],
    ["KEEL_TEST=0", { env: { KEEL_TEST: "0" } }, "real"],
    ["KEEL_TEST=1", { env: { KEEL_TEST: "1" } }, "sim"],
  ])("with %s a ctx is %s", (_, proc, mode) => {
    expect(modeWith(proc)).toBe(mode);
  });
});

describe("register", () => {
  test.each(["clock", "random", "net", "storage"])("the kernel capability %s cannot be registered", async (name) => {
    const copy = await fresh();
    const e = thrown(() => copy.register(name, { sim: () => ({}), real: () => ({}), shell: () => ({}) }));
    expect(e).toMatchObject({ code: "E1602", message: `capability "${name}" is already registered` });
  });

  test("an accessor names its capability when given a ctx createCtx did not make", () => {
    const plain: Ctx = { ...createCtx({ mode: "sim", seed: 1 }) };
    expect(() => sample(plain)).toThrow('capability "test.kernel.sample": not a ctx made by createCtx');
  });
});

describe("schedule schemas", () => {
  test("a net step's delay is an integer from 0 to 60000", async () => {
    const { NetStep } = await fresh();
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: -5, max: 60005 }), fc.integer(), fc.double({ noNaN: true })), (delay) => {
        const ok = Number.isInteger(delay) && delay >= 0 && delay <= 60000;
        expect(NetStep.parse({ delay, fault: "none" }).ok).toBe(ok);
      }),
      { seed: 1337, numRuns: 200 },
    );
    expect(NetStep.parse({ delay: 0, fault: "none" }).ok).toBe(true);
    expect(NetStep.parse({ delay: 60000, fault: "none" }).ok).toBe(true);
    expect(NetStep.parse({ delay: -1, fault: "none" }).ok).toBe(false);
    expect(NetStep.parse({ delay: 60001, fault: "none" }).ok).toBe(false);
  });

  test("a net step's fault is one of the four, and both fields are required", async () => {
    const { NetStep } = await fresh();
    for (const fault of ["none", "drop", "lost", "unavailable"])
      expect(NetStep.parse({ delay: 1, fault })).toEqual({ ok: true, value: { delay: 1, fault } });
    for (const fault of ["", "fail", "NONE", 0, null]) expect(NetStep.parse({ delay: 1, fault }).ok).toBe(false);
    expect(NetStep.parse({ delay: 1 }).ok).toBe(false);
    expect(NetStep.parse({ fault: "none" }).ok).toBe(false);
    expect(NetStep.parse({}).ok).toBe(false);
  });

  test("a schedule needs its four parts, each of the stated shape", async () => {
    const { Schedule } = await fresh();
    const good = {
      net: [{ delay: 3, fault: "drop" }],
      storage: ["ok", "fail"],
      offline: [{ at: 0, ms: 0 }],
      plans: { "test.kernel": [1, "two", { three: [3] }] },
    };
    expect(Schedule.parse(good)).toEqual({ ok: true, value: good });
    expect(Schedule.parse({}).ok).toBe(false);
    for (const key of ["net", "storage", "offline", "plans"])
      expect(Schedule.parse({ ...good, [key]: undefined }).ok).toBe(false);
    expect(Schedule.parse({ ...good, net: [{ delay: -1, fault: "drop" }] }).ok).toBe(false);
    for (const call of ["", "maybe", "OK", 1]) expect(Schedule.parse({ ...good, storage: [call] }).ok).toBe(false);
    expect(Schedule.parse({ ...good, offline: [{ at: -1, ms: 0 }] }).ok).toBe(false);
    expect(Schedule.parse({ ...good, offline: [{ at: 0, ms: -1 }] }).ok).toBe(false);
    expect(Schedule.parse({ ...good, offline: [{ at: 0 }] }).ok).toBe(false);
    expect(Schedule.parse({ ...good, offline: [{ ms: 0 }] }).ok).toBe(false);
    expect(Schedule.parse({ ...good, offline: [{}] }).ok).toBe(false);
  });
});

describe("createCtx with a schedule", () => {
  const empty = { net: [], storage: [], offline: [], plans: {} };

  test("a schedule outside sim is E1604 naming the mode", () => {
    const e = thrown(() => createCtx({ mode: "shell", seed: 1, schedule: empty }));
    expect(e).toMatchObject({ code: "E1604", message: "schedule on a shell ctx" });
  });

  test("a schedule that does not parse is E1604 with the schema's message", () => {
    const bad = { ...empty, offline: [{ at: -1, ms: 1 }] };
    const parsed = Schedule.parse(bad);
    const e = thrown(() => createCtx({ mode: "sim", seed: 1, schedule: bad }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(e).toMatchObject({ code: "E1604", message: `schedule: ${parsed.error.message}` });
  });

  test("an offline window that opens at 0 is in effect when the ctx is returned", () => {
    const ctx = createCtx({ mode: "sim", seed: 1, schedule: { ...empty, offline: [{ at: 0, ms: 10 }] } });
    expect(ctx.net.online()).toBe(false);
    ctx.clock.advance(10);
    expect(ctx.net.online()).toBe(true);
  });
});

describe("sim net faults", () => {
  const scheduled = (...net: NetStep[]): SimCtx =>
    createCtx({ mode: "sim", seed: 1, schedule: { net, storage: [], offline: [], plans: {} } });

  test("an offline fetch rejects naming the cause and never runs the route", async () => {
    const ctx = scheduled();
    let ran = 0;
    ctx.net.route(URL_A, () => {
      ran++;
      return new Response("ok");
    });
    ctx.net.setOnline(false);
    const reason = await rejection(ctx.net.fetch(new Request(URL_A)));
    expect(reason).toBeInstanceOf(TypeError);
    expect(reason).toMatchObject({ message: "sim net: offline" });
    expect(ran).toBe(0);
  });

  test("a fetch whose delay ends offline rejects without running the route", async () => {
    const ctx = scheduled({ delay: 20, fault: "none" });
    let ran = 0;
    ctx.net.route(URL_A, () => {
      ran++;
      return new Response("ok");
    });
    const pending = ctx.net.fetch(new Request(URL_A));
    ctx.net.setOnline(false);
    ctx.clock.advance(20);
    expect(await rejection(pending)).toMatchObject({ message: "sim net: offline" });
    expect(ran).toBe(0);
  });

  test("a step with no delay answers without the clock moving", async () => {
    const ctx = scheduled({ delay: 0, fault: "none" });
    ctx.net.route(URL_A, () => new Response("ok"));
    const state = await outcome(ctx.net.fetch(new Request(URL_A)).then((r) => r.text()));
    expect(state).toEqual({ resolved: "ok" });
  });

  test("drop rejects before the route, lost after it, unavailable answers 503 without it", async () => {
    const ctx = scheduled({ delay: 0, fault: "drop" }, { delay: 0, fault: "lost" }, { delay: 0, fault: "unavailable" });
    let ran = 0;
    ctx.net.route(URL_A, () => {
      ran++;
      return new Response("ok");
    });
    const dropped = await rejection(ctx.net.fetch(new Request(URL_A)));
    expect(dropped).toBeInstanceOf(TypeError);
    expect(dropped).toMatchObject({ message: "sim net: dropped" });
    expect(ran).toBe(0);
    const lost = await rejection(ctx.net.fetch(new Request(URL_A)));
    expect(lost).toBeInstanceOf(TypeError);
    expect(lost).toMatchObject({ message: "sim net: response lost" });
    expect(ran).toBe(1);
    expect((await ctx.net.fetch(new Request(URL_A))).status).toBe(503);
    expect(ran).toBe(1);
    expect(await (await ctx.net.fetch(new Request(URL_A))).text()).toBe("ok");
  });

  test("a 404's body survives the net going offline", async () => {
    const ctx = scheduled();
    const res = await ctx.net.fetch(new Request(URL_A));
    ctx.net.setOnline(false);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(`sim net: no route for GET ${URL_A}`);
  });

  test("going offline cancels the route's open body, and so does the reader", async () => {
    const ctx = scheduled();
    const cancelled: unknown[] = [];
    ctx.net.route(
      URL_A,
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel(reason) {
              cancelled.push(reason);
            },
          }),
        ),
    );
    const first = await ctx.net.fetch(new Request(URL_A));
    const reading = first.text();
    ctx.net.setOnline(false);
    expect(await rejection(reading)).toMatchObject({ message: "sim net: offline" });
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toBeInstanceOf(TypeError);
    ctx.net.setOnline(true);
    const second = await ctx.net.fetch(new Request(URL_A));
    await second.body?.cancel("reader left");
    expect(cancelled).toHaveLength(2);
    expect(cancelled[1]).toBe("reader left");
  });
});

describe("storage", () => {
  const dirs: string[] = [];
  const file = (text: string): string => {
    const d = mkdtempSync(join(tmpdir(), "keel-ctx-kernel-"));
    dirs.push(d);
    const f = join(d, "store.json");
    writeFileSync(f, text);
    return f;
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  test.each(["null", "[]", '["a"]', '"ab"', "7", "true"])(
    "a file holding %s is not a JSON object of strings",
    async (text) => {
      const f = file(text);
      const reason = await rejection(fileStorage(f).get("0"));
      expect(reason).toBeInstanceOf(Error);
      expect(reason).toMatchObject({
        message: `ctx.storage: ${f} is not a JSON object of strings; delete it to start empty`,
      });
    },
  );

  test("a sim commit that names one key twice is E1606 before it takes a step", async () => {
    const sim = createCtx({
      mode: "sim",
      seed: 1,
      schedule: { net: [], storage: ["fail"], offline: [], plans: {} },
    }).storage;
    const reason = await rejection(
      sim.commit([
        { key: "k", expect: null, value: "a" },
        { key: "k", expect: null, value: "b" },
      ]),
    );
    expect(reason).toMatchObject({ code: "E1606" });
    expect(await rejection(sim.get("k"))).toMatchObject({ message: "sim storage: scheduled failure" });
    expect(await sim.get("k")).toBeNull();
  });
});
