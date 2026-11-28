// The `orders` module of the app these tests schedule into (std.jobs: one queue per module, in
// `modules/<id>/jobs.server.ts`, E2501). A test that spies on `enqueue` spies on a copy, `{ ...jobs }`.
import { ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";

/** The `orders` module's queue: `orders.digest`, which does nothing. */
export const jobs = queue({ "orders.digest": job({ input: s.object({}) }, async () => ok(null)) });

/** The `orders` queue of a test that counts job runs: `orders.digest` records each run's `at` in `ran`. */
export const recording = (ran: string[]) =>
  queue({
    "orders.digest": job({ input: s.object({ at: s.string() }) }, async (input) => {
      ran.push(input.at);
      return ok(null);
    }),
  });
