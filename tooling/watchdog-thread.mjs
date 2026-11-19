// The watchdog thread started by watchdog.ts. It runs beside a vitest worker's main thread, so a synchronous loop
// there cannot stop it. Each tick it reads the heartbeat the main thread writes into shared memory and kills the
// process when the current phase has run past `allowed * 2 + grace`, or when the worker's parent process is gone.
// It uses the real clock and real timers on purpose: bounding wall-clock time is its whole job.
// Layout of `slots` (Int32Array): PHASE (0 idle, 1 running), STARTED (ms since `base`), ALLOWED (ms), LEN (label bytes).
import { execFileSync } from "node:child_process";
import { writeSync } from "node:fs";
import { workerData } from "node:worker_threads";

const PHASE = 0;
const STARTED = 1;
const ALLOWED = 2;
const LEN = 3;

const { slots: slotBuffer, label: labelBuffer, base, ppid, tick, grace } = workerData;
const slots = new Int32Array(slotBuffer);
const label = new Uint8Array(labelBuffer);
const now = () => Math.round(performance.timeOrigin + performance.now()) - base;

/** `file\ttest` from the heartbeat; the test part is empty outside a test. */
function current() {
  const len = Atomics.load(slots, LEN);
  const text = new TextDecoder().decode(label.slice(0, len));
  const tab = text.indexOf("\t");
  return tab < 0 ? { file: text, test: "" } : { file: text.slice(0, tab), test: text.slice(tab + 1) };
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

/** Every process below `root`, from one `ps` listing; empty when `ps` is unavailable. */
function descendants(root) {
  let listing = "";
  try {
    listing = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8", timeout: 5000 });
  } catch {
    return [];
  }
  const children = new Map();
  for (const line of listing.split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(pid) || !Number.isInteger(parent)) continue;
    const list = children.get(parent) ?? [];
    list.push(pid);
    children.set(parent, list);
  }
  const out = [];
  const queue = [root];
  while (queue.length > 0) {
    const next = queue.shift();
    for (const c of children.get(next) ?? []) {
      out.push(c);
      queue.push(c);
    }
  }
  return out;
}

/**
 * One T0001 line on stderr, written synchronously: the main thread, which owns process.stderr, may be blocked. A
 * fork worker's stderr is a pipe to vitest, which an orphan no longer has (EPIPE): the kill goes ahead regardless.
 */
function kill(reason) {
  const { file, test } = current();
  const name = test.length > 36 ? `${test.slice(0, 35)}…` : test;
  const what = name ? ` "${name}"` : "";
  try {
    writeSync(2, `T0001 ${file || "(vitest worker)"}:1:1 watchdog killed${what} ${reason}\n`);
  } catch {}
  for (const pid of descendants(process.pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  process.kill(process.pid, "SIGKILL");
}

setInterval(() => {
  if (process.ppid !== ppid) {
    kill(`(worker orphaned, parent ${ppid} gone)`);
    return;
  }
  if (Atomics.load(slots, PHASE) !== 1) return;
  const elapsed = now() - Atomics.load(slots, STARTED);
  const bound = Atomics.load(slots, ALLOWED) * 2 + grace;
  if (elapsed > bound) kill(`after ${seconds(elapsed)} (bound ${seconds(bound)})`);
}, tick);
