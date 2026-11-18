// Shared helpers for the k.resume conformance suite (not a test file). Public API only.
// Every case serves a real document through `createApp`, puts its body into the happy-dom document and resumes it
// with `resume` from `@keel/runtime-dom/ops`, using components compiled from the same TSX the server rendered.
// Property seed for every property: 1337.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { resume } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { expect, vi } from "vitest";

export const SEED = 1337;

export type Component = (props: RouteProps) => Node;

export function compileComponent(name: string, source: string): Component {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

/** One route level: a page (with `path`) or a layout (without), compiled from `source`. */
export type Level = {
  readonly id: string;
  readonly source: string;
  readonly path?: string;
  readonly layout?: string;
  /** The `title` its loader returns, read as `props.data.title`. */
  readonly title?: string;
};

const Data = s.object({ title: s.string() });

/** A level's loader, or none. */
function loaderOf(title: string | undefined) {
  return title === undefined ? {} : { loader: loader({ output: Data }, () => Promise.resolve(ok({ title }))) };
}

export type ServedDocument = {
  readonly status: number;
  /** The whole response text. */
  readonly text: string;
  /** The `<body>` markup. */
  readonly body: string;
};

export type Recorded = { readonly lines: string[] };

/** Serves `path` from an app made of `levels` and returns the document. */
export async function serve(
  levels: readonly Level[],
  path: string,
  options: { readonly mode?: "dev" | "production"; readonly log?: Recorded } = {},
): Promise<ServedDocument> {
  const entries: Record<string, ReturnType<typeof entryOf>> = {};
  for (const l of levels) entries[l.id] = entryOf(l);
  const modules = [...new Set(levels.map((l) => l.id.split(".")[0] ?? l.id))];
  const log = options.log;
  const app = await createApp({
    topology: topology({ web: { modules, adapter: "node" } }),
    routes: manifest(entries),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: options.mode ?? "production",
    ...(log === undefined ? {} : { log: { format: "compact", write: (line: string) => void log.lines.push(line) } }),
  });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  const text = await res.text();
  const body = new DOMParser().parseFromString(text, "text/html").body.innerHTML;
  return { status: res.status, text, body };
}

function entryOf(l: Level) {
  return {
    component: compileComponent(l.id, l.source),
    ...(l.path === undefined ? {} : { path: l.path }),
    ...(l.layout === undefined ? {} : { layout: l.layout }),
    ...loaderOf(l.title),
  };
}

/** The components `resume` takes, by route id; `override` swaps the source a level resumes with. */
export function componentsOf(
  levels: readonly Level[],
  override: Readonly<Record<string, string>> = {},
): Record<string, Component> {
  const out: Record<string, Component> = {};
  for (const l of levels) out[l.id] = compileComponent(l.id, override[l.id] ?? l.source);
  return out;
}

/** Puts the served body into the happy-dom document. */
export function install(doc: ServedDocument): void {
  document.body.innerHTML = doc.body;
}

export function elementsOf(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")];
}

/** The element a test addresses by id: a bound element carries it as `data-k`, a static one as `id`. */
export function q(id: string): Element {
  const el = document.querySelector(`[data-k="${id}"], [id="${id}"]`);
  if (el === null) throw new Error(`fixture: no element ${id}`);
  return el;
}

export function maybe(id: string): Element | null {
  return document.querySelector(`[data-k="${id}"], [id="${id}"]`);
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

export async function click(id: string): Promise<void> {
  q(id).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await settle();
}

export type Resumed = {
  readonly warnings: readonly unknown[];
  /** Everything the page wrote to the console while resuming. */
  readonly console: readonly string[];
};

/** Resumes `document.body` and records the warnings and any console output. */
export function resumeBody(components: Record<string, Component>, mode: "dev" | "production" = "dev"): Resumed {
  const seen: string[] = [];
  const spies = (["warn", "error", "info", "debug", "log"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void seen.push(args.map(String).join(" "))),
  );
  try {
    const { warnings } = resume(document.body, components, { ctx: createCtx({ mode: "sim", seed: 1337 }), mode });
    return { warnings, console: seen };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/** Expects every element captured before resume to be the very element in the document after it. */
export function expectKept(before: readonly Element[]): void {
  const after = elementsOf(document.body);
  expect(after).toHaveLength(before.length);
  before.forEach((el, i) => {
    expect(el.isConnected).toBe(true);
    expect(after[i]).toBe(el);
  });
}

/** The content of each pair of region comments under `root`, as a tree of nested arrays (one array per region). */
export function regionTree(root: Node): unknown[] {
  const top: unknown[] = [];
  const stack: unknown[][] = [top];
  const walk = (n: Node): void => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 8 && c.nodeValue === "[") {
        const next: unknown[] = [];
        stack[stack.length - 1]?.push(next);
        stack.push(next);
      } else if (c.nodeType === 8 && c.nodeValue === "]") {
        stack.pop();
      } else walk(c);
    }
  };
  walk(root);
  return top;
}

/** Every region's closing comment is directly followed by its anchor comment. */
export function everyRegionClosesBeforeAnAnchor(root: Node): boolean {
  const closers: Node[] = [];
  const walk = (n: Node): void => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 8 && c.nodeValue === "]") closers.push(c);
      walk(c);
    }
  };
  walk(root);
  return closers.every((c) => c.nextSibling?.nodeType === 8);
}

// ---- component sources ----------------------------------------------------------------------------------------

const COUNTER = (k: string): string =>
  `<button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span>`;

/** A layout island: a counter, its own title, and `slot` (default `{props.children()}`). */
export const islandLayout = (
  k: string,
  slot = "{props.children()}",
  pre = "",
): string => `${pre}import { signal } from "@keel/reactive";
export default function Layout(props) {
  const n = signal(0);
  return <div id="${k}.root"><h1>{props.data.title}</h1>${COUNTER(k)}${slot}</div>
}
`;

/** A static layout: no handler, no binding. */
export const staticLayout = (k: string): string => `export default function Mid(props) {
  return <section id="${k}.root"><h2>{props.data.title}</h2>{props.children()}</section>
}
`;

/** A page island: a counter, its own title, and `body`. */
export const islandPage = (k: string, body = ""): string => `import { signal } from "@keel/reactive";
export default function Page(props) {
  const n = signal(0);
  return <div id="${k}.root"><h3>{props.data.title}</h3>${COUNTER(k)}${body}</div>
}
`;

/** A page with a `Boundary` around a `Match` whose `list` case holds a `For` whose rows hold an `If`. */
export const structuralPage = (k: string): string => `import { signal } from "@keel/reactive";
import { Boundary, Case, For, If, Match } from "@keel/runtime-dom";
export default function Page(props) {
  const n = signal(0);
  const view = signal({ tag: "list" });
  const rows = signal([{ id: "a", on: true }, { id: "b", on: false }]);
  const flip = (id) => rows.set(rows.get().map((r) => (r.id === id ? { id: r.id, on: !r.on } : r)));
  return <div id="${k}.root">
    ${COUNTER(k)}
    <button id="${k}.flipa" onClick={() => flip("a")}>a</button>
    <button id="${k}.flipb" onClick={() => flip("b")}>b</button>
    <button id="${k}.add" onClick={() => rows.set([...rows.get(), { id: "c", on: true }])}>add</button>
    <button id="${k}.rm" onClick={() => rows.set(rows.get().filter((r) => r.id !== "a"))}>rm</button>
    <button id="${k}.view" onClick={() => view.set({ tag: view.get().tag === "list" ? "note" : "list" })}>view</button>
    <Boundary fallback={(e, reset) => <p id="${k}.err"><button id="${k}.retry" onClick={reset}>retry</button></p>}>
      <div id="${k}.inner">
        <button id="${k}.boom" onClick={() => { throw new Error("boom") }}>boom</button>
        <Match on={view.get()}>
          <Case tag="list"><ul id="${k}.list"><For each={rows.get()} key="id">{(r) => <li class="row"><span>{r.id}</span><If when={r.on}><b class="on">on</b></If></li>}</For></ul></Case>
          <Case tag="note"><p id="${k}.note">note</p></Case>
        </Match>
      </div>
    </Boundary>
  </div>
}
`;

/** A page whose `For` starts with no rows and an `empty` branch. */
export const emptyForPage = (k: string): string => `import { signal } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
export default function Page(props) {
  const n = signal(0);
  const rows = signal([]);
  return <div id="${k}.root">
    ${COUNTER(k)}
    <button id="${k}.add" onClick={() => rows.set([...rows.get(), { id: "r" + rows.get().length }])}>add</button>
    <ul id="${k}.list"><For each={rows.get()} key="id" empty={() => <li id="${k}.none">none</li>}>{(r) => <li class="row">{r.id}</li>}</For></ul>
  </div>
}
`;

/** A layout island whose slot is inside an `If`; it starts open when its loader's title is `open`. */
export const conditionalLayout = (k: string): string => `import { signal } from "@keel/reactive";
import { If } from "@keel/runtime-dom";
export default function Layout(props) {
  const n = signal(0);
  const open = signal(props.data.title === "open");
  return <div id="${k}.root">${COUNTER(k)}<button id="${k}.toggle" onClick={() => open.set(!open.get())}>toggle</button><If when={open.get()}>{props.children()}</If></div>
}
`;

export function expectText(id: string, text: string): void {
  expect(q(id).textContent).toBe(text);
}
