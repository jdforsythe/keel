/** One binding entry of `routes.ts` (k.contract): a page `{ component, loader }`, an API GET `{ loader }` or an API write `{ action }`. `handler` is the loader or action; `page` the component, null for an API entry; `write` an API write. */
export function bindingEntry(id: string, handler: string, page: string | null, write: boolean): string {
  const body =
    page === null ? [`${write ? "action" : "loader"}: ${handler},`] : [`component: ${page},`, `loader: ${handler},`];
  return [`"${id}": {`, ...body.map((l) => `  ${l}`), "}"].join("\n");
}
