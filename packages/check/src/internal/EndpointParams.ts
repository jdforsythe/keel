import type { ObjectExpression, ObjectProperty } from "oxc-parser";

/** The statically known `params` of an endpoint: `x.object({ ... })` with plain keys; `s` is the callee's object name. */
export type EndpointParams = {
  readonly fields: ObjectExpression;
  readonly s: string;
  readonly props: ObjectProperty[];
};
