import type { ImportList } from "./ImportList.ts";

/** Whether the spread `...<name>` of a `tokens.ts` holds `group`: `brandTokens` by its keys (when known), any other name is taken to. */
export function spreadHolds(
  imports: ImportList,
  brand: Readonly<Record<string, unknown>> | undefined,
): (name: string, group: string) => boolean {
  return (name, group) =>
    imports.from.get(name) !== "@keel/ui/brand#brandTokens" || brand === undefined || Object.hasOwn(brand, group);
}
