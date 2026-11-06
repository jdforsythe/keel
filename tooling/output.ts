// Diagnostic model and formatters. Every script and package logs through this.
// Contract: docs/OUTPUT.md. Silent on success except a one-line `ok ...` trailer.
export type Diag = {
  kind: "diag";
  code: string;
  path?: string;
  line?: number;
  col?: number;
  message: string;
  fix?: string;
  see?: string;
};
export type Summary = { kind: "summary"; ok: boolean; counts: Record<string, number>; ms: number; name?: string };
export type Item = Diag | Summary;
export type Mode = "compact" | "json" | "pretty";
export type Result = { diags: Diag[]; counts: Record<string, number>; exit?: number; line?: string };

export const isDiag = (i: Item): i is Diag => i.kind === "diag";
export const isSummary = (i: Item): i is Summary => i.kind === "summary";

const VALUE_FLAGS = new Set(["limit", "root", "for", "format", "code", "task", "runner"]);

export type Args = { flags: Set<string>; values: Map<string, string>; positional: string[] };

/** Parse argv (after node + script). Supports `--flag`, `--k=v`, `--k v` for known value flags. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) {
      values.set(a.slice(2, eq), a.slice(eq + 1));
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (VALUE_FLAGS.has(name) && next !== undefined && !next.startsWith("--")) {
      values.set(name, next);
      i++;
      continue;
    }
    flags.add(name);
  }
  return { flags, values, positional };
}

export const mode = (argv: string[] = process.argv): Mode => {
  const f = parseArgs(argv.slice(2)).values.get("format");
  if (f === "json" || f === "pretty" || f === "compact") return f;
  return !process.stdout.isTTY || process.env.KEEL_AGENT === "1" ? "compact" : "pretty";
};

export const quiet = (argv: string[] = process.argv): boolean => parseArgs(argv.slice(2)).flags.has("quiet");

export const limit = (argv: string[] = process.argv): number | undefined => {
  const v = parseArgs(argv.slice(2)).values.get("limit");
  const n = v === undefined ? Number.NaN : Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const where = (d: Diag): string => (d.path ? d.path + (d.line ? `:${d.line}:${d.col ?? 1}` : "") : "");

function trailer(s: Summary): string {
  const counts = Object.entries(s.counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  return [s.ok ? "ok" : "fail", s.name, counts].filter(Boolean).join(" ") + ` (${(s.ms / 1000).toFixed(1)}s)`;
}

/** Render items. `cap` is the per-code cap (compact/pretty); `--limit N` overrides it; `--quiet` keeps only the trailer. */
export function emit(items: Item[], cap = 5): string {
  const m = mode();
  const q = quiet();
  const lim = limit();
  const summary = items.find(isSummary);
  if (m === "json") {
    const diags = q ? [] : items.filter(isDiag).slice(0, lim);
    return [...diags, ...(summary ? [summary] : [])].map((i) => JSON.stringify(i)).join("\n");
  }
  const byCode = new Map<string, Diag[]>();
  if (!q) for (const i of items) if (isDiag(i)) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i]);
  const out: string[] = [];
  const per = lim ?? cap;
  for (const [code, ds] of byCode) {
    for (const d of ds.slice(0, per)) {
      out.push(`${code} ${where(d)} ${d.message}`.replace(/ {2,}/, " "));
      if (d.fix) out.push(...d.fix.split("\n").map((l, n) => (n === 0 ? "  fix: " : "       ") + l));
      if (d.see) out.push(`  see: ${d.see}`);
    }
    if (ds.length > per) out.push(`... +${ds.length - per} more ${code} (--code ${code})`);
  }
  if (summary) out.push(trailer(summary));
  return out.join("\n");
}

/** Codes starting with W or I are advisory; everything else fails the run. */
export const isFailure = (d: Diag): boolean => !/^[WI]/.test(d.code);

/** Run a script body: time it, print through `emit`, set the exit code. */
export async function run(name: string, fn: () => Result | Promise<Result>): Promise<void> {
  const t0 = performance.now();
  const r = await fn();
  const failed = r.diags.some(isFailure);
  const ok = !failed && (r.exit ?? 0) === 0;
  const summary: Summary = { kind: "summary", ok, counts: r.counts, ms: performance.now() - t0, name };
  if (ok && r.line !== undefined) console.log(r.line);
  else {
    const text = emit([...r.diags, summary]);
    if (text) console.log(text);
  }
  process.exitCode = r.exit ?? (failed ? 1 : 0);
}
