import { s } from "@keel/schema";
import { UnreachableData } from "./UnreachableData.schema.ts";

/** `inspector.unreachable`: the target did not answer, or its answer was not an inspect document (`UnreachableData`). */
export const Unreachable = s.error("inspector.unreachable", UnreachableData);
