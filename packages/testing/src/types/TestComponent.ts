import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/** A component the harness can render (k.component): `(props, slots?, ctx?) => Node` (`slots` always `undefined`) whose `Props` schema the compiler attaches (a component file exporting `Props`); `render`/`properties` throw `schema.invalid` without it. */
export interface TestComponent<P> {
  (props: P, slots?: undefined, ctx?: Ctx): Node;
  readonly Props?: Schema<P>;
}
