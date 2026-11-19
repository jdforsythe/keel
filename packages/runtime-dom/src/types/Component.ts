import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/**
 * A component (k.component): `(props, slots?, ctx?) => Node`, its second argument always `undefined`. Props are
 * getters; `P` defaults to no props. JSX children arrive as `props.children`; a named slot is a prop. `ctx` (k.ctx) is passed by the runtime from the mount or island root.
 * A component file that exports `Props` gets it attached as `Component.Props` by the compiler (D25), which
 * is what the test harness's `render` and `properties` read.
 */
export type Component<P = Record<string, never>> = ((props: P, slots?: undefined, ctx?: Ctx) => Node) & {
  Props?: Schema<P>;
};
