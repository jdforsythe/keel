import type { JsonValue } from "@keel/schema";
import type { JsonObject } from "./JsonObject.ts";

/** Params and search written back into a URL: `:name` segments filled, search keys sorted. */
export function hrefOf(path: string, params: JsonObject, search: JsonObject): string {
  const text = (v: JsonValue): string => (typeof v === "string" ? v : JSON.stringify(v));
  const filled = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k: string) =>
    encodeURIComponent(text(params[k] ?? "")),
  );
  const q = new URLSearchParams();
  for (const k of Object.keys(search).sort()) {
    const v = search[k];
    if (v === null || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) q.append(k, text(one));
  }
  const qs = q.toString();
  return qs === "" ? filled : `${filled}?${qs}`;
}
