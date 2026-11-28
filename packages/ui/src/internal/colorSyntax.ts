import type { ColorSyntax } from "../types/ColorSyntax.ts";

/** A `<n>`: digits with an optional `.` and digits, no sign, no exponent (k.values Numbers and lengths). */
const N = /^\d+(?:\.\d+)?$/;
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const num = (s: string, min: number, max: number): number | null => {
  if (!N.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};
/** A `<n>` from 0 to 1, or one from 0 to 100 followed by `%`, as a fraction (`<l>` and `<a>`). */
const unitOrPercent = (s: string): number | null => {
  if (s.endsWith("%")) {
    const p = num(s.slice(0, -1), 0, 100);
    return p === null ? null : p / 100;
  }
  return num(s, 0, 1);
};
/** `<h>`: an `<n>`, bare or followed by `deg`. */
const hue = (s: string): number | null => num(s.endsWith("deg") ? s.slice(0, -3) : s, 0, Number.POSITIVE_INFINITY);
/** `<ab>`: an `<n>`, or `-` and an `<n>`, from -0.5 to 0.5. */
const ab = (s: string): number | null => {
  const neg = s.startsWith("-");
  const n = num(neg ? s.slice(1) : s, 0, 0.5);
  return n === null ? null : neg ? -n : n;
};
const percent = (s: string): number | null => (s.endsWith("%") ? num(s.slice(0, -1), 0, 100) : null);

const FORMS: Readonly<Record<string, readonly [string, ((s: string) => number | null)[]]>> = {
  "rgb(": ["rgb", [(s) => num(s, 0, 255), (s) => num(s, 0, 255), (s) => num(s, 0, 255)]],
  "hsl(": ["hsl", [hue, percent, percent]],
  "oklab(": ["oklab", [unitOrPercent, ab, ab]],
  "oklch(": ["oklch", [unitOrPercent, (s) => num(s, 0, 0.5), hue]],
  "color(display-p3 ": ["p3", [(s) => num(s, 0, 1), (s) => num(s, 0, 1), (s) => num(s, 0, 1)]],
};

const isForm = (f: string): f is ColorSyntax["form"] =>
  f === "hex" || f === "rgb" || f === "hsl" || f === "oklab" || f === "oklch" || f === "p3";

function hexOf(v: string): ColorSyntax | null {
  if (!HEX.test(v)) return null;
  const d = v.slice(1);
  const full = d.length <= 4 ? d.replace(/./g, "$&$&") : d;
  const at = (i: number): number => Number.parseInt(full.slice(i, i + 2), 16);
  const alpha = full.length === 8 ? at(6) / 255 : null;
  return { form: "hex", channels: [at(0), at(2), at(4)], alpha };
}

/**
 * A color value read by k.values Colors, or null when it is none of the forms: hex of 3 or 6 digits, or 4 or 8 with
 * alpha; `rgb()`, `hsl()`, `oklab()`, `oklch()` and `color(display-p3 ...)` in space syntax, each channel in its range,
 * optionally ` / <a>` before the `)`. No named color, comma, `none`, `calc()` or relative color is read.
 */
export function colorSyntax(v: string): ColorSyntax | null {
  if (v.startsWith("#")) return hexOf(v);
  const lead = Object.keys(FORMS).find((k) => v.startsWith(k));
  if (lead === undefined || !v.endsWith(")")) return null;
  const spec = FORMS[lead];
  if (spec === undefined) return null;
  const [form, readers] = spec;
  const words = v.slice(lead.length, -1).split(" ");
  let alpha: number | null = null;
  if (words.length === 5 && words[3] === "/") {
    alpha = unitOrPercent(words[4] ?? "");
    if (alpha === null) return null;
    words.length = 3;
  }
  if (words.length !== 3) return null;
  const [a, b, c] = readers.map((read, i) => read(words[i] ?? ""));
  if (a === null || b === null || c === null || a === undefined || b === undefined || c === undefined) return null;
  if (!isForm(form)) return null;
  return { form, channels: [a, b, c], alpha };
}
