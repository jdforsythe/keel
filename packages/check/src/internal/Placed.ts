import type ts from "typescript";

/**
 * Where a node sits inside the object-literal argument of a call (`placeIn`): the call, the argument, the entry
 * of the argument holding the node (`null` at the argument itself), whether the node is at or under that entry's
 * key, and the member of the entry's object holding it (`null` when none does).
 */
export type Placed = {
  readonly call: ts.CallExpression;
  readonly arg: ts.ObjectLiteralExpression;
  readonly entry: ts.PropertyAssignment | null;
  readonly atKey: boolean;
  readonly member: ts.ObjectLiteralElementLike | null;
};
