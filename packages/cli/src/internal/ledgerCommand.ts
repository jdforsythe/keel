import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { LedgerFileSchema } from "./LedgerFileSchema.ts";
import { buildLedger } from "./buildLedger.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { summary } from "./summary.ts";

const RUNGS: readonly string[] = ["none", "example", "probabilistic", "exhaustive", "proven"];
const COMMITTED = [".keel/ledger.json", "tooling/ledger/ledger.json"];
const LEDGER_RUNGS = ["none", "example", "probabilistic", "exhaustive", "proven", "monitored"] as const;
const asRung = (r: string): (typeof LEDGER_RUNGS)[number] => LEDGER_RUNGS.find((x) => x === r) ?? "none";

/**
 * `keel ledger`: one `ledger` record per exported function (k.testing). `--diff` compares with the committed
 * ledger from `io.files` and reports E1706 per lowered rung instead.
 */
export function ledgerCommand(input: Input, io: Io): OutRecord[] {
  const files = projectFiles(io);
  const next = buildLedger(files);
  const counts = {
    exports: next.exports.length,
    verified: next.exports.filter((e) => e.rung !== "none").length,
    unsafe: next.unsafe,
  };
  if (input.diff !== true) {
    const records: OutRecord[] = next.exports.map((e) => ({
      kind: "ledger",
      item: `${e.file}#${e.name}`,
      rung: asRung(e.rung),
      evidence: e.evidence,
    }));
    return [...records, summary("ledger", [], counts)];
  }
  const file = COMMITTED.map((p) => files.find((f) => f.path === p)).find((f) => f !== undefined);
  const parsed = file === undefined ? undefined : LedgerFileSchema.parse(safeJson(file.source));
  const before = new Map(parsed?.ok === true ? parsed.value.exports.map((e) => [`${e.file}#${e.name}`, e.rung]) : []);
  const diags = next.exports.flatMap((e) => {
    const old = before.get(`${e.file}#${e.name}`);
    return old !== undefined && RUNGS.indexOf(e.rung) < RUNGS.indexOf(old)
      ? [
          makeDiag("E1706", `${e.name} rung lowered ${old} -> ${e.rung}`, {
            path: e.file,
            line: 1,
            col: 1,
            see: "k.testing",
          }),
        ]
      : [];
  });
  return [...diags, summary("ledger --diff", diags, { ...counts, lowered: diags.length })];
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
