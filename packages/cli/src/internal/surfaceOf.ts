import { isSchema } from "@keel/schema";
import type { Evaluated } from "./Evaluated.ts";
import type { JsonSchema } from "./JsonSchema.ts";
import { isRecord } from "./isRecord.ts";
import { toJsonSchema } from "./toJsonSchema.ts";

/** The JSON Schema of a schema this process made, or `null` when `x` is none (k.identity). */
const ownJson = (x: unknown): JsonSchema | null => (isSchema(x) ? toJsonSchema(x.node) : null);

/** The binding members that hold a handler: a loader, an API action and each page action verb. */
const HANDLERS = ["loader", "action", "DELETE", "PATCH", "POST", "PUT"] as const;

/** One API entry as the surface records it, or `null` when `e` is a page or layout entry. */
function apiEntry(e: unknown, schemaOf: (x: unknown) => JsonSchema | null): JsonSchema | null {
  if (!isRecord(e) || typeof e.method !== "string" || typeof e.path !== "string" || e.output === undefined) return null;
  const errors = Object.fromEntries(
    Object.entries(isRecord(e.errors) ? e.errors : {}).flatMap(([status, x]) => {
      const s = schemaOf(x);
      return s === null ? [] : [[status, s]];
    }),
  );
  const parts = { params: schemaOf(e.params), query: schemaOf(e.query), body: schemaOf(e.body) };
  return { method: e.method, path: e.path, ...parts, output: schemaOf(e.output) ?? {}, errors };
}

/** Each contract with an API entry, by module (the first contract of a module wins). */
function contractsOf(e: Evaluated): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  const seen = new Set<string>();
  for (const c of e.contracts) {
    if (!isRecord(c) || c.kind !== "keel.contract" || typeof c.module !== "string" || !isRecord(c.entries)) continue;
    if (seen.has(c.module)) continue;
    seen.add(c.module);
    const entries = Object.fromEntries(
      Object.entries(c.entries).flatMap(([id, entry]) => {
        const api = apiEntry(entry, e.schemaJson ?? ownJson);
        return api === null ? [] : [[id, api]];
      }),
    );
    if (Object.keys(entries).length === 0) continue;
    out[c.module] = { module: c.module, callers: [...(e.callers[c.module] ?? [])].sort(), entries };
  }
  return out;
}

/** Each store the bound loaders' and actions' `stores` factories create: its state and payload schemas, by id. */
function storesOf(e: Evaluated): Record<string, JsonSchema> {
  const schemaOf = e.schemaJson ?? ownJson;
  const factories = new Set<unknown>();
  for (const b of e.bindings) {
    if (!isRecord(b)) continue;
    for (const key of HANDLERS) {
      const h = b[key];
      if (isRecord(h) && typeof h.stores === "function") factories.add(h.stores);
    }
  }
  const out: Record<string, JsonSchema> = {};
  for (const f of factories) {
    const shapes = e.storesOf?.(f);
    for (const sh of Array.isArray(shapes) ? shapes : []) {
      if (!isRecord(sh) || typeof sh.id !== "string" || out[sh.id] !== undefined) continue;
      const txs = isRecord(sh.transactions) ? Object.entries(sh.transactions) : [];
      const transactions = Object.fromEntries(txs.map(([name, p]) => [name, schemaOf(p) ?? {}]));
      out[sh.id] = { state: schemaOf(sh.state) ?? {}, transactions };
    }
  }
  return out;
}

/**
 * The data of `.keel/surface.json` (k.compat Surface): `contracts`, for each contract with an API entry by module,
 * its `module`, `callers` (sorted) and `entries`, each API entry by id with its `method`, `path`, `params`, `query`,
 * `body` (an absent one `null`), `output` and `errors` (`{}` without); pages and layouts are not recorded. `stores`,
 * each store a bound loader's or action's `stores` factory creates (one run on a sim ctx) by id, its state schema
 * and each transaction's payload schema; `sources`, the hash of each evaluated file's normal form (E1005 freshness). Schemas are
 * JSON Schema, as in `routes.json`. The file holds `version: 2`.
 */
export function surfaceOf(e: Evaluated): JsonSchema {
  return { version: 2, contracts: contractsOf(e), stores: storesOf(e), sources: e.sources };
}
