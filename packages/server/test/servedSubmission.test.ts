// @vitest-environment happy-dom
// k.forms Submit ("Without JS the server ... re-renders the page with the submitted values ... and errors"), k.mount
// Form (a `<Form>` with no router posts natively): an action's `keel.fields` answer on a node page re-renders the
// bound controls with the submitted values, `aria-invalid` and the error text, and resume keeps them. Seed: 1337 (no
// generated inputs).
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as schema from "@keel/schema";
import { afterEach, describe, expect, it } from "vitest";
import * as forms from "../../forms/src/index.ts";
import { MODULES, compilePage } from "../conformance/claim-support.ts";
import { install, resumeBody, settle } from "../conformance/resume-app.ts";
import { appOf } from "../conformance/resume-graph-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const IMPORTS = { ...MODULES, "@keel/forms": forms, "@keel/schema": schema };

const SOURCE = `import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Form } from "@keel/router";
import { Button, Input } from "@keel/ui";
const Pay = s.object({ shop: s.string({ min: 1 }), amount: s.string() });
export default function Page() {
  const f = form(Pay, { id: "pay", initial: { amount: "" } });
  return <Form method="POST" action="/pay" form={f}>
    <Input field={f.field("shop")} label="Shop" />
    <Input field={f.field("amount")} label="Amount" />
    <Button id="pay.save" type="submit">Save</Button>
  </Form>
}
`;

const Pay = schema.s.object({ shop: schema.s.string({ min: 1 }), amount: schema.s.string() });
const Fields = schema.s.error("keel.fields", schema.s.object({ amount: schema.s.string() }));

async function posted(): Promise<{ status: number; body: string; page: ReturnType<typeof compilePage> }> {
  const page = compilePage("pay.page", SOURCE, IMPORTS);
  const c = contract("pay", { "pay.page": { path: "/pay" } });
  const routes = manifest(c, {
    "pay.page": {
      component: page,
      POST: action(c, "pay.page", { input: Pay }, () =>
        Promise.resolve(schema.err(Fields.make({ amount: "Two decimals at most" }))),
      ),
    },
  });
  const app = await appOf(routes, ["pay"], { mode: "dev" });
  const res = await app.fetch(
    new Request("http://localhost/pay", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "sec-fetch-site": "same-origin" },
      body: new URLSearchParams({ shop: "Corner shop", amount: "12.345" }),
    }),
  );
  return {
    status: res.status,
    body: new DOMParser().parseFromString(await res.text(), "text/html").body.innerHTML,
    page,
  };
}

describe("a keel.fields answer to a native post", () => {
  it("re-renders the controls with the submitted values, aria-invalid and the error text", async () => {
    const { status, body } = await posted();
    expect(status).toBe(422);
    install({ status, text: body, body });
    const amount = document.getElementById("pay:amount");
    expect(amount?.getAttribute("value")).toBe("12.345");
    expect(amount?.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("pay:amount:error")?.textContent).toBe("Two decimals at most");
    expect(document.getElementById("pay:shop")?.getAttribute("value")).toBe("Corner shop");
    expect(document.getElementById("pay:shop")?.hasAttribute("aria-invalid")).toBe(false);
  });

  it("keeps the values and the error after resume", async () => {
    const { status, body, page } = await posted();
    install({ status, text: body, body });
    const r = resumeBody({ "pay.page": page });
    await settle();
    expect(r.warnings).toEqual([]);
    const amount = document.getElementById("pay:amount");
    expect(amount instanceof HTMLInputElement && amount.value).toBe("12.345");
    expect(amount?.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("pay:amount:error")?.textContent).toBe("Two decimals at most");
    const shop = document.getElementById("pay:shop");
    expect(shop instanceof HTMLInputElement && shop.value).toBe("Corner shop");
  });
});
