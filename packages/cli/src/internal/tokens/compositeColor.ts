import type { ColorText } from "./ColorText.ts";
import type { JsonNode } from "./JsonNode.ts";
import type { Reach } from "./Reach.ts";
import { aliasPath } from "./aliasPath.ts";
import { dtcgColor } from "./dtcgColor.ts";
import { findToken } from "./findToken.ts";
import { tokenName } from "./tokenName.ts";

/**
 * The color of a `shadow` or `border` field: an alias is `var(--k-color-<name>)` of the token it names, any other
 * value as `dtcgColor` writes it. Undefined when the alias does not resolve or the value is no color.
 */
export function compositeColor(reach: Reach, node: JsonNode): ColorText | undefined {
  const path = aliasPath(node);
  if (path === undefined) return dtcgColor(node);
  const target = findToken(reach.files, reach.file, path);
  return target === undefined ? undefined : { text: `var(--k-color-${tokenName(target.token.path)})` };
}
