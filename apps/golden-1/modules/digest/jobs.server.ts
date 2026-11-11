import { queue } from "@keel/std-jobs";
import { recount } from "./recount.server.ts";

/** The `digest` module's job queue (std.jobs). */
export const jobs = queue({ "digest.recount": recount });
