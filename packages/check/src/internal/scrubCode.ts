/**
 * Source lines with comments blanked and string/template contents emptied (port of tooling/scan.mjs `scrub`).
 * Single and double quoted strings end at end of line, so a stray quote in a regex stays contained.
 */
export function scrubCode(src: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  let inTpl = false;
  for (const line of src.split("\n")) {
    let c = "";
    let q = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i] ?? "";
      const two = line.slice(i, i + 2);
      if (inBlock) {
        if (two === "*/") {
          inBlock = false;
          i++;
          c += "  ";
        } else c += " ";
      } else if (q !== "" || inTpl) {
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === (inTpl ? "`" : q)) {
          q = "";
          inTpl = false;
          c += ch;
        }
      } else if (two === "//") {
        c += " ".repeat(line.length - i);
        break;
      } else if (two === "/*") {
        inBlock = true;
        i++;
        c += "  ";
      } else if (ch === "'" || ch === '"') {
        q = ch;
        c += ch;
      } else if (ch === "`") {
        inTpl = true;
        c += ch;
      } else c += ch;
    }
    out.push(c);
  }
  return out;
}
