import { err, ok } from "@keel/schema";
import type { Result } from "@keel/schema";
import { Missing } from "./Missing.schema.ts";
type Row = { id: string; name: string };
export function load(rows: Row[], id: string): Result<Row, ReturnType<typeof Missing.make>> {
  const row = rows.find((r) => r.id === id);
  if (!row) return err(Missing.make({ id }));
  return ok(row);
}
