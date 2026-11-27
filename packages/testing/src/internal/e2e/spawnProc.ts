import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { LogRecord } from "../../types/LogRecord.ts";
import type { Proc } from "./Proc.ts";
import type { StartFailure } from "./StartFailure.ts";
import { answersAt } from "./answersAt.ts";
import { compactRecord } from "./compactRecord.ts";
import { freePort } from "./freePort.ts";
import { parseLogLine } from "./parseLogLine.ts";
import { seconds } from "./seconds.ts";

const live = new Set<ChildProcess>();
let hooked = false;
/** Every child still running is killed when the test process exits, whatever ended it. */
function hookExit(): void {
  if (hooked) return;
  hooked = true;
  process.on("exit", () => {
    for (const c of live) c.kill("SIGKILL");
  });
}

/** A process that loses its port to another (E1560 `fails to bind`) is started again on another, at most 3 times. */
const RETRIES = 3;

/**
 * A process `serve` runs: `node <args>` in `cwd` with `env(port)` on a free port (`port` given, the one a restart
 * keeps). It is ready when it answers `GET /` at `http://127.0.0.1:<port>` after writing its listen record (`waitListen`)
 * or, for `keel dev`, which writes none, at its first answer after any line; `readyMs` bounds the wait.
 */
export function spawnProc(opts: {
  readonly name: string;
  readonly cwd: string;
  readonly args: (port: number) => readonly string[];
  readonly env: (port: number) => Readonly<Record<string, string>>;
  readonly readyMs: number;
  readonly waitListen: boolean;
  readonly port?: number;
}): Proc {
  const log: LogRecord[] = [];
  let child: ChildProcess | undefined;
  let exited: Promise<void> = Promise.resolve();
  let port = opts.port ?? 0;
  let started = false;

  const once = (at: number): Promise<StartFailure | undefined> =>
    new Promise((done) => {
      hookExit();
      const from = log.length;
      const c = spawn(process.execPath, [...opts.args(at)], {
        cwd: opts.cwd,
        env: { ...opts.env(at) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child = c;
      live.add(c);
      let settled = false;
      const finish = (f: StartFailure | undefined): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done(f);
      };
      const timer = setTimeout(
        () => finish({ why: "silent", detail: `no HTTP answer to GET / within ${seconds(opts.readyMs)}` }),
        opts.readyMs,
      );
      let probing = false;
      const probe = async (): Promise<void> => {
        if (probing || settled) return;
        probing = true;
        const ok = await answersAt(`http://127.0.0.1:${at}`);
        probing = false;
        if (ok) finish(undefined);
      };
      const onLine = (line: string): void => {
        if (line.trim() === "") return;
        const r = parseLogLine(line);
        log.push(r);
        // The listen record, json or compact (`env` may set `KEEL_FORMAT`).
        if ((r.kind === "summary" && r.name === "listen") || (r.kind === "other" && /^ok listen/.test(r.text)))
          void probe();
        else if (!opts.waitListen) void probe();
      };
      for (const s of [c.stdout, c.stderr]) if (s !== null) createInterface({ input: s }).on("line", onLine);
      exited = new Promise((gone) =>
        c.once("exit", (code, signal) => {
          live.delete(c);
          const mine = log.slice(from);
          const bind = mine.some((r) => r.kind === "diag" && r.code === "E1560" && r.message.includes("bind"));
          const tail = mine.slice(-10).map(compactRecord).join(" | ");
          finish({
            why: bind ? "bind" : "exit",
            detail: `exited ${signal ?? `with code ${code ?? 0}`}${tail === "" ? "" : `: ${tail}`}`,
          });
          gone();
        }),
      );
      c.once("error", (e) => finish({ why: "exit", detail: e.message }));
    });

  const kill = async (): Promise<void> => {
    const c = child;
    if (c !== undefined && c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
    await exited;
  };
  /** SIGTERM, then the process's own exit: its code, or the signal that ended it. */
  const drain = async (): Promise<number | string> => {
    const c = child;
    if (c === undefined) return 0;
    if (c.exitCode === null && c.signalCode === null) c.kill("SIGTERM");
    await exited;
    return c.exitCode ?? c.signalCode ?? 0;
  };

  return {
    name: opts.name,
    log,
    port: () => port,
    running: () => child !== undefined && child.exitCode === null && child.signalCode === null,
    start: async () => {
      // A first start may take another port; a restart keeps its own (k.e2e Served `start`).
      const fresh = !started;
      for (let attempt = 0; ; attempt++) {
        if (port === 0) port = await freePort();
        const failure = await once(port);
        if (failure === undefined) {
          started = true;
          return;
        }
        await kill();
        if (failure.why === "bind" && attempt < RETRIES && fresh) {
          port = 0;
          continue;
        }
        throw new Error(failure.detail);
      }
    },
    kill,
    drain,
  };
}
