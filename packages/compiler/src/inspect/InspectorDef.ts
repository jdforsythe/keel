import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";

/**
 * One section of the inspect document (k.inspect Inspector hooks): `id` names it in `sections`, `read` produces its value
 * from the app's `ctx` on every inspect request, and `schema` validates and encodes that value.
 */
export type InspectorDef<T> = {
  readonly id: string;
  readonly schema: Schema<T>;
  readonly read: (ctx: Ctx) => T;
};
