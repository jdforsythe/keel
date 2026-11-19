// @vitest-environment happy-dom
// Red-team 0207 (rfc:0070): a field that was ever a password field stays masked for the rest of the ctx. Seed 1337.
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";
import { mount } from "../src/index.ts";
import { clone, on, template } from "../src/ops/index.ts";

const PAGE = template(
  '<form id="f"><input id="pw" type="password"><input id="ac" autocomplete="username current-password"><input id="plain"><button id="show" type="button">show</button></form>',
);

const setup = () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const got: CtxEvent[] = [];
  observe(ctx, (e) => got.push(e));
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = mount(
    () => {
      const f = clone(PAGE);
      on("show", "click", () => f.querySelector("#pw")?.setAttribute("type", "text"));
      return f;
    },
    host,
    { ctx },
  );
  const el = (id: string): Element => {
    const e = host.querySelector(`#${id}`);
    if (e === null) throw new Error(`no #${id}`);
    return e;
  };
  const type = (id: string, value: string): void => {
    Reflect.set(el(id), "value", value);
    el(id).dispatchEvent(new Event("input", { bubbles: true }));
  };
  const key = (id: string, k: string): void => {
    el(id).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: k }));
  };
  const click = (id: string): void => {
    el(id).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  const done = (): void => {
    dispose();
    host.remove();
  };
  return { got, type, key, click, done };
};

const values = (got: CtxEvent[], id: string): string[] =>
  got.flatMap((e) =>
    e.kind === "fire" && e.id === id
      ? [e.event.type === "input" ? e.event.value : e.event.type === "keydown" ? e.event.key : e.event.type]
      : [],
  );

test("after a show-password toggle the field's values and one-character keys stay masked", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.string({ minLength: 1, maxLength: 8 }),
      (before, after) => {
        const t = setup();
        t.type("pw", before);
        t.click("show");
        t.type("pw", after);
        t.key("pw", "a");
        t.key("pw", "Enter");
        expect(values(t.got, "pw")).toEqual(["x".repeat(before.length), "x".repeat(after.length), "x", "Enter"]);
        t.done();
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("a field toggled before it is first typed in stays masked: the toggle's click saw it as a password field", () => {
  const t = setup();
  t.click("show");
  t.type("pw", "hunter2");
  expect(values(t.got, "pw")).toEqual(["xxxxxxx"]);
  t.done();
});

test("an autocomplete current-password field is masked; a plain field is not", () => {
  const t = setup();
  t.type("ac", "s3cret");
  t.type("plain", "hello");
  expect(values(t.got, "ac")).toEqual(["xxxxxx"]);
  expect(values(t.got, "plain")).toEqual(["hello"]);
  t.done();
});
