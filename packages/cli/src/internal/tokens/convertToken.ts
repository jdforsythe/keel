import type { Converted } from "./Converted.ts";
import { DIMENSION_GROUPS } from "./DIMENSION_GROUPS.ts";
import type { DesignToken } from "./DesignToken.ts";
import type { Reach } from "./Reach.ts";
import { borderText } from "./borderText.ts";
import { dimensionText } from "./dimensionText.ts";
import { dtcgColor } from "./dtcgColor.ts";
import { durationText } from "./durationText.ts";
import { fontFamilyText } from "./fontFamilyText.ts";
import { resolveAlias } from "./resolveAlias.ts";
import { shadowText } from "./shadowText.ts";
import { tokenName } from "./tokenName.ts";
import { typographyOf } from "./typographyOf.ts";
import { weightNumber } from "./weightNumber.ts";

/**
 * One design token as what the importer writes for it (k.cli Tokens), or the `what` that has no Keel group. An alias
 * takes its target's value, written `<ref>` in a `border` or `shadow`; a token that is an alias gives no warning
 * about its target's value, which the target gives.
 */
export function convertToken(reach: Reach, token: DesignToken): Converted {
  const skip = (what: string): Converted => ({ skip: what, warns: [] });
  const dotted = token.path.join(".");
  const r = resolveAlias(reach.files, { file: reach.file, token });
  if ("error" in r) return skip(r.error);
  const quiet = r.token !== token;
  const at = { files: reach.files, file: r.file };
  const type = token.type ?? r.token.type;
  const value = r.token.value;
  const name = tokenName(token.path);
  if (name === "") return skip("name");
  const one = (group: string, text: string | undefined, converted?: string): Converted => {
    if (text === undefined) return skip(type ?? "value");
    const warns =
      converted === undefined || quiet ? [] : [{ at: token.valueAt, message: `${dotted}: ${converted} as oklch` }];
    return { items: [{ group, name, value: text }], warns };
  };
  switch (type) {
    case "color": {
      const c = dtcgColor(value);
      if (c === undefined) return skip("color value");
      return c.alpha === true ? skip("color with alpha") : one("color", c.text, c.space);
    }
    case "dimension": {
      const group = DIMENSION_GROUPS.get(token.path[0] ?? "");
      return group === undefined || token.path.length < 2 ? skip("dimension") : one(group, dimensionText(value));
    }
    case "fontFamily":
      return one("font", fontFamilyText(value));
    case "fontWeight": {
      const w = value.kind === "string" || value.kind === "number" ? weightNumber(value.value) : undefined;
      return one("weight", w === undefined ? undefined : String(w));
    }
    case "duration":
      return one("motion", durationText(value));
    case "shadow": {
      const s = shadowText(at, value);
      return s === undefined ? skip("shadow") : one("shadow", s.text, s.converted[0]);
    }
    case "border": {
      const b = borderText(at, value);
      return b === undefined ? skip("border") : one("border", b.text, b.converted);
    }
    case "typography":
      return typographyOf(at, value, name, dotted, quiet);
    default:
      return skip(type ?? "value without $type");
  }
}
