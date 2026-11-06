/**
 * JSX whitespace rule (as Babel/TypeScript): drop lines that are only whitespace, trim around
 * line breaks, join remaining lines with one space. Returns "" when nothing remains.
 */
export function cleanJsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = -1;
  lines.forEach((l, i) => {
    if (/[^ \t]/.test(l)) lastNonEmpty = i;
  });
  let out = "";
  lines.forEach((l, i) => {
    let t = l.replace(/\t/g, " ");
    if (i !== 0) t = t.replace(/^ +/, "");
    if (i !== lines.length - 1) t = t.replace(/ +$/, "");
    if (t === "") return;
    out += i === lastNonEmpty ? t : `${t} `;
  });
  return out;
}
