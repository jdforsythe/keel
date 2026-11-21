import type { JsonValue } from "@keel/schema";
import { codeError } from "./codeError.ts";

const isPlain = (v: object): boolean => {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** What `v` is, in words that name no part of it. */
function kind(v: unknown): string {
  if (v === undefined) return "undefined";
  if (typeof v === "number") return "a non-finite number";
  if (typeof v !== "object" || v === null) return `a ${typeof v}`;
  const name: unknown = Reflect.get(Object(Reflect.get(Object(Object.getPrototypeOf(v)), "constructor")), "name");
  return typeof name === "string" && name !== "" ? `a ${name}` : "an object that is not plain";
}

/**
 * `v` checked as a JSON value and copied, for the parameter `$position`: a string, finite number, boolean, `null`, an
 * array of these or a plain object. Anything else, at any depth, throws E2457 naming the 1-based position and the
 * kind of value, never the value.
 */
export function toParam(v: unknown, position: number): JsonValue {
  const seen = new Set<object>();
  const fail = (bad: unknown, why?: string): never => {
    throw codeError("E2457", `parameter $${position} is not a JSON value: ${why ?? kind(bad)}`);
  };
  const walk = (x: unknown): JsonValue => {
    if (x === null || typeof x === "string" || typeof x === "boolean") return x;
    if (typeof x === "number") return Number.isFinite(x) ? x : fail(x);
    if (typeof x !== "object") return fail(x);
    if (seen.has(x)) return fail(x, "a cycle");
    seen.add(x);
    let out: JsonValue;
    if (Array.isArray(x)) {
      const items: JsonValue[] = [];
      for (let i = 0; i < x.length; i++) items.push(walk(i in x ? x[i] : undefined));
      out = items;
    } else if (isPlain(x)) {
      const fields: Record<string, JsonValue> = {};
      for (const key of Object.keys(x)) fields[key] = walk(Reflect.get(x, key));
      out = fields;
    } else {
      out = fail(x);
    }
    seen.delete(x);
    return out;
  };
  return walk(v);
}
