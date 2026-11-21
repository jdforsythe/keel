/** `<actionName>.server.ts` (k.contract, k.server): the action of API write entry `id` of contract `mod`; the file stem equals the export (E1752). */
export function actionTs(actionName: string, mod: string, id: string): string {
  return [
    `import { action } from "@keel/router";`,
    `import { ok } from "@keel/schema";`,
    `import { ${mod} } from "./${mod}.contract.ts";`,
    "",
    `export const ${actionName} = action(${mod}, "${id}", {}, async () => ok({}));`,
    "",
  ].join("\n");
}
