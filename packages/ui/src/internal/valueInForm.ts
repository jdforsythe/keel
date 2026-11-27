import type { GamutForm } from "../types/GamutForm.ts";
import { colorForm } from "./colorForm.ts";
import { colorSyntax } from "./colorSyntax.ts";

/** A hex color or a color function, as k.values writes them inside a token value (a `shadow` or a `border`). */
const COLOR = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])|\b(?:rgb|hsl|oklab|oklch|color)\([^()]*\)/g;

/** A token value with each color it writes in `form` (k.gamut CSS); any other text as written. */
export function valueInForm(value: string, form: GamutForm): string {
  return value.replace(COLOR, (c) => (colorSyntax(c) === null ? c : colorForm(c, form)));
}
