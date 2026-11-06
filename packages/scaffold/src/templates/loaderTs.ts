/** `<name>.server.ts` (k.router, k.server): the route's loader. */
export function loaderTs(loaderName: string): string {
  return [
    "import { loader } from '@keel/router'",
    "import { ok, s } from '@keel/schema'",
    "",
    `export const ${loaderName} = loader(s.object({}), async () => ok({}))`,
    "",
  ].join("\n");
}
