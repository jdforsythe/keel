/** `<Id>Api.schema.ts` of `scaffold service --base` (k.scaffold Service): the endpoint declaration `name`, empty, for the author to fill. */
export function apiSchemaTs(name: string): string {
  return [`import { endpoints } from "@keel/services";`, "", `export const ${name} = endpoints({});`, ""].join("\n");
}
