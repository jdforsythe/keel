import { queue } from "@keel/std-jobs";
import { restock } from "./restock.server.ts";
import { startRestock } from "./startRestock.server.ts";

/** The shopping module's job queue: the weekly start and the weekly run's step and wake jobs. */
export const jobs = queue({ "shopping.startRestock": startRestock, ...restock.jobs });
