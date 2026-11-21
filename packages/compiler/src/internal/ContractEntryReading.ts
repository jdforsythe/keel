import type { ObjectProperty } from "oxc-parser";
import type { ContractGap } from "./ContractGap.ts";

/**
 * One contract entry written as an object literal (`readContract`): its literal id, its property, the members written
 * in place with a literal key (`members`, by name, any value), the literal values of `method`, `path`, `layout` and `events`
 * (`literals`: a string, a boolean, or `null` for `null` or `undefined`), and the parts of it not read (`gaps`). An
 * entry with a spread or computed key among its members is not read whole: the spread may set any member.
 */
export type ContractEntryReading = {
  readonly kind: "entry";
  readonly id: string;
  readonly prop: ObjectProperty;
  readonly members: ReadonlyMap<string, ObjectProperty>;
  readonly literals: ReadonlyMap<string, string | boolean | null>;
  readonly gaps: readonly ContractGap[];
};
