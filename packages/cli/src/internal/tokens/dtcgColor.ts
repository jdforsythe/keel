import type { ColorText } from "./ColorText.ts";
import type { JsonNode } from "./JsonNode.ts";
import type { Vec3 } from "./Vec3.ts";
import { fmtNumber } from "./fmtNumber.ts";
import { memberOf } from "./memberOf.ts";
import { toOklch } from "./toOklch.ts";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const SIX = /^#[0-9a-f]{6}$/i;
const HEX_ALPHA = /^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/i;

const channel = (v: number): string =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");

/** The three numbers of a `components` array (`none` is 0), or undefined. */
function components(node: JsonNode | undefined): Vec3 | undefined {
  if (node?.kind !== "array" || node.items.length !== 3) return undefined;
  const v = node.items.map((i) =>
    i.kind === "number" ? i.value : i.kind === "string" && i.value === "none" ? 0 : Number.NaN,
  );
  const [a, b, c] = v;
  return a === undefined || b === undefined || c === undefined || !v.every(Number.isFinite) ? undefined : [a, b, c];
}

const withAlpha = (text: string, alpha: number | undefined): string =>
  alpha === undefined || alpha >= 1 ? text : `${text.slice(0, -1)} / ${fmtNumber(Math.max(0, alpha))})`;

/**
 * A DTCG color `$value` as the form `color` tokens take (k.values): a string `#rgb` or `#rrggbb` as written, an object
 * `{ colorSpace, components, alpha?, hex? }` in `srgb` as its `hex` or the `#rrggbb` of its components, in `hsl`,
 * `oklab`, `oklch` and `display-p3` in its own form, and in any other known space as `oklch()` at 4 decimals (the
 * result names that `space`). A color with alpha below 1 gives `alpha: true` and, as a hex or a function with ` / a`,
 * the form a shadow takes. Undefined when the value is none of these.
 */
export function dtcgColor(node: JsonNode): ColorText | undefined {
  if (node.kind === "string") {
    if (HEX.test(node.value)) return { text: node.value };
    if (!HEX_ALPHA.test(node.value)) return undefined;
    const digits = node.value.slice(1);
    const wide = digits.length === 8;
    const opaque = wide ? digits.slice(6).toLowerCase() === "ff" : digits.slice(3).toLowerCase() === "f";
    return opaque ? { text: `#${digits.slice(0, wide ? 6 : 3)}` } : { text: node.value, alpha: true };
  }
  const space = memberOf(node, "colorSpace")?.value;
  const c = components(memberOf(node, "components")?.value);
  const a = memberOf(node, "alpha")?.value;
  const alpha = a?.kind === "number" ? a.value : undefined;
  if (space?.kind !== "string" || c === undefined || (a !== undefined && alpha === undefined)) return undefined;
  const translucent = alpha !== undefined && alpha < 1;
  const flag: { alpha?: true } = translucent ? { alpha: true } : {};
  const hex = memberOf(node, "hex")?.value;
  const n = (v: number): string => fmtNumber(v);
  switch (space.value) {
    case "srgb": {
      const given = hex?.kind === "string" && (translucent ? SIX : HEX).test(hex.value) ? hex.value : undefined;
      const base = given ?? `#${c.map(channel).join("")}`;
      return { text: translucent ? `${base}${channel(alpha)}` : base, ...flag };
    }
    case "hsl":
      return { text: withAlpha(`hsl(${n(c[0])} ${n(c[1])}% ${n(c[2])}%)`, alpha), ...flag };
    case "oklab":
      return { text: withAlpha(`oklab(${n(c[0])} ${n(c[1])} ${n(c[2])})`, alpha), ...flag };
    case "oklch":
      return { text: withAlpha(`oklch(${n(c[0])} ${n(c[1])} ${n(c[2])})`, alpha), ...flag };
    case "display-p3":
      return { text: withAlpha(`color(display-p3 ${n(c[0])} ${n(c[1])} ${n(c[2])})`, alpha), ...flag };
    default: {
      const k = toOklch(space.value, c);
      if (k === undefined) return undefined;
      const f = (v: number): string => fmtNumber(v, 4);
      const text = withAlpha(`oklch(${f(Math.max(0, k[0]))} ${f(Math.max(0, k[1]))} ${f(k[2])})`, alpha);
      return { text, space: space.value, ...flag };
    }
  }
}
