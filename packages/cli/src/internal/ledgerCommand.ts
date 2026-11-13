import type { Infer } from "@keel/schema";
import { type Evidence, type LedgerRecord, ledger, ledgerDiff } from "@keel/testing";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { LedgerFileSchema } from "./LedgerFileSchema.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import type { Outcome } from "./Outcome.ts";
import { buildLedger } from "./buildLedger.ts";
import { coverageGaps } from "./coverageGaps.ts";
import { makeDiag } from "./makeDiag.ts";
import { mutationClaims } from "./mutationClaims.ts";
import { projectFiles } from "./projectFiles.ts";
import { summary } from "./summary.ts";

type Mutation = NonNullable<Infer<typeof LedgerFileSchema>["mutation"]>;

const COMMITTED = [".keel/ledger.json", "tooling/ledger/ledger.json"];

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Rungs from lowest to highest, as `ledger` ranks them. */
const RANK = ["none", "monitored", "example", "probabilistic", "exhaustive", "proven"];
// A property run outranks an example on the same rung, so an unseeded run still shows its runs.
const rankOf = (ev: Evidence): number =>
  RANK.indexOf(ledger([{ item: "", evidence: [ev] }])[0]?.rung ?? "none") * 2 + (ev.kind === "property" ? 1 : 0);

/** One line of evidence: the strongest piece, with its runs, seed, depth and `to`, and how many more back the item. */
const describe = (item: LedgerItem | undefined): string => {
  const all = item?.evidence ?? [];
  const best = all.reduce<(typeof all)[number] | undefined>(
    (a, e) => (a === undefined || rankOf(e.ev) > rankOf(a.ev) ? e : a),
    undefined,
  );
  if (best === undefined) return "none";
  const { kind, runs, seed, depth, to } = best.ev;
  const parts = [
    kind,
    ...Object.entries({ runs, seed, depth, to }).flatMap(([k, v]) => (v === undefined ? [] : [`${k} ${v}`])),
  ];
  return `${parts.join(" ")} ${best.path}${all.length > 1 ? ` +${all.length - 1}` : ""}`;
};

/** The file an item lives in: the source file, `apps/<app>/modules/<path>`, or the spec section. */
const itemPath = (item: string): string => {
  const file = item.slice(0, item.lastIndexOf("#"));
  if (file.startsWith("packages/")) return file;
  const at = file.indexOf(":");
  if (at > 0) return `apps/${file.slice(0, at)}/modules/${file.slice(at + 1)}`;
  return `spec/${file.startsWith("k.") ? "kernel" : "std"}/${file}.md`;
};

/** Rungs an item can hold evidence on, in the order the ledger file and the summary list them. */
const RUNGS = ["example", "probabilistic", "exhaustive", "proven", "monitored"] as const;

/** For each rung, how many items hold any evidence on it (k.ledger File). */
const rungCounts = (items: readonly LedgerItem[]): Record<string, number> => {
  const out: Record<string, number> = Object.fromEntries(RUNGS.map((r) => [r, 0]));
  for (const i of items) {
    const held = new Set(i.evidence.map((e) => ledger([{ item: i.item, evidence: [e.ev] }])[0]?.rung ?? "none"));
    for (const r of RUNGS) if (held.has(r)) out[r] = (out[r] ?? 0) + 1;
  }
  return out;
};

/** The ledger file: unsafe count, rungs, mutation, exports (`{ pkg, name, file, rung }`), clauses (`{ item, rung }`). */
const ledgerFile = (
  records: readonly LedgerRecord[],
  byItem: ReadonlyMap<string, LedgerItem>,
  unsafe: number,
  rungs: Readonly<Record<string, number>>,
  mutation: Mutation,
): string => {
  const exports: { pkg: string; name: string; file: string; rung: string }[] = [];
  const clauses: { item: string; rung: string }[] = [];
  for (const r of records) {
    const pkg = byItem.get(r.item)?.pkg;
    const at = r.item.lastIndexOf("#");
    if (pkg === undefined) clauses.push({ item: r.item, rung: r.rung });
    else exports.push({ pkg, name: r.item.slice(at + 1), file: r.item.slice(0, at), rung: r.rung });
  }
  const mut = mutation.claims.length > 0 || Object.keys(mutation.packages).length > 0 ? { mutation } : {};
  return `${JSON.stringify({ version: 1, unsafe, rungs, ...mut, exports, clauses }, null, 2)}\n`;
};

/**
 * `keel ledger` (k.ledger), the one ledger implementation: one `ledger` record per export and per spec clause, rung by
 * `@keel/testing` `ledger`, and one `ledger.mutation` record per mutation claim (`mutationClaims`), after any W1706
 * header notes, E1711 and W1714 (a stale claim). `--write <file>` names the ledger file: `keel ledger` writes the
 * records there instead (with `rungs` and `mutation`, the reports on disk merged into the file's claims; stdout keeps
 * the notes and the trailer); `--diff` compares with it (default `.keel/ledger.json`, else
 * `tooling/ledger/ledger.json`) and writes nothing: E1706 per lowered rung, E1706 when the unsafe count rose, E1707
 * per clause of a `conformance-covered` section left at `none` (`coverageGaps`), E1712 (no `--scope`) per rung the
 * file counts above 0 that no item holds, E1713 per package whose fresh score is below its threshold (a package
 * with claims and none fresh has no score and fails too) or whose threshold is below the committed one. `--scope <prefix>` keeps the items whose key starts with it; the unsafe count
 * is then the matching apps' (`golden-1:`), compared with zero. The summary counts the items on each rung and the
 * stale claims, each when above 0.
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
  const name = input.write ?? COMMITTED.find((p) => files.some((f) => f.path === p));
  const file = files.find((f) => f.path === name);
  const parsed = file === undefined ? undefined : LedgerFileSchema.parse(safeJson(file.source));
  const committed = parsed?.ok === true ? parsed.value : undefined;
  const { mutation, fresh, reports } = mutationClaims(files, committed?.mutation);
  const stale = mutation.claims
    .filter((c) => !fresh.has(c.file))
    .map((c) =>
      makeDiag("W1714", `mutation claim stale: ${c.file} changed since the run`, {
        path: c.file,
        line: 1,
        col: 1,
        see: "k.ledger",
      }),
    );
  const notes = scope === "" ? [...built.diags, ...stale] : [];
  const rungs = rungCounts(built.items);
  const shown = scope === "" ? rungs : rungCounts(built.items.filter((i) => i.item.startsWith(scope)));
  const counts = {
    items: records.length,
    verified: records.filter((r) => r.rung !== "none").length,
    unsafe,
    warnings: notes.length,
    // Rung and stale counts only when above 0, so a trailer stays one short line.
    ...Object.fromEntries(Object.entries({ ...shown, stale: stale.length }).filter(([, n]) => n > 0)),
  };
  if (input.diff !== true) {
    const out: OutRecord[] = [
      ...records.map((r) => ({
        kind: "ledger",
        item: r.item,
        rung: r.rung,
        evidence: r.evidence === "none" ? "none" : describe(byItem.get(r.item)),
      })),
      ...mutation.claims
        .filter((c) => c.file.startsWith(scope))
        .map((c) => ({
          kind: "ledger.mutation",
          file: c.file,
          score: c.score,
          survived: c.survived,
          fresh: fresh.has(c.file),
        })),
    ];
    const content = ledgerFile(all, byItem, built.unsafe, rungs, mutation);
    return {
      records: [...notes, ...(input.write === undefined ? out : []), summary("ledger", notes, counts)],
      writes: input.write === undefined ? [] : [{ path: input.write, content, readonly: false }],
    };
  }
  const before = [
    ...(committed?.exports ?? []).map((e) => ({ item: `${e.file}#${e.name}`, rung: e.rung })),
    ...(committed?.clauses ?? []),
  ].filter((r) => r.item.startsWith(scope));
  const diags = ledgerDiff(before, records).map((d) =>
    makeDiag(d.code, d.message, { path: itemPath(d.item), line: 1, col: 1, see: d.see }),
  );
  const allowed = scope === "" ? committed?.unsafe : 0;
  if (committed !== undefined && allowed !== undefined && unsafe > allowed)
    diags.push(makeDiag("E1706", `unsafe count up ${allowed} -> ${unsafe}`, { path: name, see: "k.ledger" }));
  if (scope === "")
    for (const [rung, n] of Object.entries(committed?.rungs ?? {}))
      if (n > 0 && (rungs[rung] ?? 0) === 0)
        diags.push(
          makeDiag("E1712", `rung ${rung} is held by no item (committed ${n})`, { path: name, see: "k.ledger" }),
        );
  for (const [pkg, p] of Object.entries(mutation.packages)) {
    const at = { path: reports[pkg] ?? name, see: "k.ledger" };
    const claimed = mutation.claims.some((c) => c.file.startsWith(`packages/${pkg}/`));
    if (p.score !== undefined && p.score < p.threshold)
      diags.push(makeDiag("E1713", `mutation ${pkg} ${p.score}% is below its threshold ${p.threshold}%`, at));
    // Claims with none fresh score nothing: no evidence the threshold still holds.
    else if (p.score === undefined && claimed)
      diags.push(makeDiag("E1713", `mutation ${pkg}: every claim is stale, so no score meets ${p.threshold}%`, at));
    const was = committed?.mutation?.packages[pkg]?.threshold;
    if (was !== undefined && p.threshold < was)
      diags.push(makeDiag("E1713", `mutation ${pkg} threshold ${p.threshold}% is below the committed ${was}%`, at));
  }
  const gaps = coverageGaps(files, records, scope);
  const found = [...diags, ...gaps];
  return {
    records: [
      ...notes,
      ...found,
      summary("ledger --diff", [...notes, ...found], { ...counts, lowered: diags.length, uncovered: gaps.length }),
    ],
    writes: [],
  };
}
