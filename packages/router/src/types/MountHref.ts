import type { Href } from "./Href.ts";

/** An `Href` under the identity mount's path (k.mount), made by `identityMount(path).href()`; a `Form` posts to it. */
export type MountHref = Href & { readonly __mount: true };
