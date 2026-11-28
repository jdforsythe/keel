import { pascal } from "../internal/pascal.ts";

/** The `s.id` entity a route param names: `listId` -> `List`, `id` -> the module's name; null for any other param. */
function paramEntity(param: string, mod: string): string | null {
  if (param === "id") return pascal(mod);
  return /^[a-z][a-zA-Z0-9]*Id$/.test(param) ? pascal(param.slice(0, -2)) : null;
}

/**
 * One k.contract entry, multi-line (the layout biome keeps): `method` for an API entry (`method` non-null), `path`,
 * `params` iff the path has `:name` (`s.id("<Entity>")` for `id` and `*Id` params, else `s.string()`), and an API
 * entry's `output`. Continuation lines are relative to the entry's own indent.
 */
export function contractEntry(id: string, path: string, params: readonly string[], method: string | null): string {
  const mod = id.slice(0, id.indexOf("."));
  const body = [...(method === null ? [] : [`method: "${method}",`]), `path: "${path}",`];
  if (params.length > 0) {
    const fields = params.map((p) => {
      const entity = paramEntity(p, mod);
      return `${p}: ${entity === null ? "s.string()" : `s.id("${entity}")`}`;
    });
    body.push(`params: s.object({ ${fields.join(", ")} }),`);
  }
  if (method !== null) body.push("output: s.object({}),");
  return [`"${id}": {`, ...body.map((l) => `  ${l}`), "}"].join("\n");
}
