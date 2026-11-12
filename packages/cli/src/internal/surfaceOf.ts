import type { Evaluated } from "./Evaluated.ts";
import type { JsonSchema } from "./JsonSchema.ts";
import { isRecord } from "./isRecord.ts";
import { isSchemaNode } from "./isSchemaNode.ts";
import { toJsonSchema } from "./toJsonSchema.ts";

type Rec = Readonly<Record<string, unknown>>;

const CALLER = /^modules\/([^/]+)\//;
const VERBS = ["DELETE", "PATCH", "POST", "PUT"] as const;
/** An action's answer (k.compat Surface): the `ok` value of its `Result`, `Href | null`. */
const ACTION_ANSWER: JsonSchema = { anyOf: [{ type: "string" }, { type: "null" }] };

/** The JSON Schema of a schema value (`{ node }`), or `null` when `x` is none. */
function schemaOf(x: unknown): JsonSchema | null {
  return isRecord(x) && isSchemaNode(x.node) ? toJsonSchema(x.node) : null;
}

/** The entries of every manifest, by route id (first manifest wins), with the file declaring each. */
function table(manifests: Evaluated["manifests"]): Map<string, { readonly def: Rec; readonly file: string }> {
  const out = new Map<string, { def: Rec; file: string }>();
  for (const m of manifests) {
    const routes = isRecord(m.routes) && isRecord(m.routes.routes) ? m.routes.routes : {};
    for (const [id, def] of Object.entries(routes))
      if (isRecord(def) && !out.has(id)) out.set(id, { def, file: m.file });
  }
  return out;
}

/** One `service({ module })` call: its endpoints' method, path and schemas, or `null` when it is not one. */
function serviceOf(file: string, opts: unknown): JsonSchema | null {
  const caller = CALLER.exec(file)?.[1];
  if (caller === undefined || !isRecord(opts) || typeof opts.module !== "string" || !isRecord(opts.schema)) return null;
  const endpoints = Object.fromEntries(
    Object.entries(opts.schema).flatMap(([name, e]) => {
      if (!isRecord(e) || typeof e.method !== "string" || typeof e.path !== "string") return [];
      const errors = Object.fromEntries(
        Object.entries(isRecord(e.errors) ? e.errors : {}).flatMap(([status, x]) => {
          const s = schemaOf(x);
          return s === null ? [] : [[status, s]];
        }),
      );
      const parts = { params: schemaOf(e.params), query: schemaOf(e.query), body: schemaOf(e.body) };
      return [[name, { method: e.method, path: e.path, ...parts, output: schemaOf(e.output) ?? {}, errors }]];
    }),
  );
  return { file, caller, module: opts.module, endpoints };
}

/**
 * The data of `.keel/surface.json` (k.compat Surface): for each path route its `module` (the id's first segment),
 * `path`, declaring `file`, `params`, `search`, GET answer (its loader's `output`; none without a loader) and, per
 * action method, `input` and answer (`Href | null`); for each `service({ module })` call in an app module its `file`,
 * calling module, `module` and endpoints (method, path, `params`, `query`, `body`, `output`, `errors`); and
 * `sources`, the hash of each evaluated file (E1005 freshness).
 * Schemas are JSON Schema, as in `routes.json`; an absent one is `null`. The file holds `version: 1`.
 */
export function surfaceOf(e: Evaluated): JsonSchema {
  const all = table(e.manifests);
  const routes = Object.fromEntries(
    [...all]
      .filter(([, r]) => typeof r.def.path === "string")
      .map(([id, { def, file }]) => {
        const bound = e.actionsOf(def);
        const actions = Object.fromEntries(
          VERBS.flatMap((v) => {
            const a = isRecord(bound) ? bound[v] : undefined;
            return isRecord(a) ? [[v, { input: schemaOf(a.input), answer: ACTION_ANSWER }]] : [];
          }),
        );
        const route = { module: id.split(".")[0] ?? id, path: def.path, file, params: schemaOf(def.params) };
        const get = isRecord(def.loader) ? (schemaOf(def.loader.output) ?? {}) : null;
        return [id, { ...route, search: schemaOf(def.search), get, actions }];
      }),
  );
  const services = e.services.flatMap((s) => serviceOf(s.file, s.opts) ?? []);
  return { version: 1, routes, services, sources: e.sources };
}
