import { heldMap } from "@keel/schema/internal";
import type { Compiled } from "./Compiled.ts";

/** The compiled form of each route table `manifest` or `routeTable` made. */
export const tables = heldMap<object, Compiled>();
