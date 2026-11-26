// @vitest-environment happy-dom
// k.testing Harness: `fire(id, { type: 'submit' })` goes where a browser sends it. A `<Form>` has no id, so a submit
// event fired at its submit button reaches the form with the button as submitter, as the browser's submit does; fired
// at the form it reaches the form. With `app`, a valid submit is one POST. Seed 1337.
import { createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MODULES, compilePage } from "../conformance/claim-support.ts";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const Amount = s.object({ amount: s.string({ min: 1 }) });
const fc1 = contract("fs", { "fs.page": { path: "/fs" }, "fs.done": { path: "/fs-done" } });
const PAGE = `import * as forms from "@keel/forms";
import { Form } from "@keel/router";
import { s } from "@keel/schema";
import { Button, Input } from "@keel/ui";
const Amount = s.object({ amount: s.string({ min: 1 }) });
export default function Page() {
  const f = forms.form(Amount);
  return <div id="fs.root">
    <Form method="POST" action="/fs" form={f}>
      <Input id="fs.amount" field={f.field("amount")} label="Amount" />
      <Button id="fs.save" type="submit">Save</Button>
    </Form>
  </div>
}
`;
const page = compilePage("fs.page", PAGE, { ...MODULES, "@keel/forms": forms, "@keel/schema": schema });
const routes = manifest(fc1, {
  "fs.page": { component: page, POST: action(fc1, "fs.page", { input: Amount }, async () => ok(fc1.href("fs.done"))) },
  "fs.done": { component: () => Object.assign(document.createElement("p"), { id: "fs.doneText" }) },
});
const served = async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const app = await createApp({ topology: topology({ web: { modules: ["fs"], adapter: "node" } }), routes, ctx });
  return { ctx, app };
};

describe("fire submit at a Form's submit button, with app", () => {
  test("a valid submit sends one POST then follows the 303, as a click on the button does", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.constantFrom<"submit" | "click">("submit", "click"),
        async (value, type) => {
          const { ctx, app } = await served();
          const t = await renderRoute("fs.page", { routes, ctx, app });
          await t.fire("fs.amount", { type: "input", value });
          await t.fire("fs.save", { type });
          expect(t.requests().map((r) => r.method)).toEqual(["GET", "POST", "GET"]);
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 6 },
    );
  });

  test("an invalid submit sends no POST", async () => {
    const { ctx, app } = await served();
    const t = await renderRoute("fs.page", { routes, ctx, app });
    await t.fire("fs.save", { type: "submit" });
    expect(t.requests().map((r) => r.method)).toEqual(["GET"]);
    t.dispose();
  });
});
