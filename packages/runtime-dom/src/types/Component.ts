import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/**
 * A component (k.component): `(props, ctx) => Node`. Props are
 * getters; `P` defaults to no props. JSX children arrive as `props.children`; a named slot is a prop. Every caller passes `ctx` (k.ctx); a component that reaches no effect may leave it out.
 * A component file that exports `Props` gets it attached as `Component.Props` by the compiler (D25), which
 * is what the test harness's `render` and `properties` read.
 */
export type Component<P = Record<string, never>> = ((props: P, ctx: Ctx) => Node) & {
  Props?: Schema<P>;
};
