import type { Infer } from "@keel/schema";
import type { RestockText } from "./RestockText.schema.ts";

/** The weekly staples panel's copy, in English. */
export const restockText: Infer<typeof RestockText> = {
  heading: "Weekly staples",
  intro:
    "Every Saturday at 08:00 UTC the app puts Milk, Bread, Eggs, Rice and Apples back on the list, one every two seconds. A staple still to buy stays as it is.",
  runNow: "Run now",
  never: "No run yet. The first starts on Saturday, or when you select Run now.",
  of: "of",
  handled: "staples handled",
  putBack: "put back",
  states: { running: "Running", done: "Done", failed: "Stopped" },
  by: { schedule: "Started by the schedule", member: "Started by a member" },
  failedWith: "Stopped with",
  refused: "The run did not start. Try it again.",
};
