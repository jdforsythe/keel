import { ledger, ledgerDiff } from "@keel/testing";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { LedgerFileSchema } from "./LedgerFileSchema.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import { buildLedger } from "./buildLedger.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { summary } from "./summary.ts";

const COMMITTED = [".keel/ledger.json", "tooling/ledger/ledger.json"];

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** One line of evidence: the strongest piece (a property first) and how many more back the item. */
const describe = (item: LedgerItem | undefined): string => {
  const all = item?.evidence ?? [];
  const best = all.find((e) => e.ev.kind === "property") ?? all[0];
  if (best === undefined) return "none";
  const runs = best.ev.runs === undefined ? "" : ` runs ${best.ev.runs}`;
  const seed = best.ev.seed === undefined ? "" : ` seed ${best.ev.seed}`;
  return `${best.ev.kind}${runs}${seed} ${best.path}${all.length > 1 ? ` +${all.length - 1}` : ""}`;
};

/**
 * `keel ledger`: one `ledger` record per exported function and per spec clause, rung by `@keel/testing` `ledger`.
 * `--diff` compares with the committed ledger from `io.files` (`.keel/ledger.json` or the tooling ledger) through
 * `ledgerDiff` and reports E1706 per lowered rung instead.
 */
export function ledgerCommand(input: Input, io: Io): OutRecord[] {
  const files = projectFiles(io);
  const { items, unsafe } = buildLedger(files);
  const byItem = new Map(items.map((i) => [i.item, i]));
  const records = ledger(items.map((i) => ({ item: i.item, evidence: i.evidence.map((e) => e.ev) })));
  const counts = {
    items: records.length,
    verified: records.filter((r) => r.rung !== "none").length,
    unsafe,
  };
  if (input.diff !== true) {
    const out: OutRecord[] = records.map((r) => ({
      kind: "ledger",
      item: r.item,
      rung: r.rung,
      evidence: r.evidence === "none" ? "none" : describe(byItem.get(r.item)),
    }));
    return [...out, summary("ledger", [], counts)];
  }
  const file = COMMITTED.map((p) => files.find((f) => f.path === p)).find((f) => f !== undefined);
  const parsed = file === undefined ? undefined : LedgerFileSchema.parse(safeJson(file.source));
  const before =
    parsed?.ok === true ? parsed.value.exports.map((e) => ({ item: `${e.file}#${e.name}`, rung: e.rung })) : [];
  const diags = ledgerDiff(before, records).map((d) => {
    const path = d.item.includes("#") && d.item.startsWith("packages/") ? d.item.split("#")[0] : undefined;
    return makeDiag(d.code, d.message, {
      path,
      line: path === undefined ? undefined : 1,
      col: path === undefined ? undefined : 1,
      see: d.see,
    });
  });
  return [...diags, summary("ledger --diff", diags, { ...counts, lowered: diags.length })];
}
