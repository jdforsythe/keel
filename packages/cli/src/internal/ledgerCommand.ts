import type { Infer } from "@keel/schema";
import { type Evidence, type LedgerRecord, ledger, ledgerDiff } from "@keel/testing";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { A11yClaim } from "./A11yClaim.ts";
import type { A11yCriteriaMap } from "./A11yCriteriaMap.ts";
import type { Diag } from "./Diag.ts";
import { LedgerFileSchema } from "./LedgerFileSchema.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import type { Outcome } from "./Outcome.ts";
import { a11yClaims } from "./a11yClaims.ts";
import { a11yFindings } from "./a11yFindings.ts";
import { buildLedger } from "./buildLedger.ts";
import { coverageGaps } from "./coverageGaps.ts";
import { justifiedFiles } from "./justifiedFiles.ts";
import { justifiedText } from "./justifiedText.ts";
import { makeDiag } from "./makeDiag.ts";
import { mutationClaims } from "./mutationClaims.ts";
import { packageInScope } from "./packageInScope.ts";
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

/** One line of evidence: the strongest piece, with its runs, seed, depth, `to` and `z3`, and how many more back the item. */
const describe = (item: LedgerItem | undefined): string => {
  const all = item?.evidence ?? [];
  const best = all.reduce<(typeof all)[number] | undefined>(
    (a, e) => (a === undefined || rankOf(e.ev) > rankOf(a.ev) ? e : a),
    undefined,
  );
  if (best === undefined) return "none";
  const { kind, runs, seed, depth, to, z3 } = best.ev;
  const parts = [
    kind,
    ...Object.entries({ runs, seed, depth, to, z3 }).flatMap(([k, v]) => (v === undefined ? [] : [`${k} ${v}`])),
  ];
  return `${parts.join(" ")} ${best.path}${all.length > 1 ? ` +${all.length - 1}` : ""}`;
};

/** The file an item lives in: the source file, `apps/<app>/modules/<path>`, or the spec section. */
const itemPath = (item: string): string => {
  if (item.startsWith("a11y:")) return "reports/a11y.json";
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

/**
 * The ledger file: unsafe count, host element count, rungs, mutation, exports (`{ pkg, name, file, rung }`), clauses (`{ item, rung }`) and
 * the a11y claims (`{ item, rung }`).
 */
const ledgerFile = (
  records: readonly LedgerRecord[],
  byItem: ReadonlyMap<string, LedgerItem>,
  unsafe: number,
  hostElements: number,
  rungs: Readonly<Record<string, number>>,
  mutation: Mutation,
  a11y: readonly A11yClaim[],
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
  const claims = a11y.map((c) => ({ item: c.item, rung: c.rung }));
  return `${JSON.stringify({ version: 1, unsafe, hostElements, rungs, ...mut, exports, clauses, a11y: claims }, null, 2)}\n`;
};

/**
 * `keel ledger` (k.ledger), the one ledger implementation: one `ledger` record per export and per spec clause, rung by
 * `@keel/testing` `ledger`, one per route and WCAG criterion (`a11yClaims` over `a11yMap`, k.a11y Claims), and one
 * `ledger.mutation` record per mutation claim (`mutationClaims`), after any W1706
 * header notes, E1711, E1725 (a `mutation-justified.json` that fails its shape, by `justifiedFiles`, or an entry that
 * justifies no mutant of its package's report on disk) and W1714 (a stale claim). `--write <file>` names the ledger file: `keel ledger` writes the
 * records there instead (with `rungs` and `mutation`, the reports on disk merged into the file's claims; stdout keeps
 * the notes and the trailer); `--diff` compares with it (default `.keel/ledger.json`, else
 * `tooling/ledger/ledger.json`) and writes nothing: E1706 per lowered rung, E1706 when the unsafe count rose, E1706
 * (no `--scope`) when the host element count rose, E1707
 * per clause of a `conformance-covered` section left at `none` (`coverageGaps`), E1712 (no `--scope`) per rung the
 * file counts above 0 that no item holds, E1713 per package whose fresh score is below its threshold (a package
 * with claims and none fresh has no score and fails too) or whose threshold is below the committed one. `--scope <prefix>` keeps the items whose key starts with it; the unsafe count
 * is then the matching apps' (`golden-1:`), compared with zero, and the host element count theirs plus a root
 * `modules/**` file's whose path starts with it. The summary counts the items on each rung and the
 * stale claims, each when above 0.
 */
export function ledgerCommand(input: Input, io: Io, a11yMap: A11yCriteriaMap = new Map()): Outcome {
  const files = projectFiles(io);
  const built = buildLedger(files);
  const byItem = new Map(built.items.map((i) => [i.item, i]));
  const all = ledger(built.items.map((i) => ({ item: i.item, evidence: i.evidence.map((e) => e.ev) })));
  const scope = input.scope ?? "";
  const name = input.write ?? COMMITTED.find((p) => files.some((f) => f.path === p));
  const file = files.find((f) => f.path === name);
  const parsed = file === undefined ? undefined : LedgerFileSchema.parse(safeJson(file.source));
  const committed = parsed?.ok === true ? parsed.value : undefined;
  const keptRungs = new Map(
    (committed?.a11y ?? []).flatMap((c) =>
      c.rung === "example" || c.rung === "none" ? [[c.item, c.rung] as const] : [],
    ),
  );
  const a11y = a11yMap.size === 0 ? [] : a11yClaims(files, a11yMap, a11yFindings(io.cwd, files), keptRungs);
  const records = all.filter((r) => r.item.startsWith(scope));
  const claims = a11y.filter((c) => c.item.startsWith(scope));
  const apps = Object.keys(built.appUnsafe).filter((a) => `${a}:`.startsWith(scope) || scope.startsWith(`${a}:`));
  const unsafe = scope === "" ? built.unsafe : apps.reduce((n, a) => n + (built.appUnsafe[a] ?? 0), 0);
  const hostElements =
    scope === ""
      ? built.hostElements
      : apps.reduce((n, a) => n + (built.appHosts[a] ?? 0), 0) +
        Object.entries(built.rootHosts).reduce((n, [path, k]) => n + (path.startsWith(scope) ? k : 0), 0);
  const { justified, diags: misshapen } = justifiedFiles(files);
  const { mutation, fresh, reports, unmatched } = mutationClaims(files, committed?.mutation, justified);
  const unjustified = Object.entries(unmatched).flatMap(([pkg, indexes]) => {
    const file = justified.get(pkg);
    return indexes.flatMap((i) => {
      const e = file?.entries[i];
      if (file === undefined || e === undefined) return [];
      return [
        makeDiag(
          "E1725",
          `entry ${i + 1} (${justifiedText(e.original)}) justifies no mutant of the report; remove it`,
          {
            path: file.path,
            line: 1,
            col: 1,
            see: "k.ledger",
          },
        ),
      ];
    });
  });
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
  const notes = scope === "" ? [...built.diags, ...misshapen, ...unjustified, ...stale] : [];
  const held = (cs: readonly A11yClaim[], r: Record<string, number>): Record<string, number> => {
    const n = cs.filter((c) => c.rung === "example").length;
    return n === 0 ? r : { ...r, example: (r.example ?? 0) + n };
  };
  const rungs = held(a11y, rungCounts(built.items));
  const shown = scope === "" ? rungs : held(claims, rungCounts(built.items.filter((i) => i.item.startsWith(scope))));
  const counts = {
    items: records.length + claims.length,
    verified: records.filter((r) => r.rung !== "none").length + claims.filter((c) => c.rung !== "none").length,
    unsafe,
    warnings: notes.length,
    // Host element, rung, stale and kept counts (a11y items kept for want of a project's report) only when above 0, so a trailer stays one short line.
    ...Object.fromEntries(
      Object.entries({
        hostElements,
        ...shown,
        stale: stale.length,
        keptNoReport: claims.filter((c) => c.kept === true).length,
      }).filter(([, n]) => n > 0),
    ),
  };
  if (input.diff !== true) {
    const out: OutRecord[] = [
      ...records.map((r) => ({
        kind: "ledger",
        item: r.item,
        rung: r.rung,
        evidence: r.evidence === "none" ? "none" : describe(byItem.get(r.item)),
      })),
      ...claims.map((c) => ({ kind: "ledger", item: c.item, rung: c.rung, evidence: c.evidence })),
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
    const content = ledgerFile(all, byItem, built.unsafe, built.hostElements, rungs, mutation, a11y);
    return {
      records: [...notes, ...(input.write === undefined ? out : []), summary("ledger", notes, counts)],
      writes: input.write === undefined ? [] : [{ path: input.write, content, readonly: false }],
    };
  }
  const before = [
    ...(committed?.exports ?? []).map((e) => ({ item: `${e.file}#${e.name}`, rung: e.rung })),
    ...(committed?.clauses ?? []),
    ...(committed?.a11y ?? []),
  ].filter((r) => r.item.startsWith(scope));
  const diags = ledgerDiff(before, [...records, ...claims]).map((d) =>
    makeDiag(d.code, d.message, { path: itemPath(d.item), line: 1, col: 1, see: d.see }),
  );
  const allowed = scope === "" ? committed?.unsafe : 0;
  if (committed !== undefined && allowed !== undefined && unsafe > allowed)
    diags.push(makeDiag("E1706", `unsafe count up ${allowed} -> ${unsafe}`, { path: name, see: "k.ledger" }));
  // An app's host elements are its own design, so under `--scope` no count is compared (unsafe's zero would refuse them).
  if (scope === "" && committed !== undefined && hostElements > committed.hostElements)
    diags.push(
      makeDiag("E1706", `host elements up ${committed.hostElements} -> ${hostElements}`, {
        path: name,
        see: "k.host-element",
      }),
    );
  if (scope === "")
    for (const [rung, n] of Object.entries(committed?.rungs ?? {}))
      if (n > 0 && (rungs[rung] ?? 0) === 0)
        diags.push(
          makeDiag("E1712", `rung ${rung} is held by no item (committed ${n})`, { path: name, see: "k.ledger" }),
        );
  let outside = 0;
  for (const [pkg, p] of Object.entries(mutation.packages)) {
    const mine: Diag[] = [];
    const at = { path: reports[pkg] ?? name, see: "k.ledger" };
    const claimed = mutation.claims.some((c) => c.file.startsWith(`packages/${pkg}/`));
    if (p.score !== undefined && p.score < p.threshold)
      mine.push(makeDiag("E1713", `mutation ${pkg} ${p.score}% is below its threshold ${p.threshold}%`, at));
    // Claims with none fresh score nothing: no evidence the threshold still holds.
    else if (p.score === undefined && claimed)
      mine.push(makeDiag("E1713", `mutation ${pkg}: every claim is stale, so no score meets ${p.threshold}%`, at));
    const was = committed?.mutation?.packages[pkg]?.threshold;
    if (was !== undefined && p.threshold < was)
      mine.push(makeDiag("E1713", `mutation ${pkg} threshold ${p.threshold}% is below the committed ${was}%`, at));
    if (packageInScope(pkg, scope)) diags.push(...mine);
    else outside += mine.length;
  }
  const gaps = coverageGaps(files, records, scope);
  const elsewhere =
    outside === 0
      ? []
      : [
          makeDiag("I1713", `${outside} mutation ${outside === 1 ? "error" : "errors"} outside the scope`, {
            see: "k.ledger",
          }),
        ];
  const found = [...diags, ...gaps];
  return {
    records: [
      ...notes,
      ...found,
      ...elsewhere,
      summary("ledger --diff", [...notes, ...found], { ...counts, lowered: diags.length, uncovered: gaps.length }),
    ],
    writes: [],
  };
}
