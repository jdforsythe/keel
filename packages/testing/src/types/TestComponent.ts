import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/** A component the harness can render (k.component): `(props, slots?, ctx?) => Node` (`slots` always `undefined`) whose `Props` schema the compiler attaches (a component file exporting `Props`); `render`/`properties` throw `schema.invalid` without it. `A` is the props type the component takes: `P` plus the callback and slot props the schema cannot hold (k.component Slot props), which `render` passes through. */
export interface TestComponent<P, A extends P = P> {
  (props: A, slots?: undefined, ctx?: Ctx): Node;
  readonly Props?: Schema<P>;
}
