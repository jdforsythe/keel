import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";

/**
 * The Keel brand (docs/BRAND.md), plus `size.control`: the full width of a text control less its `px="2"` padding
 * and its two border pixels, since a control's width counts its content box only.
 */
export const tokens = defineTokens({ ...brandTokens, size: { ...brandTokens.size, control: "calc(100% - 18px)" } });
