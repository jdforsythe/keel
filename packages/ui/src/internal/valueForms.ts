import type { TokenRefusal } from "../types/TokenRefusal.ts";
import type { Tokens } from "../types/Tokens.ts";
import { colorSyntax } from "./colorSyntax.ts";
import { varName } from "./varName.ts";

/** The matchers the grammar reads with, built on first use so that importing this file runs no code (k.values). */
type Matchers = {
  readonly number: RegExp;
  readonly word: RegExp;
  readonly units: ReadonlySet<string>;
};
let built: Matchers | undefined;
const matchers = (): Matchers => {
  if (built !== undefined) return built;
  const viewport = ["vw", "vh", "vi", "vb", "vmin", "vmax"].flatMap((u) => [u, `s${u}`, `l${u}`, `d${u}`]);
  built = {
    number: /^\d+(?:\.\d+)?/,
    word: /^[A-Za-z_][A-Za-z0-9_-]*$/,
    units: new Set([
      ...["px", "cm", "mm", "q", "in", "pt", "pc"],
      ...["em", "rem", "ex", "rex", "cap", "rcap", "ch", "rch", "ic", "ric", "lh", "rlh"],
      ...viewport,
      ...["cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax"],
    ]),
  };
  return built;
};

/** The most brackets a value nests, and the most numbers, lengths and names it holds (k.values). */
const DEPTH = 4;
const NAMES = 32;
const SIDES = ["top", "right", "bottom", "left"];
const MATH = ["calc", "min", "max", "clamp"];
const WIDE = ["inherit", "initial", "unset", "revert", "revert-layer", "default"];

/** A parse failure, caught by `holds`. */
class Refused {}
const refuse = (): never => {
  throw new Refused();
};

/** A `<n>` followed by an optional unit, read whole: its text, value and unit (`""` for none, `"%"`). */
function numberAt(s: string): { n: number; unit: string } | null {
  const m = matchers().number.exec(s);
  if (m === null) return null;
  const unit = s.slice(m[0].length);
  if (unit !== "" && unit !== "%" && !matchers().units.has(unit)) return null;
  return { n: Number(m[0]), unit };
}
const isLength = (s: string): boolean => {
  const r = numberAt(s);
  return r !== null && (r.unit === "" ? r.n === 0 && s === "0" : r.unit !== "%");
};
const isLp = (s: string): boolean => isLength(s) || numberAt(s)?.unit === "%";

/**
 * A cursor over a value for the math and `env()` forms: `<math>`, `<sum>`, terms and factors as k.values names them,
 * counting brackets and the numbers, lengths and names read.
 */
class Reader {
  at = 0;
  names = 0;
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }
  peek(text: string): boolean {
    return this.s.startsWith(text, this.at);
  }
  take(text: string): boolean {
    if (!this.peek(text)) return false;
    this.at += text.length;
    return true;
  }
  expect(text: string): void {
    if (!this.take(text)) refuse();
  }
  count(): void {
    this.names += 1;
    if (this.names > NAMES) refuse();
  }
  /** A number token with its unit, read up to the next delimiter. */
  number(): { n: number; unit: string } {
    let end = this.at;
    while (end < this.s.length && !" ,()".includes(this.s.charAt(end))) end += 1;
    const r = numberAt(this.s.slice(this.at, end));
    if (r === null) return refuse();
    this.at = end;
    this.count();
    return r;
  }
  /** `env(safe-area-inset-<side>)`, optionally `, <length>` before the bracket. */
  env(depth: number): void {
    if (depth > DEPTH) refuse();
    this.expect("env(safe-area-inset-");
    const side = SIDES.find((x) => this.peek(x)) ?? refuse();
    this.at += side.length;
    this.count();
    if (this.take(", ")) {
      const r = this.number();
      if (r.unit === "%" || (r.unit === "" && r.n !== 0)) refuse();
    }
    this.expect(")");
  }
  /** `calc(<sum>)`, `min(...)` and `max(...)` of two to four sums, `clamp(<sum>, <sum>, <sum>)`. */
  math(depth: number): void {
    if (depth > DEPTH) refuse();
    const f = MATH.find((x) => this.peek(`${x}(`)) ?? refuse();
    this.at += f.length + 1;
    let args = 1;
    this.sum(depth);
    while (this.take(", ")) {
      args += 1;
      this.sum(depth);
    }
    this.expect(")");
    const ok = f === "calc" ? args === 1 : f === "clamp" ? args === 3 : args >= 2 && args <= 4;
    if (!ok) refuse();
  }
  /** Terms joined by ` + ` or ` - `, each with exactly one length side. */
  sum(depth: number): void {
    this.term(depth);
    while (this.take(" + ") || this.take(" - ")) this.term(depth);
  }
  /** Factors joined by ` * ` or ` / `: one length side, and a `/` followed by a non-zero `<n>`. */
  term(depth: number): void {
    let lengths = 0;
    let zeros = 0;
    const factor = (): void => {
      const kind = this.factor(depth);
      if (kind === "length") lengths += 1;
      else if (kind === "zero") zeros += 1;
    };
    factor();
    for (;;) {
      if (this.take(" * ")) factor();
      else if (this.take(" / ")) {
        const r = this.number();
        if (r.unit !== "" || r.n === 0) refuse();
      } else break;
    }
    // A bare `0` is a `<length>` and an `<n>` both: it stands for the length side when no other factor is one.
    if (lengths !== 1 && !(lengths === 0 && zeros >= 1)) refuse();
  }
  /** One factor and what it is: a length side, a plain number, or a bare `0`. */
  factor(depth: number): "length" | "number" | "zero" {
    if (this.peek("(")) {
      if (depth + 1 > DEPTH) refuse();
      this.at += 1;
      this.sum(depth + 1);
      this.expect(")");
      return "length";
    }
    if (this.peek("env(")) {
      this.env(depth + 1);
      return "length";
    }
    if (MATH.some((f) => this.peek(`${f}(`))) {
      this.math(depth + 1);
      return "length";
    }
    const r = this.number();
    if (r.unit !== "") return "length";
    return r.n === 0 ? "zero" : "number";
  }
}

/** Whether all of `s` reads as one form `read` parses, at the top level. */
const whole = (s: string, read: (r: Reader) => void): boolean => {
  const r = new Reader(s);
  try {
    read(r);
    return r.at === s.length;
  } catch (e) {
    if (e instanceof Refused) return false;
    throw e;
  }
};
const isMath = (s: string): boolean => whole(s, (r) => r.math(1));
const isEnv = (s: string): boolean => whole(s, (r) => r.env(1));

/** An opaque `<color>` in one of k.values' six forms, and an `<alpha>`: one with alpha. */
const isColor = (s: string): boolean => colorSyntax(s)?.alpha === null;
const isAlpha = (s: string): boolean => {
  const c = colorSyntax(s);
  return c !== null && c.alpha !== null;
};

/** A `<paint>`: a `<color>`, a `<ref>` to a color token the tokens hold, or `currentColor`. */
const isPaint = (s: string, refs: ReadonlySet<string>): boolean => {
  if (s === "currentColor" || isColor(s)) return true;
  return s.startsWith("var(") && s.endsWith(")") && refs.has(s.slice(4, -1));
};

/** The words of a value whose last part may be a function form holding spaces (`rgb(0 0 0 / 0.2)`), that part whole. */
function wordsWithPaint(s: string): string[] {
  if (!s.endsWith(")")) return s.split(" ");
  const open = s.lastIndexOf(" ", s.indexOf("(")) + 1;
  const head = s.slice(0, open).trimEnd();
  return [...(head === "" ? [] : head.split(" ")), s.slice(open)];
}

/** One shadow: `inset`, two to four lengths (the first two and the fourth may carry `-`), an optional paint or alpha. */
function isShadow(s: string, refs: ReadonlySet<string>): boolean {
  const words = wordsWithPaint(s);
  if (words[0] === "inset") words.shift();
  const last = words.at(-1);
  if (last !== undefined && (isPaint(last, refs) || isAlpha(last))) words.pop();
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w, i) => (i === 2 ? isLength(w) : isLength(w.startsWith("-") ? w.slice(1) : w)));
}

/** A code point a quoted family may not hold: a control character or a lone surrogate (k.values Characters). */
function quotedOk(body: string, quote: string): boolean {
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    if (body.charAt(i) === quote || body.charAt(i) === "\\") return false;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return false;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = body.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}

/** One to eight families joined by `, `: a quoted string, or words each an identifier and no CSS-wide keyword. */
function isFont(v: string): boolean {
  let at = 0;
  let families = 0;
  let names = 0;
  for (;;) {
    const q = v.charAt(at);
    if (q === '"' || q === "'") {
      const end = v.indexOf(q, at + 1);
      if (end < 0 || !quotedOk(v.slice(at + 1, end), q)) return false;
      names += 1;
      at = end + 1;
    } else {
      const next = v.indexOf(", ", at);
      const run = v.slice(at, next < 0 ? v.length : next);
      const words = run.split(" ");
      if (
        !words.every((w) => matchers().word.test(w) && !WIDE.includes(w.toLowerCase())) ||
        run.includes('"') ||
        run.includes("'")
      )
        return false;
      names += words.length;
      at += run.length;
    }
    families += 1;
    if (families > 8 || names > NAMES) return false;
    if (at === v.length) return true;
    if (!v.startsWith(", ", at)) return false;
    at += 2;
  }
}

/** Whether `v` is in the form of `group` (k.values): positive forms only, so anything else is refused. */
function holds(group: string, v: string, refs: ReadonlySet<string>): boolean {
  const n = numberAt(v);
  switch (group) {
    case "color":
      return isColor(v);
    case "space":
      return v === "auto" || isLp(v) || isEnv(v) || isMath(v);
    case "size":
      return ["auto", "min-content", "max-content", "fit-content"].includes(v) || isLp(v) || isEnv(v) || isMath(v);
    case "radius":
      return isLp(v) || isMath(v);
    case "fontSize":
      return isLength(v) || n?.unit === "%" || isMath(v);
    case "font":
      return isFont(v);
    case "weight":
      return v === "normal" || v === "bold" || (/^[1-9]\d{0,3}$/.test(v) && Number(v) <= 1000);
    case "shadow": {
      if (v === "none") return true;
      const each = v.split(", ");
      return each.length <= 4 && each.every((s) => isShadow(s, refs));
    }
    case "border": {
      if (v === "0" || v === "none") return true;
      const [width = "", style = "", paint = "", ...rest] = wordsWithPaint(v);
      return (
        rest.length === 0 &&
        (["thin", "medium", "thick"].includes(width) || isLength(width)) &&
        ["solid", "dashed", "dotted", "double"].includes(style) &&
        isPaint(paint, refs)
      );
    }
    case "breakpoint":
      return n !== null && ["px", "em", "rem"].includes(n.unit) && n.n > 0;
    case "motion":
      return /^\d+(?:\.\d+)?m?s$/.test(v);
    default:
      return false;
  }
}

/** The groups a theme may hold (k.themes Themes), and the conditions that turn one on. */
const THEME_GROUPS = ["color", "overlay", "space", "size", "radius", "font", "fontSize", "weight", "shadow", "border"];
const WHEN = ["choice", "contrast", "print"];
const THEME_NAME = /^[a-z][A-Za-z0-9]{0,23}$/;
const RESERVED = ["default", "system", "light", "dark"];

const entries = (v: unknown): [string, unknown][] =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? Object.entries(v) : [];

/** Why a color or overlay value `ok` refuses is refused (k.themes Token errors). */
function colorWhat(group: string, v: string): string {
  if (v.includes("(") && v.includes(",")) return "channels are separated by spaces, not commas";
  if (/^[A-Za-z]+$/.test(v)) return "a named color; write hex or a function form";
  if (group === "color" && isAlpha(v)) return "alpha is for an overlay or a shadow";
  return `not a ${group} value`;
}

/**
 * A color or overlay value, or a `{ light, dark }` pair of them: the refusals of the values `ok` refuses, at `[...at]`
 * for a string and `[...at, scheme]` for one value of a pair. A pair where `pairs` is false is refused at `at`.
 */
function valueRefusals(
  group: string,
  at: string[],
  v: unknown,
  ok: (s: string) => boolean,
  pairs: boolean,
): TokenRefusal[] {
  if (typeof v === "string") return ok(v) ? [] : [{ path: at, what: colorWhat(group, v) }];
  if (!pairs) return [{ path: at, what: "a print theme takes one value, not a pair" }];
  return ["light", "dark"].flatMap((scheme) => {
    const one = String(Reflect.get(Object(v), scheme));
    return ok(one) ? [] : [{ path: [...at, scheme], what: colorWhat(group, one) }];
  });
}

/** The refusals of one theme (k.themes Themes): its name, `when`, held names and each value's form. */
function themeRefusals(tokens: Tokens, name: string, theme: unknown, refs: ReadonlySet<string>): TokenRefusal[] {
  const at = ["themes", name];
  const out: TokenRefusal[] = [];
  if (RESERVED.includes(name)) out.push({ path: at, what: "default, system, light and dark are reserved" });
  else if (!THEME_NAME.test(name))
    out.push({ path: at, what: "a theme name is a letter then up to 23 letters and digits" });
  const when = Reflect.get(Object(theme), "when");
  if (when !== undefined && !WHEN.includes(String(when)))
    out.push({ path: [...at, "when"], what: "when is choice, contrast or print" });
  const print = when === "print";
  for (const [group, values] of entries(theme)) {
    if (group === "when" || !THEME_GROUPS.includes(group)) continue;
    const held = new Set(entries(Reflect.get(tokens, group)).map(([n]) => n));
    for (const [token, v] of entries(values)) {
      const path = [...at, group, token];
      if (!held.has(token)) out.push({ path, what: `not a top-level ${group} token` });
      else if (group === "color") out.push(...valueRefusals(group, path, v, isColor, !print));
      else if (group === "overlay") out.push(...valueRefusals(group, path, v, isAlpha, !print));
      else if (typeof v !== "string" || !holds(group, v, refs)) out.push({ path, what: `not a ${group} value` });
    }
  }
  return out;
}

/** The refusals of the overlays (k.values Overlays): an `<alpha>` value or pair, and an `over` of held colors. */
function overlayRefusals(tokens: Tokens): TokenRefusal[] {
  const colors = new Set(Object.keys(tokens.color ?? {}));
  const out: TokenRefusal[] = [];
  for (const [name, o] of Object.entries(tokens.overlay ?? {})) {
    out.push(...valueRefusals("overlay", ["overlay", name, "value"], o.value, isAlpha, true));
    const over = o.over;
    const path = ["overlay", name, "over"];
    const missing = over.find((c) => !colors.has(c));
    if (over.length < 1 || over.length > 8 || new Set(over).size !== over.length)
      out.push({ path, what: "holds 1 to 8 distinct names" });
    else if (missing !== undefined) out.push({ path, what: `names no color token "${missing}"` });
  }
  return out;
}

/** The theme past its bound (k.themes Themes): a second `contrast` or `print`, a ninth `choice`, the later in order. */
function countRefusals(tokens: Tokens): TokenRefusal[] {
  const seen = new Map<string, number>();
  for (const [name, t] of Object.entries(tokens.themes ?? {})) {
    const when = t.when ?? "choice";
    const n = (seen.get(when) ?? 0) + 1;
    seen.set(when, n);
    const path = ["themes", name];
    if (when === "choice" && n === 9) return [{ path, what: "a ninth choice theme; at most 8" }];
    if (when !== "choice" && n === 2) return [{ path, what: `a second ${when} theme` }];
  }
  return [];
}

/**
 * Every token value not in its group's form (k.values), in order, each with its path and why: `[group, name]`, or
 * `[group, name, scheme]` for one value of a color pair; an overlay's `[overlay, name, value]` (then the scheme) or
 * `[overlay, name, over]`; a theme's under `[themes, theme]`, which is itself refused for a bad name and for a
 * second `contrast` or `print` or a ninth `choice` theme (k.themes Themes). A `<ref>` names the custom property of a
 * color token these tokens hold.
 */
export function valueForms(tokens: Tokens): TokenRefusal[] {
  const refs = new Set(Object.keys(tokens.color ?? {}).map((n) => varName("color", n)));
  const out: TokenRefusal[] = [];
  for (const [group, values] of Object.entries(tokens)) {
    if (["base", "look", "schemes", "overlay", "themes"].includes(group)) continue;
    if (typeof values !== "object" || values === null) continue;
    for (const [name, v] of Object.entries(values)) {
      if (group === "color") out.push(...valueRefusals(group, [group, name], v, isColor, true));
      // `print` is the responsive key for the printed page (k.aria Print), so no breakpoint takes the name.
      else if (typeof v === "string" && (!holds(group, v, refs) || (group === "breakpoint" && name === "print")))
        out.push({ path: [group, name], what: `not a ${group} value` });
    }
  }
  out.push(...overlayRefusals(tokens));
  const themes = Object.entries(tokens.themes ?? {});
  for (const [name, theme] of themes) out.push(...themeRefusals(tokens, name, theme, refs));
  out.push(...countRefusals(tokens));
  return out;
}
