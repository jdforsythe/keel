// onUncaught (k.leave Process): the two process listeners write one E1577 `diag` each, the route of the request the
// failing work ran in, `-` outside one, the thrown text only with `dev`, scrubbed of the request's values; the listeners
// are installed once per process, and a second copy of the module takes the first copy's place. Each case loads a fresh copy of the module so the once-flag starts unset, and calls
// the listeners it added directly (emitting the process event would reach the test runner's own handlers).
import { describe, expect, it, vi } from "vitest";

type Listener = (e: unknown) => void;
const EVENTS = ["uncaughtException", "unhandledRejection"] as const;
const ROOT = "/srv/app";

type Fn = (...args: never[]) => void;
type Event = (typeof EVENTS)[number];
const listenersOf = (event: Event): readonly Fn[] =>
  event === "uncaughtException" ? process.listeners("uncaughtException") : process.listeners("unhandledRejection");
const drop = (event: Event, fn: Fn): void => {
  Reflect.apply(process.off, process, [event, fn]);
};

async function install(opts: { format?: "compact" | "json"; dev?: boolean } = {}) {
  vi.resetModules();
  const { onUncaught } = await import("../src/internal/onUncaught.ts");
  const { serving } = await import("../src/internal/serving.ts");
  const before = new Map(EVENTS.map((e) => [e, listenersOf(e)]));
  const lines: string[] = [];
  let thens = 0;
  onUncaught(
    { format: opts.format ?? "compact", write: (l) => lines.push(l) },
    `${ROOT}/artifacts`,
    () => opts.dev ?? false,
    () => {
      thens++;
    },
  );
  const fresh = new Map<string, Listener>();
  for (const event of EVENTS)
    for (const fn of listenersOf(event))
      if (!before.get(event)?.includes(fn)) {
        fresh.set(event, (e) => Reflect.apply(fn, process, [e]));
        drop(event, fn);
      }
  return { lines, thens: () => thens, fresh, serving };
}

describe("onUncaught", () => {
  it("adds one listener to each of uncaughtException and unhandledRejection", async () => {
    const { fresh } = await install();
    expect([...fresh.keys()].sort()).toEqual(["uncaughtException", "unhandledRejection"]);
  });

  it("installs once per process: a second call adds nothing", async () => {
    vi.resetModules();
    const { onUncaught } = await import("../src/internal/onUncaught.ts");
    const before = EVENTS.map((e) => listenersOf(e));
    const log = { format: "compact", write: () => undefined } as const;
    onUncaught(log, ROOT, () => false, () => undefined);
    const after1 = EVENTS.map((e) => listenersOf(e));
    onUncaught(log, ROOT, () => false, () => undefined);
    const after2 = EVENTS.map((e) => listenersOf(e));
    try {
      expect(after1.map((l, i) => l.length - (before[i]?.length ?? 0))).toEqual([1, 1]);
      expect(after2.map((l) => l.length)).toEqual(after1.map((l) => l.length));
    } finally {
      EVENTS.forEach((event, i) => {
        for (const fn of listenersOf(event)) if (!before[i]?.includes(fn)) drop(event, fn);
      });
    }
  });

  it("a second copy of the module takes the first copy's place: one listener per event, and it reads its own `serving`", async () => {
    const before = EVENTS.map((e) => listenersOf(e));
    const copy = async () => {
      vi.resetModules();
      const { onUncaught } = await import("../src/internal/onUncaught.ts");
      const { serving } = await import("../src/internal/serving.ts");
      const lines: string[] = [];
      onUncaught({ format: "compact", write: (l) => lines.push(l) }, ROOT, () => true, () => undefined);
      return { lines, serving };
    };
    try {
      const first = await copy();
      const second = await copy();
      const added = EVENTS.map((event, i) => listenersOf(event).filter((fn) => !before[i]?.includes(fn)));
      expect(added.map((l) => l.length)).toEqual([1, 1]);
      second.serving.run({ route: "app.late", pii: new Set(), secrets: new Set() }, () => {
        for (const fn of added[0] ?? []) Reflect.apply(fn, process, [new Error("boom")]);
      });
      expect(first.lines).toEqual([]);
      expect(second.lines).toHaveLength(1);
      expect(second.lines[0]).toMatch(
        /^E1577 uncaught exception in work of route app\.late: Error #[0-9a-f]{8}( at \S+:\d+)? Error: boom$/,
      );
    } finally {
      EVENTS.forEach((event, i) => {
        for (const fn of listenersOf(event)) if (!before[i]?.includes(fn)) drop(event, fn);
      });
    }
  });

  it("writes `uncaught exception in work of route -: ` and the thrown value's form outside a request, then calls then once", async () => {
    const { lines, thens, fresh } = await install();
    fresh.get("uncaughtException")?.(new Error("boom"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^E1577 uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?$/);
    expect(thens()).toBe(1);
  });

  it("writes `uncaught rejection ...` for an unhandled rejection", async () => {
    const { lines, thens, fresh } = await install();
    fresh.get("unhandledRejection")?.(new Error("boom"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^E1577 uncaught rejection in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?$/);
    expect(thens()).toBe(1);
  });

  it("names the route of the request the failing work ran in", async () => {
    const { lines, fresh, serving } = await install();
    serving.run({ route: "orders.show", pii: new Set(), secrets: new Set() }, () => {
      fresh.get("uncaughtException")?.(new Error("boom"));
      fresh.get("unhandledRejection")?.(new Error("boom"));
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^E1577 uncaught exception in work of route orders\.show: Error #[0-9a-f]{8}/);
    expect(lines[1]).toMatch(/^E1577 uncaught rejection in work of route orders\.show: Error #[0-9a-f]{8}/);
  });

  it("adds the thrown text only with dev, scrubbed of the request's secrets and pii", async () => {
    const dev = await install({ dev: true });
    dev.fresh.get("uncaughtException")?.(new Error("plain"));
    dev.fresh.get("unhandledRejection")?.("a string");
    dev.serving.run({ route: "r", pii: new Set(["ada@example.com"]), secrets: new Set(["s3cr3t-value"]) }, () => {
      dev.fresh.get("uncaughtException")?.(new Error("bad s3cr3t-value for ada@example.com"));
    });
    expect(dev.lines[0]).toMatch(
      /^E1577 uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)? Error: plain$/,
    );
    expect(dev.lines[1]).toMatch(/^E1577 uncaught rejection in work of route -: value #[0-9a-f]{8} a string$/);
    expect(dev.lines[2]).toMatch(
      /^E1577 uncaught exception in work of route r: Error #[0-9a-f]{8}( at \S+:\d+)? Error: bad /,
    );
    expect(dev.lines[2]).not.toContain("s3cr3t-value");
    expect(dev.lines[2]).not.toContain("ada@example.com");
    const prod = await install({ dev: false });
    prod.fresh.get("uncaughtException")?.(new Error("plain"));
    expect(prod.lines).toHaveLength(1);
    expect(prod.lines[0]).toMatch(/^E1577 uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?$/);
    expect(prod.lines[0]).not.toContain("plain");
  });

  it("writes one NDJSON diag with the E1577 code, its see and the error's app frames under json", async () => {
    const { lines, fresh } = await install({ format: "json" });
    const err = new Error("boom");
    err.stack = `Error: boom\n    at run (${ROOT}/src/app.ts:3:4)\n    at lib (${ROOT}/node_modules/x/i.js:1:1)`;
    fresh.get("uncaughtException")?.(err);
    expect(lines).toHaveLength(1);
    const rec: unknown = JSON.parse(lines[0] ?? "");
    expect(rec).toEqual({
      kind: "diag",
      code: "E1577",
      message: expect.stringMatching(/^uncaught exception in work of route -: Error #[0-9a-f]{8} at src\/app\.ts:3$/),
      see: "k.server",
      frames: ["src/app.ts:3:4"],
    });
  });
});
