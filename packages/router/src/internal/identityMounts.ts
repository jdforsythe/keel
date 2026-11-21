import type { IdentityMount } from "../types/IdentityMount.ts";

/**
 * Every identity mount made in this process (k.mount Declaration), for `@keel/testing`'s `renderRoute(id, { shell })`,
 * whose options name no mount. A shell build's router reads only the mount its entry passes (`shellMount`).
 */
export const identityMounts = new Set<IdentityMount>();
