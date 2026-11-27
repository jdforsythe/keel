import type { Ctx } from "../Ctx.ts";

/**
 * The kernel's listener for supervised throws on each ctx (k.supervise Report): the server that serves with a ctx
 * writes its `supervised <id> threw:` record. A binding of this module only.
 */
export const supervisedBy = new WeakMap<Ctx, (id: string, thrown: unknown) => void>();
