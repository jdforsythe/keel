// Shared helpers for the k.resume replay and fallback suites (not a test file). Public API only.
// Components are the compiled sources the server rendered; the client side gets a `record` prop that appends to a log.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { resume } from "@keel/runtime-dom/ops";
import { type Component, q } from "./resume-app.ts";

/** A component that receives a `record(id)` prop appending to `log`. */
export function recording(component: Component, log: string[]): Component {
  const record = (id: string): void => {
    log.push(id);
  };
  return (props) => component(Object.assign({}, props, { record }));
}

export type LayoutOptions = {
  /** Markup ahead of everything else in the root: an element here makes a client component differ from the served one. */
  readonly pre?: string;
  /** A text control with an `onInput` handler. */
  readonly input?: boolean;
};

/** A layout island: a button `<k>.btn`, an output, and a wrapper element `<k>.wrap` with a handler around its slot. */
export const replayLayout = (k: string, o: LayoutOptions = {}): string => `import { signal } from "@keel/reactive";
export default function Layout(props) {
  const n = signal(0);
  if (props.record) props.record("${k}.built");
  return <div id="${k}.root">${o.pre ?? ""}<button id="${k}.btn" onClick={() => { props.record("${k}.btn"); n.set(n.get() + 1) }}>b</button><span id="${k}.out">{n.get()}</span>${o.input === true ? `<input id="${k}.name" value="a" onInput={() => props.record("${k}.name")} />` : ""}<section id="${k}.wrap" onClick={() => props.record("${k}.wrap")}>{props.children()}</section></div>
}
`;

/** A page island: a button `<k>.btn` that records, and calls `stopPropagation` when `stop`. */
export const replayPage = (
  k: string,
  o: { readonly stop?: boolean; readonly pre?: string; readonly input?: boolean } = {},
): string => `import { signal } from "@keel/reactive";
export default function Page(props) {
  const n = signal(0);
  if (props.record) props.record("${k}.built");
  return <div id="${k}.root">${o.pre ?? ""}<button id="${k}.btn" onClick={(e) => { props.record("${k}.btn"); ${o.stop === true ? "e.stopPropagation(); " : ""}n.set(n.get() + 1) }}>b</button><span id="${k}.out">{n.get()}</span>${o.input === true ? `<input id="${k}.name" value="b" onInput={() => props.record("${k}.name")} />` : ""}</div>
}
`;

/** Dispatches a bubbling click on the element `id`, as a user does before its island has resumed. */
export function clickNow(id: string): void {
  q(id).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** Types `value` into the control `id` without resuming. */
export function typeNow(id: string, value: string): void {
  const el = q(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`fixture: ${id} is not an input`);
  el.value = value;
}

export type Observed = {
  readonly events: readonly CtxEvent[];
  readonly warnings: readonly unknown[];
};

/** Resumes `document.body` on a sim ctx with an observer and returns what the observer saw. */
export function resumeObserved(components: Record<string, Component>): Observed {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  const { warnings } = resume(document.body, components, { ctx, mode: "dev" });
  return { events, warnings };
}

/** The observer's fires as `<type>:<id>`, in the order the observer got them. */
export function firedOf(events: readonly CtxEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) if (e.kind === "fire") out.push(`${e.event.type}:${e.id}`);
  return out;
}
