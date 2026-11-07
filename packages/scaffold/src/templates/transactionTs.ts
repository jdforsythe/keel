/** `<name>.transaction.ts` (k.store): the transaction on its store, payload typed by `<Name>Payload`; identity body. */
export function transactionTs(id: string, store: string, name: string, schema: string): string {
  return [
    `import { transaction } from "@keel/store";`,
    `import { ${schema} } from "./${schema}.schema.ts";`,
    `import { ${store} } from "./${store}.store.ts";`,
    "",
    `export const ${name} = transaction(${store}, "${id}", ${schema}, (state, _payload) => state);`,
    "",
  ].join("\n");
}
