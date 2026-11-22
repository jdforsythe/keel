// Shared fixture for the `renderRoute` document-mode conformance files (not a test file). Seed 1337 for every property.
// One `node` page `f.page` holding a `<Form>` over a `form(Input)` with field `amount`; its POST action answers by `control.mode`:
// `fields` -> `err` `keel.fields` `{ amount: 'Too many decimals' }`, `href` -> `ok(<href of f.done>)`; `f.done` is a second page with a loader.
// The page is TSX compiled through `compilePage` (claim-support.ts), so its island resumes. ASSUMPTIONS (spec names no shape): a submit is
// `fire('f.amount', { type: 'input', value })` then `fire('f.save', { type: 'click' })` on the submit control; the field's
// value and error are read from `Text` nodes `f.shown` and `f.error` bound to `field.value()` and `field.error()`; `invalid` is `a11y('f.amount').state.invalid`.
// `renderRoute`'s `app` option is not in its type yet: options are passed as a variable, so no cast is needed and `tsc` stays green.
import { type Ctx, createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as schema from "@keel/schema";
import { err, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { MODULES, compilePage } from "./claim-support.ts";
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

const PAGE = `import * as forms from "@keel/forms";
import { Form } from "@keel/router";
import { s } from "@keel/schema";
import { Input, Text } from "@keel/ui";
const Amount = s.object({ amount: s.string({ min: 1 }) });
export default function Page() {
  const f = forms.form(Amount);
  return <div id="f.root">
    <Text id="f.shown">{String(f.field("amount").value() ?? "")}</Text>
    <Text id="f.error">{String(f.field("amount").error() ?? "")}</Text>
    <Form method="POST" action="/f" form={f}>
      <Input id="f.amount" field={f.field("amount")} label="Amount" />
      <button id="f.save" type="submit">save</button>
    </Form>
  </div>
}
`;
const page = compilePage("f.page", PAGE, { ...MODULES, "@keel/forms": forms, "@keel/schema": schema });

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
  "f.done": { component: () => Object.assign(document.createElement("p"), { id: "f.doneText" }), loader: done },
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
