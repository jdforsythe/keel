import { s } from "@keel/schema";
import type { SchemaError } from "@keel/schema";
import { isRecord } from "./isRecord.ts";
import { tokenGroups } from "./tokenGroups.ts";

type Issue = SchemaError["data"]["issues"][number];

const pair = s.object({ light: s.string(), dark: s.string() });
const scale = s.record(s.string());

const prefixed = (
  r: { readonly ok: true } | { readonly ok: false; readonly error: SchemaError },
  path: (string | number)[],
): Issue[] => (r.ok ? [] : r.error.data.issues.map((i) => ({ path: [...path, ...i.path], rule: i.rule })));

/**
 * Every way `x` fails the token file shape: a group outside the closed set (`enum`), a non-string token,
 * a color that is neither a string nor `{ light, dark }`.
 */
export function tokenIssues(x: unknown): Issue[] {
  if (!isRecord(x)) return [{ path: [], rule: "type" }];
  const issues: Issue[] = [];
  const known: readonly string[] = tokenGroups;
  for (const [group, value] of Object.entries(x)) {
    if (!known.includes(group)) issues.push({ path: [group], rule: "enum" });
    else if (group !== "color") issues.push(...prefixed(scale.parse(value), [group]));
    else if (!isRecord(value)) issues.push({ path: [group], rule: "type" });
    else
      for (const [name, c] of Object.entries(value))
        if (typeof c !== "string") issues.push(...prefixed(pair.parse(c), [group, name]));
  }
  return issues;
}
