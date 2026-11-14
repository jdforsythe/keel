import type { Topology } from "@keel/compiler";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import { clip } from "../clip.ts";
import { hashOf } from "../hashOf.ts";
import { lineCol } from "../lineCol.ts";
import { short } from "../modules/short.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { Refusal } from "./Refusal.ts";
import type { Spot } from "./Spot.ts";
import type { Surface } from "./Surface.ts";
import type { SurfaceEndpoint } from "./SurfaceEndpoint.ts";
import type { SurfaceRoute } from "./SurfaceRoute.ts";
import type { SurfaceService } from "./SurfaceService.ts";
import { accepts } from "./accepts.ts";
import { endpointAt } from "./endpointAt.ts";
import { fieldAt } from "./fieldAt.ts";
import { isRecord } from "./isRecord.ts";
import { keyAt } from "./keyAt.ts";
import { readSurface } from "./readSurface.ts";
import { routeFor } from "./routeFor.ts";
import { routeSchemaAt } from "./routeSchemaAt.ts";
import { staleSource } from "./staleSource.ts";
import { storeSchemaAt } from "./storeSchemaAt.ts";

const SURFACE = /^((?:.*\/)?)\.keel\/surface\.json$/;
/** What an endpoint without `params`/`query`/`body` sends: nothing (an empty JSON body decodes as `{}`, k.server). */
const EMPTY = { type: "object", properties: {}, required: [], additionalProperties: false };
/** Every route's error answer (k.compat Surface): a public KeelError `{ code, message, data }`. */
const ERROR_ANSWER = {
  type: "object",
  properties: { code: { type: "string" }, message: { type: "string" }, data: {} },
  required: ["code", "data", "message"],
  additionalProperties: false,
};

type Part = "params" | "search" | "input" | "output";
type Found = {
  readonly part: Part;
  readonly label: string;
  readonly refusal: Refusal;
  readonly a: unknown;
  readonly b: unknown;
};
const SENT: Readonly<Record<Part, string>> = { params: "params", search: "query", input: "body", output: "output" };

const show = (path: readonly string[]): string => (path.length === 0 ? "(root)" : path.join("."));

/** The first part of a request `e` sends that route `r` refuses (params, search, then the action input). */
function request(r: SurfaceRoute, e: SurfaceEndpoint): Found | null {
  const action = r.actions.get(e.method);
  const parts: [Part, unknown, unknown][] = [
    ["params", r.params, e.params],
    ["search", r.search, e.query],
    ...(action === undefined ? [] : [["input", action.input, e.body] satisfies [Part, unknown, unknown]]),
  ];
  for (const [part, a, b] of parts) {
    const refusal = a === null ? null : accepts(a, b ?? EMPTY);
    if (refusal !== null) return { part, label: part, refusal, a, b: b ?? EMPTY };
  }
  return null;
}

/** Route `r`'s answer to `e`'s method: the GET answer, else the action's. */
const answerOf = (r: SurfaceRoute, e: SurfaceEndpoint): unknown => r.actions.get(e.method)?.answer ?? r.get;

/** The first part of `e`'s `output` or `errors` that refuses route `r`'s answer. */
function response(r: SurfaceRoute, e: SurfaceEndpoint, withErrors: boolean): Found | null {
  const answer = answerOf(r, e);
  const parts: [string, unknown, unknown][] = [
    ["output", e.output, answer],
    ...(withErrors ? [...e.errors].map(([s, x]): [string, unknown, unknown] => [`errors[${s}]`, x, ERROR_ANSWER]) : []),
  ];
  for (const [label, a, b] of parts) {
    const refusal = a === null || b === null ? null : accepts(a, b);
    if (refusal !== null) return { part: "output", label, refusal, a, b };
  }
  return null;
}

/** `schema` with the field at `path` no longer required (the E1562 fix, applied to the JSON Schema). */
function loosen(schema: unknown, path: readonly string[]): unknown {
  const [k, ...rest] = path;
  if (!isRecord(schema) || k === undefined || !isRecord(schema.properties)) return schema;
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

/** E1561 for each endpoint of `s` (k.compat Endpoints): no route at its method and path, or a refused part. */
function endpoints(surface: Surface, s: SurfaceService, ctx: Ctx): Diagnostic[] {
  const file = ctx.project.find((f) => f.path === `${ctx.dir}${s.file}`);
  return s.endpoints.flatMap((e) => {
    const ep = `${short(s.caller)}.${short(e.name)}`;
    const spot = file === undefined ? null : endpointAt(file, s.module, e.name, ctx.project);
    const say = (m: string) => [diag("E1561", ctx, spot, `${ctx.dir}${s.file}`, m)];
    const r = routeFor(surface.routes, s.module, e.method, e.path);
    if (r === undefined)
      return say(`${ep} calls ${e.method} ${clip(e.path, 24)}, which no route of ${short(s.module)} serves`);
    const found = request(r, e) ?? response(r, e, true);
    if (found === null) return [];
    const { refusal, label } = found;
    const field = show(refusal.path);
    const producer = `${short(r.id)} ${found.part === "output" ? `${e.method} answer` : found.part}`;
    if (found.part !== "output" && refusal.why === "missing")
      return say(`${ep} ${SENT[found.part]} lacks ${field}, which ${producer} requires`);
    if (found.part !== "output")
      return say(`${ep} ${SENT[found.part]} ${field}: ${producer} refuses it (${refusal.why})`);
    if (refusal.why === "missing") return say(`${ep} ${label} needs ${field}, which ${producer} lacks`);
    return say(`${ep} ${label} refuses ${producer} at ${field} (${refusal.why})`);
  });
}

/**
 * Where route `r`'s schema for `found` is written, the refused field when the source spells it out (`exact`, the
 * only spot a fix may edit).
 */
function routeSpot(r: SurfaceRoute, method: string, found: Found, ctx: Ctx): (Spot & { exact?: Spot }) | null {
  const file = ctx.project.find((f) => f.path === `${ctx.dir}${r.file}`);
  if (file === undefined) return null;
  const schema = routeSchemaAt(file, r.id, found.part, method, ctx.project);
  const start = keyAt(file, r.id);
  const exact = fieldAt(schema, found.refusal.path, ctx.project);
  return exact === null ? (fieldAt(schema, [], ctx.project) ?? { file, start, end: start }) : { ...exact, exact };
}

/** E1562 for each base endpoint whose caller and module now sit in different deployables (k.compat Base). */
function base(current: Surface, before: Surface, topology: Topology | undefined, ctx: Ctx): Diagnostic[] {
  const together = (a: string, b: string): boolean =>
    topology === undefined || Object.values(topology).some((d) => d.modules.includes(a) && d.modules.includes(b));
  return before.services.flatMap((s) => {
    if (together(s.caller, s.module)) return [];
    return s.endpoints.flatMap((e) => {
      const ep = `${short(s.caller)}.${short(e.name)} (base)`;
      const r = routeFor(current.routes, s.module, e.method, e.path);
      if (r === undefined) {
        const m = `${ep} calls ${e.method} ${clip(e.path, 24)}; no route of ${short(s.module)} serves it now`;
        return [diag("E1562", ctx, null, `${ctx.dir}${ctx.at}`, m)];
      }
      const req = request(r, e);
      const found = req ?? response(r, e, false);
      if (found === null) return [];
      const spot = routeSpot(r, e.method, found, ctx);
      const field = show(found.refusal.path);
      const id = short(r.id);
      if (req === null) {
        const m =
          found.refusal.why === "missing"
            ? `${ep} needs ${field}; ${id} no longer answers it`
            : `${ep} output refuses ${id} answer at ${field} (${found.refusal.why})`;
        return [diag("E1562", ctx, spot, `${ctx.dir}${r.file}`, m)];
      }
      if (found.refusal.why !== "missing")
        return [
          diag("E1562", ctx, spot, `${ctx.dir}${r.file}`, `${ep} ${SENT[found.part]} ${field}: ${id} refuses it`),
        ];
      const exact = spot?.exact;
      const src = exact?.file.source ?? "";
      const end = exact?.end ?? 0;
      const fix =
        exact !== undefined &&
        found.refusal.path.length > 0 &&
        accepts(loosen(found.a, found.refusal.path), found.b) === null
          ? unifiedDiff(exact.file.path, src, `${src.slice(0, end)}.optional()${src.slice(end)}`)
          : undefined;
      return [diag("E1562", ctx, spot, `${ctx.dir}${r.file}`, `${ep} sends no ${field}; ${id} requires it`, fix)];
    });
  });
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
 * The k.compat pass over each `<dir>.keel/surface.json` among `files` that is intact (its `hash` that of its `data`)
 * and fresh (every evaluated source unchanged in `project`; else E1005 reports it): E1561 for every `service({ module })`
 * endpoint its route does not accept or whose `output`/`errors` refuse the route's answer, at the endpoint; and, with a
 * `base` surface (`keel check --base`), E1562 for each base endpoint in another deployable (by `topologyOf(dir)`) that
 * the current route refuses, at the route's schema, with a fix when making one required field optional clears it,
 * and E1563 and W1564 for its stores (`stored`).
 */
export function compatChecks(
  files: readonly SourceFile[],
  project: readonly SourceFile[],
  topologyOf: (dir: string) => Topology | undefined,
  baseValue: unknown,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const before = baseValue === undefined ? null : readSurface(baseValue);
  for (const file of files) {
    const dir = SURFACE.exec(file.path)?.[1];
    if (dir === undefined) continue;
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
    for (const s of surface.services) out.push(...endpoints(surface, s, ctx));
    if (before !== null) out.push(...base(surface, before, topologyOf(dir), ctx), ...stored(surface, before, ctx));
  }
  return out;
}
