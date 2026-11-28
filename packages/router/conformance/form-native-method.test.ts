// @vitest-environment happy-dom
// k.router Form prose (not a Conformance sentence): without JS the form posts natively; PUT/PATCH/DELETE via a hidden _method. Exhaustive over the 4 verbs.
import { beforeEach, describe, expect, it } from "vitest";
import { VERBS, control, resetObservations, start } from "./fixtures.ts";

describe("k.router Form without JS", () => {
  beforeEach(resetObservations);
  it.each(VERBS)("a Form with method %s posts natively, with _method only when not POST", async (verb) => {
    control.verb = verb;
    const app = await start("/orders/7", { render: true });
    const form = app.host.querySelector("form");
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    const hidden = form?.querySelector('input[name="_method"]');
    if (verb === "POST") expect(hidden).toBeNull();
    else {
      expect(hidden?.getAttribute("type")).toBe("hidden");
      expect(hidden?.getAttribute("value")).toBe(verb);
    }
    app.stop();
  });
});
