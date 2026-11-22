import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import type { Island } from "../types/Island.ts";
import type { Claim } from "./Claim.ts";
import type { Held } from "./Held.ts";
import { Mismatch } from "./Mismatch.ts";
import { createOwner } from "./createOwner.ts";
import { createRoot } from "./createRoot.ts";
import { disposeOwner } from "./disposeOwner.ts";
import { eventQueue } from "./eventQueue.ts";
import { harnessed } from "./harnessed.ts";
import { made } from "./made.ts";
import { nodesOf } from "./nodesOf.ts";
import { replaced } from "./replaced.ts";
import { report } from "./report.ts";
import { rootCatcher } from "./rootCatcher.ts";
import { salvage } from "./salvage.ts";
import { stampOf } from "./stampOf.ts";
import { withCx } from "./withCx.ts";

const FOCUS = ["focus", "blur", "focusin", "focusout"];

/**
 * Resume one island: run its component with `clone` claiming the server nodes, so bindings and handlers
 * attach in place. On a structural mismatch (E1253) undo that, re-render it client-side in place of the
 * server element, and return the warning. Queued pre-resume events wait for `resume` to replay them (`eventQueue`);
 * those in a re-rendered island's own nodes are dropped. The island has the root Boundary `mount` gives its tree (k.errors): it catches handler, binding
 * and render throws and, through the island scope's `onError`, the island's own `effect` and `computed` throws
 * (`data.at` the stamp at the island's place). It is armed once the claim succeeds, so a throw while claiming is a mismatch.
 * `held` is the island's child-level content (k.resume): its `children` counts calls while the island builds. A
 * client re-render takes the held content out of the server element first, so its `children` returns those nodes,
 * and its new nodes are what `replaced` gives for the server element.
 * `waiting` holds the `#k-state` snapshots no store took yet (k.resume Stores): a store the claim creates takes its
 * snapshot from it, and a claim that mismatches gives back what its stores took, so the re-render's stores start from them.
 */
export function resumeIsland(
  el: Element,
  id: string,
  component: Island,
  props: Record<string, unknown>,
  held: Held,
  ctx: Ctx,
  mode?: "dev" | "production",
  waiting: Map<string, unknown> = new Map(),
): string | null {
  const doc = el.ownerDocument;
  const focused = doc.activeElement;
  const queued = eventQueue.pending();
  const offered = new Map(waiting);
  const root = createRoot(el, ctx, mode);
  // `data.at` of a throw at no element of its own (the component's effect, computed or render): the stamp at the
  // island's place, as `mount` uses its element's (k.errors).
  const rootAt = stampOf(el.parentNode);
  // The island's root Boundary (k.errors): a throw after the claim reports to the ctx and swaps the island for the
  // root fallback, as under `mount`. `live` holds the island's nodes the fallback replaces and how to tear it down.
  const live: { nodes: ChildNode[]; teardown: () => void } = { nodes: [el], teardown: () => undefined };
  const catcher = rootCatcher(ctx, mode, (fallback) => {
    live.teardown();
    const [head, ...rest] = live.nodes;
    head?.replaceWith(fallback);
    for (const n of rest) n.remove();
  });
  const owner = createOwner(null, root, catcher);
  const claim: Claim = { island: el, region: null, session: { failed: null, shadowed: [] } };
  const rendered: { node: Node | null; scope: Scope | null } = { node: null, scope: null };
  // A claimed node moved through a fragment loses focus. The focus events of those moves and of giving
  // the focus back reach no handler, and the queue drops them: the user did not move the focus.
  const hush = (e: Event): void => e.stopImmediatePropagation();
  for (const t of FOCUS) doc.addEventListener(t, hush, true);
  held.calls = 0;
  try {
    try {
      rendered.scope = scope(
        () => {
          rendered.node = withCx(owner, claim, () => component(props, ctx));
        },
        { onError: (error) => report(owner, error, rootAt) },
      );
    } catch (error) {
      // Any throw while claiming is a mismatch: the client re-render below shows a real app error. The thrown text can
      // carry data, so the warning holds it only in dev, as the root fallback does (k.errors), and in a test harness,
      // whose ctx is no production one: there the warning is the test's failure, and its cause is what the author needs.
      const shown = mode === "dev" || harnessed().has(ctx);
      claim.session.failed ??=
        error instanceof Mismatch
          ? error
          : new Mismatch(shown ? `the claim threw ${String(error)}` : "the claim threw");
    }
    if (claim.session.failed === null && rendered.node !== el)
      claim.session.failed = new Mismatch("the component did not render the island root");
    if (focused instanceof HTMLElement && focused !== doc.activeElement && focused.isConnected)
      focused.focus({ preventScroll: true });
  } finally {
    held.calls = -1;
    for (const e of claim.session.shadowed) Reflect.deleteProperty(e, "childNodes");
    for (const t of FOCUS) doc.removeEventListener(t, hush, true);
    eventQueue.drop(queued);
  }
  const failed = claim.session.failed;
  if (failed === null) {
    held.nodes ??= [];
    live.teardown = () => {
      disposeOwner(owner);
      rendered.scope?.dispose();
      root.dispose();
    };
    catcher.arm();
    eventQueue.resume(el, el, root.tell);
    return null;
  }
  disposeOwner(owner);
  rendered.scope?.dispose();
  root.dispose();
  for (const [key, snapshot] of offered) if (!waiting.has(key)) waiting.set(key, snapshot);
  held.nodes ??= salvage(el);
  for (const n of nodesOf(held.nodes)) n.parentNode?.removeChild(n);
  const fresh = createRoot(null, ctx, mode);
  const freshOwner = createOwner(null, fresh, catcher);
  const client: { node: Node | null; scope: Scope | null } = { node: null, scope: null };
  live.teardown = () => {
    disposeOwner(freshOwner);
    client.scope?.dispose();
    fresh.dispose();
  };
  catcher.arm();
  held.calls = 0;
  // The client render checks make-before-place: an element made before the op placing it names the cause.
  const was = made.on;
  made.on = true;
  made.from = made.seq;
  made.eager = false;
  const cause = (): string => (made.eager ? "; an element was made before its parent" : "");
  try {
    client.scope = scope(
      () => {
        client.node = withCx(freshOwner, null, () => component(props, ctx));
      },
      { onError: (error) => report(freshOwner, error, rootAt) },
    );
  } catch (error) {
    // The client render threw: the island's root Boundary shows it in place of the server element, whose queued
    // events are dropped.
    held.calls = -1;
    made.on = was;
    catcher.fail(error, rootAt);
    eventQueue.resume(el, null);
    return `E1253 [data-k-island="${id}"] ${failed.message}; re-rendered on the client${cause()}`;
  }
  held.calls = -1;
  made.on = was;
  const n = client.node;
  if (n !== null) {
    const host = n instanceof Element ? n : el.parentElement;
    // The root fallback replaces what the island rendered: an empty fragment leaves a marker in its place.
    if (n instanceof DocumentFragment && n.firstChild === null) n.append(doc.createComment(""));
    const nodes: ChildNode[] =
      n instanceof DocumentFragment ? [...n.childNodes] : n instanceof Element || n instanceof CharacterData ? [n] : [];
    el.replaceWith(n);
    replaced.set(el, nodes);
    if (nodes.length > 0) live.nodes = nodes;
    if (host !== null) {
      fresh.attach(host);
      eventQueue.root(host, fresh.tell);
    }
    // The client-rendered root is live: never queue its events.
    if (n instanceof Element) eventQueue.resume(n, null);
  }
  eventQueue.resume(el, null);
  return `E1253 [data-k-island="${id}"] ${failed.message}; re-rendered on the client${cause()}`;
}
