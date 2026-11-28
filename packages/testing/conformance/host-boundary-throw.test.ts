// @vitest-environment happy-dom
// Spec: k.host-element, clause "A throw from `mount` renders the nearest `Boundary`'s fallback with `data.at` the element's id."
// k.host-code, Events "A throw from `code`, `mount`, `update`, `onEvent` or an `emit` that fails `events` is caught by the nearest `Boundary` (`data.at` the element's id); a throw from `dispose` is reported to the ctx and dropped."
// Seed: 1337.
import { Boundary, mount } from "@keel/runtime-dom";
import { Host, hostCode } from "@keel/ui";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, host, signal } from "./host-dom.ts";
import { Points, type PointsValue, flush, frames, probe, simCtx } from "./host-support.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const caught = (e: unknown): string =>
  typeof e === "object" && e !== null && "data" in e && typeof e.data === "object" && e.data !== null && "at" in e.data
    ? String(e.data.at)
    : "";

const guarded =
  (
    code: Parameters<typeof Host>[0]["code"],
    value: PointsValue | ReturnType<typeof signal<PointsValue>>,
    seen: string[],
  ) =>
  (): Node =>
    Boundary({
      children: () => Host({ id: "h.chart", role: "img", label: "Chart", input: Points, value, code }),
      fallback: (e: unknown) => {
        seen.push(caught(e));
        const p = document.createElement("p");
        p.id = "h.fell";
        return p;
      },
    });

describe("k.host-element: throws reach the nearest Boundary", () => {
  test("A throw from `mount` renders the nearest `Boundary`'s fallback with `data.at` the element's id", async () => {
    const f = frames();
    const code = hostCode({
      mount: (): object => {
        throw new Error("mount failed");
      },
    });
    const seen: string[] = [];
    const root = host();
    mount(
      guarded(() => Promise.resolve(code), { points: [1] }, seen),
      root,
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    await flush();
    expect(root.querySelector("#h\\.fell")).not.toBeNull();
    expect(seen).toEqual(["h.chart"]);
  });

  test("A throw from `code` (a rejected import) renders the fallback with `data.at` the element's id", async () => {
    const f = frames();
    const seen: string[] = [];
    const root = host();
    mount(
      guarded(() => Promise.reject(new Error("import failed")), { points: [1] }, seen),
      root,
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    await flush();
    expect(root.querySelector("#h\\.fell")).not.toBeNull();
    expect(seen).toEqual(["h.chart"]);
  });

  test("A throw from `update` renders the fallback with `data.at` the element's id", async () => {
    const f = frames();
    const code = hostCode({
      mount: (): object => ({}),
      update: (): void => {
        throw new Error("update failed");
      },
    });
    const sig = signal<PointsValue>({ points: [1] });
    const seen: string[] = [];
    const root = host();
    mount(
      guarded(() => Promise.resolve(code), sig, seen),
      root,
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    sig.set({ points: [2] });
    await flush();
    f.step();
    await flush();
    expect(root.querySelector("#h\\.fell")).not.toBeNull();
    expect(seen).toEqual(["h.chart"]);
  });

  test("a mounted element that throws nothing leaves the Boundary's children in place", async () => {
    const f = frames();
    const { code } = probe();
    const seen: string[] = [];
    const root = host();
    mount(
      guarded(() => Promise.resolve(code), { points: [1] }, seen),
      root,
      { ctx: simCtx() },
    );
    await flush();
    f.step();
    await flush();
    expect(root.querySelector("[data-k-host]")).not.toBeNull();
    expect(seen).toEqual([]);
  });
});
