// Setup file every Keel vitest run loads (through keelConfig): the main-thread half of the hard watchdog.
// vitest's own timeout is a timer on the test's thread, so a synchronous loop never lets it fire. This file starts
// one watchdog thread per process (watchdog-thread.mjs) and writes a heartbeat into shared memory at each phase:
// collecting a file, its hooks, each test. The thread kills the process when a phase runs past
// `allowed * 2 + grace` (grace 30 s), or when the worker's parent is gone. Real clocks are used on purpose: this
// is the one place in the test setup that must bound wall-clock time. A worker also kills its own descendants on
// every way it can end (exit, SIGTERM, SIGINT, SIGHUP; a parent that vanishes closes the worker's channel, which
// ends it through exit), so a child a test started never outlives the worker.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainThread, Worker } from "node:worker_threads";
import { afterAll, afterEach, beforeAll, beforeEach, expect, inject } from "vitest";

declare module "vitest" {
  interface ProvidedContext {
    keelWatchdog: { testTimeout: number; hookTimeout: number };
  }
}

type Beat = { slots: Int32Array; label: Uint8Array; base: number };

const PHASE = 0;
const STARTED = 1;
const ALLOWED = 2;
const LEN = 3;
const LABEL_BYTES = 1024;
const KEY = Symbol.for("keel.watchdog");
/** Import of a cold file (TypeScript, the compiler) under a loaded machine takes tens of seconds; nothing else bounds it. */
const COLLECT_MS = 60_000;

// A path, not a URL: under a DOM test environment the global `URL` is the DOM's, which `Worker` refuses.
const THREAD = path.join(path.dirname(fileURLToPath(import.meta.url)), "watchdog-thread.mjs");

const envMs = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

function isBeat(v: unknown): v is Beat {
  return (
    typeof v === "object" &&
    v !== null &&
    "slots" in v &&
    v.slots instanceof Int32Array &&
    "label" in v &&
    v.label instanceof Uint8Array &&
    "base" in v &&
    typeof v.base === "number"
  );
}

const clock = (): number => Math.round(performance.timeOrigin + performance.now());

/** The process's heartbeat, starting its watchdog thread on first use. */
function heartbeat(): Beat {
  const existing: unknown = Reflect.get(process, KEY);
  if (isBeat(existing)) return existing;
  const slotBuffer = new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT);
  const labelBuffer = new SharedArrayBuffer(LABEL_BYTES);
  const base = clock();
  const beat: Beat = { slots: new Int32Array(slotBuffer), label: new Uint8Array(labelBuffer), base };
  const worker = new Worker(THREAD, {
    workerData: {
      slots: slotBuffer,
      label: labelBuffer,
      base,
      ppid: process.ppid,
      tick: envMs("KEEL_WATCHDOG_TICK_MS", 1000),
      grace: envMs("KEEL_WATCHDOG_GRACE_MS", 30_000),
    },
    execArgv: [],
    stdout: false,
    stderr: false,
  });
  // A finished worker exits even though the watchdog thread is still ticking.
  worker.unref();
  Reflect.set(process, KEY, beat);
  return beat;
}

/** Every process below `root`, from one `ps` listing; empty when `ps` is unavailable. */
function descendants(root: number): number[] {
  let listing = "";
  try {
    listing = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8", timeout: 5000 });
  } catch {
    return [];
  }
  const children = new Map<number, number[]>();
  for (const line of listing.split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    if (pid === undefined || parent === undefined || !Number.isInteger(pid) || !Number.isInteger(parent)) continue;
    children.set(parent, [...(children.get(parent) ?? []), pid]);
  }
  const out: number[] = [];
  const queue = [root];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const c of children.get(next) ?? []) {
      out.push(c);
      queue.push(c);
    }
  }
  return out;
}

/** Kills what this process started. A process with no live child process skips the `ps` listing. */
function killDescendants(): void {
  if (!process.getActiveResourcesInfo().includes("ProcessWrap")) return;
  for (const pid of descendants(process.pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
}

/** A signal ends the worker as it would without the handler, after its descendants are gone. */
function endOn(signal: NodeJS.Signals): void {
  const handler = (): void => {
    killDescendants();
    process.off(signal, handler);
    if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
  };
  process.on(signal, handler);
}

if (isMainThread && Reflect.get(process, KEY) === undefined) {
  process.on("exit", killDescendants);
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) endOn(signal);
}

const beat = heartbeat();
const encoder = new TextEncoder();
const timeouts = inject("keelWatchdog") ?? { testTimeout: 5000, hookTimeout: 10_000 };
const between = Math.max(3 * timeouts.hookTimeout, COLLECT_MS);
const file = path.relative(process.cwd(), expect.getState().testPath ?? "");

function mark(test: string, allowed: number): void {
  const bytes = encoder.encode(`${file}\t${test}`).subarray(0, LABEL_BYTES);
  beat.label.set(bytes);
  Atomics.store(beat.slots, LEN, bytes.length);
  Atomics.store(beat.slots, ALLOWED, allowed);
  Atomics.store(beat.slots, STARTED, clock() - beat.base);
  Atomics.store(beat.slots, PHASE, 1);
}

mark("", Math.max(timeouts.hookTimeout, COLLECT_MS));
beforeAll(() => mark("", between));
// The bracket holds the test and its own beforeEach and afterEach hooks: setup hooks run first and, in the
// default stack order, their afterEach runs last.
// A test without a timeout (0) still gets the configured one: the watchdog bounds every test.
beforeEach((ctx) => {
  const own = ctx.task.timeout > 0 && ctx.task.timeout < 2 ** 28 ? ctx.task.timeout : timeouts.testTimeout;
  mark(ctx.task.fullTestName, own + 2 * timeouts.hookTimeout);
});
afterEach(() => mark("", between));
afterAll(() => Atomics.store(beat.slots, PHASE, 0));
