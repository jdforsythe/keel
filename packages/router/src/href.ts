import { hrefIn } from "./internal/hrefIn.ts";
import { latest } from "./internal/latest.ts";
import type { Href } from "./types/Href.ts";

/**
 * Link to route `id` (k.router Links). `id` resolves in the most recently declared manifest that contains
 * it (`manifest()` order). Params are encoded by the route's params schema then URL-encoded; search keys
 * are sorted and absent optionals omitted; equal inputs give an identical `Href`. `id` is typed `string`:
 * an unknown id is checked by `keel check` (E1501 family) and throws here.
 */
export function href(
  id: string,
  params: Readonly<Record<string, unknown>> = {},
  search: Readonly<Record<string, unknown>> = {},
): Href {
  return hrefIn(latest.get(id), id, params, search);
}
