import type { MountHref } from "./MountHref.ts";

/** What `identityMount(path)` returns and a project's `identity.ts` default-exports (k.mount Declaration). */
export type IdentityMount<P extends string = string> = {
  readonly path: P;
  href(subpath?: string, search?: Readonly<Record<string, string>>): MountHref;
};
