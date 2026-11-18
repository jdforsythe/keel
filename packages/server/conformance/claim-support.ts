// Helpers for the k.claim suites (not a test file). Public API only.
// Pages are TSX compiled at run time (`compile` and `evaluate`); `createApp` serves them and a test resumes the served body
// either in place (`resume`, observed by a MutationObserver) or in a module graph of its own (`resumeDocument`).
// Property seed for every property: 1337.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as router from "@keel/router";
import type { RouteProps } from "@keel/router";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";

export const SEED = 1337;

export type Page = (props: RouteProps) => Node;

/** The packages a compiled page imports beyond the kernel's own. */
export const MODULES: Record<string, unknown> = { "@keel/ui": ui, "@keel/ui/aria": aria, "@keel/router": router };

/** Compiles `source` as the default export of `<name>.tsx` and returns it as a route component. */
export function compilePage(name: string, source: string, modules: Record<string, unknown> = MODULES): Page {
  const r = compile([{ path: `${name}.tsx`, source }]);
  if (r.diagnostics.length > 0) throw new Error(`fixture: ${name} does not compile: ${JSON.stringify(r.diagnostics)}`);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, modules);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

/** The lines of a log that name E1257, optionally only those naming `routeId`. */
export const e1257Lines = (lines: readonly string[], routeId?: string): string[] =>
  lines.filter((l) => l.includes("E1257") && (routeId === undefined || l.includes(routeId)));

/** What a MutationObserver saw: the nodes removed and added under the observed root. */
export type Seen = { readonly removed: readonly Node[]; readonly added: readonly Node[] };

/** Runs `run` with a MutationObserver on `root` (`childList`, `subtree`) and returns what it recorded while `run` ran. */
export function observed<T>(root: Node, run: () => T): { readonly result: T; readonly seen: Seen } {
  const removed: Node[] = [];
  const added: Node[] = [];
  const observer = new MutationObserver(() => undefined);
  observer.observe(root, { childList: true, subtree: true });
  try {
    const result = run();
    for (const record of observer.takeRecords()) {
      removed.push(...record.removedNodes);
      added.push(...record.addedNodes);
    }
    return { result, seen: { removed, added } };
  } finally {
    observer.disconnect();
  }
}

const isRegionComment = (n: Node): boolean => n.nodeType === 8 && (n.nodeValue === "[" || n.nodeValue === "]");

/** The elements and region comments among `nodes`: what resume may not remove. */
export const structural = (nodes: readonly Node[]): Node[] =>
  nodes.filter((n) => n.nodeType === 1 || isRegionComment(n));

/** The elements among `nodes`: what resume may not add. */
export const elementsIn = (nodes: readonly Node[]): Node[] => nodes.filter((n) => n.nodeType === 1);

/** For each region under `root` in document order, the elements between its comments (a nested region's elements count in both). */
export function regionElements(root: Node): Element[][] {
  const out: Element[][] = [];
  const open: Element[][] = [];
  const walk = (n: Node): void => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 8 && c.nodeValue === "[") {
        const list: Element[] = [];
        out.push(list);
        open.push(list);
      } else if (c.nodeType === 8 && c.nodeValue === "]") {
        open.pop();
      } else if (c instanceof Element) {
        for (const list of open) list.push(c);
        walk(c);
      }
    }
  };
  walk(root);
  return out;
}
