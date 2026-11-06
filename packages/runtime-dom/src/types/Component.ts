import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";
import type { Slots } from "./Slots.ts";

/**
 * A component (k.component): `(props, slots?, ctx?) => Node`. Props are getters; `P` defaults to no props.
 * JSX children arrive as `props.children` (RFC 0008). `ctx` (k.ctx) is passed by the runtime from the mount or island root.
 * A component file that exports `Props` gets it attached as `Component.Props` by the compiler (D25), which
 * is what the test harness's `render` and `properties` read.
 */
export type Component<P = Record<string, never>> = ((props: P, slots?: Slots, ctx?: Ctx) => Node) & {
  Props?: Schema<P>;
};
