import { setDefaultResultOrder } from "node:dns";
import { existsSync } from "node:fs";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { libraryEntryDiags } from "@keel/check";
import { INDEX_HTML_IGNORED } from "@keel/compiler/hosting/INDEX_HTML_IGNORED";
import { operations } from "../operations.ts";
import type { DevServer } from "./DevServer.ts";
import { devPoll } from "./devPoll.ts";
import { devPort } from "./devPort.ts";
import { errorText } from "./errorText.ts";
import { hostIo } from "./hostIo.ts";
import { libraryProjectFiles } from "./libraryProjectFiles.ts";
import { makeDiag } from "./makeDiag.ts";
import { parseArgv } from "./parseArgv.ts";
import { portDiag } from "./portDiag.ts";
import { portProbe } from "./portProbe.ts";
import { readProject } from "./readProject.ts";
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

/** The `server.host` values that keep Vite on loopback (k.topology Local topology). */
const LOOPBACK_HOSTS: ReadonlySet<unknown> = new Set([undefined, "localhost", "127.0.0.1", "::1"]);

/** Whether `address` is `0.0.0.0` or an IP address one of this machine's interfaces holds. */
const ownAddress = (address: string): boolean =>
  address === "0.0.0.0" ||
  (isIP(address) !== 0 &&
    Object.values(networkInterfaces()).some((list) => (list ?? []).some((i) => i.address === address)));

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
 * It listens on loopback alone (k.topology Local topology): a Vite `server.host` past loopback is one E1560 naming
 * `server.host`, and `--host <address>` (`0.0.0.0` or an address of this machine, else E1560 naming `--host`) is the one
 * way wider, listening there and on `127.0.0.1` with one W1569 naming both.
 *
 * Name lookups in this process put IPv4 first, so Vite's default host `localhost` binds 127.0.0.1. A client resolving
 * `localhost` always gets 127.0.0.1, while `::1` is left out on a machine without a non-loopback IPv6 address (address
 * configuration filtering, as on most CI runners and containers); a server on `::1` alone is unreachable there.
 */
export async function devStart(argv: readonly string[], cwd: string): Promise<DevOutcome | undefined> {
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok || parsed.op.name !== "dev") return undefined;
  const { input } = parsed;
  const refuse = (diag: ReturnType<typeof makeDiag>): DevOutcome => {
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
  if (input.host !== undefined && !ownAddress(input.host))
    return refuse(
      makeDiag("E1560", `keel dev --host ${input.host} is not 0.0.0.0 or an IP address of this machine`, {
        fix: "pass --host 0.0.0.0 or one of this machine's addresses, or leave --host out to stay on loopback",
        see: "k.topology",
      }),
    );
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
  // While a library's entry or shipped tokens file is out of shape (E1815, E1812), nothing is evaluated or bundled
  // (k.entries): the dev server does not start.
  const project = readProject(cwd, "query");
  const refused = libraryEntryDiags([...project, ...libraryProjectFiles(cwd, project)]).map((d) =>
    makeDiag(d.code, d.message, {
      path: d.path,
      line: d.line,
      col: d.col,
      ...(d.see === undefined ? {} : { see: d.see }),
    }),
  );
  if (refused.length > 0) {
    const r = respond([...refused, summary("dev", refused, { errors: refused.length })], hostIo(false), {
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
    server = await viteServer(cwd, input.port, input.host, input.format !== "pretty");
  } catch (e) {
    return { code: 1, stdout: "", stderr: `error when starting dev server: ${errorText(e)}\n`, serving: false };
  }
  // Only `--host` listens past loopback: a Vite `server.host` that would is refused before anything listens.
  if (input.host === undefined && !LOOPBACK_HOSTS.has(server.host)) {
    await server.close();
    return refuse(
      makeDiag("E1560", `vite server.host ${String(server.host)} listens beyond loopback`, {
        fix: "remove server.host from the Vite config; pass keel dev --host <address> to listen on a network",
        see: "k.topology",
      }),
    );
  }
  const port = devPort(input.port, server.port);
  const busy = await portProbe(port);
  if (busy !== undefined) {
    await server.close();
    return blocked(port, busy);
  }
  try {
    await server.listen();
    if (input.host !== undefined && input.host !== "0.0.0.0") await server.loopback(port);
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
  // W1569 (k.topology): `--host` listens on a network as well as loopback.
  if (input.host !== undefined) {
    const at = input.host === "0.0.0.0" ? "0.0.0.0 (every address) and 127.0.0.1" : `${input.host} and 127.0.0.1`;
    const diag = makeDiag("W1569", `keel dev listens on ${at}: anyone on that network can reach it`, {
      see: "k.topology",
    });
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
