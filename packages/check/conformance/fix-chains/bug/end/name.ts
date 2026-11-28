import { defect } from "@keel/schema";
export function name(rows: Map<string, string>, id: string): string {
  const row = rows.get(id);
  return row ?? defect("no row", { data: { id } });
}
