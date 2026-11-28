import type { ObjectSchema, Schema } from "@keel/schema";
import type { Method } from "../contract/types/Method.ts";
import type { Segment } from "./Segment.ts";

/** One contract entry as `contract` read and checked it: its kind, members and compiled path (`null` for a layout). */
export type EntryShape = {
  readonly id: string;
  readonly module: string;
  readonly kind: "page" | "layout" | "api";
  readonly path?: string;
  readonly segments: readonly Segment[] | null;
  readonly method?: Method;
  readonly params?: ObjectSchema<unknown>;
  readonly search?: ObjectSchema<unknown>;
  readonly query?: ObjectSchema<unknown>;
  readonly body?: ObjectSchema<unknown>;
  readonly output?: Schema<unknown, boolean>;
  readonly errors?: Readonly<Record<string, Schema<unknown, boolean>>>;
  readonly timeout?: number;
  readonly events?: boolean;
  /** A route of this machine alone (k.contract Local routes). */
  readonly local?: true;
};
