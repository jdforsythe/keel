import { heldMap } from "@keel/schema/internal";
import type { EntryShape } from "./EntryShape.ts";

/** The checked entries of each contract `contract` made, keyed by the contract value. */
export const shapesOf = heldMap<object, ReadonlyMap<string, EntryShape>>();
