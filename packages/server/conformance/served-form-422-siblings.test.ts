// @vitest-environment happy-dom
// Spec: k.forms, Conformance "Of input `s.object({ cards: s.record(s.object({ name: s.string({ min: 3 }), pin: s.secret(s.string()) })), pay: s.union('kind', [s.object({ kind: s.literal('card'), cvc: s.secret(s.string()) }), s.object({ kind: s.literal('cash'), note: s.string() })]) })`, a no-script post of `cards.a.name=x`, `cards.a.pin=pin-7781`, `pay.kind=cash`, `pay.note=hi` and `pay.cvc=cvc-7781` answers 422 whose `#k-state` `form.values` holds `cards.a.name` `x`, `pay.kind` `cash` and `pay.note` `hi` and no `cards.a.pin` or `pay.cvc` key, and whose body holds neither `pin-7781` nor `cvc-7781`."
// Spec: k.forms, Conformance "No 422 response carries a submitted `s.secret` or password-input value."
// Seed 1337 (fc.assert below). The neighbouring 422 cases of this clause (`secret-submission-0089.test.ts`, `served-form-422.test.ts`) live in this package, so this file does too.
// A no-script post is a multipart POST with `accept: text/html`; the 422 document's `#k-state` is read as parsed JSON, and its `form` holds the submitted values by dotted key under `values`, the shape the served document has today.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, post } from "./fixtures.ts";

const Input = s.object({
  cards: s.record(s.object({ name: s.string({ min: 3 }), pin: s.secret(s.string()) })),
  pay: s.union("kind", [
    s.object({ kind: s.literal("card"), cvc: s.secret(s.string()) }),
    s.object({ kind: s.literal("cash"), note: s.string() }),
  ]),
});
const payContract = contract("pay", { "pay.show": { path: "/pay" } });
const save = action(payContract, "pay.show", { input: Input }, () => Promise.resolve(ok(null)));
const routes = manifest(payContract, {
  "pay.show": { component: () => document.createElement("main"), POST: save },
});

async function served(fields: Record<string, string>) {
  const app = await createApp({
    topology: topology({ web: { modules: ["pay"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  const res = await app.fetch(post("/pay", fields, { accept: "text/html" }));
  const html = await res.text();
  const el = new DOMParser().parseFromString(html, "text/html").getElementById("k-state");
  const state: unknown = el === null ? null : JSON.parse(el.textContent ?? "null");
  const form: unknown = typeof state === "object" && state !== null ? Reflect.get(state, "form") : undefined;
  const values: unknown = typeof form === "object" && form !== null ? Reflect.get(form, "values") : undefined;
  return {
    status: res.status,
    html,
    form: typeof values === "object" && values !== null ? Object.fromEntries(Object.entries(values)) : null,
  };
}

describe("k.forms: a 422 re-render keeps the plain siblings of a secret under a record or union", () => {
  it("Of input `s.object({ cards: s.record(s.object({ name: s.string({ min: 3 }), pin: s.secret(s.string()) })), pay: s.union('kind', [...]) })`, a no-script post of `cards.a.name=x`, `cards.a.pin=pin-7781`, `pay.kind=cash`, `pay.note=hi` and `pay.cvc=cvc-7781` answers 422 whose `#k-state` `form` holds `cards.a.name` `x`, `pay.kind` `cash` and `pay.note` `hi` and no `cards.a.pin` or `pay.cvc` key, and whose body holds neither `pin-7781` nor `cvc-7781`.", async () => {
    const out = await served({
      "cards.a.name": "x",
      "cards.a.pin": "pin-7781",
      "pay.kind": "cash",
      "pay.note": "hi",
      "pay.cvc": "cvc-7781",
    });
    expect(out.status).toBe(422);
    expect(out.form).not.toBeNull();
    expect(out.form).toMatchObject({ "cards.a.name": "x", "pay.kind": "cash", "pay.note": "hi" });
    expect(Object.keys(out.form ?? {})).not.toContain("cards.a.pin");
    expect(Object.keys(out.form ?? {})).not.toContain("pay.cvc");
    expect(out.html).not.toContain("pin-7781");
    expect(out.html).not.toContain("cvc-7781");
  });

  it("For any record key and any plain value, `cards.<key>.name` is restored and `cards.<key>.pin` is not, and the secret's value is in no part of the body.", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/),
        fc.stringMatching(/^[a-z]{1,2}$/),
        fc.stringMatching(/^pin-[0-9a-f]{8}$/),
        async (key, name, pin) => {
          const out = await served({
            [`cards.${key}.name`]: name,
            [`cards.${key}.pin`]: pin,
            "pay.kind": "cash",
            "pay.note": "hi",
          });
          expect(out.status).toBe(422);
          expect(out.form).toMatchObject({ [`cards.${key}.name`]: name });
          expect(Object.keys(out.form ?? {})).not.toContain(`cards.${key}.pin`);
          expect(out.html).not.toContain(pin);
        },
      ),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("A union variant with no secret keeps its plain fields while the other variant's secret is dropped: `pay.kind=cash` keeps `pay.note`, and `pay.kind=card` with `pay.cvc` drops `pay.cvc` and keeps `pay.kind`.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^cvc-[0-9a-f]{6}$/), async (note, cvc) => {
        const cash = await served({ "cards.a.name": "x", "pay.kind": "cash", "pay.note": note });
        expect(cash.form).toMatchObject({ "pay.kind": "cash", "pay.note": note });
        const card = await served({ "cards.a.name": "x", "pay.kind": "card", "pay.cvc": cvc });
        expect(card.status).toBe(422);
        expect(card.form).toMatchObject({ "pay.kind": "card", "cards.a.name": "x" });
        expect(Object.keys(card.form ?? {})).not.toContain("pay.cvc");
        expect(card.html).not.toContain(cvc);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });
});
