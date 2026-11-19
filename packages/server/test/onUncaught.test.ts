// onUncaught (k.leave Process): the two process listeners write one E1577 `diag` each, the route of the request the
// failing work ran in, `-` outside one, the thrown text only with `dev`, scrubbed of the request's values; the listeners
// are installed once per process. Each case loads a fresh copy of the module so the once-flag starts unset, and calls
// the listeners it added directly (emitting the process event would reach the test runner's own handlers).
import { afterEach, describe, expect, it, vi } from "vitest";

type Listener = (e: unknown) => void;
const EVENTS = ["uncaughtException", "unhandledRejection"] as const;
const ROOT = "/srv/app";

async function install(opts: { format?: "compact" | "json"; dev?: boolean } = {}) {
  vi.resetModules();
  const { onUncaught } = await import("../src/internal/onUncaught.ts");
  const { serving } = await import("../src/internal/serving.ts");
  const before = new Map(EVENTS.map((e) => [e, process.listeners(e)]));
  const lines: string[] = [];
  let thens = 0;
  onUncaught(
    { format: opts.format ?? "compact", write: (l) => lines.push(l) },
    `${ROOT}/artifacts`,
    opts.dev ?? false,
    () => {
      thens++;
    },
  );
  const fresh = new Map<string, Listener>();
  for (const event of EVENTS)
    for (const fn of process.listeners(event))
      if (!before.get(event)?.includes(fn)) {
        fresh.set(event, (e) => fn(e));
        process.off(event, fn);
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
    const before = EVENTS.map((e) => process.listeners(e));
    const log = { format: "compact", write: () => undefined } as const;
    onUncaught(log, ROOT, false, () => undefined);
    const after1 = EVENTS.map((e) => process.listeners(e));
    onUncaught(log, ROOT, false, () => undefined);
    const after2 = EVENTS.map((e) => process.listeners(e));
    try {
      expect(after1.map((l, i) => l.length - (before[i]?.length ?? 0))).toEqual([1, 1]);
      expect(after2.map((l) => l.length)).toEqual(after1.map((l) => l.length));
    } finally {
      EVENTS.forEach((event, i) => {
        for (const fn of process.listeners(event)) if (!before[i]?.includes(fn)) process.off(event, fn);
      });
    }
  });

  it("writes `uncaught exception in work of route -` outside a request, then calls then once", async () => {
    const { lines, thens, fresh } = await install();
    fresh.get("uncaughtException")?.(new Error("boom"));
    expect(lines).toEqual(["E1577 uncaught exception in work of route -"]);
    expect(thens()).toBe(1);
  });

  it("writes `uncaught rejection ...` for an unhandled rejection", async () => {
    const { lines, thens, fresh } = await install();
    fresh.get("unhandledRejection")?.(new Error("boom"));
    expect(lines).toEqual(["E1577 uncaught rejection in work of route -"]);
    expect(thens()).toBe(1);
  });

  it("names the route of the request the failing work ran in", async () => {
    const { lines, fresh, serving } = await install();
    serving.run({ route: "orders.show", pii: new Set(), secrets: new Set() }, () => {
      fresh.get("uncaughtException")?.(new Error("boom"));
      fresh.get("unhandledRejection")?.(new Error("boom"));
    });
    expect(lines).toEqual([
      "E1577 uncaught exception in work of route orders.show",
      "E1577 uncaught rejection in work of route orders.show",
    ]);
  });

  it("adds the thrown text only with dev, scrubbed of the request's secrets and pii", async () => {
    const dev = await install({ dev: true });
    dev.fresh.get("uncaughtException")?.(new Error("plain"));
    dev.fresh.get("unhandledRejection")?.("a string");
    dev.serving.run({ route: "r", pii: new Set(["ada@example.com"]), secrets: new Set(["s3cr3t-value"]) }, () => {
      dev.fresh.get("uncaughtException")?.(new Error("bad s3cr3t-value for ada@example.com"));
    });
    expect(dev.lines[0]).toBe("E1577 uncaught exception in work of route -: Error: plain");
    expect(dev.lines[1]).toBe("E1577 uncaught rejection in work of route -: a string");
    expect(dev.lines[2]?.startsWith("E1577 uncaught exception in work of route r: Error: bad ")).toBe(true);
    expect(dev.lines[2]).not.toContain("s3cr3t-value");
    expect(dev.lines[2]).not.toContain("ada@example.com");
    const prod = await install({ dev: false });
    prod.fresh.get("uncaughtException")?.(new Error("plain"));
    expect(prod.lines).toEqual(["E1577 uncaught exception in work of route -"]);
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
      message: "uncaught exception in work of route -",
      see: "k.server",
      frames: ["src/app.ts:3:4"],
    });
  });
});
