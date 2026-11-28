// startFailed (k.deploy Refusals at start, k.serverlog Thrown values): a throw while the entry's modules are evaluated
// is one E1577 record, holding the scrubbed text while the KEEL_LOG_THROWN window is open at the throw, as a later
// throw's does. The system time is fixed (2026-11-27T12:00:00Z), so the real ctx clock reads it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { logThrownOpen } from "../src/internal/logThrownOpen.ts";
import { logThrownUntil } from "../src/internal/logThrownUntil.ts";

const NOW = 1_795_780_800_000;
const EVENTS = ["uncaughtException", "unhandledRejection"] as const;
type Event = (typeof EVENTS)[number];
type Fn = (...args: never[]) => void;
const listenersOf = (event: Event): readonly Fn[] =>
  event === "uncaughtException" ? process.listeners("uncaughtException") : process.listeners("unhandledRejection");
const realExit = process.exit;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.set(process, "exit", realExit);
});

/**
 * The record `startFailed` writes for `thrown`, its listener called directly (emitting the process event would reach
 * the runner's own handlers). Its rethrow on the next tick is caught there; every other tick runs as it would.
 */
async function recordOf(thrown: unknown, window: string | undefined): Promise<string[]> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  if (window !== undefined) vi.stubEnv("KEEL_LOG_THROWN", window);
  vi.stubEnv("KEEL_FORMAT", "compact");
  vi.resetModules();
  const { startFailed } = await import("../src/internal/startFailed.ts");
  // The modules it loads when it fails, loaded first so its own loading queues no tick of theirs.
  await Promise.all([
    import("../src/internal/onUncaught.ts"),
    import("@keel/ctx"),
    import("../src/internal/logThrownOpen.ts"),
  ]);
  const before = new Map(EVENTS.map((e) => [e, listenersOf(e)]));
  const out: string[] = [];
  const exits: unknown[] = [];
  Reflect.set(process, "exit", (code: unknown) => {
    exits.push(code);
  });
  vi.spyOn(process.stdout, "write").mockImplementation((t) => {
    out.push(String(t));
    return true;
  });
  const tick = process.nextTick;
  let rethrown = 0;
  // Every tick runs as it would; its rethrow among them is caught here.
  Reflect.set(process, "nextTick", (fn: (...a: unknown[]) => void, ...args: unknown[]) =>
    tick(() => {
      try {
        fn(...args);
      } catch (e) {
        if (e !== thrown) throw e;
        rethrown++;
      }
    }),
  );
  try {
    await startFailed(thrown, "/srv/app/artifacts");
    for (let i = 0; i < 100 && rethrown === 0; i++) await new Promise<void>((done) => setImmediate(done));
  } finally {
    Reflect.set(process, "nextTick", tick);
  }
  expect(rethrown).toBe(1);
  const added = listenersOf("uncaughtException").filter((fn) => !before.get("uncaughtException")?.includes(fn));
  for (const event of EVENTS)
    for (const fn of listenersOf(event))
      if (!before.get(event)?.includes(fn)) Reflect.apply(process.off, process, [event, fn]);
  for (const fn of added) Reflect.apply(fn, process, [thrown]);
  expect(exits).toEqual([1]);
  return out;
}

describe("startFailed", () => {
  it("inside the KEEL_LOG_THROWN window writes the thrown text in the one E1577 record", async () => {
    const out = await recordOf(new Error("user jane@x.com failed"), "2026-11-27T13:00:00Z");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(
      /^E1577 uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)? Error: user jane@x\.com failed\n$/,
    );
  });

  it("outside the window, unset, empty or malformed, the record ends at the form", async () => {
    for (const window of ["2026-11-27T11:00:00Z", undefined, "", "yes", "2026-11-28T13:00:00Z"]) {
      const out = await recordOf(new Error("user jane@x.com failed"), window);
      expect(out).toHaveLength(1);
      expect(out[0], String(window)).toMatch(
        /^E1577 uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?\n$/,
      );
    }
  });
});

describe("logThrownOpen", () => {
  it("is open for an instant after now and at most 24 hours after it", () => {
    expect(logThrownOpen("2026-11-27T13:00:00Z", NOW)).toBe(true);
    expect(logThrownOpen(" 2026-11-28T12:00:00Z ", NOW)).toBe(true);
    expect(logThrownOpen("2026-11-28T12:00:00.001Z", NOW)).toBe(false);
    expect(logThrownOpen("2026-11-27T12:00:00Z", NOW)).toBe(false);
    expect(logThrownOpen(undefined, NOW)).toBe(false);
    expect(logThrownOpen("", NOW)).toBe(false);
    expect(logThrownOpen("tomorrow", NOW)).toBe(false);
  });
});

describe("logThrownUntil", () => {
  it("is E1596 for an empty value, as for any value that is no instant; unset is no window", () => {
    for (const value of ["", "  ", "yes"]) expect(() => logThrownUntil(value, NOW), value).toThrow(/^E1596 /);
    expect(logThrownUntil(undefined, NOW)).toBeUndefined();
    expect(logThrownUntil("2026-11-27T13:00:00Z", NOW)).toBe(NOW + 3_600_000);
  });
});
