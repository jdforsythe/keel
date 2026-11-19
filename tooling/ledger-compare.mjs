// The ledger gate's comparison (tooling/ledger-fresh.mjs runs it): the committed ledger file against the records
// `keel ledger` produces from the tree. Pure functions over parsed data.

/** The rungs `rungs` counts, in the ledger file's order. */
const RUNG_KEYS = ["example", "probabilistic", "exhaustive", "proven", "monitored"];

/** Item -> rung of the committed file: exports as `file#name`, clauses as their item, WCAG items when `withA11y`. */
export function committedRungs(file, withA11y) {
  const out = new Map();
  for (const e of file.exports ?? []) out.set(`${e.file}#${e.name}`, e.rung);
  for (const c of file.clauses ?? []) out.set(c.item, c.rung);
  if (withA11y) for (const a of file.a11y ?? []) out.set(a.item, a.rung);
  return out;
}

/**
 * Differences between the committed file and the fresh records `[{ item, rung }]` (with `unsafe` and, for a complete
 * run, `rungs`). A WCAG item (`a11y:`) is compared only when `withA11y`, because its rung comes from the apps' test
 * reports. Each difference is `{ item, message }`: an item the file lists and the tree lacks, an item the tree has
 * and the file lacks, a different rung, a different unsafe count, and with `withA11y` a different count per rung.
 */
export function compareLedger(file, fresh, withA11y) {
  const have = committedRungs(file, withA11y);
  const now = new Map(
    fresh.records.filter((r) => withA11y || !r.item.startsWith("a11y:")).map((r) => [r.item, r.rung]),
  );
  const out = [];
  for (const [item, rung] of have) {
    if (!now.has(item)) out.push({ item, message: `${item} is in the ledger file and not in the tree` });
    else if (now.get(item) !== rung)
      out.push({ item, message: `${item} is ${rung} in the ledger file, ${now.get(item)} in the tree` });
  }
  for (const [item, rung] of now)
    if (!have.has(item)) out.push({ item, message: `${item} (${rung}) is in the tree and not in the ledger file` });
  if ((file.unsafe ?? 0) !== fresh.unsafe)
    out.push({
      item: "unsafe",
      message: `unsafe count is ${file.unsafe ?? 0} in the ledger file, ${fresh.unsafe} in the tree`,
    });
  if (withA11y && fresh.rungs !== undefined)
    for (const r of RUNG_KEYS)
      if ((file.rungs?.[r] ?? 0) !== (fresh.rungs[r] ?? 0))
        out.push({
          item: `rungs.${r}`,
          message: `${r} is held by ${file.rungs?.[r] ?? 0} items in the ledger file, ${fresh.rungs[r] ?? 0} in the tree`,
        });
  return out;
}

/** Parses the NDJSON of `keel ledger --format=json`: the `ledger` records and the summary's unsafe count and rungs. */
export function parseFresh(text) {
  const records = [];
  let summary;
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const r = JSON.parse(line);
    if (r.kind === "ledger") records.push({ item: r.item, rung: r.rung });
    else if (r.kind === "summary") summary = r;
  }
  if (summary === undefined) throw new Error("keel ledger printed no summary");
  const counts = summary.counts ?? {};
  return {
    records,
    unsafe: counts.unsafe ?? 0,
    rungs: Object.fromEntries(RUNG_KEYS.map((r) => [r, counts[r] ?? 0])),
  };
}
