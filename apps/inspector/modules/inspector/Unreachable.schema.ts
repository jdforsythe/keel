import { s } from "@keel/schema";
import { UnreachableData } from "./UnreachableData.schema.ts";

/** `inspector.unreachable`: `?url=` names no origin on this machine, or the fetch of its inspect document failed (`UnreachableData`). */
export const Unreachable = s.error("inspector.unreachable", UnreachableData);
