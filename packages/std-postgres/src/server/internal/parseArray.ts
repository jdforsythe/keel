import type { ArrayItem } from "./ArrayItem.ts";

/**
 * The Postgres array literal `src` (`{a,"b c",NULL,{1,2}}`, with an optional `[1:2]=` bounds prefix) as nested arrays
 * of element text, `delim` between elements. Malformed text throws.
 */
export function parseArray(src: string, delim = ","): ArrayItem[] {
  let i = src.startsWith("[") ? src.indexOf("=") + 1 : 0;
  const at = (): string => {
    const ch = src[i];
    if (ch === undefined) throw new Error("std.postgres: an array value ended early");
    return ch;
  };
  const level = (): ArrayItem[] => {
    if (at() !== "{") throw new Error("std.postgres: an array value does not start with {");
    i++;
    const out: ArrayItem[] = [];
    if (at() === "}") {
      i++;
      return out;
    }
    for (;;) {
      if (at() === "{") out.push(level());
      else if (at() === '"') {
        i++;
        let text = "";
        while (at() !== '"') {
          if (at() === "\\") i++;
          text += at();
          i++;
        }
        i++;
        out.push(text);
      } else {
        const start = i;
        while (at() !== delim && at() !== "}") i++;
        const word = src.slice(start, i).trim();
        out.push(word.toUpperCase() === "NULL" ? null : word);
      }
      const end = at();
      i++;
      if (end === "}") return out;
      if (end !== delim) throw new Error("std.postgres: an array value has text after an element");
    }
  };
  return level();
}
