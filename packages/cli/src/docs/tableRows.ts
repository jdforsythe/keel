/** The body rows of the markdown tables in a text, as trimmed cells: each table's header and separator rows dropped. */
export function tableRows(text: string): string[][] {
  const out: string[][] = [];
  let header = true;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) {
      header = true;
      continue;
    }
    const cells = t
      .slice(1, t.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => c.trim());
    if (header) header = false;
    else if (!cells.every((c) => /^:?-*:?$/.test(c))) out.push(cells);
  }
  return out;
}
