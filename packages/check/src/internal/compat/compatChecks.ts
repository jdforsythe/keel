import type { Topology } from "@keel/compiler";
import { hashOf } from "@keel/compiler/internal";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import { clip } from "../clip.ts";
import { lineCol } from "../lineCol.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { Refusal } from "./Refusal.ts";
import type { Spot } from "./Spot.ts";
import type { Surface } from "./Surface.ts";
import type { SurfaceEntry } from "./SurfaceEntry.ts";
import { accepts } from "./accepts.ts";
import { entrySchemaAt } from "./entrySchemaAt.ts";
import { fieldAt } from "./fieldAt.ts";
import { isRecord } from "./isRecord.ts";
import { readSurface } from "./readSurface.ts";
import { staleSource } from "./staleSource.ts";
import { storeSchemaAt } from "./storeSchemaAt.ts";

const SURFACE = /^((?:.*\/)?)\.keel\/surface\.json$/;
/** What an entry without `params`/`query`/`body` is sent: nothing (an empty JSON body decodes as `{}`, k.server). */
const EMPTY = { type: "object", properties: {}, required: [], additionalProperties: false };
const REQUEST = ["params", "query", "body"] as const;

type Found = {
  readonly part: string;
  readonly request: boolean;
  readonly refusal: Refusal;
  readonly a: unknown;
  readonly b: unknown;
};

const show = (path: readonly string[]): string => (path.length === 0 ? "(root)" : path.join("."));

/**
 * The first part of entry `now` that refuses base entry `was`: a request part (`params`, `query`, `body`) of `now`
 * that does not accept `was`'s, else `was`'s `output` or an `errors[status]` both declare that does not accept
 * `now`'s.
 */
function refused(now: SurfaceEntry, was: SurfaceEntry): Found | null {
  for (const part of REQUEST) {
    const a = now[part];
    const b = was[part] ?? EMPTY;
    const refusal = a === null ? null : accepts(a, b);
    if (refusal !== null) return { part, request: true, refusal, a, b };
  }
  const answers: [string, unknown, unknown][] = [
    ["output", was.output, now.output],
    ...[...was.errors].map(([s, x]): [string, unknown, unknown] => [`errors.${s}`, x, now.errors.get(s) ?? null]),
  ];
  for (const [part, a, b] of answers) {
    const refusal = a === null || b === null ? null : accepts(a, b);
    if (refusal !== null) return { part, request: false, refusal, a, b };
  }
  return null;
}

/**
 * `schema` with the field at `path` no longer required (the E1562 fix, applied to the JSON Schema): `[]` steps into
 * array items, `*` into record values, and a union (nullable, optional) is loosened in each member.
 */
function loosen(schema: unknown, path: readonly string[]): unknown {
  const [k, ...rest] = path;
  if (!isRecord(schema) || k === undefined) return schema;
  if (Array.isArray(schema.anyOf)) return { ...schema, anyOf: schema.anyOf.map((m) => loosen(m, path)) };
  if (k === "[]") return { ...schema, items: loosen(schema.items, rest) };
  if (k === "*" && !isRecord(schema.properties))
    return { ...schema, additionalProperties: loosen(schema.additionalProperties, rest) };
  if (!isRecord(schema.properties)) return schema;
  if (rest.length > 0)
    return { ...schema, properties: { ...schema.properties, [k]: loosen(schema.properties[k], rest) } };
  return { ...schema, required: Array.isArray(schema.required) ? schema.required.filter((x) => x !== k) : [] };
}

type Ctx = { readonly dir: string; readonly project: readonly SourceFile[]; readonly at: string };

function diag(code: string, ctx: Ctx, spot: Spot | null, path: string, message: string, fix?: string): Diagnostic {
  const file = spot?.file ?? ctx.project.find((f) => f.path === path);
  const { line, col } = spot === null || file === undefined ? { line: 1, col: 1 } : lineCol(file.source, spot.start);
  const d: Diagnostic = {
    kind: "diag",
    code,
    path: spot?.file.path ?? path,
    line,
    col,
    message: clip(message, 89),
    see: "k.compat",
  };
  return fix === undefined ? d : { ...d, fix };
}

/**
 * E1562 (k.compat Base) for each API entry of each base contract with a base caller in another deployable from the
 * contract's module (by `topology`; none: every module ships together): the entry gone from its method and path (no
 * fix), or a part of the current entry refusing the base one (`refused`), at that member of the current contract
 * file, with a fix when making one required field optional clears it.
 */
function base(current: Surface, before: Surface, topology: Topology | undefined, ctx: Ctx): Diagnostic[] {
  const together = (a: string, b: string): boolean =>
    topology === undefined || Object.values(topology).some((d) => d.modules.includes(a) && d.modules.includes(b));
  const out: Diagnostic[] = [];
  for (const [module, was] of before.contracts) {
    if (was.callers.every((c) => together(c, module))) continue;
    const path = `${ctx.dir}modules/${module}/${module}.contract.ts`;
    const file = ctx.project.find((f) => f.path === path);
    const at = (id: string, part: string | null) =>
      file === undefined ? null : entrySchemaAt(file, id, part, ctx.project);
    for (const [id, e] of was.entries) {
      const now = current.contracts.get(module)?.entries.get(id);
      if (now === undefined || now.method !== e.method || now.path !== e.path) {
        const m =
          now === undefined
            ? `${id} (base ${e.method} ${clip(e.path, 24)}) is gone; callers in other deployables use it`
            : `${id} moved from ${e.method} ${clip(e.path, 20)} to ${now.method} ${clip(now.path, 20)}; callers use it`;
        const entry = at(id, null);
        const spot = entry === null ? null : { file: entry.file, start: entry.expr.start, end: entry.expr.start };
        out.push(diag("E1562", ctx, spot, `${ctx.dir}${ctx.at}`, m));
        continue;
      }
      const found = refused(now, e);
      if (found === null) continue;
      const schema = at(id, found.part);
      const exact = found.request ? fieldAt(schema, found.refusal.path, ctx.project) : null;
      const whole = schema === null ? null : { file: schema.file, start: schema.expr.start, end: schema.expr.end };
      const spot = exact ?? whole;
      const field = show(found.refusal.path);
      const where = spot === null ? `${ctx.dir}${ctx.at}` : spot.file.path;
      if (!found.request) {
        const m =
          found.refusal.why === "missing"
            ? `${id} ${found.part} no longer answers ${field}, which base callers need`
            : `${id} ${found.part} at ${field}: base callers refuse it (${found.refusal.why})`;
        out.push(diag("E1562", ctx, spot, where, m));
        continue;
      }
      if (found.refusal.why !== "missing") {
        const m = `${id} ${found.part} ${field}: refuses what base callers send (${found.refusal.why})`;
        out.push(diag("E1562", ctx, spot, where, m));
        continue;
      }
      const src = exact?.file.source ?? "";
      const end = exact?.end ?? 0;
      const fix =
        exact !== null &&
        found.refusal.path.length > 0 &&
        accepts(loosen(found.a, found.refusal.path), found.b) === null
          ? unifiedDiff(exact.file.path, src, `${src.slice(0, end)}.optional()${src.slice(end)}`)
          : undefined;
      out.push(diag("E1562", ctx, spot, where, `${id} ${found.part} requires ${field}; base callers send none`, fix));
    }
  }
  return out;
}

/**
 * k.compat Stored data, for each store in both surfaces: E1563 when the current state schema refuses the base one, at
 * the refused field of the store's schema source, with the E1562 fix (make one added required field optional) when it
 * clears it; W1564 per base transaction gone or whose payload schema now refuses the base one, at the store.
 */
function stored(current: Surface, before: Surface, ctx: Ctx): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [id, was] of before.stores) {
    const now = current.stores.get(id);
    if (now === undefined) continue;
    const at = storeSchemaAt(ctx.dir, id, ctx.project);
    const whole = at === null ? null : { file: at.file, start: at.expr.start, end: at.expr.start };
    const refused = now.state === null || was.state === null ? null : accepts(now.state, was.state);
    if (refused !== null) {
      const exact = fieldAt(at, refused.path, ctx.project);
      const src = exact?.file.source ?? "";
      const fix =
        exact !== null && refused.path.length > 0 && accepts(loosen(now.state, refused.path), was.state) === null
          ? unifiedDiff(exact.file.path, src, `${src.slice(0, exact.end)}.optional()${src.slice(exact.end)}`)
          : undefined;
      const m = `store ${id} state refuses its stored states at ${show(refused.path)} (${refused.why})`;
      out.push(diag("E1563", ctx, exact ?? whole, `${ctx.dir}${ctx.at}`, m, fix));
    }
    for (const [name, payload] of was.transactions) {
      const kept = now.transactions.get(name);
      const why = kept === undefined ? "is gone" : accepts(kept, payload) === null ? null : "narrows its payload";
      if (why !== null)
        out.push(
          diag("W1564", ctx, whole, `${ctx.dir}${ctx.at}`, `store ${id}: transaction ${name} ${why}; stored logs fold`),
        );
    }
  }
  return out;
}

/**
 * The k.compat pass over each `<dir>.keel/surface.json` among `files` that is a `version: 2` surface, intact (its
 * `hash` that of its `data`) and fresh (every evaluated source unchanged in `project`; else E1005 reports it). With a
 * `base` surface (`keel check --base`): E1562 for each base API entry with a caller in another deployable (by
 * `topologyOf(dir)`) that the current entry refuses (`base`), and E1563 and W1564 for its stores (`stored`); a `base`
 * that is no `version: 2` surface is one W1568 and nothing is compared.
 */
export function compatChecks(
  files: readonly SourceFile[],
  project: readonly SourceFile[],
  topologyOf: (dir: string) => Topology | undefined,
  baseValue: unknown,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const before = baseValue === undefined ? null : readSurface(baseValue);
  const surfaces = files.filter((f) => SURFACE.test(f.path));
  if (baseValue !== undefined && before === null) {
    const path = surfaces[0]?.path ?? ".keel/surface.json";
    const m = "--base names no surface of version 2; E1562 not checked";
    out.push({ kind: "diag", code: "W1568", path, line: 1, col: 1, message: m, see: "k.compat" });
  }
  if (before === null) return out;
  for (const file of surfaces) {
    const dir = SURFACE.exec(file.path)?.[1] ?? "";
    let value: unknown;
    try {
      value = JSON.parse(file.source);
    } catch {
      continue;
    }
    const surface = readSurface(value);
    const intact = isRecord(value) && Object.hasOwn(value, "data") && value.hash === hashOf(value.data);
    if (surface === null || !intact || staleSource(surface, dir, project) !== undefined) continue;
    const ctx: Ctx = { dir, project, at: ".keel/surface.json" };
    out.push(...base(surface, before, topologyOf(dir), ctx), ...stored(surface, before, ctx));
  }
  return out;
}
