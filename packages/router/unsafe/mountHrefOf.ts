import type { MountHref } from "../src/types/MountHref.ts";
import { isHref } from "./isHref.ts";
import { unsafe } from "./unsafe.ts";

/** `href` as a `MountHref` when it is an `Href`; `identityMount`'s `href()` calls it on what it built. */
export function mountHrefOf(href: string): MountHref | undefined {
  if (!isHref(href)) return undefined;
  return unsafe(
    "identityMount's href() passes only its validated path joined to a checked subpath and encoded search, so the Href is under the mount",
    () => href as MountHref,
  );
}
