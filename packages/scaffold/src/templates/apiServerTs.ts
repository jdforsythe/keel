/** `api.server.ts` of `scaffold service --base` (k.scaffold Service): the client `api` of the endpoints `name` at `base`. */
export function apiServerTs(name: string, base: string): string {
  return [
    `import { service } from "@keel/services";`,
    `import { ${name} } from "./${name}.schema.ts";`,
    "",
    `export const api = service({ base: ${JSON.stringify(base)}, schema: ${name} });`,
    "",
  ].join("\n");
}
