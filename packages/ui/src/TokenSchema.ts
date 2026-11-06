import { err, ok, pathToString, s } from "@keel/schema";
import type { Result, Schema, SchemaError } from "@keel/schema";
import { isTokens } from "./internal/isTokens.ts";
import { tokenIssues } from "./internal/tokenIssues.ts";
import type { Tokens } from "./types/Tokens.ts";

const scale = s.record(s.string()).optional();

/** The node, generator and doc come from this open shape (string colors); `parse` adds what it cannot say. */
const shape = s.object({
  color: scale,
  space: scale,
  size: scale,
  radius: scale,
  font: scale,
  fontSize: scale,
  weight: scale,
  shadow: scale,
  breakpoint: scale,
  motion: scale,
});

const parse = (input: unknown): Result<Tokens, SchemaError> => {
  if (isTokens(input)) return ok(input);
  const issues = tokenIssues(input);
  const first = issues[0];
  const where = first === undefined || first.path.length === 0 ? "root" : pathToString(first.path);
  const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : "";
  return err({ code: "schema.invalid", message: `${first?.rule ?? "type"} at ${where}${more}`, data: { issues } });
};

/**
 * Validates `tokens.ts` (E1807): only the closed groups, string token values, colors a string or
 * `{ light, dark }`. `parse`/`decode`/`encode` enforce all of it; `node`, `gen`, `doc` describe the open
 * shape with string colors (k.schema has no closed objects or string-or-object unions yet).
 */
export const TokenSchema: Schema<Tokens> = {
  ...shape,
  parse,
  decode: parse,
  encode(value) {
    const r = parse(value);
    if (!r.ok) throw new Error(r.error.message);
    return Object.fromEntries(
      Object.entries(r.value).map(([group, names]) => [
        group,
        Object.fromEntries(
          Object.entries(names ?? {}).map(([n, v]) => [
            n,
            typeof v === "string" ? v : { light: v.light, dark: v.dark },
          ]),
        ),
      ]),
    );
  },
};
