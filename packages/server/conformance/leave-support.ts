// Helpers for the k.leave suites (not a test file). Public API only. Property seed for every property: 1337.
// Pages are TSX compiled at run time; `createApp` serves them and a test reads the document it answers.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as reactive from "@keel/reactive";
import type { RouteProps } from "@keel/router";
import * as schema from "@keel/schema";
import * as storeModule from "@keel/store";

export const SEED = 1337;

export type Component = (props: RouteProps) => Node;

const MODULES: Record<string, unknown> = {
  "@keel/store": storeModule,
  "@keel/schema": schema,
  "@keel/reactive": reactive,
};

/** Compiles `source` as the default export of `<name>.tsx` and returns it as a route component. */
export function compileLevel(name: string, source: string): Component {
  const r = compile([{ path: `${name}.tsx`, source }]);
  if (r.diagnostics.length > 0) throw new Error(`fixture: ${name} does not compile: ${JSON.stringify(r.diagnostics)}`);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, MODULES);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const HEAD = `import { signal } from "@keel/reactive";
import { store, stores } from "@keel/store";
import { s } from "@keel/schema";
`;

/** An island page (it has a handler and a binding) whose render runs `body` first. */
export const islandPage = (body: string): string => `${HEAD}export default function Page(props) {
  const n = signal(0);
  ${body}
  return <div id="page"><button id="page.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="page.out">{n.get()}</span></div>
}
`;

/** A static page: no handler, no binding. */
export const staticPage = (body: string): string => `${HEAD}export default function Page(props) {
  ${body}
  return <div id="page">static</div>
}
`;

/** A static layout whose render runs `body` first. */
export const staticLayout = (body: string): string => `${HEAD}export default function Layout(props) {
  ${body}
  return <section id="layout">{props.children()}</section>
}
`;

/** The `#k-state` of a served document, parsed. */
export function stateOf(text: string): { readonly stores: Record<string, unknown>; readonly raw: unknown } {
  const el = new DOMParser().parseFromString(text, "text/html").getElementById("k-state");
  if (el === null) throw new Error("fixture: no #k-state");
  const raw: unknown = JSON.parse(el.textContent ?? "null");
  if (typeof raw !== "object" || raw === null) throw new Error("fixture: #k-state is not an object");
  const stores: unknown = Reflect.get(raw, "stores");
  if (typeof stores !== "object" || stores === null) throw new Error("fixture: #k-state has no stores");
  return { stores: Object.fromEntries(Object.entries(stores)), raw };
}

export const hasModuleScript = (text: string): boolean => /<script[^>]*type="module"/.test(text);
