// The `orders` module's runners (std.jobs E2504: a queue runs where `runners.server.ts` lists it). The tests drive
// `schedule(...).run` and `jobs.run` themselves.
import { jobs } from "./jobs.server.ts";

export const runners = [jobs];
