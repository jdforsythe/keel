import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import { createCtx } from "@keel/ctx";
import { buildCommand } from "../internal/buildCommand.ts";
import { isError } from "../internal/isError.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import { projectFiles } from "../internal/projectFiles.ts";
import { projectTopology } from "../internal/projectTopology.ts";
import { vitestRun } from "../internal/vitestRun.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { browserCheck } from "./browserCheck.ts";
import { e2eFiles } from "./e2eFiles.ts";
import { makeRunFolder } from "./makeRunFolder.ts";
import { playwrightAt } from "./playwrightAt.ts";
import { sandboxCheck } from "./sandboxCheck.ts";
import { stopDescendants } from "./stopDescendants.ts";
import { sweepRunFolders } from "./sweepRunFolders.ts";

/** An e2e test that declares no timeout has 60 s, fixed time: it bounds a build's output starting and a browser's work (k.e2e Time). */
const TIMEOUT = 60_000;
const GLOBS = ["test/**/*.e2e.ts", "modules/*/test/**/*.e2e.ts"] as const;

const trailer = (ok: boolean, tests = 0, failed = 0, skipped = 0): OutRecord => ({
  kind: "summary",
  ok,
  name: "test",
  counts: { tests, failed, skipped },
});

/**
 * `keel test --e2e [paths] [--engine] [--no-sandbox]` (k.e2e Files): with no e2e file, `ok test 0 tests` and nothing built; else
 * `keel build` (each unserved `client` deployable built with `KEEL_PEER_<NAME>=http://<name>.peer.keel.test` per `node`
 * one, k.e2e Build input), stopping on its failure; the browser check (E1734); then vitest over the e2e files alone.
 * The run report is `reports/tests/e2e.json`; no other file there changes.
 *
 * Teardown (k.e2e-run): at its start the run sweeps what SIGKILLed runs left (`sweepRunFolders`), then makes its one
 * run folder and points `TMPDIR`, `TMP` and `TEMP` there for vitest, so every data folder, host, profile and trace of
 * the run is inside it. The folder is removed when the run ends, whatever its result; on SIGINT or SIGTERM every
 * process the run started is stopped, the folder removed and one `stopped:` line printed, exit 130.
 *
 * The sandbox (k.e2e-run Browser): Chromium runs with it on. Before any file the run launches Chromium once
 * (`sandboxCheck`); a sandbox that cannot start fails the run with one E1734. `--no-sandbox` and Linux as root run
 * without it, each with one W1734 on every run; nothing else turns it off.
 */
export async function e2eCommand(input: Input, io: Io): Promise<OutRecord[]> {
  // The sandbox seam is the runner's input alone: taken out of the environment while the run builds and tests, so no
  // build of it (the build's check for a `KEEL_*` value in a browser file, E1007, k.bundle) and no test file sees it.
  const seam = process.env.KEEL_E2E_SANDBOX;
  Reflect.deleteProperty(process.env, "KEEL_E2E_SANDBOX");
  try {
    return await e2eRun(input, io, seam);
  } finally {
    if (seam !== undefined) process.env.KEEL_E2E_SANDBOX = seam;
  }
}

async function e2eRun(input: Input, io: Io, seam: string | undefined): Promise<OutRecord[]> {
  const files = e2eFiles(io.cwd, input.paths ?? []);
  if (files.length === 0) return [trailer(true)];
  if (io.build === undefined)
    return [makeDiag("T0001", "keel test --e2e runs the built app: run it from the keel binary"), trailer(false)];
  const topology = projectTopology(projectFiles(io)) ?? {};
  const deployables = Object.entries(topology);
  const peers: Record<string, string> = {};
  if (deployables.some(([, d]) => d.adapter === "client" && d.servedBy === undefined))
    for (const [name, d] of deployables)
      if (d.adapter === "node") peers[peerKey(name)] = `http://${name}.peer.keel.test`;
  const saved = new Map(Object.keys(peers).map((k) => [k, process.env[k]]));
  Object.assign(process.env, peers);
  let built: readonly OutRecord[];
  try {
    const b = await buildCommand({ ...io, env: { ...io.env, ...peers } }, {});
    built = b.records;
    // A build that fails says why on stderr, as `keel build` does.
    if (b.stderr !== undefined && b.stderr !== "" && built.some((r) => r.kind === "summary" && r.ok === false))
      process.stderr.write(b.stderr);
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
    }
  }
  const diags = built.filter((r) => r.kind === "diag");
  const buildFailed = built.some((r) => isError(r) || (r.kind === "summary" && r.ok === false));
  if (buildFailed) return [...diags, trailer(false)];
  const engine = input.engine ?? "chromium";
  const missing = await browserCheck(io.cwd, engine);
  if (missing !== undefined) return [...diags, missing, trailer(false)];
  const rooted = process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0;
  const chromium = engine === "chromium";
  const unsandboxed = chromium && (input["no-sandbox"] === true || rooted);
  const warned = !unsandboxed
    ? []
    : [
        makeDiag(
          "W1734",
          input["no-sandbox"] === true ? "chromium sandbox off: --no-sandbox" : "chromium sandbox off: running as root",
          { see: "k.e2e-run" },
        ),
      ];
  const now = createCtx({ mode: "real" }).clock.now();
  sweepRunFolders(tmpdir(), now);
  const run = makeRunFolder(now);
  const at = playwrightAt(io.cwd);
  const refused = chromium && !unsandboxed && at !== undefined ? await sandboxCheck(at, run, seam) : undefined;
  if (refused !== undefined) {
    rmSync(run, { recursive: true, force: true });
    return [...diags, refused, trailer(false)];
  }
  const stop = (): void => {
    const n = stopDescendants();
    rmSync(run, { recursive: true, force: true });
    process.stdout.write(`stopped: removed ${n} processes and the run folder\n`);
    process.exit(130);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const r = await vitestRun(
      io.cwd,
      input.paths ?? [],
      false,
      (report) => {
        const dir = join(io.cwd, "reports", "tests");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "e2e.json"), `${JSON.stringify(report, null, 2)}\n`);
      },
      {
        include: GLOBS,
        timeout: TIMEOUT,
        env: {
          KEEL_E2E: "1",
          KEEL_E2E_ENGINE: engine,
          KEEL_E2E_RUN: run,
          KEEL_E2E_UNSANDBOXED: unsandboxed ? "1" : "0",
          TMPDIR: run,
          TMP: run,
          TEMP: run,
        },
      },
    );
    const out = r.diagnostics.map((d) => makeDiag(d.code, d.message, d));
    return [...diags, ...warned, ...out, trailer(r.failed === 0 && r.errors === 0, r.tests, r.failed, r.skipped)];
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    rmSync(run, { recursive: true, force: true });
  }
}
