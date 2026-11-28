import { ok } from "@keel/schema";
import type { Result, SchemaError } from "@keel/schema";
import { Draft } from "./Draft.schema.ts";
export function save(input: unknown): Result<string, SchemaError> {
  const r = Draft.parse(input);
  if (!r.ok) return r;
  return ok(r.value.name);
}
