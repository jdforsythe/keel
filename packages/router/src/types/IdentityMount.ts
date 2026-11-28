import type { MountHref } from "./MountHref.ts";

/** What `identityMount(path, { links })` returns and a project's `identity.ts` default-exports (k.mount Declaration). */
export type IdentityMount<P extends string = string> = {
  readonly path: P;
  /** The subpaths a shell takes from a return link at any time with no opening (k.links); `[]` by default. */
  readonly links: readonly string[];
  href(subpath?: string, search?: Readonly<Record<string, string>>): MountHref;
};
