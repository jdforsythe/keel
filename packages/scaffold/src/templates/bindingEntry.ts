/** One binding entry of `routes.ts` (k.contract): a page `{ component, loader }`, a page with no loader `{ component }`, an API GET `{ loader }` or an API write `{ action }`. `handler` is the loader or action, null for a page with none; `page` the component, null for an API entry; `write` an API write. */
export function bindingEntry(id: string, handler: string | null, page: string | null, write: boolean): string {
  const handled = handler === null ? [] : [`${write ? "action" : "loader"}: ${handler},`];
  const body = page === null ? handled : [`component: ${page},`, ...handled];
  return [`"${id}": {`, ...body.map((l) => `  ${l}`), "}"].join("\n");
}
