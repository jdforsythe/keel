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
  const root = createRoot(el);
  const owner = createOwner(null, root, null);
  const claim: Claim = { island: el, region: null, session: { failed: null } };
  const rendered: { node: Node | null; scope: Scope | null } = { node: null, scope: null };
  try {
    rendered.scope = scope(() => {
      rendered.node = withCx(owner, claim, () => component(props, undefined, ctx));
    });
  } catch (error) {
    if (!(error instanceof Mismatch)) throw error;
    claim.session.failed ??= error;
  }
  if (claim.session.failed === null && rendered.node !== el)
    claim.session.failed = new Mismatch("the component did not render the island root");
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
