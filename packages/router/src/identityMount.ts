import { codedError } from "./internal/codedError.ts";
import { mountPaths } from "./internal/mountPaths.ts";
import type { IdentityMount } from "./types/IdentityMount.ts";
import type { MountHref } from "./types/MountHref.ts";

/** A root-relative path, never protocol-relative: what every accepted `href` result is. */
const rooted = (s: string): s is MountHref => /^\/(?!\/)/.test(s);

/**
 * The identity mount at `path` (k.mount Declaration), which `identity.ts` default-exports and `identity.server.ts`
 * gives as `handle.path`. `href(subpath?, search?)` is `path`, `subpath`, then `?` and `search`'s keys sorted, keys
 * and values `encodeURIComponent`-encoded (no `?` when empty). `subpath` is `''` or `/`-led segments of
 * `[A-Za-z0-9._~-]`, none `.` or `..`; anything else throws E1582. A shell's router reads mount requests by `path`
 * (k.return).
 */
export function identityMount<P extends string>(path: P): IdentityMount<P> {
  mountPaths.add(path);
  return {
    path,
    href(sub = "", search = {}) {
      const e = encodeURIComponent;
      const q = Object.keys(search)
        .sort()
        .map((k) => `${e(k)}=${e(search[k] ?? "")}`)
        .join("&");
      const out = `${path}${sub}${q && "?"}${q}`;
      if (/^(\/(?!\.\.?(\/|$))[\w.~-]+)*$/.test(sub) && rooted(out)) return out;
      throw codedError("E1582", `href subpath ${JSON.stringify(sub)}`);
    },
  };
}
