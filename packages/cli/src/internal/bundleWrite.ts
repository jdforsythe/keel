import { sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { declaredOrigins } from "@keel/compiler/hosting/declaredOrigins";
import { createCtx } from "@keel/ctx";
import type { Infer } from "@keel/schema";
import type { Manifest } from "../evidence/Manifest.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { KERNEL_SINK_RUNGS } from "./KERNEL_SINK_RUNGS.ts";
import type { Outcome } from "./Outcome.ts";
import { a11yClaims } from "./a11yClaims.ts";
import { a11yFindings } from "./a11yFindings.ts";
import { a11yReport } from "./a11yReport.ts";
import { a11yRuleMap } from "./a11yRuleMap.ts";
import { auditAdvisories } from "./auditAdvisories.ts";
import { bundleLine } from "./bundleLine.ts";
import { checkCommand } from "./checkCommand.ts";
import { depsReport } from "./depsReport.ts";
import { evidenceKey } from "./evidenceKey.ts";
import { gitSource } from "./gitSource.ts";
import { isRecord } from "./isRecord.ts";
import { keelVersions } from "./keelVersions.ts";
import { ledgerCommand } from "./ledgerCommand.ts";
import { makeDiag } from "./makeDiag.ts";
import { piiReport } from "./piiReport.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { securityReport } from "./securityReport.ts";
import { sha256Hex } from "./sha256Hex.ts";
import { summary } from "./summary.ts";
import { testCommand } from "./testCommand.ts";

const SEE = { see: "k.evidence" };

/** `path:line:col ` of a diagnostic record, as much of it as the record holds; `''` without a path. */
const whereOf = (r: OutRecord): string => {
  if (typeof r.path !== "string") return "";
  const at = [r.path, r.line, r.col].filter((x) => typeof x === "string" || typeof x === "number").join(":");
  return `${at} `;
};
const RUNGS = ["none", "monitored", "example", "probabilistic", "exhaustive", "proven"] as const;
type Rung = (typeof RUNGS)[number];
/** The rung `x` names, or `undefined`. */
const rungOf = (x: unknown): Rung | undefined => RUNGS.find((r) => r === x);

const refuse = (code: string, message: string): Outcome => {
  const d = makeDiag(code, message, SEE);
  return { records: [d, summary("evidence", [d], { files: 0 })], writes: [] };
};
const ndjson = (records: readonly OutRecord[]): string => records.map((r) => `${bundleLine(r)}\n`).join("");
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const jsonOf = (text: string | undefined): unknown => {
  try {
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
};
const plural = (n: number, one: string): string => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * `keel evidence [--out <dir>] [--audit <file>]` (k.evidence Command): E1061 without a usable `KEEL_EVIDENCE_KEY` and
 * E1064 for an `--audit` file that is not `pnpm audit --json` output, both before anything runs or is written. Then
 * the `test`, `check` and `ledger` operations run in process, and the six report files, `manifest.json` and its
 * Ed25519 signature `manifest.sig` are written to `<dir>` (default `evidence/<date>`, the UTC date of
 * `ctx.clock.now()`; a sim ctx under `KEEL_SEED`, so its clock is pinned), whether the runs fail or not: a failing run
 * is E1060 after the bundle is written, preceded by what failed (each failed test's T0001 as `keel test` prints it, with
 * its `fix` line, and each check error), and its own `fix` names the first of them, so the last lines name the failure.
 */
export async function bundleWrite(input: Input, io: Io): Promise<Outcome> {
  const env = io.env ?? {};
  const signer = evidenceKey(env.KEEL_EVIDENCE_KEY);
  if (signer === undefined)
    return refuse("E1061", "KEEL_EVIDENCE_KEY is absent or not an Ed25519 private key; nothing written");
  const advisories = input.audit === undefined ? null : auditAdvisories(io.read?.(input.audit));
  if (advisories === undefined) return refuse("E1064", "--audit file is not pnpm audit --json output; nothing written");
  const seed = env.KEEL_SEED === undefined || !/^\d+$/.test(env.KEEL_SEED) ? undefined : Number(env.KEEL_SEED);
  const ctx = createCtx(seed === undefined ? { mode: "real" } : { mode: "sim", seed });
  const at = new Date(ctx.clock.now()).toISOString();
  const outDir = input.out ?? `evidence/${at.slice(0, 10)}`;
  const out = resolve(io.cwd, outDir);

  // `test` first: its Vite run may write `.keel/` artifacts, which `check` and `ledger` then read as they are, so a
  // second run on an unchanged project sees the same files.
  const test = await testCommand({}, io);
  const fresh = io.load === undefined ? io : { ...io, files: io.load("ledger") };
  const files = projectFiles(fresh);
  const check = await checkCommand({}, fresh);
  const map = a11yRuleMap();
  const findings = await a11yFindings(fresh.cwd, files);
  const ledger = ledgerCommand({}, fresh, map, findings);
  const checkErrors = check.filter((r) => r.kind === "diag" && String(r.code).startsWith("E")).length;
  const trailer = test.find((r) => r.kind === "summary");
  const counts = isRecord(trailer?.counts) ? trailer.counts : {};
  const failed = typeof counts.failed === "number" ? counts.failed : 0;
  const failedTests = failed === 0 && trailer?.ok === false ? 1 : failed;

  const rungs = new Map(
    ledger.records.flatMap((r) => {
      const rung = r.kind === "ledger" ? rungOf(r.rung) : undefined;
      return rung === undefined ? [] : [[r.item, rung]];
    }),
  );
  const topology = projectTopology(files);
  const topologySource = files.find((f) => f.path === "topology.ts")?.source ?? "";
  const reports: [string, string][] = [
    [
      "a11y.json",
      json(
        await a11yReport(
          io.cwd,
          a11yClaims(files, map, findings),
          map,
          files.some((f) => f.path === "tokens.ts"),
        ),
      ),
    ],
    ["check.ndjson", ndjson(check)],
    ["deps.json", json(depsReport(io.cwd, advisories))],
    ["ledger.ndjson", ndjson(ledger.records)],
    ["pii.json", json(await piiReport(io.cwd, files, (c) => rungs.get(c) ?? KERNEL_SINK_RUNGS[c] ?? "none"))],
    ["security.json", json(await securityReport(io.cwd, topology, env, declaredOrigins(topologySource).origins))],
  ];
  const pkg = jsonOf(io.read?.("package.json"));
  const manifest: Infer<typeof Manifest> = {
    v: 1,
    app: isRecord(pkg) && typeof pkg.name === "string" ? pkg.name : (io.cwd.split("/").pop() ?? ""),
    at,
    source: gitSource(io.cwd, out),
    keel: keelVersions(io.cwd),
    key: signer.key,
    keyId: signer.keyId,
    runs: { checkErrors, failedTests },
    files: reports.map(([path, text]) => ({
      path,
      sha256: sha256Hex(Buffer.from(text)),
      bytes: Buffer.byteLength(text),
    })),
  };
  const manifestText = json(manifest);
  const signature = sign(null, Buffer.from(manifestText), signer.privateKey).toString("base64");
  mkdirSync(out, { recursive: true });
  const all: readonly (readonly [string, string])[] = [
    ...reports,
    ["manifest.json", manifestText],
    ["manifest.sig", `${signature}\n`],
  ];
  for (const [path, text] of all) writeFileSync(join(out, path), text);

  const why = [
    ...test.filter((r) => r.kind === "diag"),
    ...check.filter((r) => r.kind === "diag" && String(r.code).startsWith("E")),
  ];
  const first = why[0];
  const failing =
    checkErrors + failedTests === 0
      ? []
      : [
          makeDiag(
            "E1060",
            `bundle written with ${plural(checkErrors, "check error")} and ${plural(failedTests, "failed test")}`,
            {
              path: `${outDir.replace(/\/$/, "")}/manifest.json`,
              ...SEE,
              ...(first === undefined ? {} : { fix: `first: ${whereOf(first)}${String(first.message ?? "")}` }),
            },
          ),
        ];
  const shown = failing.length === 0 ? [] : why;
  return { records: [...shown, ...failing, summary("evidence", failing, { files: reports.length })], writes: [] };
}
