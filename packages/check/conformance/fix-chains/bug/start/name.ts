export function name(rows: Map<string, string>, id: string): string {
  const row = rows.get(id);
  if (!row) throw new Error("no row " + id);
  return row;
}
