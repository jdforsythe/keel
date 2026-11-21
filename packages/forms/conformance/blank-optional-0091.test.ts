// @vitest-environment happy-dom
// Spec: k.forms, clause "A field of `s.string({ min: 1 }).optional()` holding `''` or `'  '` shows no error and submits without the key; one of `s.string().optional()` submits `'  '`." (rfc:0091)
// Seed 1337. Two routes: the client form (typed input, `<Form>` submit through the router; the action sees the input
// without the key) and a posted form decoded without the runtime (`decodeStrings` of the FormData, as the server does).
// ASSUMPTION: the action's `input` is the parsed value, so a dropped key is a missing key of that object.
import { createCtx } from "@keel/ctx";
import { form } from "@keel/forms";
import { effect } from "@keel/reactive";
import { Form, action, createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fieldInput, memoryHistory, must, settle } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const Min = s.object({ title: s.string({ min: 1 }), n: s.string({ min: 1 }).optional() });
const Plain = s.object({ title: s.string({ min: 1 }), n: s.string().optional() });
const blanks = fc
  .array(fc.constantFrom(" ", "\t", "\n", " ", "　"), { minLength: 1, maxLength: 8 })
  .map((a) => a.join(""));

type Run = { error: string | undefined; calls: unknown[] };

async function submitWith(schema: typeof Min | typeof Plain, n: string): Promise<Run> {
  const calls: unknown[] = [];
  const notesContract = contract("notes", {
    "notes.edit": { path: "/notes" },
  });

  const save = action(notesContract, "notes.edit", { input: schema }, async (input: unknown) => {
    calls.push(input);
    return ok(null);
  });
  const holder: { f?: ReturnType<typeof form<typeof Min>> | ReturnType<typeof form<typeof Plain>> } = {};
  const Page = (): HTMLFormElement => {
    const f = form(schema, {});
    holder.f = f;
    const inputs = (["title", "n"] as const).map((name) => {
      const field = f.field(name);
      const wrap = document.createElement("div");
      const el = document.createElement("input");
      const msg = document.createElement("span");
      msg.id = field.errorId;
      field.bind(el);
      effect(() => {
        msg.textContent = field.error() ?? "";
      });
      wrap.append(el, msg);
      return wrap;
    });
    const b = document.createElement("button");
    b.type = "submit";
    return Form({ method: "POST", action: notesContract.href("notes.edit"), form: f, children: () => [...inputs, b] });
  };
  const routes = manifest(notesContract, {
    "notes.edit": { component: Page, POST: save },
  });
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/notes") });
  const root = document.createElement("div");
  document.body.appendChild(root);
  const dispose = mount(router.App, root, { ctx: simCtx });
  try {
    const f = must(holder.f, "form handle");
    const type = (name: string, value: string): void => {
      fieldInput(root, name).value = value;
      fieldInput(root, name).dispatchEvent(new Event("input", { bubbles: true }));
    };
    type("title", "hello");
    type("n", n);
    fieldInput(root, "n").dispatchEvent(new Event("blur"));
    const errors: Record<string, string | undefined> = f.errors();
    const shownBeforeSubmit = errors["n"];
    must(root.querySelector("form"), "form element").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    const after: Record<string, string | undefined> = f.errors();
    return { error: shownBeforeSubmit ?? after["n"], calls };
  } finally {
    dispose();
    root.remove();
  }
}

describe("k.forms blank optional string (rfc:0091)", () => {
  test("A field of `s.string({ min: 1 }).optional()` holding `''` shows no error and submits without the key (client form)", async () => {
    const r = await submitWith(Min, "");
    expect(r.error).toBeUndefined();
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toEqual({ title: "hello" });
  });

  test("A field of `s.string({ min: 1 }).optional()` holding `'  '` shows no error and submits without the key (client form)", async () => {
    const r = await submitWith(Min, "  ");
    expect(r.error).toBeUndefined();
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toEqual({ title: "hello" });
  });

  test("any whitespace-only value in a `min` >= 1 optional field shows no error and submits without the key (client form)", async () => {
    await fc.assert(
      fc.asyncProperty(blanks, async (v) => {
        const r = await submitWith(Min, v);
        expect(r.error).toBeUndefined();
        expect(r.calls).toEqual([{ title: "hello" }]);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("a field of `s.string().optional()` holding `'  '` submits `'  '` (client form)", async () => {
    const r = await submitWith(Plain, "  ");
    expect(r.error).toBeUndefined();
    expect(r.calls).toEqual([{ title: "hello", n: "  " }]);
  });

  test("a posted form (no runtime) with `''` or `'  '` for a `min` >= 1 optional field decodes without the key and parses ok", () => {
    for (const v of ["", "  "]) {
      const fd = new FormData();
      fd.set("title", "hello");
      fd.set("n", v);
      expect(Min.decodeStrings(fd)).toEqual(ok({ title: "hello" }));
    }
    fc.assert(
      fc.property(blanks, (v) => {
        const fd = new FormData();
        fd.set("title", "hello");
        fd.set("n", v);
        expect(Min.decodeStrings(fd)).toEqual(ok({ title: "hello" }));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("a posted form (no runtime) with `'  '` for a `s.string().optional()` field decodes to `'  '`", () => {
    const fd = new FormData();
    fd.set("title", "hello");
    fd.set("n", "  ");
    expect(Plain.decodeStrings(fd)).toEqual(ok({ title: "hello", n: "  " }));
  });
});
