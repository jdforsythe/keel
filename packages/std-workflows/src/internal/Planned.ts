import type { Ctx } from "@keel/ctx";
import type { Scan } from "./Scan.ts";
import type { planKey } from "./planKey.ts";

/** A workflow as `flows` sees it: its id and its scan (`undefined` when the read was refused). */
export type Planned = { readonly id: string; readonly [planKey]: (ctx: Ctx) => Promise<Scan | undefined> };
