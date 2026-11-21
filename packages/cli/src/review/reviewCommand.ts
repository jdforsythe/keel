import { realpathSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { Outcome } from "../internal/Outcome.ts";
import { defaultMode } from "../internal/defaultMode.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { AtPath } from "./AtPath.ts";
import type { Baseline } from "./Baseline.ts";
import type { Found } from "./Found.ts";
import type { GitRepo } from "./GitRepo.ts";
import type { Judged } from "./Judged.ts";
import type { Loud } from "./Loud.ts";
import type { ReviewRecord } from "./ReviewRecord.ts";
import type { Scope } from "./Scope.ts";
import type { Snapshot } from "./Snapshot.ts";
import { baselineOf } from "./baselineOf.ts";
import { commitTree } from "./commitTree.ts";
import { fileEscapes } from "./fileEscapes.ts";
import { judge } from "./judge.ts";
import { loudness } from "./loudness.ts";
import { openRepo } from "./openRepo.ts";
import { placed } from "./placed.ts";
import { rangeEscapes } from "./rangeEscapes.ts";
import { scopeOf } from "./scopeOf.ts";
import { workTree } from "./workTree.ts";

/** `<base>..<head>`: neither side empty, starting with `.` or ending at a `/` (so `../x` and `a/../b` are paths). */
const RANGE = /^([^.\s/](?:.*[^./\s])?)\.\.([^./\s].*)$/;
const ORDER: Readonly<Record<Loud, number>> = { fail: 0, warn: 1, list: 2, count: 3 };
const BASELINE = "keel-review.json";
const FRAMEWORK = /^packages\/([^/]+)\//;

const usage = (code: string, message: string): Outcome => {
  const d = makeDiag(code, message, { see: "k.review" });
  return { records: [d, { kind: "summary", ok: false, name: "review", counts: {} }], writes: [], code: 2 };
};
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Every finding of one snapshot's files in scope, by path. */
function findingsOf(snap: Snapshot, scope: Scope): Map<string, Found[]> {
  const out = new Map<string, Found[]>();
  const paths = snap.paths.filter(scope.has);
  snap.prefetch(paths);
  for (const p of paths) {
    const text = snap.text(p);
    if (text !== undefined) out.set(p, placed(p, fileEscapes(p, text, scope.projectOf(p))));
  }
  return out;
}

/** Each baseline in scope (the root's and each chosen project's), by its project folder, or the path of one that does not parse. */
function baselines(snap: Snapshot, scope: Scope): { by: Map<string, readonly Baseline[]> } | { bad: string } {
  const by = new Map<string, readonly Baseline[]>();
  for (const d of new Set(["", ...scope.chosen])) {
    const entries = baselineOf(snap.text(`${d}${BASELINE}`));
    if (entries === null) return { bad: `${d}${BASELINE}` };
    by.set(d, entries);
  }
  return { by };
}

/** Records in print order: loudness, then code, path, line, column. */
const sorted = (rs: readonly ReviewRecord[]): ReviewRecord[] =>
  [...rs].sort(
    (a, b) =>
      ORDER[a.loud] - ORDER[b.loud] ||
      cmp(a.code, b.code) ||
      cmp(a.path, b.path) ||
      a.line - b.line ||
      a.col - b.col ||
      cmp(a.id, b.id),
  );

const record = (j: Judged): ReviewRecord => {
  const f = j.found;
  return {
    kind: "review",
    code: f.code,
    path: f.path,
    line: f.line,
    col: f.col,
    message: f.message,
    protection: f.protection,
    opt: f.opt,
    danger: f.danger,
    novelty: j.novelty,
    loud: loudness(f.danger, j.novelty, f.opt),
    id: f.id,
    ...(f.reason === undefined ? {} : { reason: f.reason }),
  };
};

/** R1151: each entry of a baseline in scope matching no finding at `<head>`, while the head's file still holds it. */
function stale(by: Map<string, readonly Baseline[]>, ids: ReadonlySet<string>, head: Snapshot): Found[] {
  const out: Found[] = [];
  for (const [d, entries] of by) {
    const path = `${d}${BASELINE}`;
    const text = head.text(path) ?? "";
    for (const e of entries) {
      if (ids.has(e.id) || !text.includes(e.id)) continue;
      const line = text.slice(0, text.indexOf(e.id)).split("\n").length;
      out.push(
        ...placed(path, [
          { code: "R1151", line, col: 1, text: e.id, message: `accepted ${e.code} ${e.id} matches no finding` },
        ]),
      );
    }
  }
  return out;
}

/** R1100: one finding when the range changes a chosen project's files and a Keel package's source. */
function framework(changed: readonly string[], scope: Scope, head: Snapshot, base: Snapshot): AtPath[] {
  const keel = (p: string): boolean => {
    if (/(?:^|\/)node_modules\/@keel\//.test(p)) return true;
    const m = FRAMEWORK.exec(p);
    if (m === null) return false;
    const manifest = `packages/${m[1]}/package.json`;
    const text = head.text(manifest) ?? base.text(manifest);
    if (text === undefined) return true;
    try {
      const v: unknown = JSON.parse(text);
      const name = typeof v === "object" && v !== null && "name" in v ? v.name : undefined;
      return typeof name !== "string" || name.startsWith("@keel/");
    } catch {
      return true;
    }
  };
  const kernel = changed.filter(keel).sort();
  const app = changed.filter((p) => !keel(p) && scope.chosen.some((d) => p.startsWith(d)));
  const first = kernel[0];
  const project = app.sort()[0];
  if (first === undefined || project === undefined) return [];
  const message = `framework source changed with ${project}`;
  return [{ path: first, raw: { code: "R1100", line: 1, col: 1, text: message, message } }];
}

/** The git-root targets a review starts from: `paths`, else the working directory. */
function targets(root: string, cwd: string, paths: readonly string[]): string[] {
  const rel = (p: string): string => {
    const r = relative(root, resolve(cwd, p)).split("\\").join("/");
    return r === "" ? "" : `${r}/`;
  };
  return paths.length === 0 ? [rel(".")] : paths.map(rel);
}

type Run = { readonly judged: Judged[]; readonly scope: Scope; readonly root: string; readonly work: Snapshot };

/** Review the working tree (`--all`): every finding `standing`, or `accepted` when its baseline holds it. */
function reviewTree(root: string, repo: GitRepo | null, at: readonly string[]): Run | Outcome {
  const work = workTree(root, repo);
  const scope = scopeOf(work, at);
  const base = baselines(work, scope);
  if ("bad" in base) return usage("E1070", `${base.bad} does not parse or holds an id twice`);
  const found = [...findingsOf(work, scope).values()].flat();
  const ids = new Set(found.map((f) => f.id));
  const acceptedIn = (f: Found): boolean =>
    (base.by.get(scope.projectOf(f.path) ?? "") ?? base.by.get("") ?? []).some((e) => e.id === f.id);
  const judged: Judged[] = [
    ...found.map((f): Judged => ({ found: f, novelty: acceptedIn(f) ? "accepted" : "standing" })),
    ...stale(base.by, ids, work).map((f): Judged => ({ found: f, novelty: "standing" })),
  ];
  return { judged, scope, root, work };
}

/** Review a range (k.review Novelty): both ends from git objects, the baseline at `<base>`. */
function reviewRange(repo: GitRepo, from: string, to: string, at: readonly string[]): Run | Outcome {
  const b = repo.commit(from);
  const h = repo.commit(to);
  if (b === null || h === null) return usage("E1069", `${b === null ? from : to} does not resolve to a commit`);
  const head = commitTree(repo, h);
  const base = commitTree(repo, b);
  const scope = scopeOf(head, at);
  const accepted = baselines(base, scope);
  if ("bad" in accepted) return usage("E1070", `${accepted.bad} at ${from} does not parse or holds an id twice`);
  const changes = repo.diff(b, h);
  const byPath = new Map(changes.map((c) => [c.path, c]));
  const headFound = findingsOf(head, scope);
  base.prefetch(changes.flatMap((c) => (c.from !== undefined && scope.has(c.path) ? [c.from] : [])));
  const alias = new Map<string, string>();
  const baseFound: Found[] = [];
  for (const [p, found] of headFound) {
    const c = byPath.get(p);
    if (c === undefined) {
      baseFound.push(...found);
      continue;
    }
    if (c.from === undefined) continue;
    const text = base.text(c.from);
    if (text === undefined) continue;
    const raws = fileEscapes(p, text, scope.projectOf(p));
    baseFound.push(...placed(p, raws));
    if (c.from !== p) {
      const own = placed(p, raws);
      placed(c.from, raws).forEach((o, i) => {
        const at = own[i];
        if (at !== undefined) alias.set(at.id, o.id);
      });
    }
  }
  const baselineFor = (f: Found): readonly Baseline[] =>
    accepted.by.get(scope.projectOf(f.path) ?? "") ?? accepted.by.get("") ?? [];
  const isAccepted = (f: Found): boolean => baselineFor(f).some((e) => e.id === f.id || e.id === alias.get(f.id));
  const all = [...headFound.values()].flat();
  const judged = judge(all, baseFound, isAccepted).filter(
    (j) => (j.found.code !== "R1101" && j.found.code !== "R1102") || j.novelty === "new" || j.novelty === "changed",
  );
  const tree = judged.map(
    (j): Judged => (j.found.code === "R1101" || j.found.code === "R1102" ? { found: j.found, novelty: "new" } : j),
  );
  const inScope = changes.filter((c) => scope.has(c.path) || (c.from !== undefined && scope.has(c.from)));
  const ranged = [
    ...rangeEscapes(inScope, base.text, head.text),
    ...framework(
      changes.flatMap((c) => (c.from !== undefined && c.from !== c.path ? [c.path, c.from] : [c.path])),
      scope,
      head,
      base,
    ),
  ];
  const ids = new Set([...all.map((f) => f.id), ...alias.values()]);
  const work: Judged[] = [
    ...tree,
    ...ranged.flatMap((r) => placed(r.path, [r.raw])).map((f): Judged => ({ found: f, novelty: "new" })),
    ...stale(accepted.by, ids, head).map((f): Judged => ({ found: f, novelty: "standing" })),
  ];
  return { judged: work, scope, root: repo.root, work: head };
}

/** `--accept <id> --reason <text>`: one entry in the baseline its finding reads, from a review of the working tree. */
function accept(run: Run, id: string, reason: string, cwd: string): Outcome {
  const hit = run.judged.find((j) => j.found.id === id);
  if (hit === undefined) return usage("E1067", `no finding with id ${id.slice(0, 24)} in the working tree`);
  const path = `${run.scope.projectOf(hit.found.path) ?? ""}${BASELINE}`;
  const text = run.work.text(path);
  const entries = baselineOf(text) ?? [];
  const records: OutRecord[] = [];
  const writes = [];
  if (!entries.some((e) => e.id === id)) {
    const next = [...entries, { id, code: hit.found.code, path: hit.found.path, reason }];
    const rel = relative(cwd, resolve(run.root, path)).split("\\").join("/");
    writes.push({ path: rel, content: `${JSON.stringify({ v: 1, accepted: next }, null, 2)}\n`, readonly: false });
    records.push({ kind: "scaffold.edit", action: text === undefined ? "create" : "change", path: rel });
  }
  records.push({ kind: "summary", ok: true, name: "review", counts: { accepted: 1 } });
  return { records, writes };
}

/**
 * `keel review [paths] [<base>..<head> | --all] [--list] [--fail-on warn]` and `keel review --accept <id> --reason
 * <text>` (k.review): one `review` record per finding, `fail` then `warn` (then `list` with `--list`; json holds
 * `list` always and `count` with `--list`), and a summary counting `fail`, `warn`, `list` and `accepted`. Offline;
 * reads git objects for a range and the working tree otherwise; runs no project code.
 */
export async function reviewCommand(input: Input, io: Io): Promise<Outcome> {
  const words = input.paths ?? [];
  const ranges = words.filter((w) => RANGE.test(w));
  const paths = words.filter((w) => !RANGE.test(w));
  const range = ranges[0];
  if (range !== undefined && input.all === true) return usage("E1068", "a range and --all together; give one");
  if (ranges.length > 1) return usage("E1068", "two ranges; give one");
  if (input.accept !== undefined) {
    const n = input.reason?.length ?? 0;
    if (input.reason === undefined) return usage("E1067", "--accept needs --reason <text>");
    if (n < 10 || n > 200) return usage("E1067", `--reason is ${n} characters; give 10 to 200`);
  }
  const cwd = realpathSync(io.cwd);
  const repo = openRepo(cwd);
  if (range !== undefined && repo === null) return usage("E1069", "not a git repository; a range needs one");
  const root = repo?.root ?? cwd;
  const at = targets(root, cwd, paths);
  const m = range === undefined || input.accept !== undefined ? null : RANGE.exec(range);
  const run = m === null || repo === null ? reviewTree(root, repo, at) : reviewRange(repo, m[1] ?? "", m[2] ?? "", at);
  if (!("judged" in run)) return run;
  if (input.accept !== undefined) return accept(run, input.accept, input.reason ?? "", cwd);

  const all = sorted(run.judged.map(record));
  const mode = input.format ?? defaultMode(io);
  const listed = input.list === true;
  const shown = all.filter((r) =>
    r.loud === "fail" || r.loud === "warn"
      ? true
      : r.loud === "list"
        ? listed || mode === "json"
        : listed && mode === "json",
  );
  const count = (l: Loud): number => all.filter((r) => r.loud === l).length;
  const counts = { fail: count("fail"), warn: count("warn"), list: count("list"), accepted: count("count") };
  const failing = counts.fail > 0 || (input["fail-on"] === "warn" && counts.warn > 0);
  return { records: [...shown, { kind: "summary", ok: !failing, name: "review", counts }], writes: [] };
}
