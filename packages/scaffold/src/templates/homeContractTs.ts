/** `modules/app/app.contract.ts` of a new project: the contract of module `app` with the route `app.home` at `/`. */
export function homeContractTs(): string {
  return [
    `import { contract } from "@keel/router/contract";`,
    "",
    `export const app = contract("app", {`,
    `  "app.home": {`,
    `    path: "/",`,
    "  },",
    "});",
    "",
  ].join("\n");
}
