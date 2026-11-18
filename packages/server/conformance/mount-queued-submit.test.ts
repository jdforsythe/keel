// @vitest-environment happy-dom
// Spec: k.mount, Form "A queued submit (k.defaults) runs this at replay: sent once if valid, never if not."
// Spec: k.mount, Conformance "A submit queued before resume is sent once when valid, never when invalid."
// Seed 1337 (fc.assert below). The sign-in page of packages/testing/conformance/mount-pages.ts is served by `createApp`, its body is put into the
// document, a `submit` is dispatched on its form before `resume`, then the page resumes with its compiled component. As in k.defaults, a native
// submit is the runtime calling `submit` or `requestSubmit` on the form: both are replaced by recorders of the form data at the call.
import { createCtx } from "@keel/ctx";
import { resume } from "@keel/runtime-dom/ops";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED, components, routes } from "../../testing/conformance/mount-pages.ts";
import { appOf } from "./resume-graph-app.ts";

type Call = {
  readonly kind: "submit" | "requestSubmit";
  readonly action: string;
  readonly data: readonly (readonly [string, string])[];
};

let calls: Call[] = [];
let submitEvents = 0;
const original = { submit: HTMLFormElement.prototype.submit, requestSubmit: HTMLFormElement.prototype.requestSubmit };
const count = (): void => {
  submitEvents += 1;
};

function record(kind: Call["kind"], form: HTMLFormElement): void {
  const data: [string, string][] = [];
  for (const [k, v] of new FormData(form)) data.push([k, String(v)]);
  calls.push({ kind, action: form.getAttribute("action") ?? "", data });
}

beforeEach(() => {
  calls = [];
  submitEvents = 0;
  HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
    record("submit", this);
  };
  HTMLFormElement.prototype.requestSubmit = function (this: HTMLFormElement) {
    record("requestSubmit", this);
  };
  document.addEventListener("submit", count, true);
});
afterEach(() => {
  HTMLFormElement.prototype.submit = original.submit;
  HTMLFormElement.prototype.requestSubmit = original.requestSubmit;
  document.removeEventListener("submit", count, true);
  document.body.innerHTML = "";
});

async function bodyOfSignIn(): Promise<string> {
  const app = await appOf(routes, ["mt"]);
  const res = await app.fetch(new Request("http://localhost/sign-in", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return new DOMParser().parseFromString(await res.text(), "text/html").body.innerHTML;
}

const control = (id: string): HTMLInputElement => {
  const el = document.querySelector(`[data-k="${id}"], [id="${id}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`fixture: no input ${id}`);
  return el;
};

/** Types `email` and `password` before resume, dispatches the submit, resumes, and returns whether the submit was prevented at capture. */
function queued(body: string, email: string, password: string): boolean {
  document.body.innerHTML = body;
  control("mt.signin.email").value = email;
  control("mt.signin.password").value = password;
  const form = document.querySelector("form");
  if (form === null) throw new Error("fixture: no form");
  const event = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  const prevented = event.defaultPrevented;
  const ctx = createCtx({ mode: "sim", seed: SEED });
  resume(document.body, { "mt.signin": components["mt.signin"] }, { ctx, mode: "dev" });
  return prevented;
}

describe("k.mount: a submit queued before resume runs the form's validation at replay", () => {
  it("a valid queued submit is prevented at capture and sent once at replay, with the named fields and no second submit event", async () => {
    const body = await bodyOfSignIn();
    expect(queued(body, "a@b.example", "pw")).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.action).toBe("/api/auth/sign-in/email");
    expect(calls[0]?.data).toEqual([
      ["email", "a@b.example"],
      ["password", "pw"],
    ]);
    expect(submitEvents).toBe(1);
  });

  it("an invalid queued submit is prevented at capture and never sent, and the errors show after resume", async () => {
    const body = await bodyOfSignIn();
    expect(queued(body, "", "pw")).toBe(true);
    expect(calls).toEqual([]);
    expect(document.querySelector('[data-k="mt.signin.errors"], [id="mt.signin.errors"]')?.textContent).toContain(
      "email",
    );
  });

  it("for generated input, a queued submit is sent once when the input is valid and never when it is not", async () => {
    const body = await bodyOfSignIn();
    const typed = fc.record({
      email: fc.stringMatching(/^[a-z0-9@.]{0,8}$/),
      password: fc.stringMatching(/^[a-z0-9]{0,5}$/),
    });
    fc.assert(
      fc.property(typed, (input) => {
        calls = [];
        submitEvents = 0;
        queued(body, input.email, input.password);
        const valid = input.email.length >= 3 && input.password.length >= 2;
        expect(calls).toHaveLength(valid ? 1 : 0);
        expect(submitEvents).toBe(1);
        document.body.innerHTML = "";
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
