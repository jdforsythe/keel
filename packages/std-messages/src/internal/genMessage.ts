import type { JsonValue } from "@keel/schema";
import type { ParamKind } from "./ParamKind.ts";

/**
 * Map generated `parts` to a valid object message for `params` (the format type's `gen.map`): a `select` over an
 * enum param, a `plural` over a number param or a `text`, as the param `parts.length` picks; each template names one.
 */
export function genMessage(parts: readonly string[], params: ReadonlyMap<string, ParamKind>): JsonValue {
  const all = [...params.keys()];
  const n = parts.length;
  const t = (i: number): string => `${(parts[i] ?? "").replace(/[{}]/g, "").slice(0, 60)} {${all[i % all.length]}}`;
  const name = all[n % all.length] ?? "";
  const kind = params.get(name);
  if (typeof kind === "object") return { select: name, cases: Object.fromEntries(kind.map((v, i) => [v, t(i)])) };
  return kind === "number" && n % 2 === 1 ? { plural: name, other: `# ${t(0)}` } : { text: t(0) };
}
