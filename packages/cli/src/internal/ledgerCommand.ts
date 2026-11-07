import { type LedgerRecord, ledger, ledgerDiff } from "@keel/testing";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { LedgerFileSchema } from "./LedgerFileSchema.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import type { Outcome } from "./Outcome.ts";
import { buildLedger } from "./buildLedger.ts";
import { makeDiag } from "./makeDiag.ts";
import { mutationScores } from "./mutationScores.ts";
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

/** The file an item lives in: the source file, `apps/<app>/modules/<path>`, or the spec section. */
const itemPath = (item: string): string => {
  const file = item.slice(0, item.lastIndexOf("#"));
  if (file.startsWith("packages/")) return file;
  const at = file.indexOf(":");
  if (at > 0) return `apps/${file.slice(0, at)}/modules/${file.slice(at + 1)}`;
  return `spec/${file.startsWith("k.") ? "kernel" : "std"}/${file}.md`;
};

/** The ledger file: unsafe count, mutation scores, exports (`{ pkg, name, file, rung }`), clauses (`{ item, rung }`). */
const ledgerFile = (
  records: readonly LedgerRecord[],
  byItem: ReadonlyMap<string, LedgerItem>,
  unsafe: number,
  mutation: Readonly<Record<string, number>>,
): string => {
  const exports: { pkg: string; name: string; file: string; rung: string }[] = [];
  const clauses: { item: string; rung: string }[] = [];
  for (const r of records) {
    const pkg = byItem.get(r.item)?.pkg;
    const at = r.item.lastIndexOf("#");
    if (pkg === undefined) clauses.push({ item: r.item, rung: r.rung });
    else exports.push({ pkg, name: r.item.slice(at + 1), file: r.item.slice(0, at), rung: r.rung });
  }
  const scores = Object.keys(mutation).length > 0 ? { mutationScore: mutation } : {};
  return `${JSON.stringify({ version: 1, unsafe, ...scores, exports, clauses }, null, 2)}\n`;
};

/**
 * `keel ledger` (k.testing Ledger), the one ledger implementation: one `ledger` record per export and per spec
 * clause, rung by `@keel/testing` `ledger`, after any W1706 header notes. `--write <file>` names the ledger file:
 * `keel ledger` writes the records there instead (with per-package mutation scores; stdout keeps the notes and the
 * trailer); `--diff` compares with it (default
 * `.keel/ledger.json`, else `tooling/ledger/ledger.json`) through `ledgerDiff` and writes nothing: E1706 per lowered
 * rung, and E1706 when the unsafe count rose. `--scope <prefix>` keeps the items whose key starts with it; the
 * unsafe count is then the matching apps' (`golden-1:`), compared with zero.
 */
export function ledgerCommand(input: Input, io: Io): Outcome {
  const files = projectFiles(io);
  const built = buildLedger(files);
  const byItem = new Map(built.items.map((i) => [i.item, i]));
  const all = ledger(built.items.map((i) => ({ item: i.item, evidence: i.evidence.map((e) => e.ev) })));
  const scope = input.scope ?? "";
  const records = all.filter((r) => r.item.startsWith(scope));
  const apps = Object.keys(built.appUnsafe).filter((a) => `${a}:`.startsWith(scope) || scope.startsWith(`${a}:`));
  const unsafe = scope === "" ? built.unsafe : apps.reduce((n, a) => n + (built.appUnsafe[a] ?? 0), 0);
  const notes = scope === "" ? built.diags : [];
  const counts = {
    items: records.length,
    verified: records.filter((r) => r.rung !== "none").length,
    unsafe,
    warnings: notes.length,
  };
  if (input.diff !== true) {
    const out: OutRecord[] = records.map((r) => ({
      kind: "ledger",
      item: r.item,
      rung: r.rung,
      evidence: r.evidence === "none" ? "none" : describe(byItem.get(r.item)),
    }));
    const content = ledgerFile(all, byItem, built.unsafe, mutationScores(files));
    return {
      records: [...notes, ...(input.write === undefined ? out : []), summary("ledger", notes, counts)],
      writes: input.write === undefined ? [] : [{ path: input.write, content, readonly: false }],
    };
  }
  const name = input.write ?? COMMITTED.find((p) => files.some((f) => f.path === p));
  const file = files.find((f) => f.path === name);
  const parsed = file === undefined ? undefined : LedgerFileSchema.parse(safeJson(file.source));
  const committed = parsed?.ok === true ? parsed.value : undefined;
  const before = [
    ...(committed?.exports ?? []).map((e) => ({ item: `${e.file}#${e.name}`, rung: e.rung })),
    ...(committed?.clauses ?? []),
  ].filter((r) => r.item.startsWith(scope));
  const diags = ledgerDiff(before, records).map((d) =>
    makeDiag(d.code, d.message, { path: itemPath(d.item), line: 1, col: 1, see: d.see }),
  );
  const allowed = scope === "" ? committed?.unsafe : 0;
  if (committed !== undefined && allowed !== undefined && unsafe > allowed)
    diags.push(makeDiag("E1706", `unsafe count up ${allowed} -> ${unsafe}`, { path: name, see: "k.testing" }));
  return {
    records: [...notes, ...diags, summary("ledger --diff", diags, { ...counts, lowered: diags.length })],
    writes: [],
  };
}
