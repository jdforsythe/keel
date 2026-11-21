/** `modules/<id>/<id>.contract.ts` (k.contract): an empty contract, exported under the module's id. */
export function contractTs(id: string): string {
  return [
    `import { contract } from "@keel/router/contract";`,
    "",
    `export const ${id} = contract("${id}", {});`,
    "",
  ].join("\n");
}
