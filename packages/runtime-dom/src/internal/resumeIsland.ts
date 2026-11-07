import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import type { Island } from "../types/Island.ts";
import type { Claim } from "./Claim.ts";
import { Mismatch } from "./Mismatch.ts";
import { createOwner } from "./createOwner.ts";
import { createRoot } from "./createRoot.ts";
import { disposeOwner } from "./disposeOwner.ts";
import { eventQueue } from "./eventQueue.ts";
import { withCx } from "./withCx.ts";

const FOCUS = ["focus", "blur", "focusin", "focusout"];

/**
 * Resume one island: run its component with `clone` claiming the server nodes, so bindings and handlers
 * attach in place. On a structural mismatch (E1253) undo that, re-render it client-side in place of the
 * server element, and return the warning. Queued pre-resume events are replayed once, in order.
 */
export function resumeIsland(
  el: Element,
  id: string,
  component: Island,
  props: Record<string, unknown>,
  ctx: Ctx | undefined,
): string | null {
  const doc = el.ownerDocument;
  const focused = doc.activeElement;
  const queued = eventQueue.pending();
  const root = createRoot(el);
  const owner = createOwner(null, root, null);
  const claim: Claim = { island: el, region: null, session: { failed: null } };
  const rendered: { node: Node | null; scope: Scope | null } = { node: null, scope: null };
  // A claimed node moved through a fragment loses focus (rfc:0064). The focus events of those moves and of giving
  // the focus back reach no handler, and the queue drops them: the user did not move the focus.
  const hush = (e: Event): void => e.stopImmediatePropagation();
  for (const t of FOCUS) doc.addEventListener(t, hush, true);
  try {
    try {
      rendered.scope = scope(() => {
        rendered.node = withCx(owner, claim, () => component(props, undefined, ctx));
      });
    } catch (error) {
      // Any throw while claiming is a mismatch (backlog 0184): the client re-render below shows a real app error.
      claim.session.failed ??= error instanceof Mismatch ? error : new Mismatch(`the claim threw ${String(error)}`);
    }
    if (claim.session.failed === null && rendered.node !== el)
      claim.session.failed = new Mismatch("the component did not render the island root");
    if (focused instanceof HTMLElement && focused !== doc.activeElement && focused.isConnected)
      focused.focus({ preventScroll: true });
  } finally {
    for (const t of FOCUS) doc.removeEventListener(t, hush, true);
    eventQueue.drop(queued);
  }
  const failed = claim.session.failed;
  if (failed === null) {
    eventQueue.resume(el, el);
    return null;
  }
  disposeOwner(owner);
  rendered.scope?.dispose();
  root.dispose();
  const fresh = createRoot(null);
  const freshOwner = createOwner(null, fresh, null);
  const client: { node: Node | null } = { node: null };
  scope(() => {
    client.node = withCx(freshOwner, null, () => component(props, undefined, ctx));
  });
  const n = client.node;
  if (n !== null) {
    const host = n instanceof Element ? n : el.parentElement;
    el.replaceWith(n);
    if (host !== null) fresh.attach(host);
    // The client-rendered root is live: never queue its events.
    if (n instanceof Element) eventQueue.resume(n, null);
  }
  eventQueue.resume(el, null);
  return `E1253 [data-k-island="${id}"] ${failed.message}; re-rendered on the client`;
}
