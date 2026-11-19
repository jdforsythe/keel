import type { SimCtx } from "@keel/ctx";

/** A group's server (std.multi): `serve(ctx)` returns a `{ fetch }` over the sim ctx it is given, as `createApp` does. */
export type Serve = (ctx: SimCtx) => { fetch(req: Request): Promise<Response> };
