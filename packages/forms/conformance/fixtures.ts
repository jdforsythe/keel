// Shared harness for k.forms conformance. Not a test file.
// ASSUMED router seam (same as packages/router/conformance/fixtures.ts):
//   createRouter(routes, { ctx, history }) -> { navigate, route, dispose, App }; manifest, action, Form from @keel/router.
//   history is the in-memory { push, replace, current, onPop } defined below (copied, not imported).
//   Form is called as a function and returns a DOM Node; slots return Nodes. Inputs are plain DOM bound via Field.bind.
// Seed 1337 for all fast-check runs (see SEED).
import { createCtx } from "@keel/ctx";
import { form } from "@keel/forms";
import { effect } from "@keel/reactive";
import { Form, type Href, action, createRouter, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { type KeelError, type Result, ok, s } from "@keel/schema";

export const SEED = 1337;
export const RUNS = 25;

export const Note = s.object({
  title: s.string({ min: 1 }),
  email: s.string({ min: 3 }),
  age: s.int({ min: 0 }),
});
export type Field = "title" | "email" | "age";
export const FIELDS: readonly Field[] = ["title", "email", "age"];
export const VALID: Record<Field, string> = { title: "hello", email: "a@b.c", age: "30" };
export const INVALID: Record<Field, string> = { title: "", email: "a", age: "-1" };

export type Outcome = Result<Href | null, KeelError<string, unknown>>;
export type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };

export function deferred<T>(): Deferred<T> {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

export function must<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new Error(`missing ${what}`);
  return v;
}

export function fieldInput(root: Element, name: string): HTMLInputElement {
  const el = root.querySelector(`[name="${name}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no input ${name}`);
  return el;
}

// ---- in-memory history
export type MemoryHistory = {
  push(url: string): void;
  replace(url: string): void;
  current(): string;
  onPop(fn: (url: string) => void): void;
  back(): void;
  forward(): void;
  external(url: string): void;
};
export function memoryHistory(start: string): MemoryHistory {
  const entries: string[] = [start];
  let at = 0;
  const subs: ((url: string) => void)[] = [];
  const current = (): string => entries[at] ?? start;
  const pop = (): void => {
    for (const fn of subs) fn(current());
  };
  const push = (url: string): void => {
    entries.splice(at + 1);
    entries.push(url);
    at += 1;
  };
  return {
    push,
    replace: (url) => {
      entries[at] = url;
    },
    current,
    onPop: (fn) => {
      subs.push(fn);
    },
    back: () => {
      if (at > 0) at -= 1;
      pop();
    },
    forward: () => {
      if (at < entries.length - 1) at += 1;
      pop();
    },
    external: (url) => {
      push(url);
      pop();
    },
  };
}

// Plain DOM binding per the k.forms Field contract: bind(el), and error text under field.errorId.
type BoundField = {
  errorId: string;
  error(): string | undefined;
  bind(el: HTMLInputElement): () => void;
};
function plainInput(field: BoundField): Node {
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
}
function plainSubmit(): Node {
  const b = document.createElement("button");
  b.type = "submit";
  b.textContent = "Save";
  return b;
}

export type Harness = {
  root: HTMLElement;
  f: ReturnType<typeof form<typeof Note>>;
  calls: unknown[];
  handler: { current: (input: unknown) => Promise<Outcome> | Outcome };
  type(name: Field, value: string): void;
  blur(name: Field): void;
  fill(values: Record<Field, string>): void;
  submit(): Promise<void>;
  dispose(): void;
};

export function setup(opts: { order?: readonly Field[]; initial?: Record<string, unknown> } = {}): Harness {
  const order = opts.order ?? FIELDS;
  const calls: unknown[] = [];
  const handler: Harness["handler"] = { current: () => ok(null) };
  const save = action({ input: Note }, async (input: unknown): Promise<Outcome> => {
    calls.push(input);
    return handler.current(input);
  });
  const holder: { f?: Harness["f"] } = {};
  // Annotated: the Form's action reads `routes`, whose manifest holds Page (TS7022 otherwise).
  const Page = (): HTMLFormElement => {
    const f = form(Note, opts.initial === undefined ? {} : { initial: opts.initial });
    holder.f = f;
    return Form({
      method: "POST",
      action: routes.href("notes.edit"),
      form: f,
      error: (e: { message: string }) => {
        const d = document.createElement("div");
        d.setAttribute("data-slot", "error");
        d.textContent = e.message;
        return d;
      },
      children: [...order.map((n) => plainInput(f.field(n))), plainSubmit()],
    });
  };
  const routes = manifest({
    "notes.edit": { path: "/notes", component: Page },
  });
  routes.actions({ "notes.edit": { POST: save } });
  const ctx = createCtx({ mode: "sim" });
  const router = createRouter(routes, { ctx, history: memoryHistory("/notes") });
  const root = document.createElement("div");
  document.body.appendChild(root);
  const disposeMount = mount(router.App, root);
  const f = must(holder.f, "form handle");
  const fire = (name: Field, type: string) =>
    fieldInput(root, name).dispatchEvent(new Event(type, { bubbles: type !== "blur" && type !== "focus" }));
  const h: Harness = {
    root,
    f,
    calls,
    handler,
    type(name, value) {
      fieldInput(root, name).value = value;
      fire(name, "input");
    },
    blur(name) {
      fire(name, "blur");
    },
    fill(values) {
      for (const n of FIELDS) h.type(n, values[n]);
    },
    async submit() {
      const fe = must(root.querySelector("form"), "form element");
      fe.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await settle();
    },
    dispose() {
      disposeMount();
      root.remove();
    },
  };
  return h;
}
