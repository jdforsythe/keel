import { setDefaultResultOrder } from "node:dns";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { INDEX_HTML_IGNORED } from "@keel/compiler/hosting/INDEX_HTML_IGNORED";
import { operations } from "../operations.ts";
import type { DevServer } from "./DevServer.ts";
import { devPoll } from "./devPoll.ts";
import { devPort } from "./devPort.ts";
import { errorText } from "./errorText.ts";
import { hostIo } from "./hostIo.ts";
import { makeDiag } from "./makeDiag.ts";
import { parseArgv } from "./parseArgv.ts";
import { portDiag } from "./portDiag.ts";
import { portProbe } from "./portProbe.ts";
import { respond } from "./respond.ts";
import { summary } from "./summary.ts";
import { viteServer } from "./viteServer.ts";

/** What `keel dev` hands back to the binary: `serving` keeps the process alive until a signal stops it. */
type DevOutcome = {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly serving: boolean;
};

/** Signals that stop the dev server, with their numbers for the 128 + n exit code. */
const STOPS = [
  ["SIGINT", 2],
  ["SIGTERM", 15],
] as const;

/**
 * Binary only: `keel dev` over a Vite project, with Vite in this process. Flags are parsed and validated by the `dev`
 * input schema. The project's Vite creates the server (strict port; `--port` when given), the port it resolved is
 * probed on every address, and a port that will not bind is one E1560 line (exit 1): the server is closed and never
 * listens, so it cannot move to another port. Otherwise it listens, prints Vite's banner and URLs, and serves until
 * SIGINT or SIGTERM closes it; a project `index.html` is one W1012 record first (k.head). `KEEL_DEV_DIR` is set to the app's `.keel-dev/` folder first (k.data Files). Undefined when the engine answers instead: flags that do not parse (E1052).
 *
 * Name lookups in this process put IPv4 first, so Vite's default host `localhost` binds 127.0.0.1. A client resolving
 * `localhost` always gets 127.0.0.1, while `::1` is left out on a machine without a non-loopback IPv6 address (address
 * configuration filtering, as on most CI runners and containers); a server on `::1` alone is unreachable there.
 */
export async function devStart(argv: readonly string[], cwd: string): Promise<DevOutcome | undefined> {
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok || parsed.op.name !== "dev") return undefined;
  const { input } = parsed;
  const blocked = (port: number, code: string | undefined): DevOutcome => {
    const diag = portDiag(port, code);
    const r = respond([diag, summary("dev", [diag], { errors: 1 })], hostIo(false), {
      command: "dev",
      format: input.format,
      quiet: input.quiet,
      limit: input.limit,
      verbose: input.verbose,
      code: input.code,
    });
    return { code: r.code, stdout: r.stdout, stderr: "", serving: false };
  };
  if (devPoll(process.env.KEEL_DEV_POLL) === undefined) {
    const diag = makeDiag("E1560", "dev watcher setting KEEL_DEV_POLL is not 1, 0 or unset", {
      fix: "set KEEL_DEV_POLL=1 to poll for file changes, or unset it",
      see: "k.topology",
    });
    const r = respond([diag, summary("dev", [diag], { errors: 1 })], hostIo(false), {
      command: "dev",
      format: input.format,
      quiet: input.quiet,
      limit: input.limit,
      verbose: input.verbose,
      code: input.code,
    });
    return { code: r.code, stdout: r.stdout, stderr: "", serving: false };
  }
  setDefaultResultOrder("ipv4first");
  // Where a capability keeps its dev data (k.data Files), beside each deployable's storage file.
  process.env.KEEL_DEV_DIR = join(resolve(cwd), ".keel-dev");
  let server: DevServer;
  try {
    server = await viteServer(cwd, input.port, input.format !== "pretty");
  } catch (e) {
    return { code: 1, stdout: "", stderr: `error when starting dev server: ${errorText(e)}\n`, serving: false };
  }
  const port = devPort(input.port, server.port);
  const busy = await portProbe(port);
  if (busy !== undefined) {
    await server.close();
    return blocked(port, busy);
  }
  try {
    await server.listen();
  } catch (e) {
    await server.close();
    return blocked(port, e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : undefined);
  }
  // W1012 (k.head Document source): the project's `index.html` is never read, in dev as in a build.
  if (existsSync(join(cwd, "index.html"))) {
    const diag = makeDiag("W1012", INDEX_HTML_IGNORED, { path: "index.html", line: 1, col: 1, see: "k.head" });
    process.stdout.write(
      respond([diag], hostIo(false), { command: "dev", format: input.format, quiet: input.quiet, limit: input.limit })
        .stdout,
    );
  }
  for (const [signal, n] of STOPS) {
    process.once(signal, () => {
      void server.close().finally(() => process.exit(128 + n));
    });
  }
  server.info(`\n  VITE v${server.version}  ready in ${Math.ceil(performance.now())} ms\n`);
  server.printUrls();
  server.shortcuts();
  return { code: 0, stdout: "", stderr: "", serving: true };
}
