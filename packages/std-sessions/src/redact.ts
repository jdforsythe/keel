import type { JsonValue, Schema } from "@keel/schema";
import type { TypeNode } from "./internal/TypeNode.ts";
import { fake } from "./internal/fake.ts";
import { mask } from "./internal/mask.ts";
import { pathSegments } from "./internal/pathSegments.ts";
import { seeded } from "./internal/seeded.ts";

type Options = {
  /** Dot paths into `value` to replace (`pathSegments`): `*` matches any one segment, `\\.` is a literal dot. */
  readonly paths: readonly string[];
  /** Session seed; with `salt` and the path it seeds each generated value. */
  readonly seed: number;
  /** The redact entry's subject and target, e.g. `tx:cart.pay`. */
  readonly salt: string;
  /** Also write every `s.string()` value not under one of `except` as `x` repeated (`to-test`, D3). */
  readonly strings?: { readonly except: readonly string[] };
  /** Called with each original value a path matched (a recorder masks them in later error messages). */
  readonly found?: (original: JsonValue) => void;
};

const isObject = (v: JsonValue): v is { readonly [k: string]: JsonValue } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const matches = (pattern: readonly (string | null)[], at: readonly string[]): boolean =>
  pattern.length === at.length && pattern.every((p, i) => p === null || p === at[i]);

const under = (pattern: readonly (string | null)[], at: readonly string[]): boolean =>
  pattern.length <= at.length && matches(pattern, at.slice(0, pattern.length));

/**
 * Redact an encoded value of `schema` (std.sessions): each value at one of `paths` becomes its field schema's generated
 * value, and the keys of a `.pii()`-marked `s.record` become `x0`, `x1`, ... in entry order (distinct, still a record) (seeded by `seed`, `salt` and the path), so the result still parses; every `s.secret` field becomes a generated
 * inner value. Under an `s.json()` field a matched value is masked (`x` repeated, 0, false, null). With `strings`, every
 * `s.string()` value, and every string under `s.json()`, not under an `except` path is written as `x` repeated. Pure.
 */
export function redact(schema: Schema<unknown, boolean>, value: JsonValue, options: Options): JsonValue {
  const patterns = options.paths.map(pathSegments);
  const except = options.strings?.except.map(pathSegments);
  const gen = (node: TypeNode, at: readonly string[]): JsonValue =>
    fake(node, seeded(options.seed, options.salt, at.join(".")));

  /** In strings mode, a string not under an `except` path becomes `x` repeated. */
  const hide = (v: JsonValue, at: readonly string[]): JsonValue =>
    except !== undefined && typeof v === "string" && !except.some((p) => under(p, at)) ? "x".repeat(v.length) : v;

  const walk = (node: TypeNode, v: JsonValue, at: readonly string[], typed: boolean, inherited = false): JsonValue => {
    const marked = inherited || (typed && node.pii !== undefined);
    if (patterns.some((p) => matches(p, at))) {
      options.found?.(v);
      return typed ? gen(node, at) : mask(v);
    }
    if (!typed) {
      if (Array.isArray(v)) return v.map((x, i) => walk(node, x, [...at, String(i)], false, marked));
      if (isObject(v))
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(node, x, [...at, k], false, marked)]));
      return hide(v, at);
    }
    switch (node.kind) {
      case "secret":
        return gen(node.inner, at);
      case "nullable":
      case "optional":
        return v === null && node.kind === "nullable" ? v : walk(node.inner, v, at, true);
      case "json":
        return walk(node, v, at, false, marked);
      case "string":
        return hide(v, at);
      case "format":
        return walk(node.base, v, at, true, marked);
      case "array":
        return Array.isArray(v) ? v.map((x, i) => walk(node.item, x, [...at, String(i)], true, marked)) : v;
      case "record":
        return isObject(v)
          ? Object.fromEntries(
              Object.entries(v).map(([k, x], i) => {
                if (marked) options.found?.(k);
                return [marked ? `x${i}` : k, walk(node.value, x, [...at, k], true, marked)];
              }),
            )
          : v;
      case "object":
        return isObject(v)
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => {
                const f = node.fields[k];
                return [k, f === undefined ? x : walk(f, x, [...at, k], true, marked)];
              }),
            )
          : v;
      case "union": {
        const tag = isObject(v) ? v[node.key] : undefined;
        const variant = node.variants.find(
          (n) => n.kind === "object" && n.fields[node.key]?.kind === "literal" && literalOf(n.fields[node.key]) === tag,
        );
        return variant === undefined ? v : walk(variant, v, at, true, marked);
      }
      default:
        return v;
    }
  };
  return walk(schema.node, value, [], true);
}

const literalOf = (n: TypeNode | undefined): JsonValue => (n?.kind === "literal" ? n.value : null);
