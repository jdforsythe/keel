import type { Out } from "./Out.ts";

/** docs/OUTPUT.md's message bound: 89 UTF-16 units, a longer one cut to 86 and `...`. */
const clip = (m: string): string => (m.length > 89 ? `${m.slice(0, 86)}...` : m);

function line(r: Out, pretty: boolean, run: string): string {
  switch (r.kind) {
    case "scaffold.edit":
      return pretty ? `create  ${r.path}` : `create ${r.path}`;
    case "create.next":
      return pretty
        ? `  ${r.command}${r.dir === undefined ? "" : `   (in ${r.dir})`}${r.command.endsWith(" dev") ? "   # http://localhost:5173" : ""}`
        : `next ${r.command}${r.dir === undefined ? "" : ` (in ${r.dir})`}`;
    case "diag": {
      const at =
        r.path === undefined || r.path === ""
          ? ""
          : `${r.path}${r.line === undefined ? "" : `:${r.line}:${r.col ?? 1}`}`;
      const see = `  see: ${run} docs ${r.see}`;
      // A diagnostic about several files names each on its own line under the head (docs/OUTPUT.md).
      const each = (r.paths ?? []).map((p) => `  ${p}`);
      return pretty
        ? [at === "" ? r.code : `${r.code}  ${at}`, `  ${clip(r.message)}`, ...each, see].join("\n")
        : [`${r.code}${at === "" ? "" : ` ${at}`} ${clip(r.message)}`, ...each, see].join("\n");
    }
    case "summary": {
      const counts = Object.entries(r.counts).map(([k, n]) => `${n} ${k}`);
      return [r.ok ? "ok" : "fail", r.name, ...(r.ok ? counts : [])].join(" ");
    }
  }
}

/**
 * The records in a docs/OUTPUT.md format, the trailer last. `json`: one record per line, uncapped unless `limit`.
 * `compact`: `create <path>`, `next <command>` (` (in <dir>)`), the diagnostic with `see`, then `ok create ...`.
 * A `see` line names `keel docs` in the project's form `run` (`pnpm keel docs k.create`), which works once the
 * printed install has run. `pretty`: the same, the next commands under a `Next:` line, indented to copy. `quiet` keeps the trailer; `limit`
 * caps each kind, saying how many it left out.
 */
export function render(
  records: readonly Out[],
  format: "compact" | "json" | "pretty",
  quiet = false,
  limit?: number,
  run = "pnpm keel",
): string {
  const body = quiet ? [] : records.filter((r) => r.kind !== "summary");
  const trailer = records.filter((r) => r.kind === "summary");
  const kept: Out[] = [];
  const more = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const r of body) {
    const n = (seen.get(r.kind) ?? 0) + 1;
    seen.set(r.kind, n);
    if (limit === undefined || n <= limit) kept.push(r);
    else more.set(r.kind, (more.get(r.kind) ?? 0) + 1);
  }
  if (format === "json") return [...kept, ...trailer].map((r) => `${JSON.stringify(r)}\n`).join("");
  const pretty = format === "pretty";
  const out: string[] = [];
  let last = "";
  for (const r of kept) {
    if (pretty && r.kind !== last && out.length > 0) out.push("");
    if (pretty && r.kind === "create.next" && last !== "create.next") out.push("Next:");
    out.push(line(r, pretty, run));
    last = r.kind;
    const left = more.get(r.kind);
    if (left !== undefined && kept.filter((k) => k.kind === r.kind).at(-1) === r)
      out.push(`... +${left} more ${r.kind} (create-app --limit ${(seen.get(r.kind) ?? 0).toString()})`);
  }
  if (pretty && out.length > 0 && trailer.length > 0) out.push("");
  for (const r of trailer) out.push(line(r, pretty, run));
  return out.length === 0 ? "" : `${out.join("\n")}\n`;
}
