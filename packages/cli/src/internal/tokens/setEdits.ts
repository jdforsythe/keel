import type { Expression, ObjectExpression, Program } from "oxc-parser";
import type { SourceEdit } from "./SourceEdit.ts";
import type { TokenPath } from "./TokenPath.ts";
import type { Val } from "./Val.ts";
import { afterSpreads } from "./afterSpreads.ts";
import { appendProperty } from "./appendProperty.ts";
import { importFacts } from "./importFacts.ts";
import { keyOf } from "./keyOf.ts";
import { keyText } from "./keyText.ts";
import { literalValue } from "./literalValue.ts";
import { tokensShape } from "./tokensShape.ts";

const q = (s: string): string => JSON.stringify(s);

/**
 * The edits that set `value` at `path` in the `tokens` of a `tokens.ts` (k.cli Tokens): the key written after the
 * literal's last spread in that group (and theme) is replaced, else added there, the group or theme created where
 * it is missing (a new group spreads the group of each top-level spread `holds` says holds it). With a scheme, a value
 * that was one string becomes a pair keeping it in the other scheme; `current` is the value the spreads give. Undefined
 * when `tokens` is not `defineTokens({...})` or a bare name, or a step of the path is not an object literal.
 */
export function setEdits(
  program: Program,
  path: TokenPath,
  value: string,
  current: Val | undefined,
  holds: (name: string, group: string) => boolean,
): SourceEdit[] | undefined {
  const shape = tokensShape(program);
  if (shape === undefined) return undefined;
  const { scheme } = path;
  const other = (v: Val | undefined): string => {
    if (scheme === undefined) return value;
    if (typeof v === "string") return v;
    return v === undefined ? value : scheme === "dark" ? v.light : v.dark;
  };
  const pair = (kept: string): string =>
    scheme === "dark" ? `{ light: ${q(kept)}, dark: ${q(value)} }` : `{ light: ${q(value)}, dark: ${q(kept)} }`;
  const fresh = scheme === undefined ? q(value) : pair(other(current));
  const chain = [...(path.theme === undefined ? [] : ["themes", path.theme]), path.group, path.name];
  const spreads =
    shape.literal === undefined
      ? [shape.alias ?? ""]
      : shape.literal.properties.flatMap((p) =>
          p.type === "SpreadElement" && p.argument.type === "Identifier" ? [p.argument.name] : [],
        );
  const create = (keys: readonly string[], depth: number): string => {
    const [key, ...rest] = keys;
    if (key === undefined) return fresh;
    if (rest.length === 0) return `${keyText(key)}: ${fresh}`;
    const base =
      depth === 0 && path.theme === undefined ? spreads.filter((s) => holds(s, key)).map((s) => `...${s}.${key}`) : [];
    return `${keyText(key)}: { ${[...base, create(rest, depth + 1)].join(", ")} }`;
  };
  const replace = (prop: { readonly value: Expression }): SourceEdit[] | undefined => {
    const v = prop.value;
    if (scheme === undefined) return [{ start: v.start, end: v.end, text: q(value) }];
    if (v.type === "ObjectExpression") {
      const own = v.properties.find((p) => p.type === "Property" && keyOf(p) === scheme);
      if (own?.type === "Property") return [{ start: own.value.start, end: own.value.end, text: q(value) }];
      return [appendProperty(v, `${scheme}: ${q(value)}`)];
    }
    const written = literalValue(v);
    return [{ start: v.start, end: v.end, text: pair(typeof written === "string" ? written : other(current)) }];
  };
  const descend = (obj: ObjectExpression, keys: readonly string[]): SourceEdit[] | undefined => {
    const [key, ...rest] = keys;
    if (key === undefined) return undefined;
    const prop = afterSpreads(obj, key);
    if (prop === undefined) return [appendProperty(obj, create(keys, chain.length - keys.length))];
    if (rest.length === 0) return replace(prop);
    return prop.value.type === "ObjectExpression" ? descend(prop.value, rest) : undefined;
  };
  const edits: SourceEdit[] | undefined =
    shape.literal === undefined
      ? [
          {
            start: shape.init.start,
            end: shape.init.end,
            text: `defineTokens({ ...${shape.alias ?? ""}, ${create(chain, 0)} })`,
          },
        ]
      : descend(shape.literal, chain);
  if (edits === undefined) return undefined;
  const imports = importFacts(program);
  if (shape.literal === undefined && imports.from.get("defineTokens") !== "@keel/ui#defineTokens")
    edits.push({
      start: imports.firstStart,
      end: imports.firstStart,
      text: 'import { defineTokens } from "@keel/ui";\n',
    });
  return edits;
}
