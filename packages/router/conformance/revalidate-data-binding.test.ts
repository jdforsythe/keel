// Spec: k.router, Conformance "After an `ok(null)` action, a binding reading `props.data` shows the new value and the page keeps its nodes and focus."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMPTIONS (as in fixtures.ts): createRouter(routes, { ctx, history }) returns { App, dispose }; a `Form` is called as a function with
// `children: () => Node[]`; `props.data` is read inside a binding (`text`), and shows the loader's `ok` value as the page's props hold it.
import { createCtx } from "@keel/ctx";
import { Form, action, createRouter, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, settle } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const Count = s.object({ n: s.int({ min: 0, max: 1000000 }) });
const Note = s.object({ note: s.string({ min: 0, max: 20 }) });

const control: { loads: number; builds: number; atBuild: string[] } = { loads: 0, builds: 0, atBuild: [] };

const numberOf = (data: unknown): string => {
  const n: unknown = typeof data === "object" && data !== null ? Reflect.get(data, "n") : undefined;
  return typeof n === "number" ? String(n) : "none";
};

const link = contract("link", {
  "link.page": { path: "/rev" },
});

const links = manifest(link, {
  "link.page": { component: () => document.createElement("p") },
});

const page = (props: RouteProps): Node => {
  control.builds++;
  control.atBuild.push(numberOf(props.data)); // a top-level read: the value at build
  const main = document.createElement("main");
  main.id = "rev.page";
  const shown = document.createElement("p");
  shown.id = "rev.n";
  text(shown, () => numberOf(props.data)); // a binding reading props.data
  const note = document.createElement("label");
  note.append("Note ");
  const field = document.createElement("input");
  field.id = "rev.note";
  field.name = "note";
  field.value = "hello";
  note.append(field);
  const save = document.createElement("button");
  save.id = "rev.save";
  save.setAttribute("type", "submit");
  save.textContent = "Save";
  const form = Form({ method: "POST", action: link.href("link.page"), children: () => [note, save] });
  form.id = "rev.form";
  main.append(shown, form);
  return main;
};

const revContract = contract("rev", {
  "rev.page": { path: "/rev" },
});

const read = loader(revContract, "rev.page", { output: Count }, async () => {
  control.loads++;
  return ok({ n: control.loads });
});
const write = action(revContract, "rev.page", { input: Note }, async () => ok(null));
const routes = manifest(revContract, {
  "rev.page": { loader: read, component: page, POST: write },
});

const open = async () => {
  control.loads = 0;
  control.builds = 0;
  control.atBuild = [];
  const entries: string[] = ["/rev"];
  const router = createRouter(routes, {
    ctx: createCtx({ mode: "sim", seed: SEED }),
    history: {
      push: (url) => {
        entries.push(url);
      },
      replace: (url) => {
        entries[entries.length - 1] = url;
      },
      current: () => entries[entries.length - 1] ?? "/rev",
      onPop: () => undefined,
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx: simCtx });
  await settle();
  return {
    host,
    teardown: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
};

const byId = (host: HTMLElement, id: string): Element => {
  const found = host.querySelector(`[id="${id}"]`);
  if (found === null) throw new Error(`fixture: no element ${id}`);
  return found;
};
const noteInput = (host: HTMLElement): HTMLElement => {
  const found = byId(host, "rev.note");
  if (!(found instanceof HTMLElement)) throw new Error("fixture: no note input");
  return found;
};
const submit = async (host: HTMLElement): Promise<void> => {
  byId(host, "rev.form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
};

afterEach(() => document.body.replaceChildren());

describe("k.router: revalidation updates a page's data in place", () => {
  it("After an `ok(null)` action, a binding reading `props.data` shows the new value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (times) => {
        const app = await open();
        expect(byId(app.host, "rev.n").textContent).toBe("1");
        for (let i = 1; i <= times; i++) {
          await submit(app.host);
          expect(byId(app.host, "rev.n").textContent).toBe(String(1 + i));
        }
        app.teardown();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("After an `ok(null)` action, the page keeps its nodes and focus", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (times) => {
        const app = await open();
        const pageEl = byId(app.host, "rev.page");
        const shown = byId(app.host, "rev.n");
        const input = noteInput(app.host);
        input.focus();
        expect(document.activeElement).toBe(input);
        for (let i = 0; i < times; i++) await submit(app.host);
        expect(control.loads).toBe(1 + times);
        expect(byId(app.host, "rev.page")).toBe(pageEl);
        expect(byId(app.host, "rev.n")).toBe(shown);
        expect(noteInput(app.host)).toBe(input);
        expect(document.activeElement).toBe(input);
        expect(control.builds).toBe(1);
        expect(control.atBuild).toEqual(["1"]);
        app.teardown();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
