import type { Ctx } from "@keel/ctx";

/**
 * The `/__keel/user` read a router uses (k.guards Client): `readUser`, put here by the first `identityMount` call, so
 * a bundle with no identity mount (an app with no `identity.ts`) holds no code that reads it. Unset, no router reads.
 */
export const userRead: { fn: ((ctx: Ctx) => Promise<string>) | undefined } = { fn: undefined };
