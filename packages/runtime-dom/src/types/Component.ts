import type { Ctx } from "@keel/ctx";
import type { Slots } from "./Slots.ts";

/**
 * A component (k.component): `(props, slots?, ctx?) => Node`. Props are getters; `P` defaults to no props.
 * JSX children arrive as `props.children` (RFC 0008). `ctx` (k.ctx) is passed by the runtime from the mount or island root.
 */
export type Component<P = Record<string, never>> = (props: P, slots?: Slots, ctx?: Ctx) => Node;
