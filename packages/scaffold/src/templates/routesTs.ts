/** `modules/<id>/routes.ts` (k.contract): the binding of the module's contract, empty. */
export function routesTs(id: string): string {
  return [
    `import { manifest } from "@keel/router";`,
    `import { ${id} } from "./${id}.contract.ts";`,
    "",
    `export const routes = manifest(${id}, {});`,
    "",
  ].join("\n");
}
