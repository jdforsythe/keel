// @vitest-environment happy-dom
// k.router Keys/Form prose (not a Conformance sentence): actions are keyed by POST/PUT/PATCH/DELETE; <Form method> runs the action of that verb. Exhaustive over the 4 verbs.
import { beforeEach, describe, expect, it } from "vitest";
import { VERBS, control, count, resetObservations, start, submit } from "./fixtures.ts";

describe("k.router actions keyed by verb", () => {
  beforeEach(resetObservations);
  it.each(VERBS)("a Form with method %s runs only the %s action", async (verb) => {
    control.verb = verb;
    const app = await start("/orders/7", { render: true });
    await submit(app.host);
    for (const v of VERBS) expect(count(`action:${v}`)).toBe(v === verb ? 1 : 0);
    app.stop();
  });
});
