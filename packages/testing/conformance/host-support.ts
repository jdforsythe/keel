// Lives in @keel/testing: it needs @keel/ctx and the runtime together; the element is @keel/ui's.
// Shared helpers for the k.host-element conformance (not a test file). Public API only. Seed: 1337.
// Assumed: a direct call `Host({ id, role, label, input, value, code, events?, onEvent? })` takes `value` as a plain value, a signal or a computed (as `Part` does for its ARIA props), `code` as a function returning a `HostCode` or a promise of one, and reads the ctx `mount` passes to its root component.
// Frames: `requestAnimationFrame` and `cancelAnimationFrame` are replaced by a manual queue, so no timer runs; `frames.step()` runs the callbacks queued at that moment.
import { createCtx } from "@keel/ctx";
import { hostCode } from "@keel/ui";
import { s } from "@keel/schema";
import { vi } from "vitest";

export const SEED = 1337;
export const simCtx = () => createCtx({ mode: "sim", seed: SEED });

export const Points = s.object({ points: s.array(s.number()) });
export type PointsValue = { readonly points: readonly number[] };
export const Pick = s.object({ at: s.number() });

export const frames = () => {
  let next = 1;
  const queue = new Map<number, () => void>();
  vi.stubGlobal("requestAnimationFrame", (cb: () => void): number => {
    const id = next++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
    queue.delete(id);
  });
  return {
    pending: (): number => queue.size,
    step: (): number => {
      const now = [...queue.entries()];
      queue.clear();
      for (const [, cb] of now) cb();
      return now.length;
    },
  };
};

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** A `HostCode` that records every call. */
export const probe = () => {
  const log: {
    mounts: { node: HTMLElement; value: PointsValue }[];
    updates: { value: PointsValue; prev: PointsValue }[];
    disposes: number;
    signals: AbortSignal[];
    outs: { emit(e: { at: number }): void }[];
  } = { mounts: [], updates: [], disposes: 0, signals: [], outs: [] };
  const code = hostCode({
    mount(node: HTMLElement, value: PointsValue, out: { emit(e: { at: number }): void; signal: AbortSignal }) {
      log.mounts.push({ node, value });
      log.signals.push(out.signal);
      log.outs.push(out);
      return { n: 0 };
    },
    update(_state: { n: number }, value: PointsValue, prev: PointsValue) {
      log.updates.push({ value, prev });
    },
    dispose() {
      log.disposes += 1;
    },
  });
  return { log, code };
};
