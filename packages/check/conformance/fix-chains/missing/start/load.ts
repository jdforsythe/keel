type Row = { id: string; name: string };
export function load(rows: Row[], id: string): Row {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error("not found: " + id);
  return row;
}
