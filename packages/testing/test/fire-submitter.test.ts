// @vitest-environment happy-dom
// Spec: k.testing Harness (`fire`: an event goes where a browser sends it). A `submit` fired at a submit button reaches
// its form with the button as the submitter; at the form it reaches the form; at a button that does not submit it is
// dispatched there and bubbles; a button outside a form reaches no form. Seed 1337.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { expect, it } from "vitest";

const seen: { target: string; submitter: string | null }[] = [];
const Page = Object.assign(
  (_props: Record<string, never>): Node => {
    const form = document.createElement("form");
    form.id = "sb.form";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      seen.push({
        target: e.target instanceof Element ? e.target.id : "?",
        submitter: e instanceof SubmitEvent && e.submitter !== null ? e.submitter.id : null,
      });
    });
    const make = (tag: string, id: string, type: string | null): HTMLElement => {
      const el = document.createElement(tag);
      el.id = id;
      if (type !== null) el.setAttribute("type", type);
      el.textContent = id;
      return el;
    };
    form.append(
      make("button", "sb.send", "submit"),
      make("button", "sb.plain", null),
      make("button", "sb.other", "button"),
    );
    const main = document.createElement("main");
    main.append(form, make("button", "sb.outside", "submit"));
    return main;
  },
  { Props: s.object({}) },
);

it("a submit fired at a submit button submits its form with the button as submitter", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom("sb.send", "sb.plain", "sb.other", "sb.form", "sb.outside"), async (id) => {
      seen.length = 0;
      const t = render(Page, { props: {} });
      await t.fire(id, { type: "submit" });
      const submitting = id === "sb.send" || id === "sb.plain";
      const expected =
        id === "sb.outside" ? [] : [{ target: submitting ? "sb.form" : id, submitter: submitting ? id : null }];
      expect(seen).toEqual(expected);
      t.dispose();
    }),
    { seed: 1337, numRuns: 20 },
  );
});
