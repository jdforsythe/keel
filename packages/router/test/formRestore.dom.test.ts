// @vitest-environment happy-dom
// k.forms Submit: a Form rendered for the post it sent, which the server rejected, hands the submitted values and
// errors to its form handle before its controls bind; a Form of another action or method takes nothing.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { servedForm } from "@keel/runtime-dom/internal";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { contract } from "../src/contract/contract.ts";
import { formHandle } from "../src/internal/formHandle.ts";
import type { FormHandle } from "../src/types/FormHandle.ts";
import type { Href } from "../src/types/Href.ts";

const SEED = 1337;
const ctx = createCtx({ mode: "sim", seed: SEED });
const c = contract("fr", {
  "fr.in": { path: "/fr/in", search: s.object({ next: s.string().optional() }) },
  "fr.out": { path: "/fr/out" },
});
const IN = c.href("fr.in");
const OUT = c.href("fr.out");
const NEXT = c.href("fr.in", {}, { next: "/a" });
const values = { name: "Ada", tags: ["a", "b"] };
const errors = { name: "Taken" };
type Method = "POST" | "PUT" | "PATCH" | "DELETE";

/** A handle that logs what `restore` is given and, in order, when its control is made. */
const handleOf = (log: unknown[], restore = true): FormHandle => ({
  [formHandle]: {
    ...(restore ? { restore: (v, e) => void log.push(["restore", v, e]) } : {}),
    setPending: () => undefined,
    onResult: () => undefined,
    validate: () => ok(null),
  },
});
/** Renders a Form of `action` and `method` with `form`, its one control logging when it binds. */
const render = (action: Href, method: Method, log: unknown[], form?: FormHandle): void => {
  const h = document.createElement("div");
  document.body.append(h);
  const unmount = mount(
    () =>
      Form({
        method,
        action,
        ...(form === undefined ? {} : { form }),
        children: () => {
          log.push("controls");
          return [document.createElement("input")];
        },
      }),
    h,
    { ctx },
  );
  unmount();
  h.remove();
};

afterEach(() => {
  servedForm.current = null;
});

describe("a Form rendered for its rejected post", () => {
  it("restores the submitted values and errors before its controls bind", () => {
    servedForm.current = { href: IN, method: "POST", values, errors };
    const log: unknown[] = [];
    render(IN, "POST", log, handleOf(log));
    expect(log).toEqual([["restore", values, errors], "controls"]);
  });

  it("restores only for the post's own action and method", () => {
    const actions = [IN, OUT, NEXT];
    const methods: readonly Method[] = ["POST", "PUT", "PATCH", "DELETE"];
    fc.assert(
      fc.property(
        fc.constantFrom(...actions),
        fc.constantFrom(...methods),
        fc.constantFrom(...actions),
        fc.constantFrom(...methods),
        (postedAction, postedMethod, action, method) => {
          servedForm.current = { href: postedAction, method: postedMethod, values, errors };
          const log: unknown[] = [];
          render(action, method, log, handleOf(log));
          const own = postedAction === action && postedMethod === method;
          expect(log).toEqual(own ? [["restore", values, errors], "controls"] : ["controls"]);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("with no rejected post, restores nothing", () => {
    const log: unknown[] = [];
    render(IN, "POST", log, handleOf(log));
    expect(log).toEqual(["controls"]);
  });

  it("renders all the same with no form handle, or one that takes no restore", () => {
    servedForm.current = { href: IN, method: "POST", values, errors };
    const log: unknown[] = [];
    render(IN, "POST", log);
    render(IN, "POST", log, handleOf(log, false));
    expect(log).toEqual(["controls", "controls"]);
  });
});
