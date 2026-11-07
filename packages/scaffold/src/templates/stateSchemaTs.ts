/** `<Name>.schema.ts`: an empty object schema (a store's `<Name>State`, a transaction's `<Name>Payload`). */
export function stateSchemaTs(schema: string): string {
  return [`import { s } from "@keel/schema";`, "", `export const ${schema} = s.object({});`, ""].join("\n");
}
