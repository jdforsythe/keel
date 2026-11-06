/** `<Name>State.schema.ts`: the state schema of a store. */
export function stateSchemaTs(schema: string): string {
  return [`import { s } from "@keel/schema";`, "", `export const ${schema} = s.object({});`, ""].join("\n");
}
