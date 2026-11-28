import { constants, accessSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readLibraryLedger } from "@keel/check";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { TestRunReport } from "@keel/testing";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Outcome } from "./Outcome.ts";
import { appMarkedLibrary } from "./appMarkedLibrary.ts";
import { checkCommand } from "./checkCommand.ts";
import { frozenRun } from "./derived/frozenRun.ts";
import { isError } from "./isError.ts";
import { isRecord } from "./isRecord.ts";
import { jsonFieldAt } from "./jsonFieldAt.ts";
import { ledgerCommand } from "./ledgerCommand.ts";
import { makeDiag } from "./makeDiag.ts";
import { packageShape } from "./packageShape.ts";
import { relPath } from "./relPath.ts";
import { summary } from "./summary.ts";
import { testCommand } from "./testCommand.ts";

const LEDGER = ".keel/ledger.json";
const RUN_REPORT = "reports/tests/run.json";
const RUN_REPORTS = /^reports\/tests\//;
const SEE = "k.library-pack";
const plural = (n: number, one: string): string => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The `kind` step: the folder's `package.json` marks a library under a scoped name, else why not. */
function kind(
  cwd: string,
):
  | { readonly ok: true; readonly pkg: Readonly<Record<string, unknown>>; readonly text: string }
  | { readonly ok: false; readonly diag: OutRecord } {
  /** One E1164 naming `kind`: at `package.json`, at `at` (line 1 by default), unless `nowhere`. */
  const fail = (
    message: string,
    at?: { line: number; col: number },
    nowhere = false,
  ): { ok: false; diag: OutRecord } => ({
    ok: false,
    diag: makeDiag("E1164", `kind: ${message}`, {
      ...(nowhere ? {} : { path: "package.json", ...(at ?? { line: 1, col: 1 }) }),
      see: SEE,
    }),
  });
  let text: string;
  try {
    text = readFileSync(join(cwd, "package.json"), "utf8");
  } catch {
    return fail("no package.json here, so no library", undefined, true);
  }
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    return fail("package.json is not JSON");
  }
  if (!isRecord(pkg) || pkg.keel !== "library")
    return fail('package.json has no "keel": "library"', isRecord(pkg) ? jsonFieldAt(text, "keel") : undefined);
  const name = typeof pkg.name === "string" ? pkg.name : "";
  if (libraryKind(pkg, name) !== "library")
    return fail(`name ${JSON.stringify(name.slice(0, 40))} is no scoped package name`, jsonFieldAt(text, "name"));
  return { ok: true, pkg, text };
}

/** Why `.keel/ledger.json` cannot be written in `cwd`, or undefined. */
function unwritable(cwd: string): string | undefined {
  const dir = join(cwd, ".keel");
  if (existsSync(dir) && !statSync(dir).isDirectory()) return ".keel is not a folder";
  try {
    accessSync(existsSync(dir) ? dir : cwd, constants.W_OK);
    if (existsSync(join(cwd, LEDGER))) accessSync(join(cwd, LEDGER), constants.W_OK);
  } catch {
    return `${LEDGER} cannot be written here`;
  }
  return undefined;
}

/**
 * `keel pack [--frozen]` (k.library-pack Pack), in a library's own folder: the steps `kind` (the folder's
 * `package.json` marks a library under a scoped name), `package` (`packageShape`), `check` (`keel check` there),
 * `test` (`keel test` there, its run report held, not written) and `ledger` (`keel ledger --write .keel/ledger.json`
 * over that run's report in place of any on disk; run frozen (`--frozen`, or `CI` set: `frozenRun`), the shipped file's
 * `unsafe`, `hostElements` and `exports` as an app reads them, `readLibraryLedger`, against the ones it would write).
 * In an app's folder (`appMarkedLibrary`) it runs no step: one E1170 and the summary. It stops at the first step that fails: that step's own records, then one E1164 whose message begins with the step's
 * name. On success one summary whose `counts` are the written ledger's `{ unsafe, hostElements, exports }`, and, without
 * frozen, the ledger file as the one write. Nothing else is written, so a failing run leaves the folder as it was.
 */
export async function packCommand(input: Input, io: Io): Promise<Outcome> {
  const frozen = frozenRun(input.frozen, io.env);
  const name = frozen ? "pack --frozen" : "pack";
  const stop = (records: readonly OutRecord[], diag: OutRecord): Outcome => ({
    records: [...records, diag, summary(name, [diag], {})],
    writes: [],
  });
  // An app's folder marked a library stops at once with its E1170 alone (k.module).
  const marked = appMarkedLibrary(io.cwd);
  if (marked !== undefined) return { records: [marked, summary(name, [marked], {})], writes: [] };
  const k = kind(io.cwd);
  if (!k.ok) return stop([], k.diag);
  const shape = packageShape(io.cwd, k.pkg, k.text);
  if (shape !== undefined) return stop([], shape);
  const checked = (await checkCommand(frozen ? { frozen: true } : {}, io)).filter((r) => r.kind !== "summary");
  const errors = checked.filter(isError).length;
  if (errors > 0)
    return stop(checked, makeDiag("E1164", `check: ${plural(errors, "error")}; nothing packed`, { see: SEE }));
  // The test step writes no run report: a pack writes `.keel/ledger.json` alone (k.library-pack Pack). The ledger step
  // reads that run's report, held here, in place of any `reports/tests/` on disk.
  let run: TestRunReport = { v: 1, files: {} };
  const tested = await testCommand({}, io, (r) => {
    run = r;
  });
  const trailer = tested.find((r) => r.kind === "summary");
  if (trailer?.ok !== true) {
    const counts = isRecord(trailer?.counts) ? trailer.counts : {};
    const failed = typeof counts.failed === "number" ? counts.failed : 0;
    const tests = typeof counts.tests === "number" ? counts.tests : 0;
    const why = failed > 0 ? `${failed} of ${plural(tests, "test")} failed` : "the run did not pass";
    return stop(
      tested.filter((r) => r.kind !== "summary"),
      makeDiag("E1164", `test: ${why}; nothing packed`, { see: SEE }),
    );
  }
  const own = { path: RUN_REPORT, source: `${JSON.stringify(run, null, 2)}\n` };
  const files = (io.files ?? []).filter((f) => !RUN_REPORTS.test(relPath(io.cwd, f.path)));
  const written = ledgerCommand({ write: LEDGER }, { ...io, files: [...files, own] });
  const content = written.writes[0]?.content;
  const fresh = readLibraryLedger(typeof content === "string" ? content : undefined);
  if (!fresh.ok) return stop([], makeDiag("E1164", "ledger: the ledger it would write fails its shape", { see: SEE }));
  const counts = {
    unsafe: fresh.value.unsafe,
    hostElements: fresh.value.hostElements,
    exports: fresh.value.exports.length,
  };
  const at = { path: LEDGER, line: 1, col: 1, see: SEE };
  if (frozen) {
    const file = join(io.cwd, LEDGER);
    const shipped = readLibraryLedger(existsSync(file) ? readFileSync(file, "utf8") : undefined);
    if (!shipped.ok)
      return stop(
        [],
        shipped.fault === "missing"
          ? makeDiag("E1164", `ledger: ${LEDGER} is missing; keel pack writes it`, { see: SEE })
          : makeDiag("E1164", `ledger: ${LEDGER} fails its shape; keel pack writes it again`, at),
      );
    const stale = (["unsafe", "hostElements", "exports"] as const).find(
      (f) => JSON.stringify(shipped.value[f]) !== JSON.stringify(fresh.value[f]),
    );
    if (stale !== undefined)
      return stop([], makeDiag("E1164", `ledger: ${LEDGER} is stale at ${stale}; keel pack writes it again`, at));
    return { records: [summary(name, [], counts)], writes: [] };
  }
  const why = unwritable(io.cwd);
  if (why !== undefined)
    return stop(
      [],
      makeDiag("E1164", `ledger: ${why}`, { path: why.startsWith(".keel is") ? ".keel" : LEDGER, see: SEE }),
    );
  return {
    records: [summary(name, [], counts)],
    writes: [{ path: LEDGER, content: typeof content === "string" ? content : "", readonly: false }],
  };
}
