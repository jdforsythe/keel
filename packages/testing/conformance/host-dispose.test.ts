// @vitest-environment happy-dom
// Spec: k.host-element, Conformance "Removing the element through an `If` calls `dispose` once and aborts `signal`; removing it before the import resolves calls neither `mount` nor `dispose`."
// Spec: k.host-element, Lifecycle "Disposing the element's scope (an `If`, a `For` row, a navigation) cancels a pending frame, calls `dispose` if `mount` ran and removes the node; `mount` never runs after it."
// Spec: k.host-code, Code "`dispose(state)`: runs once, then `signal` aborts."
// Spec: k.host-code, Events "a throw from `dispose` is reported to the ctx and dropped."
// Seed: 1337.
import { observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { If, mount } from "@keel/runtime-dom";
import { Host, hostCode } from "@keel/ui";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Points, flush, frames, probe, simCtx } from "./host-support.ts";
import { cleanup, host, signal } from "./host-dom.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const element = (code: Parameters<typeof Host>[0]["code"]): Node =>
  Host({ id: "h.chart", role: "img", label: "Chart", input: Points, value: { points: [1] }, code });

describe("k.host-element: dispose", () => {
  test("Removing the element through an `If` calls `dispose` once and aborts `signal`", async () => {
    const f = frames();
    const { log, code } = probe();
    const on = signal(true);
    const root = host();
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () => element(() => Promise.resolve(code)),
        }),
      root,
    );
    await flush();
    f.step();
    expect(log.mounts).toHaveLength(1);
    expect(log.signals[0]?.aborted).toBe(false);
    on.set(false);
    await flush();
    expect(log.disposes).toBe(1);
    expect(log.signals[0]?.aborted).toBe(true);
    expect(root.querySelector("[data-k-host]")).toBeNull();
    f.step();
    expect(log.disposes).toBe(1);
  });

  test("`signal` is aborted after `dispose` has run, not before", async () => {
    const f = frames();
    const order: string[] = [];
    const code = hostCode({
      mount(_node: HTMLElement, _value: { points: readonly number[] }, out: { signal: AbortSignal }) {
        out.signal.addEventListener("abort", () => order.push("abort"));
        return {};
      },
      dispose() {
        order.push("dispose");
      },
    });
    const on = signal(true);
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () => element(() => Promise.resolve(code)),
        }),
      host(),
    );
    await flush();
    f.step();
    on.set(false);
    await flush();
    expect(order).toEqual(["dispose", "abort"]);
  });

  test("Removing it before the import resolves calls neither `mount` nor `dispose`", async () => {
    const f = frames();
    const { log, code } = probe();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const on = signal(true);
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () => element(() => gate.then(() => code)),
        }),
      host(),
    );
    on.set(false);
    await flush();
    release();
    await flush();
    f.step();
    expect(log.mounts).toEqual([]);
    expect(log.disposes).toBe(0);
  });

  test("Removing it after the import resolves and before the frame cancels the pending frame: `mount` never runs", async () => {
    const f = frames();
    const { log, code } = probe();
    const on = signal(true);
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () => element(() => Promise.resolve(code)),
        }),
      host(),
    );
    await flush();
    on.set(false);
    await flush();
    f.step();
    expect(log.mounts).toEqual([]);
    expect(log.disposes).toBe(0);
    expect(f.pending()).toBe(0);
  });

  test("a throw from `dispose` is reported to the ctx and dropped", async () => {
    const f = frames();
    const code = hostCode({
      mount: () => ({}),
      dispose() {
        throw new Error("dispose failed");
      },
    });
    const ctx = simCtx();
    const seen: CtxEvent[] = [];
    observe(ctx, (e) => seen.push(e));
    const on = signal(true);
    const root = host();
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () => element(() => Promise.resolve(code)),
        }),
      root,
      { ctx },
    );
    await flush();
    f.step();
    on.set(false);
    await flush();
    expect(root.querySelector("[data-k-host]")).toBeNull();
    expect(seen.filter((e) => e.kind === "error")).toHaveLength(1);
  });
});
