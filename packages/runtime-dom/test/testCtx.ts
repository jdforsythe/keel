import { createCtx } from "@keel/ctx";

/** A sim ctx every test mounts with. */
export const testCtx = createCtx({ mode: "sim", seed: 1 });
