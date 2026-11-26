import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { browserCheck } from "./browserCheck.ts";
import { buildCommand } from "./buildCommand.ts";
import { e2eFiles } from "./e2eFiles.ts";
import { isError } from "./isError.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { vitestRun } from "./vitestRun.ts";

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
 * `keel test --e2e [paths] [--engine]` (k.e2e Files): with no e2e file, `ok test 0 tests` and nothing built; else
 * `keel build` (each unserved `client` deployable built with `KEEL_PEER_<NAME>=http://<name>.peer.keel.test` per `node`
 * one, k.e2e Build input), stopping on its failure; the browser check (E1734); then vitest over the e2e files alone.
 * The run report is `reports/tests/e2e.json`; no other file there changes.
 */
export async function e2eCommand(input: Input, io: Io): Promise<OutRecord[]> {
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
    built = (await buildCommand({ ...io, env: { ...io.env, ...peers } }, {})).records;
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
      env: { KEEL_E2E: "1", KEEL_E2E_ENGINE: engine },
    },
  );
  const out = r.diagnostics.map((d) => makeDiag(d.code, d.message, d));
  return [...diags, ...out, trailer(r.failed === 0 && r.errors === 0, r.tests, r.failed, r.skipped)];
}
