// @vitest-environment happy-dom
// A secret never becomes markup (k.forms Bindings, k.schema Secrets): a field whose schema is `s.secret` writes no
// markup default on any control type, so a typed value cannot reach server HTML or a DOM snapshot through a later
// bind; a `password` input over a plain string writes none either. The value still binds and submits.
import { type Scope, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { form } from "../src/index.ts";

const Login = s.object({
  user: s.string(),
  token: s.secret(s.string()).optional(),
  pin: s.string(),
});

const scopes: Scope[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});

const input = (type: string): HTMLInputElement => {
  const el = document.createElement("input");
  el.type = type;
  return el;
};

function bindAll(type: string, typed: string) {
  const first = input(type);
  const again = input(type);
  const pin = input("password");
  scopes.push(
    scope(
      () => {
        const f = form(Login, { initial: { user: "ada", pin: "" } });
        f.field("token").bind(first);
        first.value = typed;
        first.dispatchEvent(new Event("input"));
        f.field("pin").set(typed);
        // A second control bound later (a re-render) starts from the field's current value.
        f.field("token").bind(again);
        f.field("pin").bind(pin);
      },
      { detached: true },
    ),
  );
  return { first, again, pin };
}

describe("a secret field writes no markup default", () => {
  it("an s.secret field bound to a text input keeps its value off the value attribute", () => {
    const { again, pin } = bindAll("text", "tok-SECRET");
    expect(again.value).toBe("tok-SECRET");
    expect(again.getAttribute("value")).toBeNull();
    expect(pin.getAttribute("value")).toBeNull();
    expect(again.outerHTML).not.toContain("tok-SECRET");
  });

  it("property: no generated secret string reaches a bound control's markup (seed 1337)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("text", "search", "email", "password"),
        fc.string({ minLength: 1 }),
        (type, typed) => {
          const { first, again, pin } = bindAll(type, `S3cr3t${typed}`);
          for (const el of [first, again, pin]) expect(el.getAttribute("value")).toBeNull();
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
