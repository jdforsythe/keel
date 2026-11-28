// Starting and stopping the server of an arm: a free port, a child process, a wait for the first answer.
import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";

export type Served = { origin: string; stop: () => Promise<void>; output: () => string };

export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function answers(origin: string): Promise<boolean> {
  try {
    return (await fetch(`${origin}/`, { signal: AbortSignal.timeout(1_500) })).status < 500;
  } catch {
    return false;
  }
}

function stopper(child: ChildProcess): () => Promise<void> {
  return () =>
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const kill = setTimeout(() => child.kill("SIGKILL"), 3_000);
      child.once("exit", () => {
        clearTimeout(kill);
        resolve();
      });
      child.kill("SIGTERM");
    });
}

/** Runs `cmd args` in `cwd` with PORT set and resolves once `/` answers; rejects with the server's output on exit or timeout. */
export async function serve(
  cmd: string,
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>>,
  waitMs = 60_000,
): Promise<Served> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(cmd, [...args], {
    cwd,
    env: { ...process.env, ...env, PORT: String(port), KEEL_ORIGIN: origin, KEEL_AGENT: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  const keep = (d: Buffer): void => {
    out = (out + String(d)).slice(-4_000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const stop = stopper(child);
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    if (exited) break;
    if (await answers(origin)) return { origin, stop, output: () => out };
    await sleep(300);
  }
  await stop();
  throw new Error(exited ? `server exited: ${out.trim().split("\n").pop() ?? ""}` : "server did not answer in time");
}
