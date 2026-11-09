import { type JsonValue, type KeelError, type Schema, s } from "@keel/schema";
import { redact } from "../redact.ts";
import type { JsonObject } from "./JsonObject.ts";
import type { Redaction } from "./Redaction.ts";
import { hrefOf } from "./hrefOf.ts";
import { jsonOf } from "./jsonOf.ts";
import { objectOf } from "./objectOf.ts";
import { parseRedactEntry } from "./parseRedactEntry.ts";

const json = s.json();

/** `v` with each string (and number, as text) passed through `fn`, depth first; an unchanged value keeps its type. */
function each(v: JsonValue, fn: (x: string) => string): JsonValue {
  if (Array.isArray(v)) return v.map((x) => each(x, fn));
  if (typeof v === "object" && v !== null)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, each(x, fn)]));
  if (typeof v !== "string" && typeof v !== "number") return v;
  const out = fn(String(v));
  return out === String(v) ? v : out;
}

/**
 * The redaction for `entries` (`<subject>:<target>#<path>`, every module's `redact` list) under session `seed`:
 * schema-backed values become generated values, `el:` and `error:` values are masked, `s.secret` always goes. An `el:`
 * entry masks every input value and one-character key of its element, and so does an element once reported masked
 * (a password, k.ctx). Every value an entry matched is masked again wherever it appears in a later error's message
 * or data; other free text in errors is out of scope.
 */
export function redactionOf(entries: readonly string[], seed: number): Redaction {
  const paths = new Map<string, string[]>();
  for (const e of entries) {
    const p = parseRedactEntry(e);
    if (p === undefined) continue;
    const key = `${p.subject}:${p.target}`;
    paths.set(key, [...(paths.get(key) ?? []), p.path]);
  }
  const known = new Set<string>();
  const masked = new Set<string>();
  const found = (v: JsonValue): void => {
    each(v, (x) => {
      if (x.length >= 3) known.add(x);
      return x;
    });
  };
  const scrub = (text: string): string => {
    let out = text;
    for (const k of [...known].sort((a, b) => b.length - a.length)) out = out.split(k).join("x".repeat(k.length));
    return out;
  };
  const under = (key: string, prefix: string): string[] =>
    (paths.get(key) ?? []).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
  const apply = (schema: Schema<unknown, boolean>, value: JsonValue, salt: string, at: readonly string[]) =>
    redact(schema, value, { paths: at, seed, salt, found });

  return {
    tx: (name, schema, payload) => apply(schema ?? json, payload, `tx:${name}`, paths.get(`tx:${name}`) ?? []),
    state: (id, schema, value) => apply(schema, value, `store:${id}`, paths.get(`store:${id}`) ?? []),
    nav(event) {
      const r = event.route;
      const key = `route:${r.id}`;
      const params = objectOf(
        apply(r.schemas.params ?? json, jsonOf(r.params, r.schemas.params), key, under(key, "params.")),
      );
      const search = objectOf(
        apply(r.schemas.search ?? json, jsonOf(r.search, r.schemas.search), key, under(key, "search.")),
      );
      // The href is always rebuilt from the redacted values, so an `s.secret` param or search never stays in it.
      return { route: { id: r.id, params, search }, href: hrefOf(r.path, params, search) };
    },
    fire(event) {
      const e = event.event;
      if (e.type === "input" && /^x+$/.test(e.value)) masked.add(event.id);
      if (!masked.has(event.id) && !(paths.get(`el:${event.id}`) ?? []).includes("value")) return event;
      if (e.type === "input") {
        found(e.value);
        return { ...event, event: { type: "input", value: "x".repeat(e.value.length) } };
      }
      return e.type === "keydown" && e.key.length === 1 ? { ...event, event: { type: "keydown", key: "x" } } : event;
    },
    error(error: KeelError<string, JsonValue>) {
      const at = under(`error:${error.code}`, "data.");
      const data = at.length === 0 ? error.data : apply(json, error.data, `error:${error.code}`, at);
      return { ...error, message: scrub(error.message), data: each(data, scrub) };
    },
  };
}
