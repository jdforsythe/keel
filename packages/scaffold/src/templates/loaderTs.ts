/**
 * `<loaderName>.server.ts` (k.contract, k.server): the loader of entry `id` of contract `mod`; the file stem equals the
 * export (E1752). A page's loader declares its `output`; an API GET's output is its entry's.
 */
export function loaderTs(loaderName: string, mod: string, id: string, api: boolean): string {
  return [
    `import { loader } from "@keel/router";`,
    `import { ok${api ? "" : ", s"} } from "@keel/schema";`,
    `import { ${mod} } from "./${mod}.contract.ts";`,
    "",
    `export const ${loaderName} = loader(${mod}, "${id}", ${api ? "{}" : "{ output: s.object({}) }"}, async () => ok({}));`,
    "",
  ].join("\n");
}
