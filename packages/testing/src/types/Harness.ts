import type { Ctx, SimCtx } from "@keel/ctx";
import type { Store } from "@keel/store";
import type { A11yNode } from "./A11yNode.ts";
import type { Found } from "./Found.ts";
import type { TestEvent } from "./TestEvent.ts";

/**
 * A rendered component. Every element is addressed by id; nothing returns a DOM node. `C` is the type of its ctx: the
 * sim ctx made for it (`SimCtx`, the default, so a test drives `ctx.clock` and `ctx.net`), else the given one's.
 */
export interface Harness<C extends Ctx = SimCtx> {
  /** The ctx the component, or a route handle's app, runs on: the one given as `ctx`, else the sim ctx made for it. */
  readonly ctx: C;
  /** The a11y tree of the render (top-level nodes), or the node with `id`. */
  a11y(): readonly A11yNode[];
  a11y(id: string): A11yNode;
  /** Every live store's value keyed by store id, or one store's value. */
  state(): Readonly<Record<string, unknown>>;
  state<T>(store: Store<T>): T;
  /** Dispatch `event` on the element with `id`; resolves once triggered work has settled. */
  fire(id: string, event: TestEvent): Promise<void>;
  /** Wait, without an event or timers, until DOM and store logs are quiet (e.g. after a resource resolves). */
  settle(): Promise<void>;
  find(id: string): Found;
  /** The ids of focusable elements in sequential focus order, without disabled or hidden ones (k.a11y). */
  focusOrder(): readonly string[];
  /** Unmount and free every binding, listener, and subscription. Idempotent. */
  dispose(): void;
}
