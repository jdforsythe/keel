import type { Ctx } from "@keel/ctx";

/**
 * Per ctx, the errors a recorder has already taken (std.sessions): the ctx replays the errors since its current `nav`
 * to every new observer, and a later recorder on the same ctx skips these, so one error is uploaded once.
 */
export const takenErrors: WeakMap<Ctx, WeakSet<object>> = new WeakMap();
