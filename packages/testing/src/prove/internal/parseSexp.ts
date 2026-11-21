import type { Sexp } from "./Sexp.ts";

/** Parse the first s-expression of Z3's output (`((t v) ...)`); `|quoted|` symbols and strings stay one atom. */
export function parseSexp(text: string): Sexp {
  const tokens = text.match(/\(|\)|\|[^|]*\||"(?:[^"]|"")*"|[^\s()|"]+/g) ?? [];
  let at = 0;
  const read = (): Sexp => {
    const tok = tokens[at++] ?? ")";
    if (tok !== "(") return tok;
    const list: Sexp[] = [];
    while (at < tokens.length && tokens[at] !== ")") list.push(read());
    at++;
    return list;
  };
  return read();
}
