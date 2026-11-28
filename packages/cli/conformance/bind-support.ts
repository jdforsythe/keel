// Support for the loopback-bind conformance files (not a test file): the machine's non-loopback address, a free port, a connection probe,
// a child in its own process group and bounded waits with no timer of the test's own (`vi.waitFor`). Seed 1337 where a property is used.
import { type ChildProcess, spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { networkInterfaces } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { testTime } from "@keel/tooling/test-time";
import { expect, vi } from "vitest";
import { childEnv } from "./boundary-support.ts";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

/** The first non-loopback IPv4 address of this machine, or undefined when it has none (the cases that need it then do not run: stated in each file). */
export const LAN: string | undefined = Object.values(networkInterfaces())
  .flatMap((a) => a ?? [])
  .find((i) => !i.internal && i.family === "IPv4")?.address;

export const freePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() =>
        typeof addr === "object" && addr !== null ? resolvePort(addr.port) : reject(new Error("no port")),
      );
    });
  });

/** True when a TCP connection to `host:port` is accepted. */
export const accepts = (host: string, port: number): Promise<boolean> =>
  new Promise((res) => {
    const sock = net.connect({ port, host });
    sock.once("connect", () => {
      sock.destroy();
      res(true);
    });
    sock.once("error", () => res(false));
  });

export type Reply = { status: number; body: string };
/** One GET to `host:port` (the connection's own remote address is the machine's, whichever `host` is) with `headers`; undefined when the connection fails. */
export const get = (
  host: string,
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<Reply | undefined> =>
  new Promise((res) => {
    const req = http.request({ host, port, path, method: "GET", headers }, (r) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => res({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", () => res(undefined));
    req.end();
  });

export type Proc = { child: ChildProcess; out: () => string; exited: Promise<number | null>; port: number };
const started = new Set<Proc>();

function signal(p: Proc, s: NodeJS.Signals): void {
  const pid = p.child.pid;
  if (pid === undefined || p.child.exitCode !== null || p.child.signalCode !== null) return;
  try {
    process.kill(-pid, s);
  } catch {
    // the group is gone
  }
}

/** Starts `node <argv>` in `cwd` as a process group leader on a free port; `extra` is added to the environment without `KEEL_*`. */
export async function start(
  argv: (port: number) => string[],
  cwd: string,
  extra: Record<string, string | ((port: number) => string)> = {},
): Promise<Proc> {
  const port = await freePort();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) env[k] = typeof v === "function" ? v(port) : v;
  const child = spawn(process.execPath, argv(port), {
    cwd,
    env: childEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let buf = "";
  for (const s of [child.stdout, child.stderr])
    s?.on("data", (d: Buffer) => {
      buf += d.toString("utf8");
    });
  const exited = new Promise<number | null>((res) => child.on("close", (code) => res(code)));
  const p: Proc = { child, out: () => buf, exited, port };
  started.add(p);
  return p;
}

/** Ends every child this file started (its whole group) and waits for each to close. */
export async function stopAll(): Promise<void> {
  const all = [...started];
  started.clear();
  for (const p of all) signal(p, "SIGKILL");
  await Promise.all(all.map((p) => p.exited));
}

/** Resolves once `host:port` accepts a connection, or the process exits first; bounded by `ms`. */
export async function up(p: Proc, host = "127.0.0.1", ms = testTime(180_000)): Promise<void> {
  let gone = false;
  void p.exited.then(() => {
    gone = true;
  });
  await vi.waitFor(
    async () => {
      if (gone) return;
      expect(await accepts(host, p.port), p.out()).toBe(true);
    },
    { timeout: ms, interval: 100 },
  );
}

/** The exit code of `p`, waited for at most `ms` (a process that stays up fails the wait instead of hanging the case). */
export async function exitCode(p: Proc, ms = testTime(60_000)): Promise<number | null> {
  let done = false;
  let code: number | null = null;
  void p.exited.then((c) => {
    done = true;
    code = c;
  });
  await vi.waitFor(() => expect(done, `still running: ${p.out()}`).toBe(true), { timeout: ms, interval: 100 });
  return code;
}
