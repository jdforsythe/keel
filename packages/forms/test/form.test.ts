// @vitest-environment happy-dom
// fast-check seed: 1337
import { type Scope, effect, scope } from "@keel/reactive";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { type Field, type FormState, form } from "../src/index.ts";
import { settle } from "./support/settle.ts";
import { type Reply, standInForm } from "./support/standInForm.ts";

const SEED = 1337;
const Note = s.object({
  title: s.string({ min: 1 }),
  email: s.string({ min: 3 }),
  age: s.int(),
  tag: s.string().optional(),
  done: s.boolean(),
});
type Name = "title" | "email" | "age";
const NAMES: readonly Name[] = ["title", "email", "age"];
const VALID: Record<Name, string> = { title: "hello", email: "a@b.c", age: "30" };
const INVALID: Record<Name, string> = { title: "", email: "a", age: "x" };

type Rig = {
  f: FormState<s.infer<typeof Note>>;
  root: HTMLFormElement;
  input(name: string): HTMLInputElement;
  type(name: Name, text: string): void;
  submit(): Promise<void>;
  sent: unknown[];
  reply: { current: () => Promise<Reply> | Reply };
  scope: Scope;
};
const rigs: Rig[] = [];
afterEach(() => {
  for (const r of rigs.splice(0)) {
    r.scope.dispose();
    r.root.remove();
  }
});

function plain(field: Field<unknown>, type = "text"): Node {
  const wrap = document.createElement("div");
  const el = document.createElement("input");
  el.type = type;
  const msg = document.createElement("span");
  msg.id = field.errorId;
  field.bind(el);
  effect(() => {
    msg.textContent = field.error() ?? "";
  });
  wrap.append(el, msg);
  return wrap;
}

function rig(order: readonly Name[] = NAMES, initial: Partial<s.infer<typeof Note>> = {}): Rig {
  const sent: unknown[] = [];
  const reply: Rig["reply"] = { current: () => ok(null) };
  const holder: { f?: Rig["f"]; root?: HTMLFormElement } = {};
  const sc = scope(() => {
    const f = form(Note, { initial });
    holder.f = f;
    holder.root = standInForm(
      f,
      (v) => {
        sent.push(v);
        return reply.current();
      },
      [...order.map((n) => plain(f.field(n))), plain(f.field("done"), "checkbox")],
    );
  });
  const f = holder.f;
  const root = holder.root;
  if (f === undefined || root === undefined) throw new Error("rig");
  document.body.append(root);
  const input = (name: string): HTMLInputElement => {
    const el = root.querySelector(`[name="${name}"]`);
    if (!(el instanceof HTMLInputElement)) throw new Error(`no input ${name}`);
    return el;
  };
  const r: Rig = {
    f,
    root,
    input,
    sent,
    reply,
    scope: sc,
    type(name, text) {
      input(name).value = text;
      input(name).dispatchEvent(new Event("input", { bubbles: true }));
    },
    async submit() {
      root.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await settle();
    },
  };
  rigs.push(r);
  return r;
}
const fill = (r: Rig, v: Record<Name, string>): void => {
  for (const n of NAMES) r.type(n, v[n]);
};
const badArb = fc.record({ title: fc.boolean(), email: fc.boolean(), age: fc.boolean() });

describe("submit", () => {
  it("invalid values: nothing sent, every invalid field has an error, first invalid in document order focused", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([...NAMES], { minLength: 3, maxLength: 3 }), badArb, (order, bad) => {
        fc.pre(bad.title || bad.email || bad.age);
        const r = rig(order);
        fill(r, { title: bad.title ? "" : "t", email: bad.email ? "a" : "abc", age: bad.age ? "x" : "1" });
        r.root.dispatchEvent(new Event("submit", { cancelable: true }));
        expect(r.sent).toEqual([]);
        expect(Object.keys(r.f.errors()).sort()).toEqual(NAMES.filter((n) => bad[n]).sort());
        expect(document.activeElement).toBe(r.input(order.find((n) => bad[n]) ?? ""));
        r.scope.dispose();
        r.root.remove();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("valid values: sends the typed value; pending until the reply; ok resets to initial", async () => {
    let release: (v: Reply) => void = () => {};
    const r = rig(NAMES, { title: "seed" });
    expect(r.input("title").value).toBe("seed");
    r.reply.current = () =>
      new Promise<Reply>((res) => {
        release = res;
      });
    fill(r, VALID);
    r.input("done").checked = true;
    r.input("done").dispatchEvent(new Event("input"));
    await r.submit();
    expect(r.sent).toEqual([{ title: "hello", email: "a@b.c", age: 30, done: true }]);
    expect(r.f.pending()).toBe(true);
    release(ok(null));
    await settle();
    expect(r.f.pending()).toBe(false);
    expect(r.f.values()).toEqual({ title: "seed", done: false });
    expect(r.input("title").value).toBe("seed");
    expect(r.input("age").value).toBe("");
    expect(r.input("done").checked).toBe(false);
  });

  it("keel.fields sets exactly the listed errors, then the next reply replaces them", async () => {
    await fc.assert(
      fc.asyncProperty(fc.subarray([...NAMES]), fc.subarray([...NAMES]), async (a, b) => {
        const r = rig();
        fill(r, VALID);
        const reply = (names: readonly string[]): Reply =>
          err({ code: "keel.fields", message: "f", data: Object.fromEntries(names.map((n) => [n, `bad ${n}`])) });
        r.reply.current = () => reply(a);
        await r.submit();
        expect(Object.keys(r.f.errors()).sort()).toEqual([...a].sort());
        r.reply.current = () => reply(b);
        await r.submit();
        expect(r.f.errors()).toEqual(Object.fromEntries(b.map((n) => [n, `bad ${n}`])));
        r.scope.dispose();
        r.root.remove();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("any other err leaves values and field errors unchanged (the router's error slot shows it)", async () => {
    const r = rig();
    fill(r, VALID);
    const before = r.f.values();
    r.reply.current = () => err({ code: "keel.unexpected", message: "boom", data: null });
    await r.submit();
    expect(r.root.querySelector('[data-slot="error"]')?.textContent).toBe("boom");
    expect(r.f.values()).toEqual(before);
    expect(r.f.errors()).toEqual({});
  });

  it("every schema issue is reported; issues no field() covers are summarised under ''", () => {
    scope(() => {
      const f = form(s.object({ a: s.string({ min: 1 }), b: s.int(), c: s.object({ d: s.string() }) }));
      const a = f.field("a");
      const el = document.createElement("input");
      document.body.append(el);
      a.bind(el);
      const r = f.validate();
      expect(r.ok).toBe(false);
      expect(f.errors()).toEqual({
        a: "Required",
        b: "Required",
        c: "Required",
        "": "b: Required (+1 more)",
      });
      expect(document.activeElement).toBe(el);
      el.remove();
    }).dispose();
  });

  it("focus skips disconnected bound elements", () => {
    scope(() => {
      const f = form(s.object({ a: s.string({ min: 1 }), b: s.string({ min: 1 }) }));
      const gone = document.createElement("input");
      const here = document.createElement("input");
      document.body.append(here);
      f.field("a").bind(gone);
      f.field("b").bind(here);
      f.validate();
      expect(document.activeElement).toBe(here);
      here.remove();
    }).dispose();
  });
});

describe("field validation", () => {
  it("validates on blur, then on every input once an error has shown", () => {
    const r = rig();
    r.type("title", "");
    expect(r.f.errors()).toEqual({});
    r.input("title").dispatchEvent(new Event("blur"));
    expect(r.f.field("title").touched()).toBe(true);
    expect(r.f.errors().title).toBe("Must be at least 1 character");
    r.type("title", "x");
    expect(r.f.errors().title).toBeUndefined();
    r.type("title", "");
    expect(r.f.errors().title).toBe("Must be at least 1 character");
  });

  it("uncoercible number text stays in the input, is absent from values, and fails with type", () => {
    const r = rig();
    r.type("age", "12x");
    expect(r.f.values()).toEqual({ done: false });
    expect(r.input("age").value).toBe("12x");
    r.f.field("age").blur();
    expect(r.f.errors().age).toBe("Must be a number");
    r.type("age", "12");
    expect(r.f.values()).toEqual({ age: 12, done: false });
    expect(r.f.errors().age).toBeUndefined();
  });

  it("empty text for an optional key is absent", () => {
    const r = rig();
    const tag = r.f.field("tag");
    tag.set("x");
    expect(r.f.values()).toEqual({ tag: "x", done: false });
    tag.set(undefined);
    expect(r.f.values()).toEqual({ done: false });
  });

  it("aria-invalid and aria-describedby follow the error; other describedby ids are kept", () => {
    const r = rig();
    const el = r.input("email");
    el.setAttribute("aria-describedby", "hint");
    const f = r.f.field("email");
    f.set("a");
    f.blur();
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("aria-describedby")).toBe(`hint ${f.errorId}`);
    expect(document.getElementById(f.errorId)?.textContent).toBe(r.f.errors().email);
    f.set("abc");
    expect(el.hasAttribute("aria-invalid")).toBe(false);
    expect(el.getAttribute("aria-describedby")).toBe("hint");
  });

  it("reset clears values, errors, touched, and the action error", () => {
    const r = rig();
    fill(r, INVALID);
    r.f.field("title").blur();
    r.f.reset();
    expect(r.f.values()).toEqual({ done: false });
    expect(r.f.errors()).toEqual({});
    expect(r.f.field("title").touched()).toBe(false);
  });
});

describe("binding lifecycle", () => {
  it("bind sets name and id; unbind stops listening; scope disposal unbinds", () => {
    const r = rig();
    const el = document.createElement("input");
    const title = r.f.field("title");
    const unbind = scope(() => {}).dispose;
    unbind();
    const sc = scope(() => {
      title.bind(el);
    });
    expect(el.name).toBe("title");
    expect(el.id).toBe(title.id);
    el.value = "typed";
    el.dispatchEvent(new Event("input"));
    expect(title.value()).toBe("typed");
    sc.dispose();
    el.value = "after";
    el.dispatchEvent(new Event("input"));
    expect(title.value()).toBe("typed");
  });

  it("an explicit element id wins: field.id and errorId derive from it", () => {
    const r = rig();
    const el = document.createElement("input");
    el.id = "my-title";
    const title = r.f.field("title");
    const bare = document.createElement("input");
    const email = r.f.field("email");
    const sc = scope(() => {
      title.bind(el);
      email.bind(bare);
    });
    expect(el.id).toBe("my-title");
    expect(title.id).toBe("my-title");
    expect(title.errorId).toBe("my-title:error");
    expect(bare.id).toBe(email.id);
    expect(email.id).toMatch(/:email$/);
    sc.dispose();
  });

  it("the returned unbind detaches the element", () => {
    const r = rig();
    const el = document.createElement("input");
    const title = r.f.field("title");
    let unbind: () => void = () => {};
    scope(() => {
      unbind = title.bind(el);
    });
    unbind();
    el.value = "x";
    el.dispatchEvent(new Event("input"));
    expect(title.value()).toBeUndefined();
  });
});
