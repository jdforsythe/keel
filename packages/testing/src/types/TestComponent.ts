import type { Ctx } from "@keel/ctx";
import type { Slots } from "@keel/runtime-dom";
import type { Schema } from "@keel/schema";

/** A component the harness can render (k.component): `(props, slots?, ctx?) => Node` whose `Props` schema the compiler attaches (a component file exporting `Props`); `render`/`properties` throw `schema.invalid` without it. */
export interface TestComponent<P> {
  (props: P, slots?: Slots, ctx?: Ctx): Node;
  readonly Props?: Schema<P>;
}
