// @vitest-environment happy-dom
// k.claim In place, k.runtime Islands and resume, k.forms Bindings: a form field typed into before resume, its control
// inside a structural op the server rendered, resumes in place: no warning, no element removed, the typed value,
// focus and caret kept, and the field holding the typed value. Seed: 1337 (no generated inputs).
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as schema from "@keel/schema";
import { afterEach, describe, expect, it } from "vitest";
import * as forms from "../../forms/src/index.ts";
import { MODULES, compilePage, observed, structural } from "../conformance/claim-support.ts";
import { install, q, resumeBody, settle } from "../conformance/resume-app.ts";
import { serveRoutes } from "../conformance/resume-graph-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const IMPORTS = { ...MODULES, "@keel/forms": forms, "@keel/schema": schema };

/** A page whose email field's `Input` sits where `wrap` puts it; `{F}` in `wrap` is that `Input`. */
const pageSource = (k: string, wrap: string): string => `import { computed, signal } from "@keel/reactive";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Form } from "@keel/router";
import { Boundary, Case, For, If, Match } from "@keel/runtime-dom";
import { Button, Input } from "@keel/ui";
const C = s.object({ email: s.string({ min: 3 }) });
export default function Page() {
  const f = form(C, { id: "${k}.form" });
  const email = computed(() => String(f.values().email ?? ""));
  const on = signal(true);
  const off = signal(false);
  const view = signal({ tag: "a" });
  const rows = signal([{ id: "r1" }]);
  return <div id="${k}.root">
    <button id="${k}.show" onClick={() => off.set(true)}>show</button>
    <span id="${k}.out">{email.get()}</span>
    <Form method="POST" action="/${k}/save" form={f}>
      ${wrap.replace("{F}", `<Input field={f.field("email")} label="Email" />`)}
      <Button id="${k}.submit" type="submit">go</Button>
    </Form>
  </div>
}
`;

type Shape = { readonly k: string; readonly title: string; readonly wrap: string };

const SHAPES: readonly Shape[] = [
  { k: "tf", title: "no structural op", wrap: "{F}" },
  { k: "ti", title: "an If branch", wrap: "<If when={on.get()}>{() => {F}}</If>" },
  {
    k: "tl",
    title: "an If fallback",
    wrap: '<If when={off.get()} fallback={() => {F}}>{() => <p id="tl.other">other</p>}</If>',
  },
  {
    k: "tm",
    title: "a Match case",
    wrap: '<Match on={view.get()}><Case tag="a">{F}</Case><Case tag="b"><p id="tm.other">other</p></Case></Match>',
  },
  { k: "tr", title: "a For row", wrap: '<For each={rows.get()} key="id">{(r) => {F}}</For>' },
  {
    k: "tb",
    title: "a Boundary",
    wrap: '<Boundary fallback={(e, reset) => <p id="tb.err">err</p>}>{F}</Boundary>',
  },
  {
    k: "tn",
    title: "an If nested in an If",
    wrap: "<If when={on.get()}>{() => <div><If when={on.get()}>{() => {F}}</If></div>}</If>",
  },
];

async function served(s: Shape): Promise<{ page: ReturnType<typeof compilePage>; input: HTMLInputElement }> {
  const page = compilePage(`${s.k}.page`, pageSource(s.k, s.wrap), IMPORTS);
  const routes = manifest(contract(s.k, { [`${s.k}.page`]: { path: `/${s.k}` } }), {
    [`${s.k}.page`]: { component: page },
  });
  install(await serveRoutes(routes, [s.k], `/${s.k}`));
  const input = document.querySelector("input");
  if (!(input instanceof HTMLInputElement)) throw new Error(`fixture: ${s.k} served no input`);
  return { page, input };
}

/** Resumes the body, recording the elements and region comments it removed. */
async function resumed(s: Shape, page: ReturnType<typeof compilePage>) {
  const { result, seen } = observed(document.body, () => resumeBody({ [`${s.k}.page`]: page }));
  await settle();
  return { warnings: result.warnings, console: result.console, removed: structural(seen.removed) };
}

describe("a field typed into before resume, its Input inside a structural op", () => {
  for (const s of SHAPES) {
    it(`${s.title}: a value set and an input dispatched resume in place, the field holding it`, async () => {
      const { page, input } = await served(s);
      input.value = "ada@example.com";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const r = await resumed(s, page);
      expect(r.warnings).toEqual([]);
      expect(r.console).toEqual([]);
      expect(r.removed).toEqual([]);
      expect(input.isConnected).toBe(true);
      expect(input.value).toBe("ada@example.com");
      expect(q(`${s.k}.out`).textContent).toBe("ada@example.com");
    });

    it(`${s.title}: focused and typed, with no input event, keeps focus, caret and value, the field holding it`, async () => {
      const { page, input } = await served(s);
      input.focus();
      input.value = "bo@example.com";
      input.setSelectionRange(2, 2);
      const r = await resumed(s, page);
      expect(r.warnings).toEqual([]);
      expect(r.removed).toEqual([]);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe("bo@example.com");
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(q(`${s.k}.out`).textContent).toBe("bo@example.com");
    });
  }

  it("an If branch hidden at server render, shown after resume, binds a fresh Input that takes typing", async () => {
    const s: Shape = { k: "th", title: "", wrap: "<If when={off.get()}>{() => {F}}</If>" };
    const page = compilePage("th.page", pageSource(s.k, s.wrap), IMPORTS);
    const routes = manifest(contract("th", { "th.page": { path: "/th" } }), { "th.page": { component: page } });
    install(await serveRoutes(routes, ["th"], "/th"));
    expect(document.querySelector("input")).toBe(null);
    const r = await resumed(s, page);
    expect(r.warnings).toEqual([]);
    expect(r.removed).toEqual([]);
    q("th.show").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    const input = document.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture: the shown branch has no input");
    input.value = "cy@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(q("th.out").textContent).toBe("cy@example.com");
  });
});
