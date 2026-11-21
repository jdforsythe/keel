// Shared fixture for the `renderRoute` document-mode conformance files (not a test file). Seed 1337 for every property.
// One `node` page `f.page` holding a `<Form>` over a `form(Input)` with field `amount`; its POST action answers by `control.mode`:
// `fields` -> `err` `keel.fields` `{ amount: 'Too many decimals' }`, `href` -> `ok(<href of f.done>)`; `f.done` is a second page with a loader.
// ASSUMPTIONS (spec names no shape): a submit is `fire('f.amount', { type: 'input', value })` then `fire('f.form', { type: 'submit' })`; the field's
// value and error are read from `Text` nodes `f.shown` and `f.error` bound to `field.value()` and `field.error()`; `invalid` is `a11y('f.amount').state.invalid`.
// `renderRoute`'s `app` option is not in its type yet: options are passed as a variable, so no cast is needed and `tsc` stays green.
import { type Ctx, createCtx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form, action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { text } from "@keel/runtime-dom/ops";
import { err, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { Input } from "@keel/ui";
import { createApp } from "./fixtures.ts";

export const SEED = 1337;
export const MESSAGE = "Too many decimals";
export const simCtx = (): Ctx => createCtx({ mode: "sim", seed: SEED });

export const control: { mode: "fields" | "href"; posts: number; doneLoads: number } = {
  mode: "fields",
  posts: 0,
  doneLoads: 0,
};
export const reset = (mode: "fields" | "href"): void => {
  control.mode = mode;
  control.posts = 0;
  control.doneLoads = 0;
};

const Amount = s.object({ amount: s.string({ min: 1 }) });
const Empty = s.object({});
const fc = contract("f", { "f.page": { path: "/f" }, "f.done": { path: "/done" } });

const el = (tag: string, id: string): HTMLElement => {
  const e = document.createElement(tag);
  e.id = id;
  return e;
};
const page = (): Node => {
  const f = form(Amount);
  const main = el("main", "f.root");
  const shown = el("p", "f.shown");
  text(shown, () => String(f.field("amount").value() ?? ""));
  const shownErr = el("p", "f.error");
  text(shownErr, () => String(f.field("amount").error() ?? ""));
  const save = el("button", "f.save");
  save.setAttribute("type", "submit");
  save.textContent = "save";
  const fm = Form({
    method: "POST",
    action: fc.href("f.page"),
    form: f,
    children: () => [Input({ id: "f.amount", field: f.field("amount"), label: "Amount" }), save],
  });
  fm.id = "f.form";
  main.append(shown, shownErr, fm);
  return main;
};

const save = action(fc, "f.page", { input: Amount }, async () => {
  control.posts++;
  if (control.mode === "fields") return err({ code: "keel.fields", message: "fields", data: { amount: MESSAGE } });
  return ok(fc.href("f.done"));
});
const done = loader(fc, "f.done", { output: Empty }, async () => {
  control.doneLoads++;
  return ok({});
});
export const routes = manifest(fc, {
  "f.page": { component: page, POST: save },
  "f.done": { component: () => el("p", "f.doneText"), loader: done },
});

/** An app for the `node` deployable serving `f` on `ctx`, wrapped so each request it receives is recorded as `METHOD /path`. */
export async function appOn(ctx: Ctx) {
  const inner = await createApp({
    topology: topology({ web: { modules: ["f"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  const requests: string[] = [];
  return {
    requests,
    fetch: (req: Request): Promise<Response> => {
      requests.push(`${req.method} ${new URL(req.url).pathname}`);
      return inner.fetch(req);
    },
  };
}
