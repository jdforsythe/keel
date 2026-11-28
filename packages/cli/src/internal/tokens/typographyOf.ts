import type { Converted } from "./Converted.ts";
import type { Item } from "./Item.ts";
import type { JsonNode } from "./JsonNode.ts";
import type { Reach } from "./Reach.ts";
import type { Warn } from "./Warn.ts";
import { aliasPath } from "./aliasPath.ts";
import { dimensionText } from "./dimensionText.ts";
import { findToken } from "./findToken.ts";
import { fontFamilyText } from "./fontFamilyText.ts";
import { memberOf } from "./memberOf.ts";
import { tokenName } from "./tokenName.ts";
import { weightNumber } from "./weightNumber.ts";

const FIELDS: readonly { readonly field: string; readonly group: string }[] = [
  { field: "fontFamily", group: "font" },
  { field: "fontSize", group: "fontSize" },
  { field: "fontWeight", group: "weight" },
];
const DROPPED = ["lineHeight", "letterSpacing"];

const textOf = (group: string, node: JsonNode): string | undefined => {
  if (group === "font") return fontFamilyText(node);
  if (group === "fontSize") return dimensionText(node);
  const w = node.kind === "string" || node.kind === "number" ? weightNumber(node.value) : undefined;
  return w === undefined ? undefined : String(w);
};

/**
 * A DTCG typography `value` named `name` as a look of `font`, `fontSize` and `weight`: each field that is an alias
 * names the token it aliases, each other field becomes a token of `name` in its group. A field that does not
 * convert, and each `lineHeight` and `letterSpacing`, is a warning at its key unless `quiet`.
 */
export function typographyOf(reach: Reach, value: JsonNode, name: string, dotted: string, quiet: boolean): Converted {
  const items: Item[] = [];
  const warns: Warn[] = [];
  const look: Record<string, string> = {};
  for (const { field, group } of FIELDS) {
    const m = memberOf(value, field);
    if (m === undefined) continue;
    const path = aliasPath(m.value);
    if (path !== undefined) {
      const target = findToken(reach.files, reach.file, path);
      if (target === undefined) return { skip: "dangling alias", warns: [] };
      look[group] = tokenName(target.token.path);
      continue;
    }
    const text = textOf(group, m.value);
    if (text === undefined) {
      if (!quiet) warns.push({ at: m.keyAt, message: `${dotted} ${field}: dropped` });
      continue;
    }
    items.push({ group, name, value: text });
    look[group] = name;
  }
  if (!quiet)
    for (const field of DROPPED) {
      const m = memberOf(value, field);
      if (m !== undefined) warns.push({ at: m.keyAt, message: `${dotted} ${field}: dropped` });
    }
  if (Object.keys(look).length === 0) return { skip: "typography", warns: [] };
  return { items, look: { name, value: look }, warns };
}
