import { type JsonValue, type KeelError, type Schema, piiPaths, piiValues, s } from "@keel/schema";
import { redact } from "../redact.ts";
import type { JsonObject } from "./JsonObject.ts";
import type { Redaction } from "./Redaction.ts";
import { hrefOf } from "./hrefOf.ts";
import { jsonOf } from "./jsonOf.ts";
import { objectOf } from "./objectOf.ts";
import { parseRedactEntry } from "./parseRedactEntry.ts";

const json = s.json();
/** How many distinct matched values a redaction remembers to scrub from later errors (the newest are kept). */
const REMEMBERED = 256;

const isObject = (v: JsonValue): v is { readonly [k: string]: JsonValue } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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
 * schema-backed values (and every `.pii()`-marked path of the schema, beside the entries) become generated values, `el:` and `error:` values are masked, `s.secret` always goes. An `el:`
 * entry masks every input value and one-character key of its element, and so does an element once reported masked
 * (a password, k.ctx). Every value an entry matched is masked again wherever it appears in a later error's message
 * or data, except `data.at` (where it fired, which only an `error:` entry masks), for the newest 256 distinct values
 * (a long session's memory stays bounded; an older value is assumed gone from app state); other free text in errors
 * is out of scope.
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
      if (x.length === 0) return x;
      known.delete(x);
      known.add(x);
      const oldest = known.size > REMEMBERED ? known.values().next() : undefined;
      if (oldest !== undefined && oldest.done !== true) known.delete(oldest.value);
      return x;
    });
  };
  /** Each matched value as it may appear in free text: as is, URL-encoded and JSON-escaped, any case; under 3 characters only as a whole token. */
  const scrub = (text: string): string => {
    let out = text;
    const forms = [...known].flatMap((k) => [k, encodeURIComponent(k), JSON.stringify(k).slice(1, -1)]);
    for (const k of [...new Set(forms)].sort((a, b) => b.length - a.length)) {
      const body = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(k.length < 3 ? `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])` : body, "giu");
      out = out.replace(re, (m) => "x".repeat(m.length));
    }
    return out;
  };
  const under = (key: string, prefix: string): string[] =>
    (paths.get(key) ?? []).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
  /**
   * `held` as `schema` encodes it, redacted. Every non-empty string and number under a mark in `held` is remembered
   * first, a marked open object's undeclared keys and what is under them among them: the encoded value no longer
   * holds those, and a later error may.
   */
  const apply = (schema: Schema<unknown, boolean>, held: unknown, salt: string, at: readonly string[]) => {
    for (const v of piiValues(schema, held)) found(v);
    return redact(schema, jsonOf(held, schema), {
      paths: [...at, ...piiPaths(schema).map((m) => m.path)],
      seed,
      salt,
      found,
    });
  };

  return {
    tx: (name, schema, payload) => apply(schema ?? json, payload, `tx:${name}`, paths.get(`tx:${name}`) ?? []),
    state: (id, schema, value) => apply(schema, value, `store:${id}`, paths.get(`store:${id}`) ?? []),
    nav(event) {
      const r = event.route;
      const key = `route:${r.id}`;
      const params = objectOf(apply(r.schemas.params ?? json, r.params, key, under(key, "params.")));
      const search = objectOf(apply(r.schemas.search ?? json, r.search, key, under(key, "search.")));
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
    blind(error) {
      const where = isObject(error.data) ? error.data.at : undefined;
      const out = each(error.data, (x) => "x".repeat(x.length));
      return {
        ...error,
        message: error.code,
        data: isObject(out) && typeof where === "string" ? { ...out, at: where } : out,
      };
    },
    remember: (value) => found(value),
    elements: [...paths]
      .filter(([key, at]) => key.startsWith("el:") && at.includes("value"))
      .map(([key]) => key.slice("el:".length)),
    error(error: KeelError<string, JsonValue>) {
      const at = under(`error:${error.code}`, "data.");
      const data = at.length === 0 ? error.data : apply(json, error.data, `error:${error.code}`, at);
      const out = each(data, scrub);
      // `data.at` names where the error fired and feeds the fingerprint: only an `error:` entry masks it.
      const where = isObject(data) ? data.at : undefined;
      return {
        ...error,
        message: scrub(error.message),
        data: isObject(out) && typeof where === "string" ? { ...out, at: where } : out,
      };
    },
  };
}
