import { codedError } from "./internal/codedError.ts";
import { mountLinks } from "./internal/mountLinks.ts";
import { mountPaths } from "./internal/mountPaths.ts";
import type { IdentityMount } from "./types/IdentityMount.ts";
import type { MountHref } from "./types/MountHref.ts";

/** A root-relative path, never protocol-relative: what every accepted `href` result is. */
const rooted = (s: string): s is MountHref => /^\/(?!\/)/.test(s);
/** `''` or `/`-led segments of `[A-Za-z0-9._~-]`, none `.` or `..`: a subpath `href` and `links` take. */
const SUBPATH = /^(\/(?!\.\.?(\/|$))[\w.~-]+)*$/;

/**
 * The identity mount at `path` (k.mount Declaration), which `identity.ts` default-exports and `identity.server.ts`
 * gives as `handle.path`. `href(subpath?, search?)` is `path`, `subpath`, then `?` and `search`'s keys sorted, keys
 * and values `encodeURIComponent`-encoded (no `?` when empty). `subpath` is `''` or `/`-led segments of
 * `[A-Za-z0-9._~-]`, none `.` or `..`; anything else throws E1582. `options.links` (default `[]`) are subpaths of that
 * form, none `''` and none repeated, else E1584: a shell takes a return link to `path` plus one of them at any time
 * (k.links). A shell's router reads mount requests by `path` (k.return).
 */
export function identityMount<P extends string>(
  path: P,
  options: { readonly links?: readonly string[] } = {},
): IdentityMount<P> {
  const { links = [] } = options;
  links.forEach((sub, i) => {
    if (sub === "" || !SUBPATH.test(sub) || links.indexOf(sub) < i)
      throw codedError("E1584", `links ${JSON.stringify(sub)}`);
  });
  mountPaths.add(path);
  for (const sub of links) mountLinks.add(path + sub);
  return {
    path,
    links,
    href(sub = "", search = {}) {
      const e = encodeURIComponent;
      const q = Object.keys(search)
        .sort()
        .map((k) => `${e(k)}=${e(search[k] ?? "")}`)
        .join("&");
      const out = `${path}${sub}${q && "?"}${q}`;
      if (SUBPATH.test(sub) && rooted(out)) return out;
      throw codedError("E1582", `href subpath ${JSON.stringify(sub)}`);
    },
  };
}
