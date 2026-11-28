// What ended a vitest fork worker that died mid-run. Vitest reports such a death as "[vitest-pool]: Worker forks
// emitted error." and drops the exit code, the signal and anything the worker wrote last. Installed once in the
// vitest process (the Keel reporter's onInit), this records, for every fork worker that exits while vitest still
// listens for its unexpected exit or that vitest did not ask to stop, its exit code or signal, the test files vitest
// last sent it and the last line it wrote to stderr. A worker vitest stops on purpose is sent a `stop` request first
// and is not recorded. A worker whose channel fails as it dies is force-stopped by vitest, which removes the exit
// listener before the exit arrives and sends no `stop` request: it is recorded.
import { ChildProcess } from "node:child_process";

export type WorkerExit = {
  readonly pid: number;
  readonly code: number | null;
  readonly signal: string | null;
  /** The test files of the last run or collect request vitest sent the worker. */
  readonly files: readonly string[];
  readonly said: string;
};

const TAIL = 60;
const exits: (Omit<WorkerExit, "said"> & { readonly child: ChildProcess })[] = [];
const tails = new WeakMap<ChildProcess, string[]>();
const sent = new WeakMap<ChildProcess, readonly string[]>();
/** Fork workers vitest has sent a `stop` request: their exit is one vitest asked for. */
const stopped = new WeakSet<ChildProcess>();
let installed = false;

/** True for the process vitest forks to run test files (`vitest/dist/workers/forks.js`). */
const isForkWorker = (c: ChildProcess): boolean => c.spawnargs.some((a) => /[\\/]workers[\\/]forks\.js$/.test(a));

/** Vitest's own listener for a worker's unexpected exit is a class field named `emitUnexpectedExit`. */
const unexpected = (c: ChildProcess): boolean => c.listeners("exit").some((l) => l.name === "emitUnexpectedExit");

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** The `filepath` of each file in a vitest worker request (`{ type: "run", context: { files } }`), else none. */
export function requestFiles(message: unknown): readonly string[] | undefined {
  if (!isRec(message) || !isRec(message.context) || !Array.isArray(message.context.files)) return undefined;
  return message.context.files.flatMap((f: unknown) =>
    isRec(f) && typeof f.filepath === "string" ? [f.filepath] : [],
  );
}

const FATAL = /FATAL|out of memory|Segmentation fault|Assertion failed|Abort|panicked|Error\b/;

/**
 * What a dying worker said: the last line of `lines` naming a fatal error (Node's `FATAL ERROR: ...`, an assertion,
 * a thrown `Error`), else its last non-empty line; without ANSI escapes or Node's native stack frames.
 */
export function lastSaid(lines: readonly string[]): string {
  const esc = String.fromCharCode(27);
  const ansi = new RegExp(`${esc}\\[[0-9;]*m`, "g");
  const said = lines
    .map((l) => l.replace(ansi, "").trim())
    .filter((l) => l !== "" && !/^\d+: 0x[0-9a-f]+ /.test(l) && !/^-+ .* -+$/.test(l));
  return [...said].reverse().find((l) => FATAL.test(l)) ?? said.at(-1) ?? "";
}

/** Start recording fork worker exits in this process; a second call does nothing. */
export function watchWorkerExits(): void {
  if (installed) return;
  installed = true;
  const emit = ChildProcess.prototype.emit;
  ChildProcess.prototype.emit = function keelWatchedEmit(
    this: ChildProcess,
    event: string | symbol,
    ...args: unknown[]
  ): boolean {
    if (event === "spawn" && isForkWorker(this)) {
      const send = this.send;
      Object.defineProperty(this, "send", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): boolean => {
          const files = requestFiles(args[0]);
          if (files !== undefined) sent.set(this, files);
          if (isRec(args[0]) && args[0].type === "stop") stopped.add(this);
          return Reflect.apply(send, this, args);
        },
      });
      // Whole lines only: a chunk may end mid-line, and its rest comes with the next one.
      const tail: string[] = [""];
      tails.set(this, tail);
      this.stderr?.on("data", (chunk: Buffer | string) => {
        const [first = "", ...more] = String(chunk).split("\n");
        tail[tail.length - 1] += first;
        tail.push(...more);
        if (tail.length > TAIL) tail.splice(0, tail.length - TAIL);
      });
    }
    if (event === "exit" && isForkWorker(this) && (unexpected(this) || !stopped.has(this))) {
      const [code, signal] = args;
      exits.push({
        child: this,
        pid: this.pid ?? 0,
        code: typeof code === "number" ? code : null,
        signal: typeof signal === "string" ? signal : null,
        files: sent.get(this) ?? [],
      });
    }
    return Reflect.apply(emit, this, [event, ...args]);
  };
}

/**
 * Every unexpected fork worker exit recorded so far, oldest first. What each worker said is read now, not at its
 * exit: a dead worker's last stderr can arrive after its exit event.
 */
export const workerExits = (): readonly WorkerExit[] =>
  exits.map(({ child, ...e }) => ({ ...e, said: lastSaid(tails.get(child) ?? []) }));

/** `killed by SIGKILL` or `exited 134`, then what the worker said last. */
export function describeExit(e: WorkerExit | undefined): string {
  if (e === undefined) return "worker exited unexpectedly";
  const how = e.signal !== null ? `worker killed by ${e.signal}` : `worker exited ${e.code ?? "unexpectedly"}`;
  return e.said === "" ? how : `${how}: ${e.said}`;
}
