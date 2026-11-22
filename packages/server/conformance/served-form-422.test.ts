// @vitest-environment happy-dom
// Spec: k.forms, clause "With the runtime absent, posting invalid FormData returns 422 HTML containing the submitted values and messages."
// Spec: k.forms, clause "An invalid bound input has `aria-invalid=\"true\"` and `aria-describedby` naming an element whose text is its message."
// Seed 1337 (fc.assert below). Asserts on the served document: the bound control carries the rejected `value`, `aria-invalid` and the
// error text, for a decode failure and for an action's `err(keel.fields)`, and after resume.
import { resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createCtx } from "@keel/ctx";
import { topology, createApp } from "@keel/server";
import { REFUSED, routes } from "./served-form-routes.ts";

const FRESH = () => import("./served-form-routes.ts");

const word = fc
  .array(fc.constantFrom(..."acdefghjkmnpqrstuvwxyz"), { minLength: 4, maxLength: 10 })
  .map((a) => a.join(""));

const post = (qty: string, note: string): Request =>
  new Request("http://localhost/rf", {
    method: "POST",
    headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ qty, note }).toString(),
  });

function control(doc: Document, id: string) {
  const el = doc.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no input ${id}`);
  const describedBy = el.getAttribute("aria-describedby") ?? "";
  return {
    value: el.getAttribute("value"),
    invalid: el.getAttribute("aria-invalid"),
    error: doc.getElementById(describedBy)?.textContent ?? null,
  };
}

async function served(qty: string, note: string): Promise<{ status: number; html: string; doc: Document }> {
  const app = await createApp({
    topology: topology({ web: { modules: ["rf"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  const res = await app.fetch(post(qty, note));
  const html = await res.text();
  return { status: res.status, html, doc: new DOMParser().parseFromString(html, "text/html") };
}

describe("k.forms: the 422 document of a native post shows the rejected values and errors in its markup", () => {
  it("a decode failure: the bound control carries the rejected value, aria-invalid and the error text, in the served document", async () => {
    await fc.assert(
      fc.asyncProperty(word, word, async (qty, note) => {
        const { status, doc } = await served(qty, note);
        expect(status).toBe(422);
        const q = control(doc, "rf:qty");
        expect(q.value).toBe(qty);
        expect(q.invalid).toBe("true");
        expect((q.error ?? "").length).toBeGreaterThan(0);
        expect(control(doc, "rf:note").value).toBe(note);
        expect(control(doc, "rf:note").invalid).not.toBe("true");
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("an action's err(keel.fields): the bound control carries the rejected value, aria-invalid and the error text, in the served document", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 999 }), async (n) => {
        const { status, doc } = await served(String(n), "bad");
        expect(status).toBe(422);
        const note = control(doc, "rf:note");
        expect(note.value).toBe("bad");
        expect(note.invalid).toBe("true");
        expect(note.error).toBe(REFUSED);
        expect(control(doc, "rf:qty").value).toBe(String(n));
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  for (const [title, qty, note] of [
    ["a decode failure", "abc", "hello"],
    ["an action's err(keel.fields)", "3", "bad"],
  ] as const) {
    it(`${title}: the value, aria-invalid and the error text are still there after resume`, async () => {
      const { html } = await served(qty, note);
      const t = await resumeDocument(html, { routes: FRESH });
      const bad = note === "bad" ? "rf:note" : "rf:qty";
      const rejected = note === "bad" ? note : qty;
      const after = control(document, bad);
      expect(after.value ?? "").toBe(rejected);
      expect(after.invalid).toBe("true");
      expect((after.error ?? "").length).toBeGreaterThan(0);
      expect(t.a11y(bad).state.invalid).toBe(true);
      t.dispose();
    });
  }
});
