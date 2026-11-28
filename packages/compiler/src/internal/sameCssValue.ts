/** One token of a value: a number with its unit, or any other text as written. */
type Part = { readonly n: number; readonly unit: string } | string;

const SPACE = /\s+/y;
const HEX = /#[\w-]+/y;
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const UNIT = /[a-zA-Z%]*/y;
const IDENT = /-{0,2}[a-zA-Z_][\w-]*/y;
const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y;
/** Punctuation a space beside carries no meaning in a value. */
const TIGHT = new Set([",", "/", "(", ")"]);

const at = (re: RegExp, s: string, i: number): string | undefined => {
  re.lastIndex = i;
  return re.exec(s)?.[0];
};

/** The parts of a CSS value: each run of spaces one `" "`, dropped beside `,`, `/`, `(` and `)` and at the ends. */
function parts(value: string): Part[] {
  const out: Part[] = [];
  let i = 0;
  while (i < value.length) {
    const space = at(SPACE, value, i);
    if (space !== undefined) {
      out.push(" ");
      i += space.length;
      continue;
    }
    const text = at(HEX, value, i) ?? at(STRING, value, i) ?? at(IDENT, value, i);
    if (text !== undefined) {
      out.push(text);
      i += text.length;
      continue;
    }
    const num = at(NUMBER, value, i);
    if (num !== undefined) {
      const unit = at(UNIT, value, i + num.length) ?? "";
      out.push({ n: Number(num), unit });
      i += num.length + unit.length;
      continue;
    }
    out.push(value[i] ?? "");
    i++;
  }
  const tight = (p: Part | undefined): boolean => p === undefined || (typeof p === "string" && TIGHT.has(p));
  return out.filter((p, k) => p !== " " || (!tight(out[k - 1]) && !tight(out[k + 1])));
}

/**
 * Whether two CSS values are the same: numbers compared as numbers with their units (`0.95` and `.95`, `1` and
 * `1.0`), spaces beside `,`, `/` and parentheses and at the ends ignored, a run of spaces one space; anything else,
 * letter case and a hex color's digits among it, as written (k.gamut CSS).
 */
export function sameCssValue(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  return (
    x.length === y.length &&
    x.every((p, k) => {
      const q = y[k];
      if (typeof p === "string" || typeof q === "string" || q === undefined) return p === q;
      return p.n === q.n && p.unit === q.unit;
    })
  );
}
